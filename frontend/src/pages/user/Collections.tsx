import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/courses/Modal';
import { CourseTypeBadge } from '../../components/courses/CourseTypeBadge';
import { ErrorState, LoadingState } from '../../components/courses/States';
import { certificateService } from '../../services/certificates';
import { fmtDate } from '../../lib/certificates';
import type { Certificate, CertificateState } from '../../types';

type StateFilter = 'todos' | CertificateState;

function StateBadge({ estado }: { estado: CertificateState }) {
  return estado === 'emitido' ? (
    <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-700">Emitido</span>
  ) : (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Anulado</span>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-MZ');
}

export function UserCertificates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const courseFilter = searchParams.get('curso') ?? '';
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [stateFilter, setStateFilter] = useState<StateFilter>('todos');
  const [annulling, setAnnulling] = useState<Certificate | null>(null);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCerts(await certificateService.list(courseFilter || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar certificados.');
    } finally {
      setLoading(false);
    }
  }, [courseFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs.filter(
      (c) =>
        (stateFilter === 'todos' || c.estado === stateFilter) &&
        (!q ||
          c.codigo.toLowerCase().includes(q) ||
          c.formando_nome.toLowerCase().includes(q) ||
          c.curso_nome.toLowerCase().includes(q)),
    );
  }, [certs, search, stateFilter]);

  async function handleAnnul() {
    if (!annulling || saving) return;
    if (motivo.trim().length < 3) {
      toast.error('Indique o motivo da anulação (mín. 3 caracteres).');
      return;
    }
    setSaving(true);
    try {
      const updated = await certificateService.annul(annulling.id, motivo.trim());
      setCerts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(`Certificado ${updated.codigo} anulado. A nota/matrícula do formando fica de novo editável.`);
      setAnnulling(null);
      setMotivo('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao anular o certificado.');
    } finally {
      setSaving(false);
    }
  }

  const courseName = courseFilter ? certs[0]?.curso_nome : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">Certificados</h1>
        <p className="mt-1 text-sm text-slate-500">
          Emita certificados a partir da página de cada curso concluído. Aqui consulta, imprime e anula os certificados emitidos.
        </p>
      </div>

      {courseFilter && (
        <p className="text-sm text-slate-500">
          Curso: <strong className="text-brand-950">{courseName ?? '...'}</strong> ·{' '}
          <button
            onClick={() => setSearchParams({})}
            className="font-semibold text-brand-900 hover:underline"
          >
            Ver todos
          </button>
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por código, formando ou curso"
          aria-label="Pesquisar certificados"
          className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-soft"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as StateFilter)}
          aria-label="Filtrar por estado"
          className="rounded-control border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-soft sm:w-48"
        >
          <option value="todos">Todos os estados</option>
          <option value="emitido">Emitidos</option>
          <option value="anulado">Anulados</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="A carregar certificados..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={certs.length === 0 ? 'Ainda sem certificados' : 'Sem resultados'}
            description={
              certs.length === 0
                ? 'Abra um curso concluído e use «Emitir certificados» para emitir todos os elegíveis de uma vez.'
                : 'Nenhum certificado corresponde aos filtros.'
            }
            action={
              certs.length === 0 ? (
                <Link
                  to="/app/cursos"
                  className="inline-flex items-center justify-center rounded-button bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-950"
                >
                  Ir para cursos
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtered.map((c) => (
            <li key={c.id} className="flex flex-col rounded-card border border-line bg-white">
              <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-ink">{c.formando_nome}</p>
                  <p className="mt-0.5 break-words text-sm text-muted">{c.curso_nome}</p>
                </div>
                <StateBadge estado={c.estado} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 px-4 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted">Código</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-ink">{c.codigo}</dd>
                </div>
                <div>
                  <dt className="text-muted">Tipo</dt>
                  <dd className="mt-0.5">
                    <CourseTypeBadge tipo={c.tipo} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{c.tipo === 'tecnico_profissional' ? 'Nota' : 'Carga'}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                    {c.tipo === 'tecnico_profissional' ? `${c.nota} valores` : `${c.carga_horaria}h`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Emitido em</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{fmtDateTime(c.emitido_em)}</dd>
                </div>
              </dl>
              {c.estado === 'anulado' && (
                <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  Anulado em {c.anulado_em ? fmtDateTime(c.anulado_em) : '-'}: {c.motivo_anulacao}
                </p>
              )}
              <p className="mt-2 px-4 text-xs text-muted">
                Período: {fmtDate(c.data_abertura)} a {fmtDate(c.data_encerramento)}
              </p>
              <div className={`mt-3 grid border-t border-line text-sm font-medium ${c.estado === 'emitido' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Link to={`/certificado/${c.codigo}`} target="_blank" className="py-2.5 text-center text-ink hover:bg-soft">
                  Ver / imprimir
                </Link>
                {c.estado === 'emitido' && (
                  <button onClick={() => setAnnulling(c)} className="border-l border-line py-2.5 text-red-700 hover:bg-red-50">
                    Anular
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={annulling !== null} title="Anular certificado" onClose={() => (saving ? null : setAnnulling(null))}>
        {annulling && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              Anular o certificado <strong className="font-mono text-brand-950">{annulling.codigo}</strong> de{' '}
              <strong className="text-brand-950">{annulling.formando_nome}</strong>? A verificação pública passa a indicar
              «anulado». O registo não é apagado e pode emitir um novo certificado depois de corrigir os dados.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="motivo" className="block text-sm font-medium text-brand-950">
                Motivo <span className="text-red-600">*</span>
              </label>
              <textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ex.: Nota lançada incorrectamente"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAnnulling(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleAnnul} loading={saving}>
                Anular certificado
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
