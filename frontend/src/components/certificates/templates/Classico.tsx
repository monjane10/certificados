import { CertificateBody, Logo, SignatureImage, certificateText, fitFontSize, signer, type TemplateProps } from '../shared';

/** Clássico: moldura dupla azul-marinho, tipografia serifada. */
export function ClassicoTemplate({ cert }: TemplateProps) {
  const t = certificateText(cert);
  const s = signer(cert);
  return (
    <div className="absolute inset-0 bg-white text-[#11245C]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <div className="absolute inset-[34px] border-[4px] border-[#11245C]" />
      <div className="absolute inset-[48px] border border-[#11245C]/30" />

      <div className={`absolute inset-x-[110px] text-center ${cert.logo_path ? 'top-[70px]' : 'top-[100px]'}`}>
        <Logo cert={cert} className="mx-auto mb-4 h-[64px] max-w-[260px]" />
        <p className="text-[17px] font-semibold uppercase tracking-[0.3em] text-[#7486A8]" style={{ fontFamily: 'Inter, sans-serif' }}>
          {cert.emissor_nome}
        </p>
        <h1 className={`${cert.logo_path ? 'mt-5' : 'mt-8'} text-[54px] font-bold leading-none`}>Certificado</h1>
        <p className="mt-3 text-[24px] italic text-[#3E5C9E]">{t.subtitulo}</p>
        <p className={`${cert.logo_path ? 'mt-7' : 'mt-10'} text-[19px] text-slate-600`}>Certifica-se que</p>
        <p className="mt-3 font-semibold leading-tight" style={{ fontSize: fitFontSize(cert.formando_nome, 44, 36) }}>
          {cert.formando_nome}
        </p>
        <div className="mx-auto mt-3 h-px w-[520px] bg-[#11245C]/40" />
        <p className="mx-auto mt-7 max-w-[780px] text-[20px] leading-relaxed text-slate-700">
          <CertificateBody cert={cert} strongClass="text-[#11245C]" />
        </p>
      </div>

      <div className="absolute inset-x-[110px] bottom-[80px] flex items-end justify-between text-[14px] text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div>
          <p>Emitido a {t.dataEmissao}</p>
          <p className="mt-1">
            Código <span className="font-mono font-semibold text-[#11245C]">{cert.codigo}</span> · {t.verifyUrl}
          </p>
        </div>
        <div className="relative w-[300px] text-center">
          <SignatureImage cert={cert} />
          <div className="border-t border-[#11245C]/60 pt-2 font-semibold leading-tight text-[#11245C]">{s.nome}</div>
          <p className="mt-0.5 text-[12px] uppercase tracking-widest">{s.cargo}</p>
        </div>
      </div>
    </div>
  );
}
