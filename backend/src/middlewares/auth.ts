import type { NextFunction, Request, Response } from 'express';
import { scopedClient, supabaseAnon } from '../config/supabase.js';
import { PROFILE_COLUMNS } from '../services/profileService.js';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Não autenticado. Token em falta.' });
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Não autenticado. Token em falta.' });
      return;
    }
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      return;
    }
    // Identidade vem SEMPRE do token validado.
    const { data: profile } = await scopedClient(token)
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', data.user.id)
      .maybeSingle();

    req.authToken = token;
    req.authUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      profile: (profile as never) ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Falha de autenticação.' });
  }
}
