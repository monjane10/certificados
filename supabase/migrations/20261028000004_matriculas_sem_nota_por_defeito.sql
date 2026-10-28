-- Matrículas sem nota por defeito - Microlegal Certificados
-- Aplicar DEPOIS de 20261028000003_encerramento_cursos.sql.
--
-- Na BD, matriculas.avaliacao tinha um valor por defeito (definido fora das
-- migrações). Matricular um formando já registado num curso de participação
-- falhava com «Cursos de participação não têm avaliação.», porque a matrícula
-- nascia com essa nota. A nota começa sempre vazia e é lançada depois.

alter table public.matriculas alter column avaliacao drop default;
