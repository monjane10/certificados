import { supabase } from './supabase';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `Erro ${res.status}`);
  }
  return json;
}

export const api = {
  async me() {
    const res = await fetch(`${API_URL}/api/me`, { headers: await authHeader() });
    return handle(res);
  },
  async getProfile() {
    const res = await fetch(`${API_URL}/api/profile`, { headers: await authHeader() });
    return handle(res);
  },
  async updateProfile(patch: { organization_name?: string; phone?: string }) {
    const res = await fetch(`${API_URL}/api/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(patch),
    });
    return handle(res);
  },
  async adminOverview() {
    const res = await fetch(`${API_URL}/api/admin/overview`, { headers: await authHeader() });
    return handle(res);
  },
};

export { API_URL };
