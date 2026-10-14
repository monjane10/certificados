export function Spinner({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-brand-900" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-900" aria-hidden />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
