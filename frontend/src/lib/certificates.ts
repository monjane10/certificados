import { NOTA_MINIMA_APROVACAO, type Course, type EnrollmentView } from '../types';

/**
 * Situação de uma matrícula face à emissão. Espelha a função SQL
 * emitir_certificados, que é quem decide de facto.
 */
export type CertificateEligibility = 'emitido' | 'elegivel' | 'sem_nota' | 'reprovado';

export function eligibilityOf(course: Pick<Course, 'tipo'>, e: EnrollmentView): CertificateEligibility {
  if (e.certificado) return 'emitido';
  if (course.tipo === 'participacao') return 'elegivel';
  if (e.avaliacao === null) return 'sem_nota';
  return e.avaliacao >= NOTA_MINIMA_APROVACAO ? 'elegivel' : 'reprovado';
}

/** Motivo pelo qual o curso ainda não permite emitir (null se pode). */
export function courseBlockReason(course: Pick<Course, 'status' | 'data_encerramento'>): string | null {
  if (course.status === 'cancelado') return 'Não é possível emitir certificados de um curso cancelado.';
  if (!course.data_encerramento) return 'Defina a data de encerramento do curso antes de emitir certificados.';
  if (course.status !== 'concluido') {
    return `Os certificados podem ser emitidos a partir da data de encerramento (${fmtDate(course.data_encerramento)}).`;
  }
  return null;
}

/** Período legível de um curso/certificado. */
export function fmtDate(d: string | null): string {
  if (!d) return '-';
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-MZ');
}
