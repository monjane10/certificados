import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { PublicCertificate } from '../../types';
import { CertificateDocument } from './CertificateDocument';
import { CANVAS_H, CANVAS_W } from './shared';

type OrientationLock = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };

/**
 * Certificado a ocupar o ecrã: no telemóvel tenta rodar para horizontal.
 * «Ampliar» mostra-o maior do que o ecrã, para ler os pormenores deslizando.
 */
export function CertificateFullscreen({
  cert,
  watermark,
  onClose,
}: {
  cert: PublicCertificate;
  watermark?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let entered = false;

    // Ecrã inteiro e rotação são opcionais: nem todos os browsers deixam.
    el?.requestFullscreen?.()
      .then(() => {
        entered = true;
        return (screen.orientation as OrientationLock | undefined)?.lock?.('landscape');
      })
      .catch(() => undefined);

    // Sair do ecrã inteiro (botão «voltar» ou Esc) fecha a vista.
    function onFullscreenChange() {
      if (entered && !document.fullscreenElement) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="fixed inset-0 z-50 flex flex-col bg-slate-950 print:hidden" role="dialog" aria-modal="true" aria-label="Certificado em ecrã inteiro">
      <div className="flex items-center justify-end gap-2 p-2">
        <button
          type="button"
          onClick={() => setZoom((z) => !z)}
          className="inline-flex items-center gap-1.5 rounded-button px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          {zoom ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {zoom ? 'Ajustar ao ecrã' : 'Ampliar'}
        </button>
        <button type="button" onClick={onClose} className="rounded-button p-2 text-white hover:bg-white/10" aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        <div
          className="mx-auto"
          style={{
            width: zoom ? Math.round(CANVAS_W * 1.6) : `min(100%, calc((100dvh - 4.5rem) * ${CANVAS_W / CANVAS_H}))`,
          }}
        >
          <CertificateDocument cert={cert} watermark={watermark} />
        </div>
      </div>
    </div>
  );
}
