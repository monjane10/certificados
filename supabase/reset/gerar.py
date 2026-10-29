"""Gera recriar_dominio.sql a partir de supabase/migrations/.

Uso (na raiz do repositório):  python supabase/reset/gerar.py

Junta, por ordem, todas as migrações do domínio (de 20261013000000 em diante)
numa única transacção, precedidas da remoção das tabelas e funções do domínio.
As migrações do perfil (20261010*) ficam de fora: profiles não é tocado.
"""
import glob
import io
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
MIGRACOES = os.path.join(AQUI, '..', 'migrations')
PRIMEIRA = '20261013000000'

# Ordem: dependentes primeiro (pagamentos -> certificados -> matriculas -> ...).
TABELAS = [
    'pagamentos',
    'certificados',
    'certificados_legado',
    'matriculas',
    'formandos',
    'formandos_matriculados',
    'cursos',
]

FUNCOES = [
    'generate_course_code', 'fill_course_code', 'protect_trainee_course',
    'protect_formando_owner', 'protect_matricula_link', 'remover_matricula',
    'remover_curso', 'check_avaliacao_tipo_curso', 'protect_curso_tipo',
    'nota_minima_aprovacao', 'generate_certificate_code', 'emitir_certificados',
    'anular_certificado', 'verificar_certificado', 'protect_matricula_certificada',
    'protect_curso_certificado_tipo', 'sync_modelo_certificados',
    'estado_curso_datas', 'estado_curso', 'proteger_curso_encerrado',
    'proteger_matriculas_curso_encerrado', 'encerrar_curso', 'reabrir_curso',
    'taxa_certificado', 'preparar_certificado', 'pagamentos_touch',
    'certificado_por_token', 'marcar_whatsapp_enviado',
]
# Criadas directamente na BD, fora das migrações.
FUNCOES_FORA = ['definir_estado_curso', 'actualizar_estados_cursos', 'calcular_estado_curso']

CABECALHO = """-- RECRIAR O DOMÍNIO DO ZERO - Microlegal Certificados
-- ============================================================================
-- APAGA TODOS os cursos, formandos, matrículas, certificados e PAGAMENTOS e
-- recria as tabelas, funções, triggers e políticas exactamente como estão nas
-- migrações do repositório (de {primeira} até à última).
--
-- ATENÇÃO: os pagamentos são registos de dinheiro recebido. Não use este
-- script numa base de dados com pagamentos reais.
--
-- NÃO toca em:
--   * public.profiles (perfis, códigos, papéis, primeiro admin, logótipo,
--     assinatura e responsável) nem nas suas funções/triggers;
--   * auth.users (contas de acesso);
--   * Storage (bucket "branding" e as imagens já carregadas).
--
-- Corre numa única transacção: se algum passo falhar, nada é alterado.
-- Gerado por supabase/reset/gerar.py a partir de supabase/migrations/;
-- não editar à mão.
-- ============================================================================

begin;

-- 0) Apagar o domínio ---------------------------------------------------------------
-- As tabelas levam consigo triggers, políticas, índices e restrições (incluindo
-- os criados fora das migrações).
{tabelas}

-- Funções do domínio (todas as assinaturas), incluindo as criadas fora das
-- migrações. As funções do perfil (is_admin, handle_updated_at, ...) ficam.
do $$
declare
  r record;
begin
  if to_regclass('cron.job') is not null then
    for r in execute
      'select jobid from cron.job where command ~* ''(actualizar_estados_cursos|encerrar_curso|emitir_certificados)'''
    loop
      execute format('select cron.unschedule(%s::bigint)', r.jobid);
    end loop;
  end if;

  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
{funcoes}
      )
  loop
    execute format('drop function %s cascade', r.fn);
  end loop;
end
$$;
"""


def lista_sql(nomes, indent='        '):
    linhas, linha = [], []
    for n in nomes:
        linha.append(f"'{n}'")
        if len(linha) == 3:
            linhas.append(indent + ', '.join(linha))
            linha = []
    if linha:
        linhas.append(indent + ', '.join(linha))
    return ',\n'.join(linhas)


def main():
    migs = sorted(f for f in glob.glob(os.path.join(MIGRACOES, '*.sql')) if os.path.basename(f) >= PRIMEIRA)
    funcoes = lista_sql(FUNCOES) + ',\n        -- criadas fora das migrações\n' + lista_sql(FUNCOES_FORA)
    partes = [CABECALHO.format(
        primeira=PRIMEIRA,
        tabelas='\n'.join(f'drop table if exists public.{t} cascade;' for t in TABELAS),
        funcoes=funcoes,
    )]
    for f in migs:
        corpo = io.open(f, encoding='utf-8').read().replace('\r\n', '\n').rstrip() + '\n'
        nome = os.path.basename(f)
        partes.append(f'\n-- {"=" * 76}\n-- {nome}\n-- {"=" * 76}\n\n{corpo}')
    partes.append('\ncommit;\n')
    destino = os.path.join(AQUI, 'recriar_dominio.sql')
    io.open(destino, 'w', encoding='utf-8', newline='\n').write(''.join(partes))
    print(f'{len(migs)} migrações: {os.path.basename(migs[0])} ... {os.path.basename(migs[-1])}')


if __name__ == '__main__':
    main()
