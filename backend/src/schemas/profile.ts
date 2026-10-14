import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    organization_name: z
      .string()
      .trim()
      .min(2, 'Nome da organização deve ter pelo menos 2 caracteres')
      .max(120, 'Nome demasiado longo')
      .optional(),
    phone: z
      .string()
      .trim()
      .min(9, 'Telefone inválido')
      .max(20, 'Telefone inválido')
      .regex(/^[+0-9][0-9\s-]*$/, 'Telefone inválido')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .strict()
  .refine((d) => d.organization_name !== undefined || d.phone !== undefined, {
    message: 'Nada para actualizar. Envie organization_name e/ou phone.',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
