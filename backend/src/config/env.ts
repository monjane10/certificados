import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // N.º de proxies à frente do servidor (0 em local; 1 atrás de Nginx/Render/Railway).
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL inválido' }),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'SUPABASE_PUBLISHABLE_KEY em falta'),
  // Obrigatória para os pagamentos (só o servidor regista pagamentos confirmados).
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Fornecedor de pagamentos: desactivado (por defeito), simulado (desenvolvimento:
  // aprova sempre, excepto números terminados em 000) ou o fornecedor real, quando ligado.
  PAYMENT_PROVIDER: z.enum(['desactivado', 'simulado']).default('desactivado'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
    throw new Error('Configuração de ambiente inválida. Ver backend/.env.example');
  }
  return parsed.data;
}

export const env = loadEnv();
