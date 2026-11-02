-- Página do formando: pagamento em dois passos, pagamento herdado e pedidos de correcção
-- Microlegal Certificados. Aplicar DEPOIS de 20261029000000_pagamento_certificados.sql.
--
--   1. Pagamento em dois passos: o backend regista o pedido («pendente») e
--      responde logo; a confirmação chega depois (resposta do fornecedor).
--      Um pedido sem resposta em 3 minutos conta como falhado.
--   2. Pagamento herdado: se a instituição anular um certificado pago (para
--      corrigir dados) e emitir outro para o mesmo formando no mesmo curso, o
--      novo nasce pago. Cada pagamento passa uma só vez.
--   3. Pedidos de correcção: o formando avisa a instituição de um erro nos
--      dados, a partir do seu link. Enquanto houver um pedido aberto não pode
--      pagar. O pedido fecha-se ao anular o certificado ou quando a instituição
--      confirma que os dados estão correctos.

-- 1) Pagamentos: no máximo um pendente por certificado ---------------------------------------
-- Pendentes antigos (de antes do pagamento em dois passos) ficam como falhados;
-- de cada certificado fica no máximo o pendente mais recente.
update public.pagamentos p
   set estado = 'falhado', erro = coalesce(p.erro, 'Sem confirmação no telemóvel.')
 where p.estado = 'pendente'
   and (p.criado_em < now() - interval '3 minutes'
        or exists (
          select 1 from public.pagamentos q
          where q.certificado_id = p.certificado_id and q.estado = 'pendente' and q.criado_em > p.criado_em
        ));
create unique index if not exists pagamentos_um_pendente_uidx
  on public.pagamentos (certificado_id) where estado = 'pendente';

-- 2) Pagamento herdado ---------------------------------------------------------------------------
alter table public.certificados
  add column if not exists pago_herdado_de uuid references public.certificados (id) on delete restrict;
-- Cada certificado pago passa o pagamento no máximo a um certificado novo.
create unique index if not exists certificados_pago_herdado_uidx
  on public.certificados (pago_herdado_de) where pago_herdado_de is not null;

create or replace function public.preparar_certificado()
returns trigger
language plpgsql
as $$
declare
  v_origem uuid;
  v_pago timestamptz;
begin
  if new.acesso_token is null then
    new.acesso_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  end if;
  new.taxa_valor := public.taxa_certificado(new.tipo);

  -- O último certificado pago e anulado deste formando neste curso, se ainda
  -- não tiver passado o pagamento a outro.
  if new.pago_em is null then
    select c.id, c.pago_em into v_origem, v_pago
      from public.certificados c
     where c.curso_id = new.curso_id
       and c.formando_id = new.formando_id
       and c.estado = 'anulado'
       and c.pago_em is not null
     order by c.anulado_em desc nulls last, c.emitido_em desc
     limit 1;
    if v_origem is not null
       and not exists (select 1 from public.certificados x where x.pago_herdado_de = v_origem) then
      new.pago_em := v_pago;
      new.pago_herdado_de := v_origem;
    end if;
  end if;
  return new;
end;
$$;

