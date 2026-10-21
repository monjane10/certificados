-- Tipo de curso - Microlegal Certificados
-- Aplicar DEPOIS de 20261021000000_correcoes_seguranca.sql.
--
-- Cada curso passa a ter um tipo, que determina se há avaliação e (futuramente)
-- o modelo de certificado:
--   * participacao          -> sem notas; certificado de participação.
--   * tecnico_profissional  -> nota 0-20 por matrícula; certificado com nota
--                              (aprovação a partir de 10 valores, regra da app).
--
-- Regras garantidas na BD (mesmo com acesso directo via API do Supabase):
--   1. Matrículas de cursos de participação não podem ter avaliação.
--   2. Um curso só passa a "participacao" se nenhuma matrícula tiver nota.

-- 1) Coluna tipo ----------------------------------------------------------------
-- Cursos existentes ficam como técnico-profissionais (podem já ter notas; não
-- se perde informação). O default é removido a seguir: novos cursos têm de
-- indicar o tipo explicitamente.
alter table public.cursos
  add column if not exists tipo text not null default 'tecnico_profissional';

alter table public.cursos alter column tipo drop default;

alter table public.cursos drop constraint if exists cursos_tipo_check;
alter table public.cursos
  add constraint cursos_tipo_check check (tipo in ('participacao', 'tecnico_profissional'));

create index if not exists cursos_tipo_idx on public.cursos (tipo);

-- 2) Sem avaliação em cursos de participação ------------------------------------
create or replace function public.check_avaliacao_tipo_curso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  if new.avaliacao is null then
    return new;
  end if;
  select c.tipo into v_tipo from public.cursos c where c.id = new.curso_id;
  if v_tipo = 'participacao' then
    raise exception 'Cursos de participação não têm avaliação.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matriculas_avaliacao_tipo on public.matriculas;
create trigger trg_matriculas_avaliacao_tipo
  before insert or update of avaliacao, curso_id on public.matriculas
  for each row execute function public.check_avaliacao_tipo_curso();

-- 3) Mudança de tipo só sem notas lançadas --------------------------------------
create or replace function public.protect_curso_tipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'participacao'
     and old.tipo is distinct from new.tipo
     and exists (
       select 1 from public.matriculas m
       where m.curso_id = new.id and m.avaliacao is not null
     ) then
    raise exception 'Não é possível mudar para curso de participação: existem notas lançadas.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cursos_protect_tipo on public.cursos;
create trigger trg_cursos_protect_tipo
  before update of tipo on public.cursos
  for each row execute function public.protect_curso_tipo();
