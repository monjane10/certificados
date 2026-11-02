import { randomBytes } from 'node:crypto';
import { getServiceClient, supabaseAnon } from '../config/supabase.js';
import { env } from '../config/env.js';
import type { CorrectionRequest, PaymentMethod, StudentCertificate } from '../types/index.js';
import { HttpError, dbError, logDbError } from './courseService.js';

export const ACCESS_TOKEN_RE = /^[a-f0-9]{64}$/;

/** M-Pesa (Vodacom): 84/85; e-Mola (Movitel): 86/87. 9 dígitos, sem o 258. */
const PREFIXOS: Record<PaymentMethod, RegExp> = {
  mpesa: /^8[45][0-9]{7}$/,
  emola: /^8[67][0-9]{7}$/,
};

const NOME_METODO: Record<PaymentMethod, string> = { mpesa: 'M-Pesa', emola: 'e-Mola' };

/** Aceita 84 123 4567, +258841234567, 258-84-123-4567...; devolve os 9 dígitos. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('258') ? digits.slice(3) : digits;
}

export function validatePhone(metodo: PaymentMethod, telefone: string): string | null {
  if (PREFIXOS[metodo].test(telefone)) return null;
  return metodo === 'mpesa'
    ? 'Número M-Pesa inválido: use um número Vodacom (84 ou 85) com 9 dígitos.'
    : 'Número e-Mola inválido: use um número Movitel (86 ou 87) com 9 dígitos.';
}

// --- Fornecedores ------------------------------------------------------------------

interface ChargeRequest {
  metodo: PaymentMethod;
  telefone: string;
  valor: number;
  referencia: string;
}

/** Resultado final de uma cobrança (resposta do fornecedor). */
export interface ChargeResult {
  estado: 'pago' | 'falhado';
  fornecedorRef?: string;
  erro?: string;
}

/**
 * Cobrança ao formando em dois passos: `start` envia o pedido para o
 * telemóvel e volta logo; o resultado chega mais tarde, quando o formando
 * confirma (ou não) com o PIN, e é registado com `finalizePayment`.
 * O fornecedor real (M-Pesa/e-Mola ou agregador) entra aqui quando houver
 * conta: `start` chama a API dele e a resposta dele (callback) chama `finalizePayment`.
 */
interface PaymentProvider {
  nome: string;
  start(req: ChargeRequest): Promise<void>;
}

const simulado: PaymentProvider = {
  nome: 'simulado',
  async start(req) {
    // Simula o tempo que o formando leva a confirmar no telemóvel.
    setTimeout(() => {
      const result: ChargeResult = req.telefone.endsWith('000')
        ? { estado: 'falhado', erro: 'Saldo insuficiente (simulado).' }
        : { estado: 'pago', fornecedorRef: `SIM-${req.referencia}` };
      finalizePayment(req.referencia, result).catch((e) =>
        console.error(`Pagamento ${req.referencia}: falha ao registar o resultado simulado.`, e),
      );
    }, 6000);
  },
};

function provider(): PaymentProvider | null {
  return env.PAYMENT_PROVIDER === 'simulado' ? simulado : null;
}

function newReference(): string {
  // Ex.: ML7K2Q9XWA4D — curta, para aparecer no extracto do formando.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return 'ML' + Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join('');
}

/** Um pedido sem resposta neste tempo conta como falhado (o mesmo prazo de certificado_por_token). */
const PENDENTE_MINUTOS = 3;

// --- Página do formando ----------------------------------------------------------------

export async function getStudentCertificate(token: string): Promise<StudentCertificate | null> {
  const { data, error } = await supabaseAnon.rpc('certificado_por_token', { p_token: token });
  if (error) throw dbError(error, 500, 'Falha ao carregar o certificado.');
  return (data as StudentCertificate | null) ?? null;
}

/**
 * Inicia a cobrança da taxa e responde logo com o pedido «pendente»; a página
 * do formando vai consultando o estado até chegar a resposta. Escreve com a
 * chave de serviço: nem o formando nem a instituição conseguem marcar «pago».
 */
