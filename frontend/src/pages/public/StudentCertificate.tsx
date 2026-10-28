import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleCheck, Printer, ShieldCheck, Smartphone } from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { CertificateDocument } from '../../components/certificates/CertificateDocument';
import { PRINT_CSS } from '../../components/certificates/print';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import type { PaymentMethod, StudentCertificate } from '../../types';

const METODOS: Array<{ id: PaymentMethod; nome: string; rede: string; prefixos: string }> = [
  { id: 'mpesa', nome: 'M-Pesa', rede: 'Vodacom', prefixos: '84 ou 85' },
  { id: 'emola', nome: 'e-Mola', rede: 'Movitel', prefixos: '86 ou 87' },
];

/**
 * Página do formando (link privado enviado pela instituição). Antes do
 * pagamento mostra uma pré-visualização com marca de água e o pagamento;
 * depois, o certificado pronto a imprimir ou guardar em PDF.
 */
export function StudentCertificatePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [cert, setCert] = useState<StudentCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<PaymentMethod>('mpesa');
  const [telefone, setTelefone] = useState('');
  const [paying, setPaying] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCert(await certificateService.student(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Certificado não encontrado.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (paying) return;
    setPaying(true);
    setFalha(null);
    try {
      const r = await certificateService.pay(token, metodo, telefone);
      if (r.estado === 'pago') await load();
      else setFalha(r.mensagem);
    } catch (err) {
      setFalha(err instanceof Error ? err.message : 'Não foi possível concluir o pagamento.');
    } finally {
      setPaying(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-bold text-brand-950">Link inválido</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </div>
    );
  }
  if (!cert) return <div className="p-8"><Spinner label="A carregar o seu certificado..." /></div>;

  if (cert.estado === 'anulado') {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-bold text-red-700">Certificado anulado</p>
        <p className="mt-2 text-sm text-slate-500">
          Este certificado foi anulado por {cert.emissor_nome}. Contacte a instituição para mais informações.
        </p>
      </div>
    );
  }

  const escolhido = METODOS.find((m) => m.id === metodo)!;

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>
      {/* A pré-visualização não se imprime: só o certificado pago. */}
      {!cert.pago && <style>{'@media print { .cert-frame { display: none !important; } }'}</style>}

      <div className="mx-auto max-w-[1123px] space-y-4 px-4 print:max-w-none print:px-0">
        <div className="print:hidden">
          <p className="text-sm text-slate-500">{cert.emissor_nome}</p>
          <h1 className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">
            Certificado de {cert.formando_nome}
          </h1>
          <p className="text-sm text-slate-500">Curso «{cert.curso_nome}» · {cert.codigo}</p>
        </div>

        {cert.pago ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent-500/40 bg-accent-50 px-4 py-3 print:hidden">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent-700">
              <CircleCheck size={18} /> Pagamento confirmado. O seu certificado é válido.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/verificar?codigo=${cert.codigo}`}
                className="inline-flex items-center gap-1.5 rounded-button border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-soft"
              >
                <ShieldCheck size={16} /> Verificar
              </Link>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-button bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-950"
              >
                <Printer size={16} /> Imprimir / guardar PDF
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={pagar} className="rounded-card border border-line bg-white p-4 sm:p-5 print:hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-brand-950">Pague a taxa para desbloquear o certificado</h2>
              <p className="text-2xl font-extrabold tabular-nums text-brand-950">{cert.taxa_valor} MT</p>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Abaixo vê uma pré-visualização. Depois do pagamento pode imprimi-lo ou guardá-lo em PDF, e o código passa a
              ser válido na verificação pública.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
              <fieldset>
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
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder={`Ex.: ${metodo === 'mpesa' ? '84' : '86'} 123 4567`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <Button type="submit" loading={paying} className="w-full sm:w-auto">
                Pagar {cert.taxa_valor} MT
              </Button>
            </div>

            {paying ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900" role="status">
                <Smartphone size={16} /> Confirme o pagamento no seu telemóvel com o PIN {escolhido.nome}.
              </p>
            ) : falha ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {falha}
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Use um número {escolhido.rede} começado por {escolhido.prefixos}. Vai receber um pedido no telemóvel para
                confirmar.
              </p>
            )}
          </form>
        )}

        <CertificateDocument
          cert={cert}
          watermark={cert.pago ? undefined : 'Pré-visualização'}
          className="shadow-lg print:shadow-none"
        />
      </div>
    </div>
  );
}
