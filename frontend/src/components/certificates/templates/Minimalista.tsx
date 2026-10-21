import { CertificateBody, certificateText, fitFontSize, initials, type TemplateProps } from '../shared';

const GREEN = '#0F3D3E';
const TEAL = '#14B8A6';

/** Minimalista: faixa lateral escura com os dados da instituição, conteúdo limpo à direita. */
export function MinimalistaTemplate({ cert }: TemplateProps) {
  const t = certificateText(cert);
  return (
    <div className="absolute inset-0 bg-white text-slate-800" style={{ fontFamily: 'Inter, sans-serif' }}>
      <aside className="absolute inset-y-0 left-0 flex w-[300px] flex-col justify-between px-[44px] py-[60px] text-white" style={{ background: GREEN }}>
        <div>
          <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-[22px] font-bold" style={{ background: TEAL }}>
            {initials(cert.emissor_nome)}
          </span>
          <p className="mt-5 text-[22px] font-semibold leading-snug">{cert.emissor_nome}</p>
        </div>
        <div className="space-y-5 text-[14px]">
          <div>
            <p className="uppercase tracking-[0.2em] text-white/60">Emitido a</p>
            <p className="mt-1 font-medium">{t.dataEmissao}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.2em] text-white/60">Código</p>
            <p className="mt-1 font-mono text-[16px] font-semibold">{cert.codigo}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.2em] text-white/60">Verificar em</p>
            <p className="mt-1 break-all font-medium">{t.verifyUrl}</p>
          </div>
        </div>
      </aside>

      <div className="absolute bottom-0 left-[300px] right-0 top-0 px-[80px] py-[90px]">
        <div className="h-[6px] w-[90px]" style={{ background: TEAL }} />
        <p className="mt-8 text-[18px] font-semibold uppercase tracking-[0.35em] text-slate-500">Certificado</p>
        <p className="mt-2 text-[30px] font-bold" style={{ color: GREEN }}>
          {t.subtitulo}
        </p>
        <p className="mt-14 text-[17px] text-slate-500">Atribuído a</p>
        <p
          className="mt-2 font-extrabold leading-[1.1] tracking-tight"
          style={{ color: GREEN, fontSize: fitFontSize(cert.formando_nome, 54, 20, 34) }}
        >
          {cert.formando_nome}
        </p>
        <p className="mt-8 max-w-[640px] text-[20px] leading-relaxed text-slate-600">
          <CertificateBody cert={cert} strongClass="text-slate-900" />
        </p>

        <div className="absolute bottom-[90px] left-[80px] w-[300px]">
          <div className="h-px w-full bg-slate-300" />
          <p className="mt-2 text-[15px] font-semibold" style={{ color: GREEN }}>{cert.emissor_nome}</p>
          <p className="text-[12px] uppercase tracking-[0.2em] text-slate-500">Coordenação</p>
        </div>
      </div>
    </div>
  );
}
