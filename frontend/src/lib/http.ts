import { supabase } from './supabase';

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Json = { error?: string } & Record<string, unknown>;

async function handle(res: Response): Promise<Json> {
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    throw new Error(json.error ?? `Erro ${res.status}`);
  }
  return json;
}

/** Pedido ao backend com o token da sessão; `body` é serializado como JSON. */
export async function apiRequest(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}) {
  const { method = 'GET', body, auth = true } = init;
  const headers: Record<string, string> = auth ? await authHeader() : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle(res);
}
