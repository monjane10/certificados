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
