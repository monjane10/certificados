import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, Download, Expand, Eye, ImageDown, MessageCircle, Printer, Share2, ShieldCheck } from 'lucide-react';
import { brandingUrl } from '../../lib/branding';
import { whatsappNumber, whatsappUrl } from '../../lib/whatsapp';
import { CertificateDocument } from '../certificates/CertificateDocument';
import { downloadImage, downloadPdf } from '../certificates/export';
import { verifyLink } from '../certificates/shared';
import { MethodLogo, NOME_METODO } from './Checkout';
import type { StudentCertificate } from '../../types';

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-PT')}, ${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
}

const outline =
  'inline-flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-brand-900/70 bg-white px-4 py-3 font-semibold text-brand-950 transition hover:bg-slate-50 disabled:opacity-60';

/** Contacto de apoio: WhatsApp da instituição; na falta, email ou telefone. */
function helpLink(cert: StudentCertificate): string | null {
  const wa = whatsappNumber(cert.emissor_telefone);
  if (wa) return whatsappUrl(wa, `Olá! Tenho uma questão sobre o meu certificado ${cert.codigo}.`);
  if (cert.emissor_email) return `mailto:${cert.emissor_email}?subject=${encodeURIComponent(`Certificado ${cert.codigo}`)}`;
  if (cert.emissor_telefone) return `tel:${cert.emissor_telefone.replace(/[^\d+]/g, '')}`;
  return null;
}

/**
 * Página do formando depois do pagamento: o certificado à esquerda e, à
 * direita, descarregar, comprovativo e verificação.
 */
