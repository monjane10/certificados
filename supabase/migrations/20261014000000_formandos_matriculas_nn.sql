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
