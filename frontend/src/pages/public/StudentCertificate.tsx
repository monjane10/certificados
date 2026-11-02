import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CircleAlert,
  CircleCheck,
  Download,
  Expand,
  ImageDown,
  Mail,
  MessageCircle,
  Phone,
  Printer,
  Share2,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { ApiError } from '../../lib/http';
import { brandingUrl } from '../../lib/branding';
import { whatsappNumber, whatsappUrl } from '../../lib/whatsapp';
import { CertificateDocument } from '../../components/certificates/CertificateDocument';
import { CertificateFullscreen } from '../../components/certificates/CertificateFullscreen';
import { downloadImage, downloadPdf } from '../../components/certificates/export';
import { PRINT_CSS } from '../../components/certificates/print';
import { verifyLink } from '../../components/certificates/shared';
import { Modal } from '../../components/courses/Modal';
import { Checkout, MethodLogo, NOME_METODO } from '../../components/student/Checkout';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import type { StudentCertificate } from '../../types';

/** Enquanto o pagamento está pendente, a página consulta o estado a este ritmo. */
const POLL_MS = 3000;

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-MZ', { dateStyle: 'medium', timeStyle: 'short' });
}

const secondaryAction =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-button border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink hover:bg-soft disabled:opacity-60 sm:px-4';

/**
 * Página do formando (link privado enviado pela instituição). Antes do
 * pagamento: só a confirmação dos dados e o pagamento (Checkout); depois:
 * comprovativo e certificado para descarregar.
 */
export function StudentCertificatePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [cert, setCert] = useState<StudentCertificate | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  const load = useCallback(async () => {
    try {
      setCert(await certificateService.student(token));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e : new ApiError(500, 'Não foi possível carregar o certificado.'));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // À espera da confirmação no telemóvel: a página actualiza-se sozinha. Uma
  // falha de rede pelo meio não interrompe; o servidor dá o pedido como
  // falhado ao fim de 3 minutos sem resposta.
  const pendente = Boolean(cert && !cert.pago && cert.pagamento?.estado === 'pendente');
  useEffect(() => {
    if (!pendente) return;
    const id = window.setInterval(() => {
      certificateService.student(token).then(setCert).catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [pendente, token]);

  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  if (loadError && !cert) return <LoadErrorPage error={loadError} onRetry={() => void load()} />;
  if (!cert) return <div className="p-8"><Spinner label="A carregar o seu certificado..." /></div>;

  const correctionModal = (
    <CorrectionModal
      open={correcting}
      token={token}
      onClose={() => setCorrecting(false)}
      onSent={(correcao) => {
        setCert((prev) => (prev ? { ...prev, correcao } : prev));
        setCorrecting(false);
      }}
    />
  );

  if (cert.estado === 'anulado') {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p className="text-lg font-bold text-red-700">Certificado anulado</p>
        <p className="text-sm text-slate-500">
          Este certificado foi anulado por {cert.emissor_nome}. Se pediu uma correcção dos dados, a instituição vai
          enviar-lhe um link novo com o certificado corrigido.
          {cert.pago && ' O pagamento que fez passa para o certificado novo: não paga outra vez.'}
        </p>
        <IssuerContact cert={cert} className="justify-center" />
      </div>
    );
  }

  if (!cert.pago) {
    return (
      <>
        <Checkout cert={cert} token={token} onStarted={load} onReportError={() => setCorrecting(true)} />
        {correctionModal}
      </>
    );
  }

  const reportError = cert.correcao ? undefined : () => setCorrecting(true);

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>

      {/* Depois do pagamento: o certificado em grande, para descarregar. */}
      <div className="mx-auto max-w-[1123px] space-y-4 px-4 print:max-w-none print:px-0">
          <IssuerHeader cert={cert} />
          {cert.correcao && <CorrectionPending cert={cert} />}
          <PaidPanel cert={cert} />
          <div className="space-y-2">
            <div className="flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-900 hover:underline"
              >
                <Expand size={15} /> Ver em ecrã inteiro
              </button>
            </div>
            <ExportableCertificate cert={cert} />
          </div>
          <InfoPanel cert={cert} onReportError={reportError} />
        </div>

      {fullscreen && <CertificateFullscreen cert={cert} onClose={closeFullscreen} />}
      {correctionModal}
    </div>
  );
}

/** «Link inválido» só quando o servidor diz que o link não existe; o resto pode resolver-se tentando de novo. */
function LoadErrorPage({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.status === 404) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-bold text-brand-950">Link inválido</p>
        <p className="mt-2 text-sm text-slate-500">{error.message}</p>
      </div>
    );
  }
  const offline = error.status === 0;
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      {offline && <WifiOff className="mx-auto mb-3 text-slate-400" size={32} aria-hidden />}
      <p className="text-lg font-bold text-brand-950">{offline ? 'Sem ligação à internet' : 'Não foi possível carregar'}</p>
      <p className="mt-2 text-sm text-slate-500">
        {offline ? 'Verifique os dados móveis ou o Wi-Fi e tente de novo.' : error.message}
      </p>
      <Button onClick={onRetry} className="mt-4">
        Tentar de novo
      </Button>
    </div>
  );
}

