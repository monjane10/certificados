import type { NextFunction, Request, Response } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  void _next; // 4.º argumento exigido pelo Express para middlewares de erro
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}
