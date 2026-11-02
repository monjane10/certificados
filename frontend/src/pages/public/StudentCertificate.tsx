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
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { ApiError } from '../../lib/http';
import { brandingUrl } from '../../lib/branding';
import { fmtDate } from '../../lib/certificates';
import { whatsappNumber, whatsappUrl } from '../../lib/whatsapp';
import { CertificateDocument } from '../../components/certificates/CertificateDocument';
import { CertificateFullscreen } from '../../components/certificates/CertificateFullscreen';
import { downloadImage, downloadPdf } from '../../components/certificates/export';
import { PRINT_CSS } from '../../components/certificates/print';
import { verifyLink } from '../../components/certificates/shared';
import { Modal } from '../../components/courses/Modal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import type { PaymentMethod, StudentCertificate, StudentPayment } from '../../types';

const METODOS: Array<{ id: PaymentMethod; nome: string; rede: string; prefixos: string }> = [
  { id: 'mpesa', nome: 'M-Pesa', rede: 'Vodacom', prefixos: '84 ou 85' },
  { id: 'emola', nome: 'e-Mola', rede: 'Movitel', prefixos: '86 ou 87' },
];

const NOME_METODO: Record<PaymentMethod, string> = { mpesa: 'M-Pesa', emola: 'e-Mola' };

/** Enquanto o pagamento está pendente, a página consulta o estado a este ritmo. */
const POLL_MS = 3000;

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-MZ', { dateStyle: 'medium', timeStyle: 'short' });
}

const secondaryAction =
  'inline-flex items-center justify-center gap-1.5 rounded-button border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-soft disabled:opacity-60';

/**
 * Página do formando (link privado enviado pela instituição). Antes do
 * pagamento: confirmação dos dados, pré-visualização com marca de água e
 * pagamento; depois: comprovativo e certificado para descarregar.
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

  const watermark = cert.pago ? undefined : 'Pré-visualização';

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>
      {/* A pré-visualização não se imprime: só o certificado pago. */}
      {!cert.pago && <style>{'@media print { .cert-frame { display: none !important; } }'}</style>}

      <div className="mx-auto max-w-[1123px] space-y-4 px-4 print:max-w-none print:px-0">
        <IssuerHeader cert={cert} />

        {cert.correcao && <CorrectionPending cert={cert} />}

        {cert.pago ? (
          <PaidPanel cert={cert} />
        ) : cert.correcao ? null : cert.pagamento?.estado === 'pendente' ? (
          <PendingPanel pagamento={cert.pagamento} />
        ) : (
          <PaymentForm cert={cert} token={token} onStarted={load} onReportError={() => setCorrecting(true)} />
        )}

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
          {cert.pago ? (
            <ExportableCertificate cert={cert} />
          ) : (
            <CertificateDocument cert={cert} watermark={watermark} className="shadow-lg print:shadow-none" />
          )}
        </div>

        <InfoPanel cert={cert} onReportError={cert.correcao ? undefined : () => setCorrecting(true)} />
      </div>

      {fullscreen && <CertificateFullscreen cert={cert} watermark={watermark} onClose={closeFullscreen} />}
      <CorrectionModal
        open={correcting}
        token={token}
        onClose={() => setCorrecting(false)}
        onSent={(correcao) => {
          setCert((prev) => (prev ? { ...prev, correcao } : prev));
          setCorrecting(false);
        }}
      />
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

