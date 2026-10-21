import rateLimit from 'express-rate-limit';

// Partilhado por todas as rotas de escrita: o limite tem de comportar uso
// normal (ex.: lançar notas de uma turma inteira) e não só abuso.
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos. Tente novamente mais tarde.' },
});

// Verificação pública de certificados (sem autenticação): trava enumeração de códigos.
export const publicVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas verificações. Tente novamente mais tarde.' },
});
