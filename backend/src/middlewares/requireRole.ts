import type { NextFunction, Request, Response } from 'express';

export function requireRole(...roles: Array<'admin' | 'user'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const profile = req.authUser?.profile;
    if (!profile) {
      res.status(403).json({ error: 'Perfil não encontrado ou sem permissão.' });
      return;
    }
    if (!roles.includes(profile.role)) {
      res.status(403).json({ error: 'Acesso não autorizado.' });
      return;
    }
    next();
  };
}
