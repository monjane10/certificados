import type { Request, Response } from 'express';
import {
  fetchOwnProfile,
  updateOwnProfileScoped,
  countProfilesScoped,
} from '../services/profileService.js';

function tokenOf(req: Request): string {
  return req.authToken ?? '';
}

export async function getMe(req: Request, res: Response) {
  const profile = await fetchOwnProfile(tokenOf(req));
  res.json({
    user: { id: req.authUser?.id, email: req.authUser?.email ?? null },
    profile,
  });
}

export async function getOwnProfile(req: Request, res: Response) {
  const profile = await fetchOwnProfile(tokenOf(req));
  if (!profile) {
    res.status(404).json({ error: 'Perfil não encontrado.' });
    return;
  }
  res.json({ profile });
}

export async function patchOwnProfile(req: Request, res: Response) {
  try {
    const profile = await updateOwnProfileScoped(tokenOf(req), req.body);
    if (!profile) {
      res.status(404).json({ error: 'Perfil não encontrado.' });
      return;
    }
    res.json({ profile });
  } catch {
    res.status(400).json({ error: 'Não foi possível actualizar o perfil.' });
  }
}

export async function adminOverview(_req: Request, res: Response) {
  // Sprint 1: sem estatísticas reais. Retorna zeros/estados vazios honestos.
  // Conta total de perfis apenas para prova de autorização admin.
  try {
    const total = await countProfilesScoped((_req as Request).authToken ?? '');
    res.json({
      totalUsers: total,
      certificatesIssued: 0,
      pendingValidations: 0,
      note: 'Indicadores reais serão implementados nas próximas sprints.',
    });
  } catch {
    res.json({
      totalUsers: 0,
      certificatesIssued: 0,
      pendingValidations: 0,
      note: 'Indicadores reais serão implementados nas próximas sprints.',
    });
  }
}
