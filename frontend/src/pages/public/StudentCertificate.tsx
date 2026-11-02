import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, MessageCircle, Phone, WifiOff } from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { ApiError } from '../../lib/http';
import { whatsappNumber, whatsappUrl } from '../../lib/whatsapp';
import { CertificateFullscreen } from '../../components/certificates/CertificateFullscreen';
import { PRINT_CSS } from '../../components/certificates/print';
import { Modal } from '../../components/courses/Modal';
import { Checkout } from '../../components/student/Checkout';
import { PaidView } from '../../components/student/PaidView';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import type { StudentCertificate } from '../../types';

/** Enquanto o pagamento está pendente, a página consulta o estado a este ritmo. */
const POLL_MS = 3000;

/**
 * Página do formando (link privado enviado pela instituição). Antes do
 * pagamento: só a confirmação dos dados e o pagamento (Checkout); depois:
 * o certificado, para descarregar, e o comprovativo (PaidView).
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
    <>
      <style>{PRINT_CSS}</style>
      <PaidView cert={cert} onFullscreen={() => setFullscreen(true)} onReportError={reportError} />
      {fullscreen && <CertificateFullscreen cert={cert} onClose={closeFullscreen} />}
      {correctionModal}
    </>
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
