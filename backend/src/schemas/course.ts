import { z } from 'zod';

/** O estado não é enviado pelo cliente: só cancelado é manual, o resto vem das datas. */
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

const dateString = (requiredMessage = 'Indique a data') =>
  z
    .string({ required_error: requiredMessage, invalid_type_error: 'Data inválida' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato AAAA-MM-DD)')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Data inválida');

/** As duas datas são obrigatórias: o estado do curso é calculado a partir delas. '' conta como em falta. */
const dateField = (campo: string) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), dateString(`Indique a ${campo}`));

/** No update a data é opcional (não muda), mas não pode ser apagada. */
const dateUpdateField = dateString().optional();

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
    data_abertura: dateField('data de abertura'),
    data_encerramento: dateField('data de encerramento'),
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
    cancelado: z.boolean({ invalid_type_error: 'Cancelado deve ser verdadeiro ou falso' }).optional(),
  })
  .strict()
  .refine((d) => d.nome !== undefined || d.carga_horaria !== undefined || d.cancelado !== undefined
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
