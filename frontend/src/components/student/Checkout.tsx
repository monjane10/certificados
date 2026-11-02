import { useState } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { brandingUrl } from '../../lib/branding';
import { fmtDate } from '../../lib/certificates';
import { Button } from '../ui/Button';
import type { PaymentMethod, StudentCertificate } from '../../types';

const METODOS: Array<{ id: PaymentMethod; nome: string; rede: string; prefixos: string }> = [
  { id: 'mpesa', nome: 'M-Pesa', rede: 'Vodacom', prefixos: '84 ou 85' },
  { id: 'emola', nome: 'e-Mola', rede: 'Movitel', prefixos: '86 ou 87' },
];

export const NOME_METODO: Record<PaymentMethod, string> = { mpesa: 'M-Pesa', emola: 'e-Mola' };

/** Logótipos em public/logos (o do M-Pesa é rectangular, o do e-Mola quadrado). */
const LOGO_METODO: Record<PaymentMethod, string> = { mpesa: '/logos/mpesa.png', emola: '/logos/emola.png' };

export function MethodLogo({ metodo, className = 'h-8' }: { metodo: PaymentMethod; className?: string }) {
  return <img src={LOGO_METODO[metodo]} alt="" className={`w-auto shrink-0 rounded-md object-contain ${className}`} />;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-MZ', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Página do formando antes do pagamento: confirmar os dados (01), pagar (02)
 * e, depois, descarregar (03). O certificado só aparece depois de pago.
 */
export function Checkout({
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
  const pendente = cert.pagamento?.estado === 'pendente';
  const passo = pendente || confirmado ? 2 : 1;
  const logo = brandingUrl(cert.logo_path);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <header className="flex items-center gap-3 border-b border-slate-200 py-5">
          {logo && <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain" />}
          <p className="text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{cert.emissor_nome}</p>
        </header>

        <div className="py-10 text-center sm:py-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl">O seu certificado</h1>
          <p className="mt-2 text-slate-500 sm:text-lg">Confirme os dados e conclua o pagamento para descarregar.</p>
          <Steps active={passo} />
        </div>

        {cert.correcao && (
          <div className="mb-6 rounded-card border border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <CircleAlert size={18} /> Pedido de correcção enviado em {fmtDateTime(cert.correcao.criado_em)}
            </p>
            <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-sm italic text-amber-900/80">
              {cert.correcao.mensagem}
            </blockquote>
            <p className="mt-2 text-sm text-amber-900">
              A instituição vai corrigir os dados e enviar-lhe um link novo. Não precisa de pagar até lá.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <DataCard
            cert={cert}
            confirmado={confirmado || pendente}
            onConfirm={setConfirmado}
            locked={pendente || Boolean(cert.correcao)}
            onReportError={cert.correcao ? undefined : onReportError}
          />
          <PaymentCard cert={cert} token={token} enabled={confirmado} onStarted={onStarted} />
        </div>

        <footer className="mt-10 border-t border-slate-200 py-5 text-center text-sm text-slate-500">
          {cert.emissor_nome} · Certificados digitais
        </footer>
      </div>
    </div>
  );
}

const STEPS = ['Confirmar dados', 'Pagamento', 'Descarregar'];

function Steps({ active }: { active: number }) {
  return (
    <ol className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:text-base">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const on = n === active;
        return (
          <li key={label} className="flex items-center gap-3">
            {i > 0 && <span className="text-slate-300" aria-hidden>-</span>}
            <span className={`flex items-center gap-2 ${on ? 'font-semibold text-brand-950' : 'text-slate-400'}`} aria-current={on ? 'step' : undefined}>
              <span className={on ? 'font-bold' : ''}>{String(n).padStart(2, '0')}</span> {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CardTitle({ n, title, subtitle }: { n: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-brand-950">
        {String(n).padStart(2, '0')}
      </span>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-brand-950">{title}</h2>
        {subtitle && <p className="mt-0.5 text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, value, big = false, mono = false }: { label: string; value: string; big?: boolean; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`mt-0.5 font-semibold text-brand-950 ${big ? 'text-xl' : 'text-lg'} ${mono ? 'tracking-wide' : ''}`}>{value}</dd>
    </div>
  );
}

function DataCard({
  cert,
  confirmado,
  onConfirm,
  locked,
  onReportError,
}: {
  cert: StudentCertificate;
  confirmado: boolean;
  onConfirm: (v: boolean) => void;
  locked: boolean;
  onReportError?: () => void;
}) {
  const tecnico = cert.tipo === 'tecnico_profissional';
  const periodo = `${cert.data_abertura ? `${fmtDate(cert.data_abertura)} a ` : 'Concluído a '}${fmtDate(cert.data_encerramento)}`;
  return (
    <section className="rounded-card border border-slate-200 bg-white p-5 sm:p-7">
      <CardTitle n={1} title="Confirme os seus dados" subtitle="Estes dados vão aparecer no certificado." />
      <dl className="mt-6 rounded-xl bg-slate-50 p-5 sm:p-6">
        <div className="space-y-4">
          <Field label="Nome" value={cert.formando_nome} big />
          <Field label="Curso" value={cert.curso_nome} big />
        </div>
        <div className="my-5 h-px bg-slate-200" />
        <div className="grid gap-5 sm:grid-cols-2">
          {tecnico ? (
            <Field label="Nota final" value={`${cert.nota} valores`} />
          ) : (
            <Field label="Tipo" value="Participação" />
          )}
          <Field label="Carga horária" value={`${cert.carga_horaria} horas`} />
          <Field label="Período" value={periodo} />
          <Field label="Código do certificado" value={cert.codigo} mono />
        </div>
      </dl>
      <div className="mt-6 border-t border-slate-200 pt-6">
        <label className="flex items-center gap-3 text-brand-950">
          <input
            type="checkbox"
            checked={confirmado}
            disabled={locked}
            onChange={(e) => onConfirm(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 accent-brand-900"
          />
          Confirmo que os meus dados estão correctos.
        </label>
        {onReportError && (
          <button type="button" onClick={onReportError} className="ml-8 mt-4 text-sm text-brand-900 underline hover:text-brand-950">
            Há um erro nos meus dados
          </button>
        )}
      </div>
    </section>
  );
}

function PaymentCard({
  cert,
  token,
  enabled,
  onStarted,
}: {
  cert: StudentCertificate;
  token: string;
  enabled: boolean;
  onStarted: () => Promise<void>;
}) {
  const [metodo, setMetodo] = useState<PaymentMethod>(cert.pagamento?.metodo ?? 'mpesa');
  const [telefone, setTelefone] = useState('');
  const [sending, setSending] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const escolhido = METODOS.find((m) => m.id === metodo)!;
  const pagamento = cert.pagamento;
  // Última tentativa recusada (saldo, PIN cancelado, sem resposta a tempo...).
  const anterior = pagamento?.estado === 'falhado' ? pagamento : null;

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !enabled) return;
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

  return (
    <section className="rounded-card border border-slate-200 bg-white p-5 sm:p-7">
      <CardTitle n={2} title="Pagamento" />
      <div className="mt-6 border-b border-slate-200 pb-5">
        <p className="text-sm text-slate-500">Taxa de emissão</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-brand-950">{cert.taxa_valor} MT</p>
      </div>

      {pagamento?.estado === 'pendente' ? (
        <div className="mt-6 rounded-xl border border-brand-500/30 bg-brand-50 p-4" role="status" aria-live="polite">
          <p className="flex items-center gap-2 font-semibold text-brand-950">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-900" aria-hidden />
            A aguardar a confirmação no telemóvel
          </p>
          <p className="mt-2 flex gap-1.5 text-sm text-slate-600">
            <MethodLogo metodo={pagamento.metodo} className="h-6" /> Enviámos um pedido de {pagamento.valor} MT para o número{' '}
            {pagamento.telefone}. Introduza o PIN {NOME_METODO[pagamento.metodo]} para confirmar.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Esta página actualiza-se sozinha. Pode fechá-la e voltar mais tarde pelo mesmo link. Referência {pagamento.referencia}.
          </p>
        </div>
      ) : cert.correcao ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          O pagamento fica disponível depois de a instituição responder ao seu pedido de correcção.
        </p>
      ) : (
        <form onSubmit={pagar} className={`mt-5 space-y-4 ${enabled ? '' : 'opacity-50'}`} aria-disabled={!enabled}>
          <fieldset disabled={!enabled}>
            <legend className="mb-2 text-brand-950">Pagar com</legend>
            <div className="grid grid-cols-2 gap-3">
              {METODOS.map((m) => {
                const on = metodo === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodo(m.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left font-semibold transition ${
                      on ? 'border-brand-900 bg-brand-50 text-brand-950' : 'border-slate-200 text-brand-950 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? 'border-brand-900' : 'border-slate-300'}`}
                      aria-hidden
                    >
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-brand-900" />}
                    </span>
                    <MethodLogo metodo={m.id} />
                    {m.nome}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="telefone" className="mb-2 block text-brand-950">
              Número {escolhido.nome} ({escolhido.rede})
            </label>
            <input
              id="telefone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              disabled={!enabled}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder={metodo === 'mpesa' ? '84 123 4567' : '86 123 4567'}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-2 text-sm text-slate-500">
              Use um número {escolhido.rede} começado por {escolhido.prefixos}.
            </p>
          </div>

          <div>
            <Button type="submit" loading={sending} disabled={!enabled} className="w-full py-3.5 text-base">
              Pagar {cert.taxa_valor} MT {!sending && <ArrowRight size={18} />}
            </Button>
            {falha ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {falha}
              </p>
            ) : anterior ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                O pagamento por {NOME_METODO[anterior.metodo]} de {fmtDateTime(anterior.criado_em)} não foi concluído
                {anterior.erro ? `: ${anterior.erro}` : '.'} Pode tentar de novo.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {enabled ? 'Receberá um pedido no telemóvel para confirmar com o PIN.' : 'Confirme primeiro os seus dados.'}
              </p>
            )}
          </div>
        </form>
      )}

      <div className="mt-6 rounded-xl bg-slate-50 p-5">
        <p className="font-semibold text-brand-950">Depois do pagamento</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Descarregue o certificado em PDF ou imagem. O código ficará disponível para verificação pública.
        </p>
      </div>
    </section>
  );
}
