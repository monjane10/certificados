-- Certificados - Microlegal Certificados
-- Aplicar DEPOIS de 20261021000001_tipo_curso.sql.
--
-- Critérios de emissão (função emitir_certificados, em lote por curso):
--   * comuns: curso "concluido" com data de encerramento; um certificado
--     activo por matrícula;
--   * participacao: todos os matriculados;
--   * tecnico_profissional: matriculados com nota >= nota_minima_aprovacao().
--
-- O certificado guarda uma cópia (snapshot) dos dados no momento da emissão:
-- alterações posteriores ao formando/curso não mudam certificados emitidos.
-- Certificados não se apagam: anulam-se (anular_certificado), e a verificação
-- pública passa a indicar "anulado".
--
-- Bloqueios enquanto existir certificado activo:
--   * alterar a nota da matrícula;
--   * apagar a matrícula (e, por cascata, o curso ou o formando);
--   * mudar o tipo do curso.

-- 0) Nota mínima de aprovação (fonte única na BD; espelhada no frontend) ------
create or replace function public.nota_minima_aprovacao()
returns numeric
language sql
immutable
as $$ select 10::numeric $$;

-- 1) Tabela -----------------------------------------------------------------------
-- Se já existir uma "certificados" com outra estrutura (criada à mão antes
-- desta migração), é preservada como "certificados_legado" em vez de apagada.
-- Os índices também são renomeados: os nomes de índice são globais no schema
-- e colidiriam com os da tabela nova (ex.: certificados_pkey).
do $$
declare
  r record;
begin
  if to_regclass('public.certificados') is not null
     and (
       select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'certificados'
         and column_name in ('user_id', 'matricula_id', 'estado', 'formando_nome', 'emitido_em')
     ) < 5 then
    if to_regclass('public.certificados_legado') is not null then
      raise exception 'Existem "certificados" e "certificados_legado" com estrutura antiga. Reveja-as manualmente antes de aplicar esta migração.';
    end if;
    for r in
      select i.relname as nome
      from pg_index x
      join pg_class i on i.oid = x.indexrelid
      where x.indrelid = 'public.certificados'::regclass
    loop
      execute format('alter index public.%I rename to %I', r.nome, left(r.nome, 55) || '_legado');
    end loop;
    alter table public.certificados rename to certificados_legado;
    raise notice 'Tabela antiga "certificados" preservada como "certificados_legado".';
  end if;
end
$$;

create table if not exists public.certificados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  -- Ligação viva à matrícula (fica NULL se uma matrícula com certificado
  -- anulado for removida). curso_id/formando_id são referência histórica,
  -- sem FK: o certificado sobrevive aos registos de origem.
  matricula_id uuid references public.matriculas (id) on delete set null,
  curso_id uuid not null,
  formando_id uuid not null,
  user_id uuid not null references auth.users (id),
  -- Snapshot no momento da emissão.
  tipo text not null check (tipo in ('participacao', 'tecnico_profissional')),
  formando_nome text not null,
  curso_nome text not null,
  carga_horaria integer not null check (carga_horaria > 0),
  data_abertura date,
  data_encerramento date not null,
  nota numeric,
  emissor_nome text not null,
  estado text not null default 'emitido' check (estado in ('emitido', 'anulado')),
  emitido_em timestamptz not null default now(),
  anulado_em timestamptz,
  motivo_anulacao text,
  check (
    (tipo = 'participacao' and nota is null)
    or (tipo = 'tecnico_profissional' and nota is not null
        and nota >= public.nota_minima_aprovacao() and nota <= 20)
  ),
  check (
    (estado = 'emitido' and anulado_em is null)
    or (estado = 'anulado' and anulado_em is not null and motivo_anulacao is not null)
  )
);

-- Um único certificado activo por matrícula (anulados não contam).
create unique index if not exists certificados_matricula_activa_uidx
  on public.certificados (matricula_id) where estado = 'emitido';
create index if not exists certificados_user_id_idx on public.certificados (user_id, emitido_em desc);
create index if not exists certificados_curso_id_idx on public.certificados (curso_id);

-- 2) RLS: leitura do próprio emissor; escrita SÓ via funções abaixo ------------------
alter table public.certificados enable row level security;

revoke all on public.certificados from anon, authenticated;
grant select on public.certificados to authenticated;

drop policy if exists "certificados_select_own" on public.certificados;
drop policy if exists "certificados_admin_select" on public.certificados;

create policy "certificados_select_own"
  on public.certificados for select to authenticated
  using (user_id = auth.uid());

create policy "certificados_admin_select"
  on public.certificados for select to authenticated
  using (public.is_admin());

-- 3) Código único: CERT-XXXXXXXX (sem 0/O/1/I), aleatoriedade de gen_random_uuid --
create or replace function public.generate_certificate_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  result text := 'CERT-';
  i int;
begin
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

