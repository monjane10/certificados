import { randomBytes } from 'node:crypto';
import { getServiceClient, supabaseAnon } from '../config/supabase.js';
import { env } from '../config/env.js';
import type { PaymentMethod, StudentCertificate } from '../types/index.js';
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

interface ChargeResult {
  estado: 'pago' | 'falhado';
  fornecedorRef?: string;
  erro?: string;
}

/**
 * Cobrança ao formando. O pedido chega ao telemóvel e o formando confirma
 * com o PIN; a chamada só termina quando o fornecedor responde.
 * O fornecedor real (M-Pesa/e-Mola ou agregador) entra aqui quando houver conta.
 */
interface PaymentProvider {
  nome: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

const simulado: PaymentProvider = {
  nome: 'simulado',
  async charge(req) {
    await new Promise((r) => setTimeout(r, 1500));
    if (req.telefone.endsWith('000')) return { estado: 'falhado', erro: 'Saldo insuficiente (simulado).' };
    return { estado: 'pago', fornecedorRef: `SIM-${req.referencia}` };
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

// --- Página do formando ----------------------------------------------------------------

export async function getStudentCertificate(token: string): Promise<StudentCertificate | null> {
  const { data, error } = await supabaseAnon.rpc('certificado_por_token', { p_token: token });
  if (error) throw dbError(error, 500, 'Falha ao carregar o certificado.');
  return (data as StudentCertificate | null) ?? null;
}

/**
 * Cobra a taxa do certificado. Escreve com a chave de serviço: nem o formando
 * nem a instituição conseguem marcar um certificado como pago.
 */
export async function payCertificate(
  token: string,
  metodo: PaymentMethod,
  telefone: string,
): Promise<{ estado: 'pago' | 'falhado'; mensagem: string }> {
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

  // Um pedido de cada vez: evita cobrar duas vezes com cliques repetidos.
  const desde = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { count, error: pendError } = await service
    .from('pagamentos')
    .select('id', { count: 'exact', head: true })
    .eq('certificado_id', cert.id)
    .eq('estado', 'pendente')
    .gte('criado_em', desde);
  if (pendError) throw dbError(pendError, 500, 'Falha ao iniciar o pagamento.');
  if ((count ?? 0) > 0) {
    throw new HttpError(409, 'Já há um pagamento em curso. Confirme no telemóvel ou aguarde alguns minutos.');
  }

  const referencia = newReference();
  const { data: pagamento, error: insError } = await service
    .from('pagamentos')
    .insert({
      certificado_id: cert.id,
      metodo,
      telefone,
      valor: cert.taxa_valor,
      referencia,
      fornecedor: prov.nome,
    })
    .select('id')
    .single();
  if (insError) throw dbError(insError, 500, 'Falha ao iniciar o pagamento.');

  let result: ChargeResult;
  try {
    result = await prov.charge({ metodo, telefone, valor: cert.taxa_valor, referencia });
  } catch (e) {
    result = { estado: 'falhado', erro: e instanceof Error ? e.message : 'Erro do fornecedor.' };
  }

  const { error: updError } = await service
    .from('pagamentos')
    .update({ estado: result.estado, fornecedor_ref: result.fornecedorRef ?? null, erro: result.erro ?? null })
    .eq('id', pagamento.id);
  if (updError) logDbError('Falha ao actualizar o pagamento.', updError);

  if (result.estado === 'pago') {
    const { error: certError } = await service
      .from('certificados')
      .update({ pago_em: new Date().toISOString() })
      .eq('id', cert.id)
      .is('pago_em', null);
    // O dinheiro foi recebido: o erro fica registado para acerto manual, mas o
    // formando não deve ser cobrado outra vez.
    if (certError) logDbError(`Pagamento ${referencia} recebido mas certificado não desbloqueado.`, certError);
    return { estado: 'pago', mensagem: `Pagamento de ${cert.taxa_valor} MT confirmado (referência ${referencia}).` };
  }
  return {
    estado: 'falhado',
    mensagem: `O pagamento por ${NOME_METODO[metodo]} não foi concluído${result.erro ? `: ${result.erro}` : '.'} Pode tentar de novo.`,
  };
}
