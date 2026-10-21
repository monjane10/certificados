import { z } from 'zod';

/** Caminho no bucket "branding": "<user_id>/<logo|assinatura>-<timestamp>.<ext>". */
const BRANDING_PATH_RE = /^[0-9a-f-]{36}\/(logo|assinatura)-\d+\.(png|jpg|jpeg|webp)$/i;

const brandingPath = (message: string) =>
  z.string().trim().regex(BRANDING_PATH_RE, message).nullable().optional();

/** Texto opcional: '' ou null limpam o campo. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} demasiado longo`)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

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
    logo_path: brandingPath('Logótipo inválido'),
    assinatura_path: brandingPath('Assinatura inválida'),
    responsavel_nome: optionalText(120, 'Nome do responsável'),
    responsavel_cargo: optionalText(80, 'Cargo do responsável'),
  })
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Nada para actualizar.',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
