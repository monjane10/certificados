-- Pagamento da taxa do certificado pelo formando - Microlegal Certificados
-- Aplicar DEPOIS de 20261028000005_encerrar_e_emitir.sql.
--
-- Fluxo:
--   1. Emitir: cada certificado recebe um link privado (acesso_token) e a taxa
--      do seu tipo (participação 100 MT, técnico-profissional 150 MT).
--   2. A instituição envia o link ao formando pelo seu próprio WhatsApp
--      (registado em whatsapp_enviado_em).
--   3. O formando abre o link, vê uma pré-visualização e paga por M-Pesa ou
--      e-Mola. O dinheiro é recebido pela Microlegal.
--   4. Pagamento confirmado (pago_em): o certificado fica desbloqueado e a
--      verificação pública passa a mostrá-lo como válido. Até lá mostra só
--      «pendente de pagamento», sem os dados do formando.
--
-- Os pagamentos são escritos só pelo backend com a chave de serviço
-- (service_role): nem o formando nem a instituição podem marcar «pago».

-- 1) Taxa por tipo (fonte única na BD) ------------------------------------------------
create or replace function public.taxa_certificado(p_tipo text)
returns integer
language sql
immutable
as $$
  select case p_tipo when 'participacao' then 100 when 'tecnico_profissional' then 150 end;
$$;

-- 2) Certificados: link privado, taxa, pagamento e envio ---------------------------------
alter table public.certificados
  add column if not exists acesso_token text,
  add column if not exists taxa_valor integer,
  add column if not exists pago_em timestamptz,
  add column if not exists whatsapp_enviado_em timestamptz;

-- Token: 64 caracteres hexadecimais (dois UUID aleatórios), impossível de adivinhar.
update public.certificados
   set acesso_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where acesso_token is null;
update public.certificados set taxa_valor = public.taxa_certificado(tipo) where taxa_valor is null;

alter table public.certificados alter column acesso_token set not null;
alter table public.certificados alter column taxa_valor set not null;
create unique index if not exists certificados_acesso_token_uidx on public.certificados (acesso_token);

create or replace function public.preparar_certificado()
returns trigger
language plpgsql
as $$
begin
  if new.acesso_token is null then
    new.acesso_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  end if;
  new.taxa_valor := public.taxa_certificado(new.tipo);
  return new;
end;
$$;

drop trigger if exists trg_certificados_preparar on public.certificados;
create trigger trg_certificados_preparar
  before insert on public.certificados
  for each row execute function public.preparar_certificado();

-- 3) Pagamentos -----------------------------------------------------------------------------
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  certificado_id uuid not null references public.certificados (id) on delete restrict,
  metodo text not null check (metodo in ('mpesa', 'emola')),
  telefone text not null check (telefone ~ '^8[4-7][0-9]{7}$'),
  valor integer not null check (valor > 0),
  estado text not null default 'pendente' check (estado in ('pendente', 'pago', 'falhado')),
  referencia text not null unique,
  fornecedor text not null,
  fornecedor_ref text,
  erro text,
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

create index if not exists pagamentos_certificado_idx on public.pagamentos (certificado_id, criado_em desc);
-- No máximo um pagamento confirmado por certificado.
create unique index if not exists pagamentos_um_pago_uidx on public.pagamentos (certificado_id) where estado = 'pago';

drop trigger if exists trg_pagamentos_updated_at on public.pagamentos;
create or replace function public.pagamentos_touch()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_em := now();
  return new;
end;
$$;
create trigger trg_pagamentos_updated_at
  before update on public.pagamentos
  for each row execute function public.pagamentos_touch();

-- Leitura: a instituição dona do certificado e o admin. Escrita: só service_role.
alter table public.pagamentos enable row level security;
revoke all on public.pagamentos from anon, authenticated;
grant select on public.pagamentos to authenticated;

drop policy if exists "pagamentos_select_own" on public.pagamentos;
drop policy if exists "pagamentos_admin_select" on public.pagamentos;
create policy "pagamentos_select_own"
  on public.pagamentos for select to authenticated
  using (exists (
    select 1 from public.certificados c
    where c.id = pagamentos.certificado_id and c.user_id = auth.uid()
  ));
create policy "pagamentos_admin_select"
  on public.pagamentos for select to authenticated
  using (public.is_admin());

-- 4) Página do formando (link privado, sem sessão) -----------------------------------------
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
    'logo_path', c.logo_path,
    'assinatura_path', c.assinatura_path,
    'responsavel_nome', c.responsavel_nome,
    'responsavel_cargo', c.responsavel_cargo,
    'estado', c.estado,
    'emitido_em', c.emitido_em,
    'anulado_em', c.anulado_em,
    'pago', c.pago_em is not null,
    'taxa_valor', c.taxa_valor
  )
  from public.certificados c
  where c.acesso_token = p_token;
$$;

-- 5) Verificação pública: sem pagamento, só «pendente» (sem dados do formando) ----------------
create or replace function public.verificar_certificado(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.pago_em is null then jsonb_build_object(
      'codigo', c.codigo,
      'tipo', c.tipo,
      'curso_nome', c.curso_nome,
      'emissor_nome', c.emissor_nome,
      'estado', c.estado,
      'emitido_em', c.emitido_em,
      'anulado_em', c.anulado_em,
      'pago', false
    )
    else jsonb_build_object(
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
      'logo_path', c.logo_path,
      'assinatura_path', c.assinatura_path,
      'responsavel_nome', c.responsavel_nome,
      'responsavel_cargo', c.responsavel_cargo,
      'estado', c.estado,
      'emitido_em', c.emitido_em,
      'anulado_em', c.anulado_em,
      'pago', true
    )
  end
  from public.certificados c
  where c.codigo = upper(btrim(p_codigo));
$$;

-- 6) Registo do envio por WhatsApp (pela instituição) ------------------------------------------
create or replace function public.marcar_whatsapp_enviado(p_certificado_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_data timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;
  select c.user_id into v_owner from public.certificados c where c.id = p_certificado_id;
  if v_owner is null or (v_owner is distinct from auth.uid() and public.is_admin() is not true) then
    raise exception 'Certificado não encontrado.';
  end if;
  update public.certificados set whatsapp_enviado_em = v_data where id = p_certificado_id;
  return v_data;
end;
$$;

revoke all on function public.certificado_por_token(text) from public;
grant execute on function public.certificado_por_token(text) to anon, authenticated;
revoke all on function public.verificar_certificado(text) from public;
grant execute on function public.verificar_certificado(text) to anon, authenticated;
revoke all on function public.marcar_whatsapp_enviado(uuid) from public, anon;
grant execute on function public.marcar_whatsapp_enviado(uuid) to authenticated;

notify pgrst, 'reload schema';