function IssuerHeader({ cert }: { cert: StudentCertificate }) {
  const logo = brandingUrl(cert.logo_path);
  return (
    <header className="flex flex-wrap items-center gap-4 print:hidden">
      {logo && <img src={logo} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain p-1 shadow-card" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-500">{cert.emissor_nome}</p>
        <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">Certificado de {cert.formando_nome}</h1>
        <p className="text-sm text-slate-500">
          Curso «{cert.curso_nome}» · {cert.codigo}
        </p>
      </div>
    </header>
  );
}

/** Contactos da instituição: telefone, WhatsApp e email (os que existirem). */
function IssuerContact({ cert, className = '' }: { cert: StudentCertificate; className?: string }) {
  const wa = whatsappNumber(cert.emissor_telefone);
  if (!cert.emissor_telefone && !cert.emissor_email) return null;
  const link = 'inline-flex items-center gap-1.5 font-semibold text-brand-900 hover:underline';
  return (
    <p className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${className}`}>
      {cert.emissor_telefone && (
        <a href={`tel:${cert.emissor_telefone.replace(/[^\d+]/g, '')}`} className={link}>
          <Phone size={14} /> {cert.emissor_telefone}
        </a>
      )}
      {wa && (
        <a href={whatsappUrl(wa, `Olá! Tenho uma questão sobre o meu certificado ${cert.codigo}.`)} target="_blank" rel="noopener noreferrer" className={link}>
          <MessageCircle size={14} /> WhatsApp
        </a>
      )}
      {cert.emissor_email && (
        <a href={`mailto:${cert.emissor_email}?subject=${encodeURIComponent(`Certificado ${cert.codigo}`)}`} className={link}>
          <Mail size={14} /> {cert.emissor_email}
        </a>
      )}
    </p>
  );
}

function CorrectionPending({ cert }: { cert: StudentCertificate }) {
  return (
    <div className="rounded-card border border-amber-300 bg-amber-50 p-4 print:hidden">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <CircleAlert size={18} /> Pedido de correcção enviado em {fmtDateTime(cert.correcao!.criado_em)}
      </p>
      <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-sm italic text-amber-900/80">
        {cert.correcao!.mensagem}
      </blockquote>
      <p className="mt-2 text-sm text-amber-900">
        {cert.pago
          ? 'A instituição vai corrigir os dados e enviar-lhe um link novo. O pagamento que fez passa para o certificado corrigido.'
          : 'A instituição vai corrigir os dados e enviar-lhe um link novo. Não precisa de pagar até lá.'}
      </p>
    </div>
  );
}

function PaidPanel({ cert }: { cert: StudentCertificate }) {
  const p = cert.pagamento;
  return (
    <div className="space-y-3 print:hidden">
      <div className="rounded-card border border-accent-500/40 bg-accent-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-accent-700">
          <CircleCheck size={18} /> Pagamento confirmado. O seu certificado é válido.
        </p>
      </div>
      <div className="rounded-card border border-line bg-white p-4">
        <h2 className="text-sm font-bold text-brand-950">Comprovativo de pagamento</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
          {p && (
            <>
              <div>
                <dt className="text-xs text-slate-500">Referência</dt>
                <dd className="font-mono font-semibold text-brand-950">{p.referencia}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Valor</dt>
                <dd className="font-semibold tabular-nums text-brand-950">{p.valor} MT</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Método</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-brand-950">
                  <MethodLogo metodo={p.metodo} className="h-5" /> {NOME_METODO[p.metodo]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Número</dt>
                <dd className="font-semibold tabular-nums text-brand-950">{p.telefone}</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-xs text-slate-500">Data</dt>
            <dd className="font-semibold text-brand-950">{fmtDateTime(p?.actualizado_em ?? cert.pago_em!)}</dd>
          </div>
        </dl>
        {cert.pagamento_herdado && (
          <p className="mt-2 text-xs text-slate-500">
            Pagamento feito no certificado anterior, que a instituição anulou para corrigir os dados.
          </p>
        )}
      </div>
    </div>
  );
}

/** Certificado pago: com descarregar em PDF e imagem, partilhar e imprimir. */
function ExportableCertificate({ cert }: { cert: StudentCertificate }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap print:hidden">
        <Button
          onClick={() => void exportAs('pdf')}
          loading={busy === 'pdf'}
          disabled={busy !== null}
          className="col-span-2 py-3 sm:py-2.5"
        >
          {busy !== 'pdf' && <Download size={16} />} Descarregar PDF
        </Button>
        <button type="button" onClick={() => void exportAs('png')} disabled={busy !== null} className={secondaryAction}>
          <ImageDown size={16} /> {busy === 'png' ? 'A gerar...' : 'Guardar imagem'}
        </button>
        <button type="button" onClick={() => void share()} className={secondaryAction}>
          <Share2 size={16} /> Partilhar
        </button>
        <button type="button" onClick={() => window.print()} className={secondaryAction}>
          <Printer size={16} /> Imprimir
        </button>
        <Link to={`/verificar?codigo=${cert.codigo}`} className={secondaryAction}>
          <ShieldCheck size={16} /> Verificar
        </Link>
      </div>
      {message && (
        <p className={`text-sm print:hidden ${message.ok ? 'text-slate-600' : 'text-red-700'}`} role="status">
          {message.text}
        </p>
      )}
      <CertificateDocument cert={cert} canvasRef={canvas} className="shadow-lg print:shadow-none" />
    </div>
  );
}

/** Para que serve a taxa, aviso contra burlas e contacto da instituição. */
function InfoPanel({ cert, onReportError }: { cert: StudentCertificate; onReportError?: () => void }) {
  return (
    <div className="grid gap-4 rounded-card border border-line bg-white p-4 text-sm sm:grid-cols-2 print:hidden">
      <div className="space-y-2">
        <p className="font-semibold text-brand-950">{cert.pago ? 'O seu certificado' : 'O que recebe com a taxa'}</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-600">
          <li>Certificado em PDF (A4) e em imagem, para imprimir ou partilhar.</li>
          <li>Código QR e código {cert.codigo}, válidos na verificação pública: quem receber o certificado confirma que é autêntico.</li>
          <li>Acesso permanente a esta página, pelo mesmo link.</li>
        </ul>
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          Pague apenas nesta página. Ninguém da instituição lhe vai pedir o PIN nem pagamentos para outro número.
        </p>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-brand-950">Dúvidas? Fale com {cert.emissor_nome}</p>
        <IssuerContact cert={cert} />
        {onReportError && (
          <button type="button" onClick={onReportError} className="font-semibold text-red-700 hover:underline">
            Encontrou um erro nos dados? Avise a instituição
          </button>
        )}
      </div>
    </div>
  );
}

function CorrectionModal({
  open,
  token,
  onClose,
  onSent,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  onSent: (correcao: NonNullable<StudentCertificate['correcao']>) => void;
}) {
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setFalha(null);
    try {
      onSent(await certificateService.requestCorrection(token, mensagem.trim()));
      setMensagem('');
    } catch (err) {
      setFalha(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} title="Avisar a instituição de um erro" onClose={() => (sending ? null : onClose())}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-slate-600">
          Diga o que está errado e como deve ficar. A instituição corrige os dados e envia-lhe um link novo. Se já tiver
          pago, o pagamento passa para o certificado corrigido.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="correcao" className="block text-sm font-medium text-brand-950">
            O que está errado? <span className="text-red-600">*</span>
          </label>
          <textarea
            id="correcao"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={4}
            minLength={5}
            maxLength={1000}
            required
            placeholder="Ex.: O meu apelido é Mondlane, não Mondlani."
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {falha && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {falha}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button type="submit" loading={sending}>
            Enviar pedido
          </Button>
        </div>
      </form>
    </Modal>
  );
}