-- Pagamento confirmado de um certificado, seguindo a cadeia de pagamentos herdados.
create or replace function public.pagamento_do_certificado(p_certificado_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive cadeia as (
    select c.id, c.pago_herdado_de, 0 as nivel
      from public.certificados c
     where c.id = p_certificado_id
    union all
    select c.id, c.pago_herdado_de, k.nivel + 1
      from public.certificados c
      join cadeia k on c.id = k.pago_herdado_de
     where k.nivel < 50
  )
  select p.id
    from public.pagamentos p
    join cadeia k on k.id = p.certificado_id
   where p.estado = 'pago'
   order by k.nivel
   limit 1;
$$;

-- 3) Pedidos de correcção ------------------------------------------------------------------------
create table if not exists public.pedidos_correcao (
  id uuid primary key default gen_random_uuid(),
  certificado_id uuid not null references public.certificados (id) on delete restrict,
  mensagem text not null check (char_length(btrim(mensagem)) between 5 and 1000),
  estado text not null default 'aberto' check (estado in ('aberto', 'resolvido')),
  -- anulado: a instituição anulou o certificado para o corrigir;
  -- dados_correctos: a instituição confirmou que não há erro.
  resolucao text check (resolucao in ('anulado', 'dados_correctos')),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create unique index if not exists pedidos_correcao_um_aberto_uidx
  on public.pedidos_correcao (certificado_id) where estado = 'aberto';

-- Leitura: a instituição dona do certificado e o admin. Escrita: só pelas funções abaixo.
alter table public.pedidos_correcao enable row level security;
revoke all on public.pedidos_correcao from anon, authenticated;
grant select on public.pedidos_correcao to authenticated;

drop policy if exists "pedidos_correcao_select_own" on public.pedidos_correcao;
drop policy if exists "pedidos_correcao_admin_select" on public.pedidos_correcao;
create policy "pedidos_correcao_select_own"
  on public.pedidos_correcao for select to authenticated
  using (exists (
    select 1 from public.certificados c
    where c.id = pedidos_correcao.certificado_id and c.user_id = auth.uid()
  ));
create policy "pedidos_correcao_admin_select"
  on public.pedidos_correcao for select to authenticated
  using (public.is_admin());

-- Pedido do formando (link privado, sem sessão).
create or replace function public.pedir_correcao(p_token text, p_mensagem text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert public.certificados%rowtype;
  v_mensagem text := btrim(coalesce(p_mensagem, ''));
  v_pedido public.pedidos_correcao%rowtype;
begin
  select * into v_cert from public.certificados where acesso_token = p_token for update;
  if not found then
    raise exception 'Certificado não encontrado.';
  end if;
  if v_cert.estado <> 'emitido' then
    raise exception 'Este certificado foi anulado pela instituição.';
  end if;
  if char_length(v_mensagem) < 5 then
    raise exception 'Descreva o erro (mín. 5 caracteres).';
  end if;
  if exists (select 1 from public.pedidos_correcao where certificado_id = v_cert.id and estado = 'aberto') then
    raise exception 'Já enviou um pedido de correcção. Aguarde a resposta da instituição.';
  end if;

  insert into public.pedidos_correcao (certificado_id, mensagem)
  values (v_cert.id, left(v_mensagem, 1000))
  returning * into v_pedido;

  return jsonb_build_object('mensagem', v_pedido.mensagem, 'criado_em', v_pedido.criado_em);
end;
$$;

-- A instituição confirma que os dados estão correctos (o formando pode pagar).
create or replace function public.resolver_correcao(p_certificado_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;
  select c.user_id into v_owner from public.certificados c where c.id = p_certificado_id;
  if v_owner is null or (v_owner is distinct from auth.uid() and public.is_admin() is not true) then
    raise exception 'Certificado não encontrado.';
  end if;
  update public.pedidos_correcao
     set estado = 'resolvido', resolucao = 'dados_correctos', resolvido_em = now()
   where certificado_id = p_certificado_id and estado = 'aberto';
  if not found then
    raise exception 'Não há pedido de correcção em aberto para este certificado.';
  end if;
end;
$$;

-- Anular o certificado fecha o pedido: a correcção segue num certificado novo.
create or replace function public.resolver_correcao_ao_anular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pedidos_correcao
     set estado = 'resolvido', resolucao = 'anulado', resolvido_em = now()
   where certificado_id = new.id and estado = 'aberto';
  return new;
end;
$$;

drop trigger if exists trg_certificados_resolver_correcao on public.certificados;
create trigger trg_certificados_resolver_correcao
  after update of estado on public.certificados
  for each row
  when (old.estado = 'emitido' and new.estado = 'anulado')
  execute function public.resolver_correcao_ao_anular();

-- 4) Página do formando: contacto da instituição, pagamento e pedido de correcção ----------------
-- pagamento: o confirmado (comprovativo) se estiver pago; senão, o último pedido.
-- Um pendente com mais de 3 minutos é mostrado como falhado.
create or replace function public.certificado_por_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', c.codigo,
    'tipo', c.tipo,
    'modelo', c.modelo,
    'formando_nome', c.formando_nome,
    'curso_nome', c.curso_nome,
    'carga_horaria', c.carga_horaria,
    'data_abertura', c.data_abertura,
    'data_encerramento', c.data_encerramento,
    'nota', c.nota,
    'emissor_nome', c.emissor_nome,
    'emissor_telefone', pr.phone,
    'emissor_email', pr.email,
    'logo_path', c.logo_path,
    'assinatura_path', c.assinatura_path,
    'responsavel_nome', c.responsavel_nome,
    'responsavel_cargo', c.responsavel_cargo,
    'estado', c.estado,
    'emitido_em', c.emitido_em,
    'anulado_em', c.anulado_em,
    'pago', c.pago_em is not null,
    'pago_em', c.pago_em,
    'pagamento_herdado', c.pago_herdado_de is not null,
    'taxa_valor', c.taxa_valor,
    'pagamento', (
      select jsonb_build_object(
        'estado', case
          when p.estado = 'pendente' and p.criado_em < now() - interval '3 minutes' then 'falhado'
          else p.estado
        end,
        'erro', case
          when p.estado = 'pendente' and p.criado_em < now() - interval '3 minutes'
            then 'Sem confirmação no telemóvel a tempo.'
          else p.erro
        end,
        'referencia', p.referencia,
        'metodo', p.metodo,
        'valor', p.valor,
        'telefone', left(p.telefone, 2) || ' *** ' || right(p.telefone, 4),
        'criado_em', p.criado_em,
        'actualizado_em', p.actualizado_em
      )
      from public.pagamentos p
      where case
        when c.pago_em is not null then p.id = public.pagamento_do_certificado(c.id)
        else p.certificado_id = c.id
      end
      order by p.criado_em desc
      limit 1
    ),
    'correcao', (
      select jsonb_build_object('mensagem', pc.mensagem, 'criado_em', pc.criado_em)
      from public.pedidos_correcao pc
      where pc.certificado_id = c.id and pc.estado = 'aberto'
    )
  )
  from public.certificados c
  left join public.profiles pr on pr.id = c.user_id
  where c.acesso_token = p_token;
$$;

revoke all on function public.pagamento_do_certificado(uuid) from public, anon, authenticated;
revoke all on function public.pedir_correcao(text, text) from public;
grant execute on function public.pedir_correcao(text, text) to anon, authenticated;
revoke all on function public.resolver_correcao(uuid) from public, anon;
grant execute on function public.resolver_correcao(uuid) to authenticated;
revoke all on function public.resolver_correcao_ao_anular() from public, anon, authenticated;
revoke all on function public.certificado_por_token(text) from public;
grant execute on function public.certificado_por_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
