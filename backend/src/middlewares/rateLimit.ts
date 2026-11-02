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

// Pagamentos do formando: cada tentativa gera um pedido no telemóvel.
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas tentativas de pagamento. Tente novamente mais tarde.' },
});

// Página do formando: a página consulta o estado enquanto espera a confirmação do pagamento.
export const studentPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos. Tente novamente mais tarde.' },
});

// Pedidos de correcção do formando: cada um chega à instituição.
export const correctionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos de correcção. Tente novamente mais tarde.' },
});

// Verificação pública de certificados (sem autenticação): trava enumeração de códigos.
export const publicVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas verificações. Tente novamente mais tarde.' },
});
