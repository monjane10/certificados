-- RECRIAR O DOMÍNIO DO ZERO - Microlegal Certificados
-- ============================================================================
-- APAGA TODOS os cursos, formandos, matrículas e certificados e recria as
-- tabelas, funções, triggers e políticas exactamente como estão nas migrações
-- do repositório (de 20261013000000 até à última).
--
-- NÃO toca em:
--   * public.profiles (perfis, códigos, papéis, primeiro admin, logótipo,
--     assinatura e responsável) nem nas suas funções/triggers;
--   * auth.users (contas de acesso);
--   * Storage (bucket "branding" e as imagens já carregadas).
--
-- Corre numa única transacção: se algum passo falhar, nada é alterado.
-- Ficheiro gerado a partir de supabase/migrations/; não editar à mão.
-- ============================================================================

begin;

-- 0) Apagar o domínio ---------------------------------------------------------------
-- As tabelas levam consigo triggers, políticas, índices e restrições (incluindo
-- os criados fora das migrações).
drop table if exists public.certificados cascade;
drop table if exists public.certificados_legado cascade;
drop table if exists public.matriculas cascade;
drop table if exists public.formandos cascade;
drop table if exists public.formandos_matriculados cascade;
drop table if exists public.cursos cascade;

-- Funções do domínio (todas as assinaturas), incluindo as criadas fora das
-- migrações. As funções do perfil (is_admin, handle_updated_at, ...) ficam.
do $$
declare
  r record;
begin
  if to_regclass('cron.job') is not null then
    for r in execute
      'select jobid from cron.job where command ~* ''(actualizar_estados_cursos|encerrar_curso|emitir_certificados)'''
    loop
      execute format('select cron.unschedule(%s::bigint)', r.jobid);
    end loop;
  end if;

  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'generate_course_code', 'fill_course_code', 'protect_trainee_course',
        'protect_formando_owner', 'protect_matricula_link', 'remover_matricula',
        'remover_curso', 'check_avaliacao_tipo_curso', 'protect_curso_tipo',
        'nota_minima_aprovacao', 'generate_certificate_code', 'emitir_certificados',
        'anular_certificado', 'verificar_certificado', 'protect_matricula_certificada',
        'protect_curso_certificado_tipo', 'sync_modelo_certificados',
        'estado_curso_datas', 'estado_curso', 'proteger_curso_encerrado',
        'proteger_matriculas_curso_encerrado', 'encerrar_curso', 'reabrir_curso',
        -- criadas fora das migrações
        'definir_estado_curso', 'actualizar_estados_cursos', 'calcular_estado_curso'
      )
  loop
    execute format('drop function %s cascade', r.fn);
  end loop;
end
$$;

-- ============================================================================
-- 20261013000000_cursos_formandos.sql
-- ============================================================================

-- Sprint 2 - Microlegal Certificados
-- Gestão de cursos e formandos matriculados.
-- Incremental: não elimina dados existentes. Compatível com aplicação via
-- Supabase CLI (supabase db push) ou SQL Editor do dashboard.
--
-- Entidades futuras (certificados, pagamentos) ficam preservadas: as tabelas
-- aqui criadas usam chaves primárias UUID estáveis para referência futura.

-- 0) Extensão para gen_random_uuid (idempotente; no Supabase já existe) ------
create extension if not exists "pgcrypto";

-- 1) Tabela cursos ------------------------------------------------------------
create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) >= 2),
  carga_horaria integer not null check (carga_horaria > 0),
  codigo text not null unique,
  data_abertura date,
  data_encerramento date,
  status text not null default 'planeado'
    check (status in ('planeado', 'em_andamento', 'concluido', 'cancelado')),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_encerramento is null or data_abertura is null or data_encerramento >= data_abertura)
);

create index if not exists cursos_user_id_idx on public.cursos (user_id);
create index if not exists cursos_codigo_idx on public.cursos (codigo);
create index if not exists cursos_status_idx on public.cursos (status);
create index if not exists cursos_created_at_idx on public.cursos (created_at desc);

-- updated_at automático (reutiliza a função da Sprint 1 se existir).
do $$
begin
  if to_regproc('public.handle_updated_at') is null then
    create or replace function public.handle_updated_at()
    returns trigger language plpgsql as $f$
    begin
      new.updated_at = now();
      return new;
    end;
    $f$;
  end if;
end
$$;

drop trigger if exists trg_cursos_updated_at on public.cursos;
create trigger trg_cursos_updated_at
  before update on public.cursos
  for each row execute function public.handle_updated_at();

-- 2) Geração de código único do curso ------------------------------------------
-- Formato: CUR-XXXXXX (6 caracteres alfanuméricos, sem ambíguos 0/O/1/I).
-- O backend NÃO envia codigo/user_id: o código é gerado aqui e o proprietário
-- deriva sempre de auth.uid(). O backend também gera e envia codigo como
-- defesa complementar; esta função cobre inserts directos/omissos.
create or replace function public.generate_course_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := 'CUR-';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, (floor(random() * length(alphabet)) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.fill_course_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    for i in 1..5 loop
      v_code := public.generate_course_code();
      begin
        new.codigo := v_code;
        return new;
      exception when unique_violation then
        continue;
      end;
    end loop;
    -- Última tentativa: deixa o unique constraint decidir (erro explícito).
    new.codigo := public.generate_course_code();
  end if;
  -- Impede que o proprietário seja alterado para outro utilizador em updates.
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id
     and public.is_admin() is not true then
    raise exception 'Alteração de proprietário do curso não permitida.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cursos_fill_code on public.cursos;
create trigger trg_cursos_fill_code
  before insert or update on public.cursos
  for each row execute function public.fill_course_code();

-- 3) Tabela formandos_matriculados -----------------------------------------------
create table if not exists public.formandos_matriculados (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) >= 2),
  email text,
  contacto text,
  curso_id uuid not null references public.cursos (id) on delete cascade,
  avaliacao numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or btrim(email) = '' or email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

create index if not exists formandos_curso_id_idx on public.formandos_matriculados (curso_id);
create index if not exists formandos_nome_idx on public.formandos_matriculados (curso_id, nome);
create index if not exists formandos_email_idx on public.formandos_matriculados (email);

drop trigger if exists trg_formandos_updated_at on public.formandos_matriculados;
create trigger trg_formandos_updated_at
  before update on public.formandos_matriculados
  for each row execute function public.handle_updated_at();

-- Impede reassociação arbitrária de matrícula para curso de outro utilizador.
create or replace function public.protect_trainee_course()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_old_owner uuid;
begin
  select c.user_id into v_owner from public.cursos c where c.id = new.curso_id;
  if v_owner is null then
    raise exception 'Curso associado não existe.';
  end if;
  if tg_op = 'UPDATE' and new.curso_id is distinct from old.curso_id then
    if public.is_admin() is not true then
      raise exception 'Alteração de curso da matrícula não permitida.';
    end if;
    select c.user_id into v_old_owner from public.cursos c where c.id = old.curso_id;
    if v_old_owner is distinct from v_owner and public.is_admin() is not true then
      raise exception 'Alteração de curso da matrícula não permitida.';
    end if;
  end if;
  if v_owner <> auth.uid() and public.is_admin() is not true then
    raise exception 'Sem permissão para este curso.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_trainee_course on public.formandos_matriculados;
create trigger trg_protect_trainee_course
  before insert or update on public.formandos_matriculados
  for each row execute function public.protect_trainee_course();

