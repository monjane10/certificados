import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Cliente público (anon key). Usado para validar access tokens via auth.getUser().
// A service_role key, se definida, é usada APENAS em operações administrativas
// explícitas do servidor e nunca é exposta ao cliente.
export const supabaseAnon: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
);

export function getServiceClient(): SupabaseClient | null {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
