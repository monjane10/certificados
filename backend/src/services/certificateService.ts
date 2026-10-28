import { scopedClient, supabaseAnon } from '../config/supabase.js';
import type { Certificate, EmissionSummary, PublicVerification } from '../types/index.js';
import { dbError, requireOwnedCourse } from './courseService.js';

const CERT_COLUMNS =
  'id, codigo, matricula_id, curso_id, formando_id, tipo, modelo, formando_nome, curso_nome, carga_horaria, ' +
  'data_abertura, data_encerramento, nota, emissor_nome, logo_path, assinatura_path, responsavel_nome, ' +
  'responsavel_cargo, estado, emitido_em, anulado_em, motivo_anulacao, acesso_token, taxa_valor, pago_em, ' +
  'whatsapp_enviado_em';

export const CERT_CODE_RE = /^CERT-[A-HJ-NP-Z2-9]{8}$/;

/** Certificados emitidos pelo utilizador (RLS: user_id = auth.uid()), opcionalmente de um curso. */
export async function listCertificates(
  accessToken: string,
  userId: string,
  courseId?: string,
): Promise<Certificate[]> {
  let query = scopedClient(accessToken)
    .from('certificados')
    .select(CERT_COLUMNS)
    .eq('user_id', userId)
    .order('emitido_em', { ascending: false });
  if (courseId) query = query.eq('curso_id', courseId);
  const { data, error } = await query;
  if (error) throw dbError(error, 500, 'Falha ao listar certificados.');
  const certs = (data ?? []) as unknown as Certificate[];
  // Contacto actual do formando, para enviar o link por WhatsApp (não é snapshot:
  // se o contacto for corrigido, o envio usa o novo).
  const ids = [...new Set(certs.map((c) => c.formando_id))];
  if (ids.length === 0) return certs;
  const { data: formandos, error: fError } = await scopedClient(accessToken)
    .from('formandos')
    .select('id, contacto')
    .in('id', ids);
  if (fError) throw dbError(fError, 500, 'Falha ao listar certificados.');
  const contactos = new Map((formandos ?? []).map((f) => [f.id as string, (f.contacto as string | null) ?? null]));
  return certs.map((c) => ({ ...c, formando_contacto: contactos.get(c.formando_id) ?? null }));
}

/** Regista que o link foi enviado ao formando pelo WhatsApp da instituição. */
export async function markWhatsappSent(accessToken: string, certificateId: string): Promise<string> {
  const { data, error } = await scopedClient(accessToken).rpc('marcar_whatsapp_enviado', {
    p_certificado_id: certificateId,
  });
  if (error) throw dbError(error, 409, 'Não foi possível registar o envio.');
  return data as string;
}

/**
 * Emissão em lote (função SQL emitir_certificados, atómica e com o curso
 * bloqueado): participação -> todos; técnico-profissional -> nota >= mínima.
 */
export async function emitCertificates(
  accessToken: string,
  userId: string,
  courseId: string,
): Promise<EmissionSummary> {
  await requireOwnedCourse(accessToken, userId, courseId);
  const { data, error } = await scopedClient(accessToken).rpc('emitir_certificados', { p_curso_id: courseId });
  if (error) throw dbError(error, 409, 'Não foi possível emitir os certificados.');
  const r = (data ?? {}) as Record<string, number | undefined>;
  return {
    total: r['total'] ?? 0,
    emitidos: r['emitidos'] ?? 0,
    jaEmitidos: r['ja_emitidos'] ?? 0,
    semNota: r['sem_nota'] ?? 0,
    reprovados: r['reprovados'] ?? 0,
  };
}

export async function annulCertificate(
  accessToken: string,
  certificateId: string,
  motivo: string,
): Promise<Certificate> {
  // Propriedade verificada dentro da função SQL.
  const { data, error } = await scopedClient(accessToken).rpc('anular_certificado', {
    p_certificado_id: certificateId,
    p_motivo: motivo,
  });
  if (error) throw dbError(error, 409, 'Não foi possível anular o certificado.');
  return data as Certificate;
}

/** Certificados activos visíveis ao token (todos, para admin via policy). */
export async function countIssuedCertificates(accessToken: string): Promise<number> {
  const { count, error } = await scopedClient(accessToken)
    .from('certificados')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'emitido');
  if (error) throw error;
  return count ?? 0;
}

/** Verificação pública por código (sem autenticação). */
export async function verifyCertificate(codigo: string): Promise<PublicVerification | null> {
  const { data, error } = await supabaseAnon.rpc('verificar_certificado', { p_codigo: codigo });
  if (error) throw dbError(error, 500, 'Falha ao verificar o certificado.');
  return (data as PublicVerification | null) ?? null;
}
