import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { supabaseAnon } from '../config/supabase.js';

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
    // Cliente com escopo do utilizador: propaga o JWT para o RLS avaliar
    // auth.uid() correctamente. Identidade vem SEMPRE do token validado.
    const scoped = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile } = await scoped
      .from('profiles')
      .select('id, code, email, phone, organization_name, role, created_at, updated_at')
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
