import type { CourseStatus } from '../types';

/** Data de hoje (AAAA-MM-DD) no fuso de Maputo, o mesmo usado pela BD. */
export function todayMaputo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo' }).format(new Date());
}

/**
 * Estado do curso a partir das datas. Espelha a função SQL estado_curso_datas,
 * que é quem decide de facto; aqui serve só para pré-visualizar no formulário.
 */
export function courseStatusFromDates(d: {
  cancelado?: boolean;
  data_abertura?: string | null;
  data_encerramento?: string | null;
}): CourseStatus {
  const hoje = todayMaputo();
  if (d.cancelado) return 'cancelado';
  if (d.data_encerramento && hoje >= d.data_encerramento) return 'concluido';
  if (d.data_abertura && hoje >= d.data_abertura) return 'em_andamento';
  return 'planeado';
}
