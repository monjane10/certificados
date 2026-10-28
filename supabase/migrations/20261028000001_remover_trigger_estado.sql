-- Remove o trigger antigo que definia cursos.status a partir das datas.
-- Aplicar DEPOIS de 20261028000000_estado_automatico.sql.
--
-- O trigger trg_cursos_estado (função definir_estado_curso) foi criado
-- directamente na BD, fora das migrações, e escrevia NEW.status. Desde a
-- migração anterior a coluna status já não existe (o estado é calculado na
-- leitura por public.estado_curso), por isso qualquer insert/update em cursos
-- falhava com 'record "new" has no field "status"'.

drop trigger if exists trg_cursos_estado on public.cursos;
drop function if exists public.definir_estado_curso();
