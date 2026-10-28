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
