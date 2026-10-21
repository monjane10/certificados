import { useState } from 'react';
import { Button } from '../ui/Button';
import { NOTA_MINIMA_APROVACAO, type EnrollmentView } from '../../types';

export function GradeModal({
  enrollment,
  saving,
  onSave,
  onCancel,
}: {
  enrollment: EnrollmentView;
  saving: boolean;
  onSave: (avaliacao: number | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(enrollment.avaliacao?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (saving) return;
    const raw = value.trim();
    if (raw === '') {
      onSave(null);
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0 || n > 20) {
      setError('Avaliação entre 0 e 20 valores (ou vazio para remover).');
      return;
    }
    setError(null);
    onSave(n);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Avaliação de <strong className="text-brand-950">{enrollment.nome}</strong> apenas neste
        curso. Não afecta outros cursos onde esteja inscrito. Aprovação a partir de{' '}
        {NOTA_MINIMA_APROVACAO} valores.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="grade" className="block text-sm font-medium text-brand-950">
          Avaliação (0-20)
        </label>
        <input
          id="grade"
          type="number"
          min={0}
          max={20}
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: 14"
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            error ? 'border-red-400' : 'border-slate-200'
          }`}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" loading={saving} onClick={handleSave}>
          Guardar avaliação
        </Button>
      </div>
    </div>
  );
}
