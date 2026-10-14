import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-white p-4 sm:p-6 ${className}`}>{children}</div>;
}

/** Indicadores com 2 dígitos (01, 02…) como na referência visual. */
export function formatCount(n: number | null): string {
  if (n === null) return '...';
  return n < 10 ? String(n).padStart(2, '0') : String(n);
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[96px] items-start justify-between gap-4 rounded-card border border-line bg-white px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1.5 text-[26px] font-bold leading-none tabular-nums tracking-tight text-ink">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      </div>
      {icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-soft text-ink" aria-hidden>
          {icon}
        </span>
      )}
    </div>
  );
}
