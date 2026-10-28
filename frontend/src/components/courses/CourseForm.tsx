import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CourseStatusBadge } from './CourseStatusBadge';
import { courseStatusFromDates } from '../../lib/courseStatus';
import {
  COURSE_TYPES,
  COURSE_TYPE_DESCRIPTIONS,
  COURSE_TYPE_LABELS,
  type Course,
} from '../../types';

const schema = z
  .object({
    nome: z.string().trim().min(2, 'Nome obrigatório (mín. 2 caracteres)').max(160),
    carga_horaria: z.coerce
      .number({ invalid_type_error: 'Carga horária inválida' })
      .int('Deve ser um número inteiro')
      .positive('Deve ser positiva')
      .max(10000),
    tipo: z.enum(COURSE_TYPES as unknown as [string, ...string[]], {
      errorMap: () => ({ message: 'Indique o tipo de curso' }),
    }),
    // Obrigatórias: o estado do curso é calculado a partir delas.
    data_abertura: z.string().min(1, 'Indique a data de abertura'),
    data_encerramento: z.string().min(1, 'Indique a data de encerramento'),
    cancelado: z.boolean(),
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
  wide = false,
}: {
  initial?: Partial<Course>;
  saving: boolean;
  submitLabel: string;
  onSubmit: (v: CourseFormValues) => void;
  onCancel?: () => void;
  /** Página inteira: em ecrãs largos carga, estado e datas ficam numa só linha. */
  wide?: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: initial?.nome ?? '',
      carga_horaria: initial?.carga_horaria ?? ('' as unknown as number),
      // Sem valor por defeito na criação: o tipo tem de ser escolhido explicitamente.
      tipo: initial?.tipo,
      data_abertura: initial?.data_abertura ?? '',
      data_encerramento: initial?.data_encerramento ?? '',
      cancelado: initial?.cancelado ?? false,
    },
  });

  const busy = saving || isSubmitting;
  const tipo = watch('tipo');
  const toParticipacao = initial?.tipo === 'tecnico_profissional' && tipo === 'participacao';
  // O estado não se escolhe: é calculado a partir das datas (só o cancelamento é manual).
  const estado = courseStatusFromDates({
    cancelado: watch('cancelado'),
    data_abertura: watch('data_abertura'),
    data_encerramento: watch('data_encerramento'),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((v) => {
        if (busy) return;
        onSubmit(v);
      })}
    >
      <Input label="Nome do curso" required error={errors.nome?.message} {...register('nome')} placeholder="Ex.: Contabilidade Geral" />
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 block text-sm font-medium text-brand-950">
          Tipo de curso <span className="text-red-600">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {COURSE_TYPES.map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm transition-colors ${
                tipo === t ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input type="radio" value={t} {...register('tipo')} className="mt-0.5 accent-brand-900" />
              <span>
                <span className="block font-semibold text-brand-950">{COURSE_TYPE_LABELS[t]}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{COURSE_TYPE_DESCRIPTIONS[t]}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.tipo?.message && <p className="text-xs text-red-600">{errors.tipo.message}</p>}
        {toParticipacao && (
          <p className="text-xs text-amber-700">
            Só é possível mudar para participação se nenhum formando tiver nota lançada neste curso.
          </p>
        )}
      </fieldset>
      <div className={`grid gap-4 sm:grid-cols-2 ${wide ? 'lg:grid-cols-4' : ''}`}>
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
        <Input label="Data de abertura" required type="date" error={errors.data_abertura?.message} {...register('data_abertura')} />
        <Input label="Data de encerramento" required type="date" error={errors.data_encerramento?.message} {...register('data_encerramento')} />
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-brand-950">Estado</span>
          <div className="flex min-h-[42px] items-center">
            <CourseStatusBadge status={estado} />
          </div>
          <p className="text-xs text-slate-500">Calculado automaticamente a partir das datas.</p>
        </div>
      </div>
      {initial && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3.5 py-3 text-sm">
          <input type="checkbox" {...register('cancelado')} className="mt-0.5 accent-red-600" />
          <span>
            <span className="block font-semibold text-brand-950">Curso cancelado</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Um curso cancelado não avança de estado e não permite emitir certificados.
            </span>
          </span>
        </label>
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
