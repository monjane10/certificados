import { z } from 'zod';

export const annulCertificateSchema = z
  .object({
    motivo: z
      .string({ required_error: 'Indique o motivo da anulação.' })
      .trim()
      .min(3, 'Indique o motivo da anulação (mín. 3 caracteres).')
      .max(500, 'Motivo demasiado longo.'),
  })
  .strict();

export type AnnulCertificateInput = z.infer<typeof annulCertificateSchema>;