-- 4) Emissão em lote ---------------------------------------------------------------
create or replace function public.emitir_certificados(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso public.cursos%rowtype;
  v_emissor text;
  v_min numeric := public.nota_minima_aprovacao();
  v_emitidos int := 0;
  v_ja int := 0;
  v_sem_nota int := 0;
  v_reprovados int := 0;
  v_total int := 0;
  v_codigo text;
  v_ok boolean;
  r record;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  -- Bloqueia o curso: emissões concorrentes do mesmo curso ficam em série.
  select * into v_curso from public.cursos where id = p_curso_id for update;
  if not found
     or (v_curso.user_id is distinct from auth.uid() and public.is_admin() is not true) then
    raise exception 'Curso não encontrado.';
  end if;
  if v_curso.status <> 'concluido' then
    raise exception 'Só é possível emitir certificados de cursos concluídos.';
  end if;
  if v_curso.data_encerramento is null then
    raise exception 'Defina a data de encerramento do curso antes de emitir certificados.';
  end if;

  select p.organization_name into v_emissor from public.profiles p where p.id = v_curso.user_id;

  for r in
    select m.id, m.formando_id, m.avaliacao, f.nome
    from public.matriculas m
    join public.formandos f on f.id = m.formando_id
    where m.curso_id = p_curso_id
    order by f.nome
  loop
    v_total := v_total + 1;

    if exists (
      select 1 from public.certificados c
      where c.matricula_id = r.id and c.estado = 'emitido'
    ) then
      v_ja := v_ja + 1;
      continue;
    end if;

    if v_curso.tipo = 'tecnico_profissional' then
      if r.avaliacao is null then
        v_sem_nota := v_sem_nota + 1;
        continue;
      end if;
      if r.avaliacao < v_min then
        v_reprovados := v_reprovados + 1;
        continue;
      end if;
    end if;

    v_ok := false;
    for i in 1..5 loop
      v_codigo := public.generate_certificate_code();
      begin
        insert into public.certificados (
          codigo, matricula_id, curso_id, formando_id, user_id, tipo,
          formando_nome, curso_nome, carga_horaria, data_abertura,
          data_encerramento, nota, emissor_nome
        ) values (
          v_codigo, r.id, v_curso.id, r.formando_id, v_curso.user_id, v_curso.tipo,
          r.nome, v_curso.nome, v_curso.carga_horaria, v_curso.data_abertura,
          v_curso.data_encerramento,
          case when v_curso.tipo = 'tecnico_profissional' then r.avaliacao else null end,
          coalesce(v_emissor, 'Sem organização')
        );
        v_ok := true;
        exit;
      exception when unique_violation then
        null; -- colisão de código: tenta outro
      end;
    end loop;

    if not v_ok then
      raise exception 'Não foi possível gerar um código único. Tente de novo.';
    end if;
    v_emitidos := v_emitidos + 1;
  end loop;

  return jsonb_build_object(
    'total', v_total,
    'emitidos', v_emitidos,
    'ja_emitidos', v_ja,
    'sem_nota', v_sem_nota,
    'reprovados', v_reprovados
  );
end;
$$;

-- 5) Anulação ------------------------------------------------------------------------
create or replace function public.anular_certificado(p_certificado_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert public.certificados%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select * into v_cert from public.certificados where id = p_certificado_id for update;
  if not found
     or (v_cert.user_id is distinct from auth.uid() and public.is_admin() is not true) then
    raise exception 'Certificado não encontrado.';
  end if;
  if v_cert.estado = 'anulado' then
    raise exception 'Este certificado já está anulado.';
  end if;
  if char_length(v_motivo) < 3 then
    raise exception 'Indique o motivo da anulação.';
  end if;

  update public.certificados
     set estado = 'anulado', anulado_em = now(), motivo_anulacao = left(v_motivo, 500)
   where id = p_certificado_id
  returning * into v_cert;

  return to_jsonb(v_cert);
end;
$$;

-- 6) Verificação pública (anon) -----------------------------------------------------
-- Devolve apenas os dados impressos no certificado; NULL se o código não existir.
create or replace function public.verificar_certificado(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', c.codigo,
    'tipo', c.tipo,
    'formando_nome', c.formando_nome,
    'curso_nome', c.curso_nome,
    'carga_horaria', c.carga_horaria,
    'data_abertura', c.data_abertura,
    'data_encerramento', c.data_encerramento,
    'nota', c.nota,
    'emissor_nome', c.emissor_nome,
    'estado', c.estado,
    'emitido_em', c.emitido_em,
    'anulado_em', c.anulado_em
  )
  from public.certificados c
  where c.codigo = upper(btrim(p_codigo));
$$;

revoke all on function public.emitir_certificados(uuid) from public, anon;
revoke all on function public.anular_certificado(uuid, text) from public, anon;
revoke all on function public.verificar_certificado(text) from public;
grant execute on function public.emitir_certificados(uuid) to authenticated;
grant execute on function public.anular_certificado(uuid, text) to authenticated;
grant execute on function public.verificar_certificado(text) to anon, authenticated;

-- 7) Bloqueios enquanto houver certificado activo --------------------------------------
create or replace function public.protect_matricula_certificada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.certificados c
      where c.matricula_id = old.id and c.estado = 'emitido'
    ) then
      -- Também apanha cascatas (excluir curso/formando): mensagem genérica.
      raise exception 'Existe certificado emitido associado. Anule-o em Certificados antes de remover a matrícula, o formando ou o curso.';
    end if;
    return old;
  end if;

  if new.avaliacao is distinct from old.avaliacao and exists (
    select 1 from public.certificados c
    where c.matricula_id = old.id and c.estado = 'emitido'
  ) then
    raise exception 'Este formando já tem certificado emitido neste curso. Anule o certificado para alterar a nota.';
  end if;
  return new;
end;
$$;

-- Também dispara nas cascatas (apagar curso/formando apaga matrículas).
drop trigger if exists trg_matriculas_protect_certificado on public.matriculas;
create trigger trg_matriculas_protect_certificado
  before update of avaliacao or delete on public.matriculas
  for each row execute function public.protect_matricula_certificada();

create or replace function public.protect_curso_certificado_tipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo is distinct from old.tipo and exists (
    select 1 from public.certificados c
    where c.curso_id = old.id and c.estado = 'emitido'
  ) then
    raise exception 'O curso tem certificados emitidos. Anule-os antes de mudar o tipo.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cursos_protect_certificado_tipo on public.cursos;
create trigger trg_cursos_protect_certificado_tipo
  before update of tipo on public.cursos
  for each row execute function public.protect_curso_certificado_tipo();
