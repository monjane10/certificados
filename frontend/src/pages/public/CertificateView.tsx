import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, ShieldCheck } from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { fmtDate } from '../../lib/certificates';
import { Spinner } from '../../components/ui/Spinner';
import type { PublicCertificate } from '../../types';

function fmtNota(n: number | null): string {
  return n === null ? '-' : n.toLocaleString('pt-PT', { maximumFractionDigits: 2 });
}

/** Certificado em formato A4 horizontal, pronto a imprimir ou guardar em PDF. */
export function CertificateViewPage() {
  const { codigo = '' } = useParams<{ codigo: string }>();
  const [cert, setCert] = useState<PublicCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    certificateService
      .verify(codigo)
      .then(setCert)
      .catch((e) => setError(e instanceof Error ? e.message : 'Certificado não encontrado.'));
  }, [codigo]);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-bold text-brand-950">Certificado não encontrado</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <Link to="/verificar" className="mt-4 inline-block text-sm font-semibold text-brand-900 hover:underline">
          Verificar outro código
        </Link>
      </div>
    );
  }
  if (!cert) return <div className="p-8"><Spinner label="A carregar certificado..." /></div>;

  const tecnico = cert.tipo === 'tecnico_profissional';
  const anulado = cert.estado === 'anulado';
  const verifyUrl = `${window.location.origin}/verificar?codigo=${cert.codigo}`;
  const periodo = cert.data_abertura
    ? `de ${fmtDate(cert.data_abertura)} a ${fmtDate(cert.data_encerramento)}`
    : `concluído em ${fmtDate(cert.data_encerramento)}`;

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{'@media print { @page { size: A4 landscape; margin: 0; } }'}</style>

      <div className="mx-auto mb-4 flex max-w-[1000px] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        <Link to={`/verificar?codigo=${cert.codigo}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-900 hover:underline">
          <ShieldCheck size={16} /> Verificar autenticidade
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-button bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-950"
        >
          <Printer size={16} /> Imprimir / guardar PDF
        </button>
      </div>

      {/* Proporção A4 horizontal (297 x 210). */}
      <article className="relative mx-auto aspect-[297/210] w-full max-w-[1000px] overflow-hidden bg-white shadow-lg print:max-w-none print:shadow-none">
        <div className="absolute inset-[3%] border-[3px] border-ink" />
        <div className="absolute inset-[4.2%] border border-ink/30" />

        <div className="relative flex h-full flex-col items-center px-[9%] py-[7%] text-center text-ink">
          <p className="text-[clamp(10px,1.6vw,15px)] font-semibold uppercase tracking-[0.25em] text-muted">{cert.emissor_nome}</p>
          <h1 className="mt-[3%] font-serif text-[clamp(20px,4.2vw,42px)] font-bold leading-tight">
            Certificado {tecnico ? 'Técnico-Profissional' : 'de Participação'}
          </h1>
          <p className="mt-[4%] text-[clamp(10px,1.6vw,16px)] text-slate-600">Certifica-se que</p>
          <p className="mt-[1.5%] font-serif text-[clamp(18px,3.4vw,34px)] font-semibold leading-tight">{cert.formando_nome}</p>
          <p className="mt-[3%] max-w-[85%] text-[clamp(10px,1.6vw,16px)] leading-relaxed text-slate-700">
            {tecnico ? 'concluiu com aproveitamento' : 'participou'} no curso{' '}
            <strong className="text-ink">«{cert.curso_nome}»</strong>, com a carga horária de{' '}
            <strong className="text-ink">{cert.carga_horaria} horas</strong>, {periodo}
            {tecnico ? (
              <>
                , tendo obtido a classificação final de <strong className="text-ink">{fmtNota(cert.nota)} valores</strong>.
              </>
            ) : (
              '.'
            )}
          </p>

          <div className="mt-auto flex w-full items-end justify-between gap-6 text-left text-[clamp(8px,1.15vw,12px)] text-slate-600">
            <div>
              <p>Emitido em {new Date(cert.emitido_em).toLocaleDateString('pt-MZ')}</p>
              <p className="mt-1">
                Código: <span className="font-mono font-semibold text-ink">{cert.codigo}</span>
              </p>
              <p className="mt-1 break-all">Verificar em {verifyUrl}</p>
            </div>
            <div className="w-[34%] text-center">
              <div className="border-t border-ink/60 pt-1.5">{cert.emissor_nome}</div>
            </div>
          </div>
        </div>

        {anulado && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded-lg border-[6px] border-red-600/80 px-8 py-2 text-[clamp(28px,7vw,72px)] font-black tracking-widest text-red-600/80">
              ANULADO
            </span>
          </div>
        )}
      </article>
    </div>
  );
}
