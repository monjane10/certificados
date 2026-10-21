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
