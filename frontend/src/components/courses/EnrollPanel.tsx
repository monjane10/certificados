import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { TraineeForm, type TraineeFormValues } from './TraineeForm';
import { traineeService } from '../../services/courses';
import type { Trainee } from '../../types';

type Mode = 'novo' | 'existente';

export function EnrollPanel({
  saving,
  comNotas,
  enrolledIds,
  onEnrollNew,
  onEnrollExisting,
  onCancel,
}: {
  saving: boolean;
  /** false em cursos de participação: sem campo de avaliação. */
  comNotas: boolean;
  /** Formandos já matriculados neste curso (não podem ser seleccionados). */
  enrolledIds: string[];
  onEnrollNew: (v: TraineeFormValues) => void;
  /** Matricula de uma vez todos os formandos seleccionados. */
  onEnrollExisting: (trainees: Trainee[]) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('novo');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Trainee[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Trainee | null>(null);
  // Map (e não Set de ids) para a selecção sobreviver a novas pesquisas.
  const [selected, setSelected] = useState<Map<string, Trainee>>(new Map());

  const enrolled = useMemo(() => new Set(enrolledIds), [enrolledIds]);
  const selectable = results.filter((t) => !enrolled.has(t.id));
  const allVisibleSelected = selectable.length > 0 && selectable.every((t) => selected.has(t.id));

  useEffect(() => {
    if (mode !== 'existente') return;
    setSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        setResults(await traineeService.search(q));
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : 'Falha na pesquisa.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [mode, q]);

  function toggle(t: Trainee) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.set(t.id, t);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allVisibleSelected) selectable.forEach((t) => next.delete(t.id));
      else selectable.forEach((t) => next.set(t.id, t));
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('novo')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === 'novo' ? 'bg-white text-brand-900 shadow-card' : 'text-slate-500'
          }`}
        >
          Novo formando
        </button>
        <button
          type="button"
          onClick={() => setMode('existente')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === 'existente' ? 'bg-white text-brand-900 shadow-card' : 'text-slate-500'
          }`}
        >
          Já registado
        </button>
      </div>

      {mode === 'novo' ? (
        <TraineeForm
          saving={saving}
          submitLabel="Criar e matricular"
          withAvaliacao={comNotas}
          avaliacaoHint="Avaliação inicial neste curso (opcional; pode editar depois)."
          onSubmit={onEnrollNew}
          onCancel={onCancel}
        />
      ) : (
        <div className="space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar por nome"
            aria-label="Procurar formando registado"
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {searchError && <p className="text-sm text-red-600">{searchError}</p>}
          {searching ? (
            <p className="py-4 text-center text-sm text-slate-500">A pesquisar...</p>
          ) : results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Nenhum formando encontrado. Crie um novo no separador "Novo formando".
            </p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2.5 px-1 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={selectable.length === 0}
                  onChange={toggleAllVisible}
                  className="h-4 w-4 accent-brand-900"
                />
                Seleccionar todos ({selectable.length})
              </label>
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {results.map((t) => {
                  const jaMatriculado = enrolled.has(t.id);
                  const marcado = selected.has(t.id);
                  return (
                    <li
                      key={t.id}
                      className={`rounded-xl border p-3 ${
                        marcado ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                      } ${jaMatriculado ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className={`flex min-w-0 flex-1 items-center gap-2.5 ${jaMatriculado ? '' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            disabled={jaMatriculado || saving}
                            onChange={() => toggle(t)}
                            className="h-4 w-4 shrink-0 accent-brand-900"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-brand-950">{t.nome}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {jaMatriculado
                                ? 'Já matriculado neste curso'
                                : [t.email, t.contacto].filter(Boolean).join(' · ') || 'Sem contactos'}
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setPreview(preview?.id === t.id ? null : t)}
                          className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-900"
                        >
                          {preview?.id === t.id ? 'Ocultar' : 'Consultar'}
                        </button>
                      </div>
                      {preview?.id === t.id && (
                        <dl className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                          <div>
                            <dt className="font-semibold text-slate-500">Nome</dt>
                            <dd className="mt-0.5 text-brand-950">{t.nome}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-slate-500">Email</dt>
                            <dd className="mt-0.5 text-brand-950">{t.email ?? '-'}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-slate-500">Contacto</dt>
                            <dd className="mt-0.5 text-brand-950">{t.contacto ?? '-'}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-slate-500">Registado em</dt>
                            <dd className="mt-0.5 text-brand-950">{new Date(t.created_at).toLocaleDateString('pt-MZ')}</dd>
                          </div>
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {selected.size === 0
                ? 'Nenhum formando seleccionado.'
                : `${selected.size} seleccionado(s).`}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="flex-1 sm:flex-none">
                Fechar
              </Button>
              <Button
                type="button"
                onClick={() => onEnrollExisting([...selected.values()])}
                disabled={selected.size === 0}
                loading={saving}
                className="flex-1 sm:flex-none"
              >
                {selected.size > 0 ? `Matricular ${selected.size}` : 'Matricular'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