-- 4) RLS -------------------------------------------------------------------------
alter table public.cursos enable row level security;
alter table public.formandos_matriculados enable row level security;

revoke all on public.cursos from anon;
revoke all on public.formandos_matriculados from anon;
grant select, insert, update, delete on public.cursos to authenticated;
grant select, insert, update, delete on public.formandos_matriculados to authenticated;

-- Políticas de cursos: propriedade via user_id = auth.uid().
drop policy if exists "cursos_select_own" on public.cursos;
drop policy if exists "cursos_insert_own" on public.cursos;
drop policy if exists "cursos_update_own" on public.cursos;
drop policy if exists "cursos_delete_own" on public.cursos;
drop policy if exists "cursos_admin_all" on public.cursos;

create policy "cursos_select_own"
  on public.cursos for select to authenticated
  using (user_id = auth.uid());

create policy "cursos_insert_own"
  on public.cursos for insert to authenticated
  with check (user_id = auth.uid());

create policy "cursos_update_own"
  on public.cursos for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cursos_delete_own"
  on public.cursos for delete to authenticated
  using (user_id = auth.uid());

create policy "cursos_admin_all"
  on public.cursos for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Políticas de formandos: propriedade via curso associado.
drop policy if exists "formandos_select_own_course" on public.formandos_matriculados;
drop policy if exists "formandos_insert_own_course" on public.formandos_matriculados;
drop policy if exists "formandos_update_own_course" on public.formandos_matriculados;
drop policy if exists "formandos_delete_own_course" on public.formandos_matriculados;
drop policy if exists "formandos_admin_all" on public.formandos_matriculados;

create policy "formandos_select_own_course"
  on public.formandos_matriculados for select to authenticated
  using (exists (
    select 1 from public.cursos c
    where c.id = formandos_matriculados.curso_id and c.user_id = auth.uid()
  ));

create policy "formandos_insert_own_course"
  on public.formandos_matriculados for insert to authenticated
  with check (exists (
    select 1 from public.cursos c
    where c.id = formandos_matriculados.curso_id and c.user_id = auth.uid()
  ));

create policy "formandos_update_own_course"
  on public.formandos_matriculados for update to authenticated
  using (exists (
    select 1 from public.cursos c
    where c.id = formandos_matriculados.curso_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cursos c
    where c.id = formandos_matriculados.curso_id and c.user_id = auth.uid()
  ));

create policy "formandos_delete_own_course"
  on public.formandos_matriculados for delete to authenticated
  using (exists (
    select 1 from public.cursos c
    where c.id = formandos_matriculados.curso_id and c.user_id = auth.uid()
  ));

create policy "formandos_admin_all"
  on public.formandos_matriculados for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- 20261014000000_formandos_matriculas_nn.sql
-- ============================================================================

-- Sprint 2 (actualização) - Microlegal Certificados
-- Relação muitos-para-muitos entre formandos e cursos.
--
-- Substitui "formandos_matriculados" (dados pessoais duplicados por curso) por:
--   * public.formandos   - registo central de dados pessoais (com proprietário)
--   * public.matriculas   - ligação formando<->curso + avaliação por curso
--     com UNIQUE (formando_id, curso_id).
--
-- Incremental e com preservação de dados: os registos existentes em
-- formandos_matriculados são portados (deduplicados por utilizador) antes de
-- a tabela antiga ser removida. Reexecutável sem duplicar dados (ON CONFLICT).
-- Aplicar via Supabase CLI (supabase db push) ou SQL Editor, DEPOIS da
-- migração 20261013000000_cursos_formandos.sql.

-- 0) Tabelas novas --------------------------------------------------------------
create table if not exists public.formandos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) >= 2),
  email text,
  contacto text,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or btrim(email) = '' or email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

create table if not exists public.matriculas (
  id uuid primary key default gen_random_uuid(),
  formando_id uuid not null references public.formandos (id) on delete cascade,
  curso_id uuid not null references public.cursos (id) on delete cascade,
  avaliacao numeric check (avaliacao is null or (avaliacao >= 0 and avaliacao <= 20)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (formando_id, curso_id)
);

create index if not exists formandos_user_id_idx on public.formandos (user_id);
create index if not exists formandos_nome_idx on public.formandos (user_id, nome);
create index if not exists matriculas_formando_id_idx on public.matriculas (formando_id);
create index if not exists matriculas_curso_id_idx on public.matriculas (curso_id);

drop trigger if exists trg_formandos_updated_at on public.formandos;
create trigger trg_formandos_updated_at
  before update on public.formandos
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_matriculas_updated_at on public.matriculas;
create trigger trg_matriculas_updated_at
  before update on public.matriculas
  for each row execute function public.handle_updated_at();

-- Impede que não-admin troque o proprietário do formando ou mova a matrícula
-- para outro formando/curso (a avaliação edita-se livremente no contexto).
create or replace function public.protect_formando_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id and public.is_admin() is not true then
    raise exception 'Alteração de proprietário do formando não permitida.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_formando_owner on public.formandos;
create trigger trg_protect_formando_owner
  before update on public.formandos
  for each row execute function public.protect_formando_owner();

create or replace function public.protect_matricula_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select c.user_id into v_owner from public.cursos c where c.id = new.curso_id;
  if v_owner is null then
    raise exception 'Curso associado não existe.';
  end if;
  if tg_op = 'UPDATE'
     and (new.curso_id is distinct from old.curso_id
          or new.formando_id is distinct from old.formando_id)
     and public.is_admin() is not true then
    raise exception 'Alteração de curso/formando da matrícula não permitida.';
  end if;
  if v_owner <> auth.uid() and public.is_admin() is not true then
    raise exception 'Sem permissão para este curso.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_matricula_link on public.matriculas;
create trigger trg_protect_matricula_link
  before insert or update on public.matriculas
  for each row execute function public.protect_matricula_link();

-- 1) Migração de dados (apenas se a tabela antiga existir) -----------------------
-- Deduplica por utilizador: (nome, email, contacto) normalizados. A avaliação
-- viaja para a matrícula correspondente. created_at preservada.
do $$
begin
  if to_regclass('public.formandos_matriculados') is not null then
    -- 1a) Registos centrais de formandos (um por pessoa/utilizador).
    insert into public.formandos (nome, email, contacto, user_id, created_at)
    select
      min(btrim(f.nome)),
      nullif(min(lower(btrim(coalesce(f.email, '')))), ''),
      nullif(min(btrim(coalesce(f.contacto, ''))), ''),
      c.user_id,
      min(f.created_at)
    from public.formandos_matriculados f
    join public.cursos c on c.id = f.curso_id
    group by
      c.user_id,
      lower(btrim(f.nome)),
      lower(coalesce(nullif(btrim(coalesce(f.email, '')), ''), '')),
      coalesce(nullif(btrim(coalesce(f.contacto, '')), ''), '')
    on conflict do nothing;

    -- 1b) Matrículas (resolve o formando pela mesma chave de deduplicação).
    insert into public.matriculas (formando_id, curso_id, avaliacao, created_at)
    select fo.id, f.curso_id, f.avaliacao, f.created_at
    from public.formandos_matriculados f
    join public.cursos c on c.id = f.curso_id
    join public.formandos fo
      on fo.user_id = c.user_id
     and lower(btrim(fo.nome)) = lower(btrim(f.nome))
     and lower(coalesce(fo.email, '')) = lower(coalesce(nullif(btrim(coalesce(f.email, '')), ''), ''))
     and coalesce(fo.contacto, '') = coalesce(nullif(btrim(coalesce(f.contacto, '')), ''), '')
    on conflict (formando_id, curso_id) do nothing;
  end if;
