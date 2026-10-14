import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const schema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório (mín. 2 caracteres)').max(160),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((s) => s === '' || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s), 'Email inválido')
    .optional()
    .or(z.literal('')),
  contacto: z
    .string()
    .trim()
    .max(30)
    .refine((s) => !s || s === '' || /^[+0-9][0-9\s-]{6,29}$/.test(s), 'Contacto inválido (ex.: +258 84 000 0000)')
    .optional()
    .or(z.literal('')),
  avaliacao: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((s) => (s === '' || s === undefined ? undefined : Number(s)))
    .refine((n) => n === undefined || (!Number.isNaN(n) && n >= 0 && n <= 20), 'Avaliação entre 0 e 20 valores'),
});

export interface TraineeFormValues {
  nome: string;
  email?: string;
  contacto?: string;
  avaliacao?: number;
}

export function TraineeForm({
  initial,
  saving,
  submitLabel,
  withAvaliacao = false,
  avaliacaoHint,
  onSubmit,
  onCancel,
}: {
  initial?: { nome?: string; email?: string | null; contacto?: string | null; avaliacao?: number | null };
  saving: boolean;
  submitLabel: string;
  /** Mostra o campo de avaliação (apenas no contexto de matrícula). */
  withAvaliacao?: boolean;
  avaliacaoHint?: string;
  onSubmit: (v: TraineeFormValues) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: initial?.nome ?? '',
      email: initial?.email ?? '',
      contacto: initial?.contacto ?? '',
      avaliacao: initial?.avaliacao ?? undefined,
    },
  });

  const busy = saving || isSubmitting;

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((v) => {
        if (busy) return;
        onSubmit({
          nome: v.nome.trim(),
          email: v.email?.trim() || undefined,
          contacto: v.contacto?.trim() || undefined,
          avaliacao: (v.avaliacao as unknown as number | undefined) ?? undefined,
        });
      })}
    >
      <Input label="Nome completo" required error={errors.nome?.message} {...register('nome')} placeholder="Ex.: Ana Marta Sitoe" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Email (opcional)" type="email" error={errors.email?.message} {...register('email')} placeholder="formando@exemplo.co.mz" />
        <Input label="Contacto (opcional)" error={errors.contacto?.message} {...register('contacto')} placeholder="+258 84 000 0000" />
      </div>
      {withAvaliacao && (
        <>
          <Input
            label="Avaliação 0-20 neste curso (opcional)"
            type="number"
            min={0}
            max={20}
            step="0.5"
            error={errors.avaliacao?.message}
            {...register('avaliacao')}
            placeholder="Ex.: 14"
          />
          {avaliacaoHint && <p className="-mt-2 text-xs text-slate-500">{avaliacaoHint}</p>}
        </>
      )}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
