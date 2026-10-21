import { apiRequest } from '../lib/http';
import type { Certificate, EmissionSummary, PublicCertificate } from '../types';

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
  /** Verificação pública (sem sessão). */
  async verify(codigo: string): Promise<PublicCertificate> {
    const json = await apiRequest(`/api/public/certificates/${encodeURIComponent(codigo.trim().toUpperCase())}`, {
      auth: false,
    });
    return json['certificate'] as PublicCertificate;
  },
};
