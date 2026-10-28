import { z } from 'zod';

const nome = z
  .string()
  .trim()
  .min(2, 'Nome do formando deve ter pelo menos 2 caracteres')
  .max(160, 'Nome demasiado longo');

const emailBase = z
  .string()
  .trim()
  .max(160, 'Email demasiado longo')
  .refine((s) => s === '' || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s), 'Email inválido');

const contactoBase = z
  .string()
  .trim()
  .max(30, 'Contacto inválido')
  .refine((s) => s === '' || /^[+0-9][0-9\s-]{6,29}$/.test(s), 'Contacto inválido (ex.: +258 84 000 0000)');

const emailField = emailBase.transform((s) => (s === '' ? undefined : s)).optional();
const contactoField = contactoBase.transform((s) => (s === '' ? undefined : s)).optional();

/** No update, null ou '' limpam o campo. */
const emailUpdateField = emailBase.transform((s) => (s === '' ? null : s)).nullable().optional();
const contactoUpdateField = contactoBase.transform((s) => (s === '' ? null : s)).nullable().optional();

const avaliacaoField = z
  .number({ invalid_type_error: 'Avaliação deve ser um número' })
  .min(0, 'Avaliação não pode ser negativa')
  .max(20, 'Avaliação não pode exceder 20 valores')
  .nullable()
  .optional();

const uuidField = z.string().uuid('Identificador de formando inválido');

/** Dados pessoais do registo central (reflectem-se em todos os cursos). */
export const traineePersonalSchema = z
  .object({ nome, email: emailField, contacto: contactoField })
  .strict();

export const updateTraineePersonalSchema = z
  .object({ nome: nome.optional(), email: emailUpdateField, contacto: contactoUpdateField })
  .strict()
  .refine((d) => d.nome !== undefined || d.email !== undefined || d.contacto !== undefined, {
    message: 'Nada para actualizar.',
  });

/** Matricular um formando JÁ registado (propriedade verificada no serviço). */
export const enrollExistingSchema = z.object({ formando_id: uuidField }).strict();

/** Matricular VÁRIOS formandos já registados de uma vez (selecção múltipla). */
export const enrollManySchema = z
  .object({
    formando_ids: z
      .array(uuidField)
      .min(1, 'Seleccione pelo menos um formando')
      .max(200, 'Seleccione no máximo 200 formandos de cada vez'),
  })
  .strict();

/** Criar novo formando e matriculá-lo no curso do path. */
export const enrollNewSchema = z
  .object({ nome, email: emailField, contacto: contactoField, avaliacao: avaliacaoField })
  .strict();

/** Avaliação pertence à matrícula (por curso), não ao formando. */
export const updateEnrollmentSchema = z
  .object({ avaliacao: avaliacaoField })
  .strict()
  .refine((d) => d.avaliacao !== undefined, { message: 'Nada para actualizar.' });

export const traineeSearchSchema = z.object({
  q: z.string().trim().max(120).optional().or(z.literal('').transform(() => undefined)),
});

export type TraineePersonalInput = z.infer<typeof traineePersonalSchema>;
export type UpdateTraineePersonalInput = z.infer<typeof updateTraineePersonalSchema>;
export type EnrollNewInput = z.infer<typeof enrollNewSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
