import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';
  const styles: Record<string, string> = {
    primary: 'bg-ink text-white hover:bg-brand-950',
    secondary: 'bg-white text-ink border border-line hover:bg-soft',
    ghost: 'text-ink hover:bg-soft',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
      )}
      {children}
    </button>
  );
}
