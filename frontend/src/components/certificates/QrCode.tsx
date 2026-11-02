import { useMemo } from 'react';
import { create } from 'qrcode';

/**
 * Código QR em SVG (nítido a qualquer escala, também no PDF). Fundo branco e
 * margem de 2 módulos para os leitores o apanharem sobre fundos de cor.
 */
export function QrCode({ value, size, className = '' }: { value: string; size: number; className?: string }) {
  const { path, n } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: 'M' });
    const count = modules.size;
    let d = '';
    for (let y = 0; y < count; y += 1) {
      for (let x = 0; x < count; x += 1) {
        if (modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
      }
    }
    return { path: d, n: count + 4 };
  }, [value]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Código QR de verificação"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#0f172a" />
    </svg>
  );
}
