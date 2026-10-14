import { z } from 'zod';

export const COURSE_STATUSES = ['planeado', 'em_andamento', 'concluido', 'cancelado'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

const nome = z
  .string()
  .trim()
  .min(2, 'Nome do curso deve ter pelo menos 2 caracteres')
  .max(160, 'Nome demasiado longo');

const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato AAAA-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida')
  .optional()
  .or(z.literal('').transform(() => undefined));

function datesCoherent(d: { data_abertura?: string; data_encerramento?: string }) {
  if (d.data_abertura && d.data_encerramento) {
    return d.data_encerramento >= d.data_abertura;
  }
  return true;
}

export const createCourseSchema = z
  .object({
    nome,
    carga_horaria: z
      .number({ invalid_type_error: 'Carga horária deve ser um número' })
      .int('Carga horária deve ser um número inteiro')
      .positive('Carga horária deve ser positiva')
      .max(10000, 'Carga horária demasiado elevada'),
    data_abertura: dateField,
    data_encerramento: dateField,
    status: z.enum(COURSE_STATUSES).default('planeado'),
  })
  .strict()
  .refine(datesCoherent, {
    message: 'Data de encerramento não pode ser anterior à data de abertura.',
    path: ['data_encerramento'],
  });

export const updateCourseSchema = z
  .object({
    nome: nome.optional(),
    carga_horaria: z
      .number({ invalid_type_error: 'Carga horária deve ser um número' })
      .int('Carga horária deve ser um número inteiro')
      .positive('Carga horária deve ser positiva')
      .max(10000, 'Carga horária demasiado elevada')
      .optional(),
    data_abertura: dateField,
    data_encerramento: dateField,
    status: z.enum(COURSE_STATUSES).optional(),
  })
  .strict()
  .refine((d) => d.nome !== undefined || d.carga_horaria !== undefined || d.status !== undefined
    || d.data_abertura !== undefined || d.data_encerramento !== undefined, {
    message: 'Nada para actualizar.',
  })
  .refine(datesCoherent, {
    message: 'Data de encerramento não pode ser anterior à data de abertura.',
    path: ['data_encerramento'],
  });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
