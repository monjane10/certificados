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
