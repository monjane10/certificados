import { CertificateBody, certificateText, fitFontSize, type TemplateProps } from '../shared';

/** Clássico: moldura dupla azul-marinho, tipografia serifada. */
export function ClassicoTemplate({ cert }: TemplateProps) {
  const t = certificateText(cert);
  return (
    <div className="absolute inset-0 bg-white text-[#11245C]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <div className="absolute inset-[34px] border-[4px] border-[#11245C]" />
      <div className="absolute inset-[48px] border border-[#11245C]/30" />

      <div className="absolute inset-x-[110px] top-[100px] text-center">
        <p className="text-[17px] font-semibold uppercase tracking-[0.3em] text-[#7486A8]" style={{ fontFamily: 'Inter, sans-serif' }}>
          {cert.emissor_nome}
        </p>
        <h1 className="mt-8 text-[54px] font-bold leading-none">Certificado</h1>
        <p className="mt-3 text-[24px] italic text-[#3E5C9E]">{t.subtitulo}</p>
        <p className="mt-10 text-[19px] text-slate-600">Certifica-se que</p>
        <p className="mt-3 font-semibold leading-tight" style={{ fontSize: fitFontSize(cert.formando_nome, 44, 36) }}>
          {cert.formando_nome}
        </p>
        <div className="mx-auto mt-3 h-px w-[520px] bg-[#11245C]/40" />
        <p className="mx-auto mt-7 max-w-[780px] text-[20px] leading-relaxed text-slate-700">
          <CertificateBody cert={cert} strongClass="text-[#11245C]" />
        </p>
      </div>

      <div className="absolute inset-x-[110px] bottom-[86px] flex items-end justify-between text-[14px] text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div>
          <p>Emitido a {t.dataEmissao}</p>
          <p className="mt-1">
            Código <span className="font-mono font-semibold text-[#11245C]">{cert.codigo}</span> · {t.verifyUrl}
          </p>
        </div>
        <div className="w-[300px] text-center">
          <div className="border-t border-[#11245C]/60 pt-2 font-semibold text-[#11245C]">{cert.emissor_nome}</div>
          <p className="text-[12px] uppercase tracking-widest">Coordenação</p>
        </div>
      </div>
    </div>
  );
}