end
$$;

-- 2) Remover a tabela antiga (políticas e triggers caem com CASCADE) -------------
drop table if exists public.formandos_matriculados cascade;
drop function if exists public.protect_trainee_course();

-- 3) RLS --------------------------------------------------------------------------
alter table public.formandos enable row level security;
alter table public.matriculas enable row level security;

revoke all on public.formandos from anon;
revoke all on public.matriculas from anon;
grant select, insert, update, delete on public.formandos to authenticated;
grant select, insert, update, delete on public.matriculas to authenticated;

-- Formandos: propriedade directa (sem partilha entre utilizadores).
drop policy if exists "formandos_select_own" on public.formandos;
drop policy if exists "formandos_insert_own" on public.formandos;
drop policy if exists "formandos_update_own" on public.formandos;
drop policy if exists "formandos_delete_own" on public.formandos;
drop policy if exists "formandos_admin_all" on public.formandos;

create policy "formandos_select_own"
  on public.formandos for select to authenticated
  using (user_id = auth.uid());

create policy "formandos_insert_own"
  on public.formandos for insert to authenticated
  with check (user_id = auth.uid());

create policy "formandos_update_own"
  on public.formandos for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "formandos_delete_own"
  on public.formandos for delete to authenticated
  using (user_id = auth.uid());

create policy "formandos_admin_all"
  on public.formandos for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Matrículas: propriedade via curso; insert exige formando próprio
-- (impede vincular/consultar formandos de outros utilizadores).
drop policy if exists "matriculas_select_own_course" on public.matriculas;
drop policy if exists "matriculas_insert_own_course" on public.matriculas;
drop policy if exists "matriculas_update_own_course" on public.matriculas;
drop policy if exists "matriculas_delete_own_course" on public.matriculas;
drop policy if exists "matriculas_admin_all" on public.matriculas;

create policy "matriculas_select_own_course"
  on public.matriculas for select to authenticated
  using (exists (
    select 1 from public.cursos c
    where c.id = matriculas.curso_id and c.user_id = auth.uid()
  ));

create policy "matriculas_insert_own_course"
  on public.matriculas for insert to authenticated
  with check (
    exists (
      select 1 from public.cursos c
      where c.id = matriculas.curso_id and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.formandos f
      where f.id = matriculas.formando_id and f.user_id = auth.uid()
    )
  );

create policy "matriculas_update_own_course"
  on public.matriculas for update to authenticated
  using (exists (
    select 1 from public.cursos c
    where c.id = matriculas.curso_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cursos c
    where c.id = matriculas.curso_id and c.user_id = auth.uid()
  ));

create policy "matriculas_delete_own_course"
  on public.matriculas for delete to authenticated
  using (exists (
    select 1 from public.cursos c
    where c.id = matriculas.curso_id and c.user_id = auth.uid()
  ));

create policy "matriculas_admin_all"
  on public.matriculas for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4) Operações atómicas (concorrência) ---------------------------------------------
-- Cancela UMA matrícula; se era a última do formando, remove também o registo
-- central (sem outras dependências nesta fase: certificados/pagamentos são
-- futuros e deverão ser verificados aqui antes de eliminar). Tudo numa só
-- transacção; a propriedade é verificada dentro da função.
create or replace function public.remover_matricula(p_matricula_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_formando_id uuid;
  v_curso_id uuid;
  v_owner uuid;
  v_restantes int;
  v_removido boolean := false;
begin
  select m.formando_id, m.curso_id, c.user_id
    into v_formando_id, v_curso_id, v_owner
  from public.matriculas m
  join public.cursos c on c.id = m.curso_id
  where m.id = p_matricula_id;

  if v_formando_id is null then
    raise exception 'Matrícula não encontrada.';
  end if;
  if v_owner <> auth.uid() and public.is_admin() is not true then
    raise exception 'Matrícula não encontrada.';
  end if;

  delete from public.matriculas where id = p_matricula_id;

  select count(*)::int into v_restantes
  from public.matriculas where formando_id = v_formando_id;

  if v_restantes = 0 then
    -- Caso A: sem outras matrículas nem dependências futuras verificadas
    -- aqui (certificados/pagamentos) -> remoção definitiva segura.
    delete from public.formandos where id = v_formando_id;
    v_removido := true;
  end if;

  return jsonb_build_object(
    'removed_matricula', true,
    'removed_formando', v_removido,
    'remaining_courses', v_restantes,
    'curso_id', v_curso_id
  );
end;
$$;

-- Remove UM curso com as suas matrículas; preserva formandos com matrículas
-- noutros cursos e limpa apenas os órfãos do próprio utilizador.
-- (Futuro: bloquear se existirem certificados/pagamentos com retenção.)
create or replace function public.remover_curso(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_matriculas int;
  v_orfaos int := 0;
  r record;
begin
  select c.user_id into v_owner from public.cursos c where c.id = p_curso_id;

  if v_owner is null then
    raise exception 'Curso não encontrado.';
  end if;
  if v_owner <> auth.uid() and public.is_admin() is not true then
    raise exception 'Curso não encontrado.';
  end if;

  select count(*)::int into v_matriculas
  from public.matriculas where curso_id = p_curso_id;

  delete from public.cursos where id = p_curso_id;

  -- Limpa apenas formandos do próprio dono que ficaram sem qualquer matrícula.
  for r in
    select f.id
    from public.formandos f
    where f.user_id = v_owner
      and not exists (select 1 from public.matriculas m where m.formando_id = f.id)
  loop
    delete from public.formandos where id = r.id;
    v_orfaos := v_orfaos + 1;
  end loop;

  return jsonb_build_object(
    'removed_curso', true,
    'removed_matriculas', v_matriculas,
    'removed_orphan_formandos', v_orfaos
  );
end;
$$;

revoke all on function public.remover_matricula(uuid) from anon;
revoke all on function public.remover_curso(uuid) from anon;
grant execute on function public.remover_matricula(uuid) to authenticated;
grant execute on function public.remover_curso(uuid) to authenticated;

-- ============================================================================
-- 20261021000000_correcoes_seguranca.sql
-- ============================================================================

-- Correcções de segurança - Microlegal Certificados
-- Aplicar DEPOIS de 20261014000000_formandos_matriculas_nn.sql.
--
-- 1) remover_curso / remover_matricula: o Postgres concede EXECUTE a PUBLIC
--    na criação de funções, pelo que "revoke ... from anon" não bastava. Sem
--    sessão, auth.uid() é NULL e "v_owner <> auth.uid()" dava NULL, saltando
--    a verificação de propriedade (funções SECURITY DEFINER -> sem RLS).
--    Agora: EXECUTE só para authenticated e comparação NULL-safe.
-- 2) protect_profile_role: bloqueava a promoção do primeiro admin no SQL
--    Editor (sem JWT, is_admin() = false). Operações sem utilizador no JWT
--    (SQL Editor / service_role) são de operador confiável e passam; o anon
--    não tem privilégios sobre profiles.
-- 3) protect_matricula_link: tratamento explícito de auth.uid() NULL e
--    comparação NULL-safe (defesa em profundidade).

