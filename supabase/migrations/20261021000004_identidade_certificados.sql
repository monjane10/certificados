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
