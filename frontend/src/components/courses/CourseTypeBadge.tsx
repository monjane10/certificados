import { COURSE_TYPE_LABELS, type CourseType } from '../../types';

const styles: Record<CourseType, string> = {
  participacao: 'border-slate-200 text-slate-600',
  tecnico_profissional: 'border-brand-200 text-brand-900',
};

export function CourseTypeBadge({ tipo }: { tipo: CourseType }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[tipo]}`}>
      {COURSE_TYPE_LABELS[tipo]}
    </span>
  );
}
