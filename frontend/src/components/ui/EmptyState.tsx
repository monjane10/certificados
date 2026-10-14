import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-slate-400">{icon}</div>}
      <p className="text-base font-semibold text-brand-950">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Em breve
    </span>
  );
}
