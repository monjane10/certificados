-- Sprint 1 - Microlegal Certificados
-- Tabela profiles + RLS + trigger idempotente de criação de perfil.
-- Compatível com Supabase (Postgres). Aplicar via Supabase CLI ou SQL Editor.
--
-- Estratégia de autenticação (Sprint 1):
--   * Supabase Auth com EMAIL + PASSWORD.
--   * O formulário de registo pede email + organization_name + phone + password.
--   * Telefone é apenas dado de perfil (sem OTP/SMS nesta sprint).
--   * Novos perfis recebem SEMPRE role = 'user'. Nunca aceitar role do cliente.

-- 1) Tipos / tabela -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  email text,
  phone text,
  organization_name text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_code_idx on public.profiles (code);

-- 2) updated_at automático ----------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 3) Geração de código único ---------------------------------------------------
-- Formato: ML-XXXXXX (6 caracteres alfanuméricos, sem ambíguos 0/O/1/I).
create or replace function public.generate_profile_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := 'ML-';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, (floor(random() * length(alphabet)) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- 4) Trigger idempotente após signup ------------------------------------------
-- Lê organization_name / phone a partir de raw_user_meta_data.
-- Força role='user' independentemente de qualquer input do cliente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_org text;
  v_phone text;
  v_email text;
begin
  v_email := new.email;
  v_org := coalesce(nullif(new.raw_user_meta_data ->> 'organization_name', ''), 'Sem organização');
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');

  -- Gera código único com retry em caso de colisão.
  for i in 1..5 loop
    v_code := public.generate_profile_code();
    begin
      insert into public.profiles (id, code, email, phone, organization_name, role)
      values (new.id, v_code, v_email, v_phone, v_org, 'user')
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      -- tenta outro código
      continue;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) RLS -----------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Privilégios explícitos (defesa em profundidade e portabilidade: o Supabase
-- alojado já concede por defeito no schema public, mas noutros ambientes as
-- policies RLS sem GRANT resultariam em "permission denied").
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- Limpa políticas antigas para migração reproduzível.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

-- Cada utilizador autenticado lê apenas o próprio perfil.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Cada utilizador actualiza apenas o próprio perfil, sem tocar em role/code.
-- A protecção efectiva do campo role é feita também no trigger abaixo.
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Permite insert do próprio perfil (fallback caso o trigger falhe por
-- condição de corrida). O role continua forçado a 'user' pelo trigger
-- de protecção abaixo.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Admins (verificados via JWT -> tabela) têm acesso total.
-- Nota: usa função SECURITY DEFINER para evitar recursão de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6) Protecção do campo role ----------------------------------------------------
-- Impede que um não-admin altere o próprio role mesmo via API directa.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Garante role='user' em inserts directos (defesa em profundidade).
create or replace function public.force_default_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() is not true then
    new.role := 'user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_force_default_role on public.profiles;
create trigger trg_force_default_role
  before insert on public.profiles
  for each row execute function public.force_default_role();
