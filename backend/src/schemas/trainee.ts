import { z } from 'zod';

const nome = z
  .string()
  .trim()
  .min(2, 'Nome do formando deve ter pelo menos 2 caracteres')
  .max(160, 'Nome demasiado longo');

const emailField = z
  .string()
  .trim()
  .max(160, 'Email demasiado longo')
  .refine((s) => s === '' || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s), 'Email inválido')
  .transform((s) => (s === '' ? undefined : s))
  .optional();

const contactoField = z
  .string()
  .trim()
  .max(30, 'Contacto inválido')
  .refine((s) => s === '' || /^[+0-9][0-9\s-]{6,29}$/.test(s), 'Contacto inválido (ex.: +258 84 000 0000)')
  .transform((s) => (s === '' ? undefined : s))
  .optional();

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
  .object({ nome: nome.optional(), email: emailField, contacto: contactoField })
  .strict()
  .refine((d) => d.nome !== undefined || d.email !== undefined || d.contacto !== undefined, {
    message: 'Nada para actualizar.',
  });

/** Matricular um formando JÁ registado (propriedade verificada no serviço). */
export const enrollExistingSchema = z.object({ formando_id: uuidField }).strict();

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
