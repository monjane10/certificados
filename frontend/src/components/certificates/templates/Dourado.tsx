import { useId } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  CertificateBody,
  Logo,
  SignatureImage,
  certificateText,
  fitFontSize,
  signer,
  type TemplateProps,
} from '../shared';

const BROWN = '#3B2A12';
const GOLD_DARK = '#8A6420';

/** Canto ornamental (desenhado no canto superior esquerdo e espelhado). */
function Corner({ transform, stroke }: { transform: string; stroke: string }) {
  return (
    <g transform={transform} fill="none" stroke={stroke}>
      <path d="M60 150 L60 60 L150 60" strokeWidth="3" />
      <path d="M74 120 L74 74 L120 74" strokeWidth="1.5" />
      <path d="M60 60 L46 46" strokeWidth="2" />
      <rect x="84" y="84" width="14" height="14" transform="rotate(45 91 91)" fill={stroke} stroke="none" />
    </g>
  );
}

/** Dourado Elegante: fundo creme, molduras douradas, nome em caligrafia e selo. */
export function DouradoTemplate({ cert }: TemplateProps) {
  const t = certificateText(cert);
  const s = signer(cert);
  const gid = `gold-${useId().replace(/:/g, '')}`;
  const gold = `url(#${gid})`;
  return (
    <div className="absolute inset-0 bg-[#FBF6EA]" style={{ color: BROWN, fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E9C46A" />
            <stop offset="0.5" stopColor="#B8892D" />
            <stop offset="1" stopColor="#E3B85C" />
          </linearGradient>
        </defs>
        <rect x="26" y="26" width={CANVAS_W - 52} height={CANVAS_H - 52} fill="none" stroke={gold} strokeWidth="10" />
        <rect x="46" y="46" width={CANVAS_W - 92} height={CANVAS_H - 92} fill="none" stroke={gold} strokeWidth="1.5" />
        <Corner transform="" stroke="#B8892D" />
        <Corner transform={`translate(${CANVAS_W} 0) scale(-1 1)`} stroke="#B8892D" />
        <Corner transform={`translate(0 ${CANVAS_H}) scale(1 -1)`} stroke="#B8892D" />
        <Corner transform={`translate(${CANVAS_W} ${CANVAS_H}) scale(-1 -1)`} stroke="#B8892D" />

        {/* Selo */}
        <g transform={`translate(${CANVAS_W / 2} 642)`}>
          {Array.from({ length: 24 }, (_, i) => (
            <circle key={i} cx={52 * Math.cos((Math.PI * 2 * i) / 24)} cy={52 * Math.sin((Math.PI * 2 * i) / 24)} r={9} fill={gold} />
          ))}
          <circle r="52" fill={gold} />
          {cert.logo_path ? (
            // Fundo creme no centro do selo para o logótipo assentar.
            <circle r="42" fill="#FBF6EA" stroke="#FBF6EA" strokeWidth="2" />
          ) : (
            <>
              <circle r="40" fill="none" stroke="#FBF6EA" strokeWidth="2" />
              <text y="7" textAnchor="middle" fontSize="20" fontWeight="700" fill="#FBF6EA" fontFamily="'Playfair Display', serif">
                ★
              </text>
            </>
          )}
        </g>
      </svg>
      <Logo cert={cert} className="absolute left-[531px] top-[612px] h-[60px] w-[60px]" />

      <div className="absolute inset-x-[150px] top-[92px] text-center">
        <p className="text-[15px] uppercase tracking-[0.35em]" style={{ color: GOLD_DARK, fontFamily: "'Montserrat', sans-serif" }}>
          {cert.emissor_nome}
        </p>
        <h1 className="mt-5 text-[76px] font-bold leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>
          Certificado
        </h1>
        <p className="mt-3 text-[20px] uppercase tracking-[0.3em]" style={{ color: GOLD_DARK, fontFamily: "'Montserrat', sans-serif" }}>
          {t.subtitulo}
        </p>
        <p className="mt-8 text-[19px] italic">Confere-se a</p>
        <p
          className="flex h-[110px] items-center justify-center leading-[1.15]"
          style={{ fontFamily: "'Great Vibes', cursive", color: GOLD_DARK, fontSize: fitFontSize(cert.formando_nome, 82, 22) }}
        >
          {cert.formando_nome}
        </p>
        <p className="mx-auto mt-2 max-w-[760px] text-[20px] leading-relaxed">
          <CertificateBody cert={cert} />
        </p>
      </div>

      {/* Só a assinatura tem linha; a data é texto, alinhada com o nome e o cargo de quem assina. */}
      <div className="absolute left-[150px] top-[652px] w-[260px] pt-[9px] text-center text-[15px]">
        <p className="leading-tight">{t.dataEmissao}</p>
        <p className="mt-1 text-[12px] uppercase tracking-[0.2em]" style={{ color: GOLD_DARK }}>Data de emissão</p>
      </div>
      <div className="absolute right-[150px] top-[652px] w-[260px] text-center text-[15px]">
        <SignatureImage cert={cert} height={64} />
        <div className="h-px w-full bg-[#B8892D]" />
        <p className="mt-2 leading-tight">{s.nome}</p>
        <p className="mt-1 text-[12px] uppercase tracking-[0.2em]" style={{ color: GOLD_DARK }}>{s.cargo}</p>
      </div>

      <p className="absolute bottom-[54px] inset-x-0 text-center text-[12px]" style={{ color: GOLD_DARK, fontFamily: "'Montserrat', sans-serif" }}>
        Código <span className="font-semibold">{cert.codigo}</span> · {t.verifyUrl}
      </p>
    </div>
  );
}