-- 1) Funções atómicas de remoção -------------------------------------------------
create or replace function public.remover_matricula(p_matricula_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_formando_id uuid;
  v_curso_id uuid;
  v_owner uuid;
  v_restantes int;
  v_removido boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select m.formando_id, m.curso_id, c.user_id
    into v_formando_id, v_curso_id, v_owner
  from public.matriculas m
  join public.cursos c on c.id = m.curso_id
  where m.id = p_matricula_id;

  if v_formando_id is null then
    raise exception 'Matrícula não encontrada.';
  end if;
  if v_owner is distinct from auth.uid() and public.is_admin() is not true then
    raise exception 'Matrícula não encontrada.';
  end if;

  delete from public.matriculas where id = p_matricula_id;

  select count(*)::int into v_restantes
  from public.matriculas where formando_id = v_formando_id;

  if v_restantes = 0 then
    -- Caso A: sem outras matrículas nem dependências futuras verificadas
    -- aqui (certificados/pagamentos) -> remoção definitiva segura.
    delete from public.formandos where id = v_formando_id;
    v_removido := true;
  end if;

  return jsonb_build_object(
    'removed_matricula', true,
    'removed_formando', v_removido,
    'remaining_courses', v_restantes,
    'curso_id', v_curso_id
  );
end;
$$;

create or replace function public.remover_curso(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_matriculas int;
  v_orfaos int := 0;
  r record;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  select c.user_id into v_owner from public.cursos c where c.id = p_curso_id;

  if v_owner is null then
    raise exception 'Curso não encontrado.';
  end if;
  if v_owner is distinct from auth.uid() and public.is_admin() is not true then
    raise exception 'Curso não encontrado.';
  end if;

  select count(*)::int into v_matriculas
  from public.matriculas where curso_id = p_curso_id;

  delete from public.cursos where id = p_curso_id;

  -- Limpa apenas formandos do próprio dono que ficaram sem qualquer matrícula.
  for r in
    select f.id
    from public.formandos f
    where f.user_id = v_owner
      and not exists (select 1 from public.matriculas m where m.formando_id = f.id)
  loop
    delete from public.formandos where id = r.id;
    v_orfaos := v_orfaos + 1;
  end loop;

  return jsonb_build_object(
    'removed_curso', true,
    'removed_matriculas', v_matriculas,
    'removed_orphan_formandos', v_orfaos
  );
end;
$$;

revoke all on function public.remover_matricula(uuid) from public, anon;
revoke all on function public.remover_curso(uuid) from public, anon;
grant execute on function public.remover_matricula(uuid) to authenticated;
grant execute on function public.remover_curso(uuid) to authenticated;

-- 2) Protecção do role/code (permite operador sem JWT) ---------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem utilizador no JWT: SQL Editor (postgres) ou service_role -> confiável.
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'Alteração de role não permitida.';
    end if;
  end if;
  -- Impede alteração do código por não-admin.
  if new.code is distinct from old.code and not public.is_admin() then
    raise exception 'Alteração de code não permitida.';
  end if;
  return new;
end;
$$;

-- 3) Ligação da matrícula (comparação NULL-safe) ----------------------------------
create or replace function public.protect_matricula_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select c.user_id into v_owner from public.cursos c where c.id = new.curso_id;
  if v_owner is null then
    raise exception 'Curso associado não existe.';
  end if;
  -- Sem utilizador no JWT: operador confiável (o anon não tem privilégios na tabela).
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and (new.curso_id is distinct from old.curso_id
          or new.formando_id is distinct from old.formando_id)
     and public.is_admin() is not true then
    raise exception 'Alteração de curso/formando da matrícula não permitida.';
  end if;
  if v_owner is distinct from auth.uid() and public.is_admin() is not true then
    raise exception 'Sem permissão para este curso.';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 20261021000001_tipo_curso.sql
-- ============================================================================

-- Tipo de curso - Microlegal Certificados
-- Aplicar DEPOIS de 20261021000000_correcoes_seguranca.sql.
--
-- Cada curso passa a ter um tipo, que determina se há avaliação e (futuramente)
-- o modelo de certificado:
--   * participacao          -> sem notas; certificado de participação.
--   * tecnico_profissional  -> nota 0-20 por matrícula; certificado com nota
--                              (aprovação a partir de 10 valores, regra da app).
--
-- Regras garantidas na BD (mesmo com acesso directo via API do Supabase):
--   1. Matrículas de cursos de participação não podem ter avaliação.
--   2. Um curso só passa a "participacao" se nenhuma matrícula tiver nota.

-- 1) Coluna tipo ----------------------------------------------------------------
-- Cursos existentes ficam como técnico-profissionais (podem já ter notas; não
-- se perde informação). O default é removido a seguir: novos cursos têm de
-- indicar o tipo explicitamente.
alter table public.cursos
  add column if not exists tipo text not null default 'tecnico_profissional';

alter table public.cursos alter column tipo drop default;

alter table public.cursos drop constraint if exists cursos_tipo_check;
alter table public.cursos
  add constraint cursos_tipo_check check (tipo in ('participacao', 'tecnico_profissional'));

create index if not exists cursos_tipo_idx on public.cursos (tipo);

-- 2) Sem avaliação em cursos de participação ------------------------------------
create or replace function public.check_avaliacao_tipo_curso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  if new.avaliacao is null then
    return new;
  end if;
  select c.tipo into v_tipo from public.cursos c where c.id = new.curso_id;
  if v_tipo = 'participacao' then
    raise exception 'Cursos de participação não têm avaliação.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matriculas_avaliacao_tipo on public.matriculas;
create trigger trg_matriculas_avaliacao_tipo
  before insert or update of avaliacao, curso_id on public.matriculas
  for each row execute function public.check_avaliacao_tipo_curso();

-- 3) Mudança de tipo só sem notas lançadas --------------------------------------
create or replace function public.protect_curso_tipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'participacao'
     and old.tipo is distinct from new.tipo
     and exists (
       select 1 from public.matriculas m
       where m.curso_id = new.id and m.avaliacao is not null
     ) then
    raise exception 'Não é possível mudar para curso de participação: existem notas lançadas.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cursos_protect_tipo on public.cursos;
create trigger trg_cursos_protect_tipo
  before update of tipo on public.cursos
  for each row execute function public.protect_curso_tipo();

-- ============================================================================
-- 20261021000002_certificados.sql
-- ============================================================================

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

-- ============================================================================
-- 20261021000003_modelos_certificado.sql
-- ============================================================================

-- Modelos (templates) de certificado - Microlegal Certificados
-- Aplicar DEPOIS de 20261021000002_certificados.sql.
--
-- O modelo é escolhido por curso (cursos.modelo_certificado) e copiado para
-- cada certificado na emissão. O modelo é só aparência: mudar o modelo do
-- curso actualiza também os certificados activos desse curso (o conteúdo -
-- nome, nota, datas - continua a ser o snapshot da emissão).
--
-- Modelos disponíveis (o desenho de cada um está no frontend):
--   classico, ondas_azuis, violeta, dourado, minimalista

-- 1) Colunas ----------------------------------------------------------------------
alter table public.cursos
  add column if not exists modelo_certificado text not null default 'classico';
alter table public.cursos drop constraint if exists cursos_modelo_certificado_check;
alter table public.cursos
  add constraint cursos_modelo_certificado_check
  check (modelo_certificado in ('classico', 'ondas_azuis', 'violeta', 'dourado', 'minimalista'));

alter table public.certificados
  add column if not exists modelo text not null default 'classico';
alter table public.certificados drop constraint if exists certificados_modelo_check;
alter table public.certificados
  add constraint certificados_modelo_check
  check (modelo in ('classico', 'ondas_azuis', 'violeta', 'dourado', 'minimalista'));

