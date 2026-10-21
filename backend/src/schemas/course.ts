import { z } from 'zod';

export const COURSE_STATUSES = ['planeado', 'em_andamento', 'concluido', 'cancelado'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

/** participacao: sem notas; tecnico_profissional: nota 0-20 por matrícula. */
export const COURSE_TYPES = ['participacao', 'tecnico_profissional'] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

/** Modelos visuais de certificado (o desenho de cada um vive no frontend). */
export const CERTIFICATE_TEMPLATES = ['classico', 'ondas_azuis', 'violeta', 'dourado', 'minimalista'] as const;
export type CertificateTemplate = (typeof CERTIFICATE_TEMPLATES)[number];

const modeloCertificado = z.enum(CERTIFICATE_TEMPLATES, {
  errorMap: () => ({ message: 'Modelo de certificado inválido' }),
});

const tipo = z.enum(COURSE_TYPES, {
  errorMap: (issue) => ({
    message:
      issue.code === 'invalid_type' && issue.received === 'undefined'
        ? 'Indique o tipo de curso'
        : 'Tipo de curso inválido (participacao ou tecnico_profissional)',
  }),
});

const nome = z
  .string()
  .trim()
  .min(2, 'Nome do curso deve ter pelo menos 2 caracteres')
  .max(160, 'Nome demasiado longo');

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato AAAA-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida');

const dateField = dateString.optional().or(z.literal('').transform(() => undefined));

/** No update, null ou '' limpam a data. */
const dateUpdateField = dateString.nullable().optional().or(z.literal('').transform(() => null));

const cargaHoraria = z
  .number({ invalid_type_error: 'Carga horária deve ser um número' })
  .int('Carga horária deve ser um número inteiro')
  .positive('Carga horária deve ser positiva')
  .max(10000, 'Carga horária demasiado elevada');

export const DATES_INCOHERENT_MESSAGE = 'Data de encerramento não pode ser anterior à data de abertura.';

export function datesCoherent(d: { data_abertura?: string | null; data_encerramento?: string | null }) {
  if (d.data_abertura && d.data_encerramento) {
    return d.data_encerramento >= d.data_abertura;
  }
  return true;
}

export const createCourseSchema = z
  .object({
    nome,
    carga_horaria: cargaHoraria,
    tipo,
    modelo_certificado: modeloCertificado.default('classico'),
    data_abertura: dateField,
    data_encerramento: dateField,
    status: z.enum(COURSE_STATUSES).default('planeado'),
  })
  .strict()
  .refine(datesCoherent, {
    message: DATES_INCOHERENT_MESSAGE,
    path: ['data_encerramento'],
  });

export const updateCourseSchema = z
  .object({
    nome: nome.optional(),
    carga_horaria: cargaHoraria.optional(),
    tipo: tipo.optional(),
    modelo_certificado: modeloCertificado.optional(),
    data_abertura: dateUpdateField,
    data_encerramento: dateUpdateField,
    status: z.enum(COURSE_STATUSES).optional(),
  })
  .strict()
  .refine((d) => d.nome !== undefined || d.carga_horaria !== undefined || d.status !== undefined
    || d.tipo !== undefined || d.modelo_certificado !== undefined
    || d.data_abertura !== undefined || d.data_encerramento !== undefined, {
    message: 'Nada para actualizar.',
  })
  .refine(datesCoherent, {
    message: DATES_INCOHERENT_MESSAGE,
    path: ['data_encerramento'],
  });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