export function PaidView({
  cert,
  onFullscreen,
  onReportError,
}: {
  cert: StudentCertificate;
  onFullscreen: () => void;
  onReportError?: () => void;
}) {
  const logo = brandingUrl(cert.logo_path);
  const ajuda = helpLink(cert);
  const whatsapp = whatsappNumber(cert.emissor_telefone);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 print:max-w-none print:px-0">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 py-5 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            {logo && <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain" />}
            <p className="truncate text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{cert.emissor_nome}</p>
          </div>
          <p className="flex shrink-0 items-center gap-2 font-semibold text-accent-700">
            <CircleCheck size={26} className="fill-accent-700 text-white" aria-hidden />
            <span className="hidden sm:inline">Pagamento confirmado</span>
            <span className="sm:hidden">Pago</span>
          </p>
        </header>

        <div className="flex flex-wrap items-start justify-between gap-3 py-8 print:hidden">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl">O seu certificado</h1>
            <p className="mt-2 text-slate-500 sm:text-lg">
              {cert.formando_nome} <span aria-hidden>·</span> {cert.curso_nome}
            </p>
          </div>
          {ajuda && (
            <a href={ajuda} target="_blank" rel="noopener noreferrer" className="text-brand-900 underline hover:text-brand-950 sm:mt-3">
              Precisa de ajuda?
            </a>
          )}
        </div>

        {cert.correcao && (
          <div className="mb-6 rounded-card border border-amber-300 bg-amber-50 p-4 print:hidden">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <CircleAlert size={18} /> Pedido de correcção enviado em {fmtDateTime(cert.correcao.criado_em)}
            </p>
            <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-sm italic text-amber-900/80">
              {cert.correcao.mensagem}
            </blockquote>
            <p className="mt-2 text-sm text-amber-900">
              A instituição vai corrigir os dados e enviar-lhe um link novo. O pagamento que fez passa para o certificado
              corrigido.
            </p>
          </div>
        )}

        <PaidContent cert={cert} onFullscreen={onFullscreen} onReportError={onReportError} />

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-5 text-sm text-slate-500 print:hidden">
          <span>{cert.emissor_nome}</span>
          {whatsapp && (
            <a
              href={whatsappUrl(whatsapp, `Olá! Tenho uma questão sobre o meu certificado ${cert.codigo}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-brand-950"
            >
              <MessageCircle size={16} /> Apoio via WhatsApp
            </a>
          )}
        </footer>
      </div>
    </div>
  );
}

function PaidContent({
  cert,
  onFullscreen,
  onReportError,
}: {
  cert: StudentCertificate;
  onFullscreen: () => void;
  onReportError?: () => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const p = cert.pagamento;

  async function exportAs(kind: 'pdf' | 'png') {
    if (!canvas.current || busy) return;
    setBusy(kind);
    setMessage(null);
    try {
      await (kind === 'pdf' ? downloadPdf : downloadImage)(canvas.current, cert);
    } catch {
      setMessage({ ok: false, text: 'Não foi possível gerar o ficheiro. Tente de novo ou use «Imprimir».' });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const url = verifyLink(cert.codigo);
    const text = `Certificado do curso «${cert.curso_nome}», emitido por ${cert.emissor_nome}.`;
    setMessage(null);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Certificado ${cert.codigo}`, text, url });
      } catch {
        // Partilha cancelada pelo formando.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ ok: true, text: 'Link de verificação copiado.' });
    } catch {
      setMessage({ ok: true, text: `Link de verificação: ${url}` });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] print:block">
      {/* Certificado primeiro; as acções e o pagamento vêm a seguir (ao lado, em ecrãs largos). */}
      <section className="rounded-card border border-slate-200 bg-slate-50 p-4 sm:p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-600 print:hidden">
          <span className="inline-flex items-center gap-2">
            <Eye size={18} /> Pré-visualização
          </span>
          <button type="button" onClick={onFullscreen} className="inline-flex items-center gap-2 hover:text-brand-950">
            <Expand size={16} /> Ecrã inteiro
          </button>
        </div>
        <CertificateDocument cert={cert} canvasRef={canvas} className="bg-white shadow-sm print:shadow-none" />
      </section>

      <aside className="self-start rounded-card border border-slate-200 bg-white p-5 sm:p-6 print:hidden">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void exportAs('pdf')}
            disabled={busy !== null}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-brand-950 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-brand-900 disabled:opacity-70"
          >
            {busy === 'pdf' ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            ) : (
              <Download size={20} />
            )}
            Descarregar PDF
          </button>
          <button type="button" onClick={() => void exportAs('png')} disabled={busy !== null} className={outline}>
            <ImageDown size={20} /> {busy === 'png' ? 'A gerar...' : 'Guardar imagem'}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => void share()} className={`${outline} border-slate-200`}>
              <Share2 size={18} /> Partilhar
            </button>
            <button type="button" onClick={() => window.print()} className={`${outline} border-slate-200`}>
              <Printer size={18} /> Imprimir
            </button>
          </div>
          {message && (
            <p className={`text-sm ${message.ok ? 'text-slate-600' : 'text-red-700'}`} role="status">
              {message.text}
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-500">Pagamento</p>
          <div className="mt-1 flex items-center gap-4 sm:gap-5">
            <p className="whitespace-nowrap text-3xl font-extrabold tabular-nums tracking-tight text-brand-950 sm:text-4xl">{p?.valor ?? cert.taxa_valor} MT</p>
            {p && (
              <>
                <span className="h-9 w-px bg-slate-200" aria-hidden />
                <span className="flex items-center gap-2.5 whitespace-nowrap font-semibold text-brand-950">
                  <MethodLogo metodo={p.metodo} className="h-8" /> {NOME_METODO[p.metodo]}
                </span>
              </>
            )}
          </div>
        </div>

        <dl className="mt-5 divide-y divide-slate-200 border-t border-slate-200 text-sm">
          {p && (
            <>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-slate-500">Referência</dt>
                <dd className="font-medium tracking-wide text-brand-950">{p.referencia}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-slate-500">Número</dt>
                <dd className="font-medium tabular-nums text-brand-950">{p.telefone}</dd>
              </div>
            </>
          )}
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-slate-500">Data</dt>
            <dd className="font-medium tabular-nums text-brand-950">{fmtDateTime(p?.actualizado_em ?? cert.pago_em!)}</dd>
          </div>
        </dl>
        {cert.pagamento_herdado && (
          <p className="mt-1 text-xs text-slate-500">
            Pagamento feito no certificado anterior, que a instituição anulou para corrigir os dados.
          </p>
        )}

        <div className="mt-4 border-t border-slate-200 pt-5">
          <Link to={`/verificar?codigo=${cert.codigo}`} className={outline}>
            <ShieldCheck size={20} /> Verificar certificado
          </Link>
          {onReportError && (
            <button type="button" onClick={onReportError} className="mx-auto mt-5 block text-sm text-brand-900 underline hover:text-brand-950">
              Comunicar erro nos dados
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
