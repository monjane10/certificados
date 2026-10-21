import { scopedClient } from '../config/supabase.js';
import type { Profile } from '../types/index.js';

export const PROFILE_COLUMNS =
  'id, code, email, phone, organization_name, role, logo_path, assinatura_path, responsavel_nome, responsavel_cargo, created_at, updated_at';

/** Campos que o próprio utilizador pode alterar (null limpa o valor). */
export interface OwnProfilePatch {
  organization_name?: string;
  phone?: string;
  logo_path?: string | null;
  assinatura_path?: string | null;
  responsavel_nome?: string | null;
  responsavel_cargo?: string | null;
}

const EDITABLE: Array<keyof OwnProfilePatch> = [
  'organization_name',
  'phone',
  'logo_path',
  'assinatura_path',
  'responsavel_nome',
  'responsavel_cargo',
];

/** Lê o próprio perfil com RLS (auth.uid() = id). */
export async function fetchOwnProfile(accessToken: string): Promise<Profile | null> {
  const { data, error } = await scopedClient(accessToken)
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('fetchOwnProfile:', error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

/** Actualiza apenas os campos editáveis do próprio perfil (nunca role/code). */
export async function updateOwnProfileScoped(
  accessToken: string,
  userId: string,
  patch: OwnProfilePatch,
): Promise<Profile | null> {
  const payload: Record<string, string | null> = {};
  for (const key of EDITABLE) {
    if (patch[key] !== undefined) payload[key] = patch[key] ?? null;
  }

  const { data, error } = await scopedClient(accessToken)
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
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
