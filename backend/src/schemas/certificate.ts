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

/** Pagamento da taxa pelo formando (o número é normalizado e validado no controller). */
export const studentPaymentSchema = z
  .object({
    metodo: z.enum(['mpesa', 'emola'], { errorMap: () => ({ message: 'Escolha M-Pesa ou e-Mola.' }) }),
    telefone: z.string({ required_error: 'Indique o número de telefone.' }).trim().min(9, 'Número inválido.').max(20, 'Número inválido.'),
  })
  .strict();

export type AnnulCertificateInput = z.infer<typeof annulCertificateSchema>;