-- 2) Mudar o modelo do curso propaga aos certificados activos ----------------------
create or replace function public.sync_modelo_certificados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.modelo_certificado is distinct from old.modelo_certificado then
    update public.certificados
       set modelo = new.modelo_certificado
     where curso_id = new.id and estado = 'emitido';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cursos_sync_modelo on public.cursos;
create trigger trg_cursos_sync_modelo
  after update of modelo_certificado on public.cursos
  for each row execute function public.sync_modelo_certificados();

-- 3) Emissão: copia o modelo do curso ------------------------------------------------
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
          data_encerramento, nota, emissor_nome, modelo
        ) values (
          v_codigo, r.id, v_curso.id, r.formando_id, v_curso.user_id, v_curso.tipo,
          r.nome, v_curso.nome, v_curso.carga_horaria, v_curso.data_abertura,
          v_curso.data_encerramento,
          case when v_curso.tipo = 'tecnico_profissional' then r.avaliacao else null end,
          coalesce(v_emissor, 'Sem organização'),
          v_curso.modelo_certificado
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

-- 4) Verificação pública devolve o modelo (para desenhar o certificado) --------------
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
    'modelo', c.modelo,
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

-- create or replace preserva os privilégios; reafirmados por clareza.
revoke all on function public.emitir_certificados(uuid) from public, anon;
grant execute on function public.emitir_certificados(uuid) to authenticated;
revoke all on function public.verificar_certificado(text) from public;
grant execute on function public.verificar_certificado(text) to anon, authenticated;

-- ============================================================================
-- 20261021000004_identidade_certificados.sql
-- ============================================================================

-- Logótipo e assinatura nos certificados - Microlegal Certificados
-- Aplicar DEPOIS de 20261021000003_modelos_certificado.sql.
--
-- Cada instituição (profiles) pode ter:
--   * logo_path        - logótipo (imagem no bucket "branding")
--   * assinatura_path  - assinatura digitalizada (imagem no bucket "branding")
--   * responsavel_nome / responsavel_cargo - quem assina (ex.: "Director Pedagógico")
--
-- Ficheiros: bucket "branding", leitura pública (o certificado é uma página
-- pública), escrita só na pasta do próprio utilizador: "<user_id>/...".
-- Cada upload usa um nome novo; ficheiros antigos não são substituídos, para
-- que certificados já emitidos continuem a apontar para a imagem da época.
--
-- Os quatro campos são copiados para o certificado na emissão (snapshot),
-- como o resto dos dados: trocar a assinatura não altera certificados emitidos.

-- 1) Perfil ------------------------------------------------------------------------
alter table public.profiles
  add column if not exists logo_path text,
  add column if not exists assinatura_path text,
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_cargo text;

-- Os caminhos têm de estar na pasta do próprio perfil (impede apontar para
-- ficheiros de outra instituição).
alter table public.profiles drop constraint if exists profiles_logo_path_check;
alter table public.profiles
  add constraint profiles_logo_path_check
  check (logo_path is null or logo_path like id::text || '/%');
alter table public.profiles drop constraint if exists profiles_assinatura_path_check;
alter table public.profiles
  add constraint profiles_assinatura_path_check
  check (assinatura_path is null or assinatura_path like id::text || '/%');
alter table public.profiles drop constraint if exists profiles_responsavel_check;
alter table public.profiles
  add constraint profiles_responsavel_check
  check (char_length(coalesce(responsavel_nome, '')) <= 120
         and char_length(coalesce(responsavel_cargo, '')) <= 80);

-- 2) Certificados (snapshot) ---------------------------------------------------------
alter table public.certificados
  add column if not exists logo_path text,
  add column if not exists assinatura_path text,
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_cargo text;

-- 3) Storage: bucket "branding" ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "branding_select_own" on storage.objects;
drop policy if exists "branding_insert_own" on storage.objects;
drop policy if exists "branding_update_own" on storage.objects;
drop policy if exists "branding_delete_own" on storage.objects;

-- A leitura pública faz-se pelo URL público do bucket; esta policy só cobre
-- listagem/gestão dos próprios ficheiros.
create policy "branding_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "branding_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "branding_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "branding_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Emissão: copia logótipo, assinatura e responsável ---------------------------------
create or replace function public.emitir_certificados(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso public.cursos%rowtype;
  v_perfil public.profiles%rowtype;
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

  select * into v_perfil from public.profiles p where p.id = v_curso.user_id;

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
          data_encerramento, nota, emissor_nome, modelo,
          logo_path, assinatura_path, responsavel_nome, responsavel_cargo
        ) values (
          v_codigo, r.id, v_curso.id, r.formando_id, v_curso.user_id, v_curso.tipo,
          r.nome, v_curso.nome, v_curso.carga_horaria, v_curso.data_abertura,
          v_curso.data_encerramento,
          case when v_curso.tipo = 'tecnico_profissional' then r.avaliacao else null end,
          coalesce(v_perfil.organization_name, 'Sem organização'),
          v_curso.modelo_certificado,
          v_perfil.logo_path, v_perfil.assinatura_path,
          nullif(btrim(coalesce(v_perfil.responsavel_nome, '')), ''),
          nullif(btrim(coalesce(v_perfil.responsavel_cargo, '')), '')
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

-- 5) Verificação pública devolve os dados de identidade ----------------------------------
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
    'anulado_em', c.anulado_em
  )
  from public.certificados c
  where c.codigo = upper(btrim(p_codigo));
$$;

revoke all on function public.emitir_certificados(uuid) from public, anon;
grant execute on function public.emitir_certificados(uuid) to authenticated;
revoke all on function public.verificar_certificado(text) from public;
grant execute on function public.verificar_certificado(text) to anon, authenticated;

-- ============================================================================
-- 20261028000000_estado_automatico.sql
-- ============================================================================

-- Estado do curso calculado a partir das datas - Microlegal Certificados
-- Aplicar DEPOIS de 20261021000004_identidade_certificados.sql.
--
-- Até aqui o estado era escolhido à mão, o que permitia marcar como
-- "Concluído" um curso que ainda não terminou (e emitir certificados antes do
-- fim). Agora só o cancelamento é manual; o resto deriva das datas, no fuso
-- de Maputo, e é calculado na leitura (muda sozinho quando o dia passa):
--   * cancelado                         -> cancelado
--   * hoje >= data_encerramento         -> concluido
--   * hoje >= data_abertura             -> em_andamento
--   * sem datas ou antes da abertura    -> planeado
--
-- A coluna status é substituída por cancelado (boolean). A API continua a
-- devolver "status", lido do campo calculado public.estado_curso(cursos).

-- 1) cancelado substitui status ---------------------------------------------------
alter table public.cursos
  add column if not exists cancelado boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cursos' and column_name = 'status'
  ) then
    update public.cursos set cancelado = true where status = 'cancelado';
    alter table public.cursos drop column status;
  end if;
end
$$;

