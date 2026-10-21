import type { Request, Response } from 'express';
import {
  fetchOwnProfile,
  updateOwnProfileScoped,
  countProfilesScoped,
} from '../services/profileService.js';
import { countIssuedCertificates } from '../services/certificateService.js';

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
  const userId = req.authUser?.id ?? '';
  // Imagens só da pasta do próprio utilizador (a BD também o garante).
  for (const key of ['logo_path', 'assinatura_path'] as const) {
    const path = req.body[key];
    if (typeof path === 'string' && !path.startsWith(`${userId}/`)) {
      res.status(400).json({ error: 'Imagem inválida.' });
      return;
    }
  }
  try {
    const profile = await updateOwnProfileScoped(tokenOf(req), userId, req.body);
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
  try {
    const token = _req.authToken ?? '';
    const [total, certificates] = await Promise.all([
      countProfilesScoped(token),
      countIssuedCertificates(token),
    ]);
    res.json({
      totalUsers: total,
      certificatesIssued: certificates,
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
