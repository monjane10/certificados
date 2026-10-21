import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { TraineeForm, type TraineeFormValues } from './TraineeForm';
import { traineeService } from '../../services/courses';
import type { Trainee } from '../../types';

type Mode = 'novo' | 'existente';

export function EnrollPanel({
  saving,
  comNotas,
  onEnrollNew,
  onEnrollExisting,
  onCancel,
}: {
  saving: boolean;
  /** false em cursos de participação: sem campo de avaliação. */
  comNotas: boolean;
  onEnrollNew: (v: TraineeFormValues) => void;
  onEnrollExisting: (t: Trainee) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('novo');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Trainee[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Trainee | null>(null);

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
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {results.map((t) => (
                <li key={t.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-950">{t.nome}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[t.email, t.contacto].filter(Boolean).join(' · ') || 'Sem contactos'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => setPreview(preview?.id === t.id ? null : t)}
                        className="rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand-900"
                      >
                        {preview?.id === t.id ? 'Ocultar' : 'Consultar'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onEnrollExisting(t)}
                        className="rounded-lg bg-brand-900 px-3 py-1.5 text-white hover:bg-brand-950 disabled:opacity-60"
                      >
                        Matricular
                      </button>
                    </div>
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
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