-- 2) Regra única do estado ----------------------------------------------------------
create or replace function public.estado_curso_datas(
  p_cancelado boolean,
  p_abertura date,
  p_encerramento date
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_cancelado then 'cancelado'
    when p_encerramento is not null
         and (now() at time zone 'Africa/Maputo')::date >= p_encerramento then 'concluido'
    when p_abertura is not null
         and (now() at time zone 'Africa/Maputo')::date >= p_abertura then 'em_andamento'
    else 'planeado'
  end;
$$;

-- Campo calculado do PostgREST: select=...,status:estado_curso
create or replace function public.estado_curso(c public.cursos)
returns text
language sql
stable
set search_path = public
as $$
  select public.estado_curso_datas(c.cancelado, c.data_abertura, c.data_encerramento);
$$;

revoke all on function public.estado_curso_datas(boolean, date, date) from public, anon;
revoke all on function public.estado_curso(public.cursos) from public, anon;
grant execute on function public.estado_curso_datas(boolean, date, date) to authenticated;
grant execute on function public.estado_curso(public.cursos) to authenticated;

-- 3) Emissão: usa o estado calculado ------------------------------------------------
create or replace function public.emitir_certificados(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso public.cursos%rowtype;
  v_perfil public.profiles%rowtype;
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
  if v_curso.cancelado then
    raise exception 'Não é possível emitir certificados de um curso cancelado.';
  end if;
  if v_curso.data_encerramento is null then
    raise exception 'Defina a data de encerramento do curso antes de emitir certificados.';
  end if;
  if public.estado_curso(v_curso) <> 'concluido' then
    raise exception 'Só é possível emitir certificados a partir da data de encerramento (%).',
      to_char(v_curso.data_encerramento, 'DD/MM/YYYY');
  end if;

  select * into v_perfil from public.profiles p where p.id = v_curso.user_id;

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
          data_encerramento, nota, emissor_nome, modelo,
          logo_path, assinatura_path, responsavel_nome, responsavel_cargo
        ) values (
          v_codigo, r.id, v_curso.id, r.formando_id, v_curso.user_id, v_curso.tipo,
          r.nome, v_curso.nome, v_curso.carga_horaria, v_curso.data_abertura,
          v_curso.data_encerramento,
          case when v_curso.tipo = 'tecnico_profissional' then r.avaliacao else null end,
          coalesce(v_perfil.organization_name, 'Sem organização'),
          v_curso.modelo_certificado,
          v_perfil.logo_path, v_perfil.assinatura_path,
          nullif(btrim(coalesce(v_perfil.responsavel_nome, '')), ''),
          nullif(btrim(coalesce(v_perfil.responsavel_cargo, '')), '')
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

revoke all on function public.emitir_certificados(uuid) from public, anon;
grant execute on function public.emitir_certificados(uuid) to authenticated;

-- O PostgREST passa a ver a coluna cancelado e o campo calculado.
notify pgrst, 'reload schema';

-- ============================================================================
-- 20261028000001_remover_trigger_estado.sql
-- ============================================================================

-- Remove o trigger antigo que definia cursos.status a partir das datas.
-- Aplicar DEPOIS de 20261028000000_estado_automatico.sql.
--
-- O trigger trg_cursos_estado (função definir_estado_curso) foi criado
-- directamente na BD, fora das migrações, e escrevia NEW.status. Desde a
-- migração anterior a coluna status já não existe (o estado é calculado na
-- leitura por public.estado_curso), por isso qualquer insert/update em cursos
-- falhava com 'record "new" has no field "status"'.

drop trigger if exists trg_cursos_estado on public.cursos;
drop function if exists public.definir_estado_curso();

-- ============================================================================
-- 20261028000002_alinhar_cursos.sql
-- ============================================================================

-- Alinha public.cursos com a aplicação - Microlegal Certificados
-- Aplicar DEPOIS de 20261028000001_remover_trigger_estado.sql.
--
-- Algumas alterações foram feitas directamente na BD, fora das migrações:
--
-- 1) Coluna categoria (+ cursos_categoria_obrigatoria, cursos_categoria_valida):
--    duplicava cursos.tipo (mesmos valores: participacao/tecnico_profissional)
--    e, por a aplicação não a preencher, impedia criar cursos. O tipo é a
--    categoria do curso e é dele que sai o preço (participação 100 MT,
--    técnico-profissional 150 MT). Antes de remover, confirma-se que nenhum
--    curso tem categoria diferente do tipo, para não se perder informação.
--
-- 2) cursos_datas_obrigatorias: mantida e passada para as migrações. Com o
--    estado calculado a partir das datas, as duas datas são obrigatórias.
--    Fica NOT VALID: cursos antigos sem datas continuam a existir, mas têm de
--    as receber na próxima edição.

-- 1) categoria -> tipo -------------------------------------------------------------
do $$
declare
  v_diferentes int;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cursos' and column_name = 'categoria'
  ) then
    execute 'select count(*) from public.cursos where categoria is not null and categoria <> tipo'
      into v_diferentes;
    if v_diferentes > 0 then
      raise exception
        'Há % curso(s) com categoria diferente do tipo. Corrija-os antes de aplicar esta migração.',
        v_diferentes;
    end if;
    alter table public.cursos drop constraint if exists cursos_categoria_obrigatoria;
    alter table public.cursos drop constraint if exists cursos_categoria_valida;
    alter table public.cursos drop column categoria;
  end if;
end
$$;

-- 2) Datas obrigatórias -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cursos'::regclass and conname = 'cursos_datas_obrigatorias'
  ) then
    alter table public.cursos
      add constraint cursos_datas_obrigatorias
      check (data_abertura is not null and data_encerramento is not null) not valid;
  end if;
end
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- 20261028000003_encerramento_cursos.sql
-- ============================================================================

-- Encerramento de cursos e limpeza do estado antigo - Microlegal Certificados
-- Aplicar DEPOIS de 20261028000002_alinhar_cursos.sql.
--
-- O encerramento de cursos (encerrado_em/encerrado_por, encerrar_curso e os
-- triggers de protecção) foi criado directamente na BD, fora das migrações.
-- Esta migração passa-o para o repositório, sem alterar o comportamento,
-- excepto onde dependia de colunas que já não existem:
--   * categoria (removida em 20261028000002): o tipo é a categoria do curso;
--   * status (removida em 20261028000000): o estado é calculado na leitura.
--
-- Regras do encerramento (como estavam):
--   * encerrar_curso grava as avaliações finais e marca o curso encerrado;
--   * só se encerra um curso que já começou;
--   * um curso encerrado não pode mudar de dados, nem as suas matrículas e
--     avaliações.

-- 1) Estado antigo: actualizar_estados_cursos escrevia cursos.status ---------------
do $$
declare
  r record;
begin
  -- Desagenda eventuais tarefas pg_cron que chamem a função removida.
  if to_regclass('cron.job') is not null then
    for r in execute
      'select jobid from cron.job where command ilike ''%actualizar_estados_cursos%'''
    loop
      execute format('select cron.unschedule(%s::bigint)', r.jobid);
    end loop;
  end if;

  -- Remove todas as versões, seja qual for a assinatura.
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('actualizar_estados_cursos', 'calcular_estado_curso')
  loop
    execute format('drop function %s', r.fn);
  end loop;
end
$$;

-- 2) Colunas do encerramento ------------------------------------------------------
alter table public.cursos
  add column if not exists encerrado_em timestamptz,
  add column if not exists encerrado_por uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cursos'::regclass and conname = 'cursos_encerrado_por_fkey'
  ) then
    alter table public.cursos
      add constraint cursos_encerrado_por_fkey
      foreign key (encerrado_por) references auth.users (id) on delete set null;
  end if;
end
$$;

