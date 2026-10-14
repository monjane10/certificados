import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { COURSE_STATUSES, COURSE_STATUS_LABELS, type Course } from '../../types';

const schema = z
  .object({
    nome: z.string().trim().min(2, 'Nome obrigatório (mín. 2 caracteres)').max(160),
    carga_horaria: z.coerce
      .number({ invalid_type_error: 'Carga horária inválida' })
      .int('Deve ser um número inteiro')
      .positive('Deve ser positiva')
      .max(10000),
    data_abertura: z.string().optional().or(z.literal('')),
    data_encerramento: z.string().optional().or(z.literal('')),
    status: z.enum(COURSE_STATUSES as unknown as [string, ...string[]]),
  })
  .refine(
    (d) => {
      if (d.data_abertura && d.data_encerramento) return d.data_encerramento >= d.data_abertura;
      return true;
    },
    { message: 'Encerramento não pode ser anterior à abertura.', path: ['data_encerramento'] },
  );

export type CourseFormValues = z.infer<typeof schema>;

export function CourseForm({
  initial,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Course>;
  saving: boolean;
  submitLabel: string;
  onSubmit: (v: CourseFormValues) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: initial?.nome ?? '',
      carga_horaria: initial?.carga_horaria ?? ('' as unknown as number),
      data_abertura: initial?.data_abertura ?? '',
      data_encerramento: initial?.data_encerramento ?? '',
      status: initial?.status ?? 'planeado',
    },
  });

  const busy = saving || isSubmitting;

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((v) => {
        if (busy) return;
        onSubmit(v);
      })}
    >
      <Input label="Nome do curso" required error={errors.nome?.message} {...register('nome')} placeholder="Ex.: Contabilidade Geral" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Carga horária (horas)"
          required
          type="number"
          min={1}
          step={1}
          error={errors.carga_horaria?.message}
          {...register('carga_horaria')}
          placeholder="Ex.: 40"
        />
        <div className="space-y-1.5">
          <label htmlFor="status" className="block text-sm font-medium text-brand-950">
            Estado <span className="text-red-600">*</span>
          </label>
          <select
            id="status"
            {...register('status')}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {COURSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {COURSE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {errors.status?.message && <p className="text-xs text-red-600">{errors.status.message}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Data de abertura" type="date" error={errors.data_abertura?.message} {...register('data_abertura')} />
        <Input label="Data de encerramento" type="date" error={errors.data_encerramento?.message} {...register('data_encerramento')} />
      </div>
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
