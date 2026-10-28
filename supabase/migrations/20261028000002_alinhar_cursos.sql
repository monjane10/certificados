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