-- 3) Protecção do curso encerrado -----------------------------------------------------
-- Antes comparava/exigia categoria; agora usa tipo. A data de referência é o
-- dia de hoje em Maputo, como no estado calculado (public.estado_curso_datas).
create or replace function public.proteger_curso_encerrado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.encerrado_em is not null then
      raise exception using errcode = 'P0001', message = 'Um curso novo não pode ser criado já encerrado.';
    end if;
    return new;
  end if;

  if old.encerrado_em is not null then
    if new.encerrado_em is distinct from old.encerrado_em
       or new.encerrado_por is distinct from old.encerrado_por
       or new.nome is distinct from old.nome
       or new.carga_horaria is distinct from old.carga_horaria
       or new.data_abertura is distinct from old.data_abertura
       or new.data_encerramento is distinct from old.data_encerramento
       or new.tipo is distinct from old.tipo
       or new.codigo is distinct from old.codigo
       or new.user_id is distinct from old.user_id then
      raise exception using errcode = 'P0001', message = 'Curso encerrado: os dados já não podem ser alterados.';
    end if;
    return new;
  end if;

  if new.encerrado_em is not null then
    if new.data_abertura is null
       or new.data_abertura > (now() at time zone 'Africa/Maputo')::date then
      raise exception using errcode = 'P0001', message = 'Só é possível encerrar um curso que já começou.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cursos_proteger_encerrado on public.cursos;
create trigger trg_cursos_proteger_encerrado
  before insert or update on public.cursos
  for each row execute function public.proteger_curso_encerrado();

-- 4) Matrículas de curso encerrado ficam bloqueadas ------------------------------------
create or replace function public.proteger_matriculas_curso_encerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encerrado timestamptz;
begin
  select c.encerrado_em into v_encerrado
    from public.cursos c
   where c.id = case when tg_op = 'DELETE' then old.curso_id else new.curso_id end;
  if v_encerrado is not null then
    raise exception using errcode = 'P0001',
      message = 'Curso encerrado: as inscrições e avaliações já não podem ser alteradas.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matriculas_curso_encerrado on public.matriculas;
create trigger trg_matriculas_curso_encerrado
  before insert or update or delete on public.matriculas
  for each row execute function public.proteger_matriculas_curso_encerrado();

-- 5) Encerrar curso (grava avaliações finais e fecha o curso) -----------------------------
create or replace function public.encerrar_curso(p_curso_id uuid, p_avaliacoes jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_owner uuid;
  v_encerrado timestamptz;
  v_item jsonb;
  v_idx integer := 0;
  v_matricula_id uuid;
  v_avaliacao numeric;
  v_ids uuid[] := '{}';
  v_actualizadas integer := 0;
  v_count integer;
  v_total integer;
  v_data timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Não autenticado.';
  end if;

  select c.user_id, c.encerrado_em into v_owner, v_encerrado
    from public.cursos c
   where c.id = p_curso_id
     for update;
  if v_owner is null or (v_owner <> auth.uid() and public.is_admin() is not true) then
    raise exception using errcode = 'P0002', message = 'Curso não encontrado.';
  end if;
  if v_encerrado is not null then
    raise exception using errcode = 'P0001', message = 'O curso já está encerrado.';
  end if;

  if p_avaliacoes is null then
    p_avaliacoes := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_avaliacoes) <> 'array' then
    raise exception using errcode = '22023', message = 'Lista de avaliações inválida.';
  end if;

  for v_item in select value from jsonb_array_elements(p_avaliacoes) loop
    v_idx := v_idx + 1;
    begin
      v_matricula_id := (v_item ->> 'matricula_id')::uuid;
    exception when others then
      raise exception using errcode = '22023', message = format('Avaliação %s: matrícula inválida.', v_idx);
    end;
    if v_matricula_id is null or jsonb_typeof(v_item -> 'avaliacao') is distinct from 'number' then
      raise exception using errcode = '22023', message = format('Avaliação %s: dados inválidos.', v_idx);
    end if;
    v_avaliacao := (v_item ->> 'avaliacao')::numeric;
    if v_avaliacao < 0 or v_avaliacao > 20 then
      raise exception using errcode = '22023',
        message = format('Avaliação %s: deve estar entre 0 e 20.', v_idx);
    end if;
    if v_matricula_id = any (v_ids) then
      raise exception using errcode = '22023', message = format('Avaliação %s: matrícula repetida.', v_idx);
    end if;
    v_ids := v_ids || v_matricula_id;

    update public.matriculas m
       set avaliacao = v_avaliacao
     where m.id = v_matricula_id and m.curso_id = p_curso_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception using errcode = '22023',
        message = format('Avaliação %s: a matrícula não pertence a este curso.', v_idx);
    end if;
    v_actualizadas := v_actualizadas + 1;
  end loop;

  update public.cursos
     set encerrado_em = now(), encerrado_por = auth.uid()
   where id = p_curso_id
  returning encerrado_em into v_data;

  select count(*)::int into v_total from public.matriculas where curso_id = p_curso_id;

  return jsonb_build_object(
    'curso_id', p_curso_id,
    'encerrado_em', v_data,
    'avaliacoes_actualizadas', v_actualizadas,
    'total_formandos', v_total
  );
end;
$$;

revoke all on function public.encerrar_curso(uuid, jsonb) from public, anon;
grant execute on function public.encerrar_curso(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- 20261028000004_matriculas_sem_nota_por_defeito.sql
-- ============================================================================

-- Matrículas sem nota por defeito - Microlegal Certificados
-- Aplicar DEPOIS de 20261028000003_encerramento_cursos.sql.
--
-- Na BD, matriculas.avaliacao tinha um valor por defeito (definido fora das
-- migrações). Matricular um formando já registado num curso de participação
-- falhava com «Cursos de participação não têm avaliação.», porque a matrícula
-- nascia com essa nota. A nota começa sempre vazia e é lançada depois.

alter table public.matriculas alter column avaliacao drop default;

-- ============================================================================
-- 20261028000005_encerrar_e_emitir.sql
-- ============================================================================

-- Encerrar, reabrir e emitir - Microlegal Certificados
-- Aplicar DEPOIS de 20261028000004_matriculas_sem_nota_por_defeito.sql.
--
-- Fluxo do curso:
--   Planeado -> Em andamento -> Concluído -> [Encerrar] -> Encerrado -> [Emitir]
--               (pelas datas)
--
--   * O estado calculado ganha "encerrado" (encerrado_em preenchido).
--   * Encerrar: só cursos concluídos, não cancelados, com formandos e, nos
--     técnico-profissionais, com todas as notas lançadas. Congela o curso e
--     as matrículas (triggers de 20261028000003).
--   * Reabrir: volta a permitir alterações (ex.: corrigir uma nota depois de
--     anular o certificado). Certificados já emitidos mantêm-se; as notas
--     com certificado activo continuam bloqueadas pelo trigger próprio.
--   * Emitir certificados: só com o curso encerrado.

-- 1) Estado calculado com "encerrado" ------------------------------------------------
create or replace function public.estado_curso(c public.cursos)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when c.cancelado then 'cancelado'
    when c.encerrado_em is not null then 'encerrado'
    else public.estado_curso_datas(c.cancelado, c.data_abertura, c.data_encerramento)
  end;
$$;

