import { COURSE_STATUS_LABELS, type CourseStatus } from '../../types';

const dot: Record<CourseStatus, string> = {
  planeado: 'bg-slate-400',
  em_andamento: 'bg-brand-500',
  concluido: 'bg-accent-500',
  cancelado: 'bg-red-500',
};

const styles: Record<CourseStatus, string> = {
  planeado: 'bg-slate-100 text-slate-700',
  em_andamento: 'bg-brand-50 text-brand-900',
  concluido: 'bg-accent-100 text-accent-700',
  cancelado: 'bg-red-100 text-red-700',
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} aria-hidden />
      {COURSE_STATUS_LABELS[status]}
    </span>
  );
}
