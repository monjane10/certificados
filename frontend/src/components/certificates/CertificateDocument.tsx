import { useLayoutEffect, useRef, useState } from 'react';
import type { PublicCertificate } from '../../types';
import { templateById } from './registry';
import { CANVAS_H, CANVAS_W } from './shared';

/**
 * Desenha o certificado no modelo indicado. Os modelos são desenhados a
 * 1123x794 (A4 horizontal) e escalados para a largura disponível; na
 * impressão a escala é 1 (ver estilos de impressão em CertificateView).
 */
export function CertificateDocument({ cert, className = '' }: { cert: PublicCertificate; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CANVAS_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { Component } = templateById(cert.modelo);

  return (
    <div
      ref={ref}
      className={`cert-frame relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    >
      <div
        className="cert-scaler absolute left-0 top-0 origin-top-left"
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
      >
        <Component cert={cert} />
        {cert.estado === 'anulado' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded-xl border-[8px] border-red-600/80 bg-white/40 px-12 py-3 text-[96px] font-black tracking-[0.2em] text-red-600/80">
              ANULADO
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
