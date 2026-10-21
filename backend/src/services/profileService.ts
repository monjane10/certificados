import { scopedClient } from '../config/supabase.js';
import type { Profile } from '../types/index.js';

/** Lê o próprio perfil com RLS (auth.uid() = id). */
export async function fetchOwnProfile(accessToken: string): Promise<Profile | null> {
  const { data, error } = await scopedClient(accessToken)
    .from('profiles')
    .select('id, code, email, phone, organization_name, role, created_at, updated_at')
    .maybeSingle();
  if (error) {
    console.error('fetchOwnProfile:', error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

/** Actualiza apenas organization_name/phone do próprio perfil. */
export async function updateOwnProfileScoped(
  accessToken: string,
  patch: { organization_name?: string; phone?: string },
): Promise<Profile | null> {
  const payload: Record<string, string> = {};
  if (patch.organization_name !== undefined) payload.organization_name = patch.organization_name;
  if (patch.phone !== undefined) payload.phone = patch.phone;

  const { data, error } = await scopedClient(accessToken)
    .from('profiles')
    .update(payload)
    .eq('id', (await scopedClient(accessToken).auth.getUser()).data.user?.id ?? '')
    .select('id, code, email, phone, organization_name, role, created_at, updated_at')
    .maybeSingle();
  if (error) {
    console.error('updateOwnProfileScoped:', error.message);
    throw new Error('Não foi possível actualizar o perfil.');
  }
  return (data as Profile | null) ?? null;
}

/** Contagem para o overview admin (policy profiles_admin_all). */
export async function countProfilesScoped(accessToken: string): Promise<number> {
  const { count, error } = await scopedClient(accessToken)
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}
