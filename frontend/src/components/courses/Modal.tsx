import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  title,
  size = 'md',
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  /** 'xl' para conteúdo largo (ex.: escolha de modelo de certificado). */
  size?: 'md' | 'xl';
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-brand-950/50" onClick={onClose} />
      <div className={`relative max-h-[92dvh] w-full ${size === 'xl' ? 'max-w-4xl' : 'max-w-lg'} overflow-y-auto rounded-t-banner bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-banner sm:p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-950">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
