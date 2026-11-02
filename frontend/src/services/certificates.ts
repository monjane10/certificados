import { apiRequest } from '../lib/http';
import type {
  Certificate,
  CorrectionRequest,
  EmissionSummary,
  PaymentMethod,
  PublicVerification,
  StudentCertificate,
} from '../types';

export const certificateService = {
  async list(courseId?: string): Promise<Certificate[]> {
    const json = await apiRequest(`/api/certificates${courseId ? `?curso_id=${courseId}` : ''}`);
    return (json['certificates'] as Certificate[]) ?? [];
  },
  /** Emite, num só pedido, os certificados de todos os formandos elegíveis do curso. */
  async emitForCourse(courseId: string): Promise<EmissionSummary> {
    const json = await apiRequest(`/api/courses/${courseId}/certificates`, { method: 'POST' });
    return json['summary'] as EmissionSummary;
  },
  async annul(id: string, motivo: string): Promise<Certificate> {
    const json = await apiRequest(`/api/certificates/${id}/annul`, { method: 'POST', body: { motivo } });
    return json['certificate'] as Certificate;
  },
  /** Regista que o link foi enviado ao formando pelo WhatsApp da instituição. */
  async markWhatsappSent(id: string): Promise<string> {
    const json = await apiRequest(`/api/certificates/${id}/whatsapp`, { method: 'POST' });
    return json['whatsapp_enviado_em'] as string;
  },
  /** A instituição confirma que os dados estão correctos e fecha o pedido de correcção. */
  async resolveCorrection(id: string): Promise<void> {
    await apiRequest(`/api/certificates/${id}/correcao/resolver`, { method: 'POST' });
  },
  /** Página do formando (link privado, sem sessão). */
  async student(token: string): Promise<StudentCertificate> {
    const json = await apiRequest(`/api/public/c/${encodeURIComponent(token)}`, { auth: false });
    return json['certificate'] as StudentCertificate;
  },
  /**
   * Inicia a cobrança da taxa: o pedido chega ao telemóvel e o formando
   * confirma com o PIN. A resposta chega depois (ver `pagamento` em `student`).
   */
  async pay(token: string, metodo: PaymentMethod, telefone: string): Promise<void> {
    await apiRequest(`/api/public/c/${encodeURIComponent(token)}/pagamento`, {
      method: 'POST',
      body: { metodo, telefone },
      auth: false,
    });
  },
  /** O formando avisa a instituição de um erro nos dados do certificado. */
  async requestCorrection(token: string, mensagem: string): Promise<CorrectionRequest> {
    const json = await apiRequest(`/api/public/c/${encodeURIComponent(token)}/correcao`, {
      method: 'POST',
      body: { mensagem },
      auth: false,
    });
    return json['correcao'] as CorrectionRequest;
  },
  /** Verificação pública (sem sessão). */
  async verify(codigo: string): Promise<PublicVerification> {
    const json = await apiRequest(`/api/public/certificates/${encodeURIComponent(codigo.trim().toUpperCase())}`, {
      auth: false,
    });
    return json['certificate'] as PublicVerification;
  },
};