export async function payCertificate(
  token: string,
  metodo: PaymentMethod,
  telefone: string,
): Promise<{ estado: 'pendente'; referencia: string }> {
  const service = getServiceClient();
  const prov = provider();
  if (!service || !prov) throw new HttpError(503, 'Os pagamentos ainda não estão disponíveis. Tente mais tarde.');

  const { data: cert, error } = await service
    .from('certificados')
    .select('id, estado, pago_em, taxa_valor')
    .eq('acesso_token', token)
    .maybeSingle();
  if (error) throw dbError(error, 500, 'Falha ao carregar o certificado.');
  if (!cert) throw new HttpError(404, 'Certificado não encontrado.');
  if (cert.pago_em) throw new HttpError(409, 'Este certificado já está pago.');
  if (cert.estado !== 'emitido') throw new HttpError(409, 'Este certificado foi anulado pela instituição.');

  const { count: correcoes, error: corrError } = await service
    .from('pedidos_correcao')
    .select('id', { count: 'exact', head: true })
    .eq('certificado_id', cert.id)
    .eq('estado', 'aberto');
  if (corrError) throw dbError(corrError, 500, 'Falha ao iniciar o pagamento.');
  if ((correcoes ?? 0) > 0) {
    throw new HttpError(409, 'Pediu uma correcção dos dados. Aguarde que a instituição a resolva antes de pagar.');
  }

  // Pedidos sem resposta a tempo deixam de bloquear uma nova tentativa.
  const limite = new Date(Date.now() - PENDENTE_MINUTOS * 60 * 1000).toISOString();
  const { error: expError } = await service
    .from('pagamentos')
    .update({ estado: 'falhado', erro: 'Sem confirmação no telemóvel a tempo.' })
    .eq('certificado_id', cert.id)
    .eq('estado', 'pendente')
    .lt('criado_em', limite);
  if (expError) throw dbError(expError, 500, 'Falha ao iniciar o pagamento.');

  // Um pedido de cada vez (índice único na BD): evita cobrar duas vezes com cliques repetidos.
  const referencia = newReference();
  const { error: insError } = await service.from('pagamentos').insert({
    certificado_id: cert.id,
    metodo,
    telefone,
    valor: cert.taxa_valor,
    referencia,
    fornecedor: prov.nome,
  });
  if (insError?.code === '23505') {
    throw new HttpError(409, 'Já há um pagamento em curso. Confirme no telemóvel ou aguarde alguns minutos.');
  }
  if (insError) throw dbError(insError, 500, 'Falha ao iniciar o pagamento.');

  try {
    await prov.start({ metodo, telefone, valor: cert.taxa_valor, referencia });
  } catch (e) {
    await finalizePayment(referencia, { estado: 'falhado', erro: e instanceof Error ? e.message : 'Erro do fornecedor.' });
    throw new HttpError(502, `Não foi possível enviar o pedido de pagamento por ${NOME_METODO[metodo]}. Tente de novo.`);
  }
  return { estado: 'pendente', referencia };
}

/**
 * Regista a resposta do fornecedor. Uma confirmação que chegue depois do
 * prazo continua a valer: o dinheiro foi recebido.
 */
export async function finalizePayment(referencia: string, result: ChargeResult): Promise<void> {
  const service = getServiceClient();
  if (!service) throw new Error('Chave de serviço em falta.');

  const { data: pagamento, error } = await service
    .from('pagamentos')
    .update({ estado: result.estado, fornecedor_ref: result.fornecedorRef ?? null, erro: result.erro ?? null })
    .eq('referencia', referencia)
    .neq('estado', 'pago')
    .select('certificado_id')
    .maybeSingle();
  if (error) {
    // Ex.: segundo pagamento confirmado do mesmo certificado (índice único): acerto manual.
    logDbError(`Pagamento ${referencia}: falha ao registar «${result.estado}».`, error);
    return;
  }
  if (!pagamento || result.estado !== 'pago') return;

  const { error: certError } = await service
    .from('certificados')
    .update({ pago_em: new Date().toISOString() })
    .eq('id', pagamento.certificado_id)
    .is('pago_em', null);
  // O dinheiro foi recebido: o erro fica registado para acerto manual, mas o
  // formando não deve ser cobrado outra vez.
  if (certError) logDbError(`Pagamento ${referencia} recebido mas certificado não desbloqueado.`, certError);
}

/** Pedido de correcção dos dados, feito pelo formando a partir do seu link. */
export async function requestCorrection(token: string, mensagem: string): Promise<CorrectionRequest> {
  const { data, error } = await supabaseAnon.rpc('pedir_correcao', { p_token: token, p_mensagem: mensagem });
  if (error) throw dbError(error, 409, 'Não foi possível enviar o pedido.');
  return data as CorrectionRequest;
}
