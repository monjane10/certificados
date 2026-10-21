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
