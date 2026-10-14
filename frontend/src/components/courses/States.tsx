import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';

export function LoadingState({ label = 'A carregar...' }: { label?: string }) {
  return <Spinner label={label} />;
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-card">
      <p className="text-base font-semibold text-brand-950">Não foi possível carregar</p>
      <p className="max-w-md text-sm text-slate-500">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <Button variant="secondary" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      )}
    </div>
  );
}
