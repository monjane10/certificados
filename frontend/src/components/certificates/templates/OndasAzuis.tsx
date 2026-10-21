import { CANVAS_H, CANVAS_W, CertificateBody, certificateText, fitFontSize, type TemplateProps } from '../shared';

const DARK = '#16548C';
const LIGHT = '#55C3EA';
const NAVY = '#0B3561';

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return `M${pts.join('L')}Z`;
}

function Gear({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <g fill={color}>
      {teeth.map((deg) => (
        <rect key={deg} x={cx - r * 0.22} y={cy - r * 1.22} width={r * 0.44} height={r * 0.5} rx={4} transform={`rotate(${deg} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r * 0.36} fill="#EAF6FD" />
    </g>
  );
}

/** Ondas Azuis: fundo azul-claro, ondas nos cantos, medalha e engrenagens. */
export function OndasAzuisTemplate({ cert }: TemplateProps) {
  const t = certificateText(cert);
  return (
    <div className="absolute inset-0 bg-[#EAF6FD]" style={{ color: NAVY, fontFamily: "'Montserrat', sans-serif" }}>
      <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} aria-hidden>
        {/* Ondas: canto superior direito */}
        <path d="M735 0 C790 80 880 118 985 108 C1050 102 1095 132 1123 185 L1123 0 Z" fill={LIGHT} />
        <path d="M805 0 C850 60 935 92 1030 84 C1075 80 1105 98 1123 118 L1123 0 Z" fill={DARK} />
        {/* Ondas: canto inferior esquerdo */}
        <path d="M0 545 C110 575 190 680 215 794 L0 794 Z" fill={DARK} />
        <path d="M0 680 C120 680 230 730 330 794 L0 794 Z" fill={LIGHT} />

        {/* Medalha */}
        <g>
          <path d="M120 230 L82 330 L112 318 L130 350 L160 250 Z" fill={DARK} />
          <path d="M210 230 L248 330 L218 318 L200 350 L170 250 Z" fill={DARK} />
          {Array.from({ length: 18 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 18;
            return <circle key={i} cx={165 + 64 * Math.cos(a)} cy={170 + 64 * Math.sin(a)} r={13} fill={DARK} />;
          })}
          <circle cx={165} cy={170} r={66} fill={DARK} />
          <circle cx={165} cy={170} r={52} fill="#EAF6FD" />
          <circle cx={165} cy={170} r={45} fill="none" stroke={DARK} strokeWidth={5} />
          <path d={starPath(165, 172, 30, 13)} fill={DARK} />
        </g>

        {/* Engrenagens */}
        <Gear cx={1062} cy={655} r={46} color={DARK} />
        <Gear cx={990} cy={712} r={56} color={LIGHT} />
      </svg>

      <div className="absolute inset-x-[230px] top-[118px] text-center">
        <h1 className="text-[112px] font-black leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>
          Certificado
        </h1>
        <p className="mt-2 text-[32px] font-medium uppercase tracking-wide">{t.subtitulo}</p>
      </div>

      <div className="absolute left-[190px] right-[190px] top-[318px] flex h-[150px] flex-col justify-center text-center">
        <p
          className="relative z-10 leading-[1.25]"
          style={{ fontFamily: "'Great Vibes', cursive", color: '#45B4E0', fontSize: fitFontSize(cert.formando_nome, 88, 18) }}
        >
          {cert.formando_nome}
        </p>
        <div className="mx-auto -mt-[0.45em] h-[2px] w-[540px]" style={{ background: NAVY, fontSize: fitFontSize(cert.formando_nome, 88, 18) }} />
      </div>

      <p className="absolute left-[250px] right-[250px] top-[515px] text-center text-[21px] leading-[1.45]">
        <CertificateBody cert={cert} strongClass="font-semibold" />
      </p>

      <div className="absolute left-1/2 top-[668px] w-[300px] -translate-x-1/2 text-center">
        <div className="h-[2px] w-full" style={{ background: NAVY }} />
        <p className="mt-2 text-[16px] font-medium uppercase tracking-wider">Coordenação</p>
        <p className="text-[14px] leading-tight">{cert.emissor_nome}</p>
      </div>

      <p className="absolute bottom-[24px] left-[300px] right-[300px] text-center text-[12px] text-[#3E6A96]">
        Emitido a {t.dataEmissao} · Código <span className="font-semibold">{cert.codigo}</span> · {t.verifyUrl}
      </p>
    </div>
  );
}
