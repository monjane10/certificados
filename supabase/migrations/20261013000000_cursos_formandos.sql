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
