import { useId } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  CertificateBody,
  Logo,
  SignatureImage,
  certificateText,
  fitFontSize,
  initials,
  signer,
  type TemplateProps,
} from '../shared';

const PURPLE = '#4C2A85';

/** Violeta Moderno: fundo branco, ondas em degradê violeta/azul, bloco de marca. */
export function VioletaTemplate({ cert }: TemplateProps) {
  const t = certificateText(cert);
  const s = signer(cert);
  // Ids únicos: vários modelos podem estar no ecrã ao mesmo tempo (escolha de modelo).
  const uid = useId().replace(/:/g, '');
  const a = `vl-a-${uid}`;
  const b = `vl-b-${uid}`;
  return (
    <div className="absolute inset-0 bg-white text-[#1F1147]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} aria-hidden>
        <defs>
          <linearGradient id={a} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#C4B5FD" />
            <stop offset="0.55" stopColor="#7C3AED" />
            <stop offset="1" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id={b} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#22D3EE" />
            <stop offset="0.5" stopColor="#6366F1" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        {/* Canto superior direito */}
        <path d="M660 0 C720 40 800 70 870 140 C930 200 990 330 1123 380 L1123 0 Z" fill={`url(#${a})`} opacity="0.35" />
        <path d="M760 0 C820 50 880 90 930 160 C985 240 1040 300 1123 320 L1123 0 Z" fill={`url(#${a})`} opacity="0.75" />
        <path d="M900 0 C940 70 990 120 1050 150 C1085 168 1105 190 1123 230 L1123 0 Z" fill={`url(#${b})`} />
         <rect x="968" y="96" width="118" height="128" fill="none" stroke="#C4B5FD" strokeWidth="2" />
        {/* Canto inferior esquerdo: linhas finas + onda */}
        {Array.from({ length: 22 }, (_, i) => (
          <path
            key={i}
            d={`M0 ${520 + i * 6} C ${90 + i * 4} ${560 + i * 5}, ${140 + i * 3} ${700 + i * 2}, ${240 + i * 6} 794`}
            fill="none"
            stroke={`url(#${a})`}
            strokeWidth="1"
            opacity={0.25 + i * 0.025}
          />
        ))}
        <path d="M0 640 C80 660 150 730 190 794 L0 794 Z" fill={`url(#${b})`} opacity="0.9" />
      </svg>

      {/* Bloco de marca (iniciais da instituição) */}
      <div className="absolute left-[110px] top-[64px] flex items-center gap-3">
        <Logo
          cert={cert}
          className="h-[78px] max-w-[180px]"
          fallback={
            <span className="flex h-[78px] w-[78px] items-center justify-center text-[24px] font-bold text-white" style={{ background: PURPLE }}>
              {initials(cert.emissor_nome)}
            </span>
          }
        />
        <div className="max-w-[420px]">
          <p className="text-[12px] uppercase tracking-wider text-slate-500">Instituição</p>
          <p className="text-[22px] font-semibold leading-tight">{cert.emissor_nome}</p>
        </div>
      </div>

      <div className="absolute inset-x-[150px] top-[205px] text-center">
        <h1 className="text-[80px] font-bold leading-none tracking-[0.16em]" style={{ color: PURPLE }}>
          CERTIFICADO
        </h1>
        <p className="mt-4 text-[22px] font-medium uppercase tracking-wide">{t.subtitulo}</p>
        <p className="mt-7 text-[17px] uppercase tracking-[0.12em] text-slate-600">Este certificado é concedido a</p>
        <p
          className="mt-4 font-semibold leading-tight"
          style={{ fontFamily: "'Playfair Display', serif", color: PURPLE, fontSize: fitFontSize(cert.formando_nome, 50, 30) }}
        >
          {cert.formando_nome}
        </p>
        <div className="mx-auto mt-2 h-[2px] w-[460px] bg-gradient-to-r from-transparent via-[#7C3AED] to-transparent" />
        <p className="mx-auto mt-6 max-w-[760px] text-[19px] leading-relaxed text-slate-700">
          <CertificateBody cert={cert} strongClass="text-[#1F1147]" />
        </p>
      </div>

      {/* Só a assinatura tem linha; a data é texto, alinhada com o nome e o cargo de quem assina. */}
      <div className="absolute left-[230px] top-[668px] w-[240px] pt-[9px] text-center">
        <p className="text-[15px] font-medium leading-tight">{t.dataEmissao}</p>
        <p className="mt-1 text-[12px] uppercase tracking-widest text-slate-500">Data de emissão</p>
      </div>
      <div className="absolute right-[200px] top-[668px] w-[280px] text-center">
        <SignatureImage cert={cert} height={64} />
        <div className="h-px w-full bg-slate-400" />
        <p className="mt-2 text-[15px] font-medium leading-tight">{s.nome}</p>
        <p className="mt-1 text-[12px] uppercase tracking-widest text-slate-500">{s.cargo}</p>
      </div>

      <p className="absolute bottom-[18px] inset-x-0 text-center text-[12px] text-slate-500">
        Código <span className="font-semibold text-[#1F1147]">{cert.codigo}</span> · Verifique a autenticidade em {t.verifyUrl}
      </p>
    </div>
  );
}