-- 2) Protecção do curso encerrado: só reabrir_curso o pode desfazer --------------------
-- reabrir_curso liga a variável de sessão app.reabrir_curso (local à transacção);
-- fora dela, um curso encerrado não muda (nem pode ser cancelado).
create or replace function public.proteger_curso_encerrado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.encerrado_em is not null then
      raise exception using errcode = 'P0001', message = 'Um curso novo não pode ser criado já encerrado.';
    end if;
    return new;
  end if;

  if old.encerrado_em is not null then
    if coalesce(current_setting('app.reabrir_curso', true), '') = 'on'
       and new.encerrado_em is null and new.encerrado_por is null then
      return new;
    end if;
    if new.encerrado_em is distinct from old.encerrado_em
       or new.encerrado_por is distinct from old.encerrado_por
       or new.nome is distinct from old.nome
       or new.carga_horaria is distinct from old.carga_horaria
       or new.data_abertura is distinct from old.data_abertura
       or new.data_encerramento is distinct from old.data_encerramento
       or new.tipo is distinct from old.tipo
       or new.cancelado is distinct from old.cancelado
       or new.codigo is distinct from old.codigo
       or new.user_id is distinct from old.user_id then
      raise exception using errcode = 'P0001',
        message = 'Curso encerrado: os dados já não podem ser alterados. Reabra o curso para os corrigir.';
    end if;
    return new;
  end if;

  if new.encerrado_em is not null then
    if new.cancelado then
      raise exception using errcode = 'P0001', message = 'Um curso cancelado não pode ser encerrado.';
    end if;
    if public.estado_curso_datas(false, new.data_abertura, new.data_encerramento) <> 'concluido' then
      raise exception using errcode = 'P0001',
        message = format('Só é possível encerrar o curso a partir da data de encerramento (%s).',
                         coalesce(to_char(new.data_encerramento, 'DD/MM/YYYY'), 'por definir'));
    end if;
  end if;
  return new;
end;
$$;

-- 3) Encerrar: exige formandos e, nos técnico-profissionais, todas as notas -----------
create or replace function public.encerrar_curso(p_curso_id uuid, p_avaliacoes jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_owner uuid;
  v_encerrado timestamptz;
  v_tipo text;
  v_item jsonb;
  v_idx integer := 0;
  v_matricula_id uuid;
  v_avaliacao numeric;
  v_ids uuid[] := '{}';
  v_actualizadas integer := 0;
  v_count integer;
  v_total integer;
  v_sem_nota integer;
  v_data timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Não autenticado.';
  end if;

  select c.user_id, c.encerrado_em, c.tipo into v_owner, v_encerrado, v_tipo
    from public.cursos c
   where c.id = p_curso_id
     for update;
  if v_owner is null or (v_owner <> auth.uid() and public.is_admin() is not true) then
    raise exception using errcode = 'P0002', message = 'Curso não encontrado.';
  end if;
  if v_encerrado is not null then
    raise exception using errcode = 'P0001', message = 'O curso já está encerrado.';
  end if;

  if p_avaliacoes is null then
    p_avaliacoes := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_avaliacoes) <> 'array' then
    raise exception using errcode = '22023', message = 'Lista de avaliações inválida.';
  end if;

  for v_item in select value from jsonb_array_elements(p_avaliacoes) loop
    v_idx := v_idx + 1;
    begin
      v_matricula_id := (v_item ->> 'matricula_id')::uuid;
    exception when others then
      raise exception using errcode = '22023', message = format('Avaliação %s: matrícula inválida.', v_idx);
    end;
    if v_matricula_id is null or jsonb_typeof(v_item -> 'avaliacao') is distinct from 'number' then
      raise exception using errcode = '22023', message = format('Avaliação %s: dados inválidos.', v_idx);
    end if;
    v_avaliacao := (v_item ->> 'avaliacao')::numeric;
    if v_avaliacao < 0 or v_avaliacao > 20 then
      raise exception using errcode = '22023',
        message = format('Avaliação %s: deve estar entre 0 e 20.', v_idx);
    end if;
    if v_matricula_id = any (v_ids) then
      raise exception using errcode = '22023', message = format('Avaliação %s: matrícula repetida.', v_idx);
    end if;
    v_ids := v_ids || v_matricula_id;

    update public.matriculas m
       set avaliacao = v_avaliacao
     where m.id = v_matricula_id and m.curso_id = p_curso_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception using errcode = '22023',
        message = format('Avaliação %s: a matrícula não pertence a este curso.', v_idx);
    end if;
    v_actualizadas := v_actualizadas + 1;
  end loop;

  select count(*)::int, count(*) filter (where avaliacao is null)::int
    into v_total, v_sem_nota
    from public.matriculas where curso_id = p_curso_id;
  if v_total = 0 then
    raise exception using errcode = 'P0001', message = 'Matricule formandos antes de encerrar o curso.';
  end if;
  if v_tipo = 'tecnico_profissional' and v_sem_nota > 0 then
    raise exception using errcode = 'P0001',
      message = format('Lance a nota de todos os formandos antes de encerrar (%s sem nota).', v_sem_nota);
  end if;

  -- As restantes regras (concluído, não cancelado) estão no trigger proteger_curso_encerrado.
  update public.cursos
     set encerrado_em = now(), encerrado_por = auth.uid()
   where id = p_curso_id
  returning encerrado_em into v_data;

  return jsonb_build_object(
    'curso_id', p_curso_id,
    'encerrado_em', v_data,
    'avaliacoes_actualizadas', v_actualizadas,
    'total_formandos', v_total
  );
end;
$$;

-- 4) Reabrir ---------------------------------------------------------------------------
create or replace function public.reabrir_curso(p_curso_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_owner uuid;
  v_encerrado timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Não autenticado.';
  end if;

  select c.user_id, c.encerrado_em into v_owner, v_encerrado
    from public.cursos c
   where c.id = p_curso_id
     for update;
  if v_owner is null or (v_owner <> auth.uid() and public.is_admin() is not true) then
    raise exception using errcode = 'P0002', message = 'Curso não encontrado.';
  end if;
  if v_encerrado is null then
    raise exception using errcode = 'P0001', message = 'O curso não está encerrado.';
  end if;

  perform set_config('app.reabrir_curso', 'on', true);
  update public.cursos set encerrado_em = null, encerrado_por = null where id = p_curso_id;
  perform set_config('app.reabrir_curso', '', true);

  return jsonb_build_object('curso_id', p_curso_id);
end;
$$;

revoke all on function public.encerrar_curso(uuid, jsonb) from public, anon;
grant execute on function public.encerrar_curso(uuid, jsonb) to authenticated;
revoke all on function public.reabrir_curso(uuid) from public, anon;
grant execute on function public.reabrir_curso(uuid) to authenticated;

-- 5) Emissão: só com o curso encerrado ----------------------------------------------------
create or replace function public.emitir_certificados(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso public.cursos%rowtype;
  v_perfil public.profiles%rowtype;
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
  if v_curso.cancelado then
    raise exception 'Não é possível emitir certificados de um curso cancelado.';
  end if;
  if v_curso.encerrado_em is null then
    raise exception 'Encerre o curso antes de emitir certificados.';
  end if;

  select * into v_perfil from public.profiles p where p.id = v_curso.user_id;

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
          data_encerramento, nota, emissor_nome, modelo,
          logo_path, assinatura_path, responsavel_nome, responsavel_cargo
        ) values (
          v_codigo, r.id, v_curso.id, r.formando_id, v_curso.user_id, v_curso.tipo,
          r.nome, v_curso.nome, v_curso.carga_horaria, v_curso.data_abertura,
          v_curso.data_encerramento,
          case when v_curso.tipo = 'tecnico_profissional' then r.avaliacao else null end,
          coalesce(v_perfil.organization_name, 'Sem organização'),
          v_curso.modelo_certificado,
          v_perfil.logo_path, v_perfil.assinatura_path,
          nullif(btrim(coalesce(v_perfil.responsavel_nome, '')), ''),
          nullif(btrim(coalesce(v_perfil.responsavel_cargo, '')), '')
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

revoke all on function public.emitir_certificados(uuid) from public, anon;
grant execute on function public.emitir_certificados(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