function PendingPanel({ pagamento }: { pagamento: StudentPayment }) {
  const nome = NOME_METODO[pagamento.metodo];
  return (
    <div className="rounded-card border border-brand-500/30 bg-white p-4 sm:p-5 print:hidden" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-900" aria-hidden />
        <div className="space-y-1">
          <p className="font-bold text-brand-950">A aguardar a confirmação no telemóvel</p>
          <p className="flex items-center gap-1.5 text-sm text-slate-600">
            <Smartphone size={15} /> Enviámos um pedido de {pagamento.valor} MT para o número {pagamento.telefone}. Introduza o
            PIN {nome} no telemóvel para confirmar.
          </p>
          <p className="text-xs text-slate-500">
            Esta página actualiza-se sozinha. Pode fechá-la e voltar mais tarde pelo mesmo link. Referência {pagamento.referencia}.
          </p>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  cert,
  token,
  onStarted,
  onReportError,
}: {
  cert: StudentCertificate;
  token: string;
  onStarted: () => Promise<void>;
  onReportError: () => void;
}) {
  const [confirmado, setConfirmado] = useState(false);
  const [metodo, setMetodo] = useState<PaymentMethod>(cert.pagamento?.metodo ?? 'mpesa');
  const [telefone, setTelefone] = useState('');
  const [sending, setSending] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const escolhido = METODOS.find((m) => m.id === metodo)!;
  // Última tentativa recusada (saldo, PIN cancelado, sem resposta a tempo...).
  const anterior = cert.pagamento?.estado === 'falhado' ? cert.pagamento : null;

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !confirmado) return;
    setSending(true);
    setFalha(null);
    try {
      await certificateService.pay(token, metodo, telefone);
      await onStarted();
    } catch (err) {
      setFalha(err instanceof Error ? err.message : 'Não foi possível iniciar o pagamento.');
    } finally {
      setSending(false);
    }
  }

  const tecnico = cert.tipo === 'tecnico_profissional';

  return (
    <form onSubmit={pagar} className="space-y-5 rounded-card border border-line bg-white p-4 sm:p-5 print:hidden">
      <section>
        <h2 className="text-base font-bold text-brand-950">1. Confirme os seus dados</h2>
        <p className="mt-1 text-sm text-slate-500">É assim que vão aparecer no certificado. Confira antes de pagar.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Nome</dt>
            <dd className="font-semibold text-brand-950">{cert.formando_nome}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Curso</dt>
            <dd className="font-semibold text-brand-950">{cert.curso_nome}</dd>
          </div>
          {tecnico && (
            <div>
              <dt className="text-xs text-slate-500">Nota final</dt>
              <dd className="font-semibold tabular-nums text-brand-950">{cert.nota} valores</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate-500">Carga horária</dt>
            <dd className="font-semibold tabular-nums text-brand-950">{cert.carga_horaria} horas</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Período</dt>
            <dd className="font-semibold text-brand-950">
              {cert.data_abertura ? `${fmtDate(cert.data_abertura)} a ` : 'Concluído a '}
              {fmtDate(cert.data_encerramento)}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-start gap-2 text-sm text-brand-950">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-900"
            />
            Confirmo que os meus dados estão correctos.
          </label>
          <button type="button" onClick={onReportError} className="text-sm font-semibold text-red-700 hover:underline">
            Há um erro nos dados
          </button>
        </div>
      </section>

      <section className={confirmado ? '' : 'pointer-events-none opacity-50'} aria-disabled={!confirmado}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-brand-950">2. Pague a taxa do certificado</h2>
          <p className="text-2xl font-extrabold tabular-nums text-brand-950">{cert.taxa_valor} MT</p>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Depois do pagamento descarrega o certificado em PDF ou imagem, e o código passa a ser válido na verificação
          pública.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <fieldset disabled={!confirmado}>
            <legend className="mb-1.5 text-sm font-medium text-brand-950">Pagar com</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {METODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodo(m.id)}
                  aria-pressed={metodo === m.id}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    metodo === m.id ? 'bg-white text-brand-900 shadow-card' : 'text-slate-500'
                  }`}
                >
                  {m.nome}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <label htmlFor="telefone" className="block text-sm font-medium text-brand-950">
              Número {escolhido.nome} ({escolhido.rede})
            </label>
            <input
              id="telefone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              disabled={!confirmado}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder={`Ex.: ${metodo === 'mpesa' ? '84' : '86'} 123 4567`}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <Button type="submit" loading={sending} disabled={!confirmado} className="w-full sm:w-auto">
            Pagar {cert.taxa_valor} MT
          </Button>
        </div>

        {falha ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {falha}
          </p>
        ) : anterior ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            O pagamento por {NOME_METODO[anterior.metodo]} de {fmtDateTime(anterior.criado_em)} não foi concluído
            {anterior.erro ? `: ${anterior.erro}` : '.'} Pode tentar de novo.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Use um número {escolhido.rede} começado por {escolhido.prefixos}. Vai receber um pedido no telemóvel para
            confirmar com o PIN.
          </p>
        )}
      </section>
    </form>
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
                <dd className="font-semibold text-brand-950">{NOME_METODO[p.metodo]}</dd>
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
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => void exportAs('pdf')} loading={busy === 'pdf'} disabled={busy !== null}>
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
