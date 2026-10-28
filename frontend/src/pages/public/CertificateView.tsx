import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, ShieldCheck } from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { CertificateDocument } from '../../components/certificates/CertificateDocument';
import { Spinner } from '../../components/ui/Spinner';
import { PRINT_CSS } from '../../components/certificates/print';
import type { PublicVerification } from '../../types';


/** Certificado no modelo escolhido para o curso, pronto a imprimir ou guardar em PDF. */
export function CertificateViewPage() {
  const { codigo = '' } = useParams<{ codigo: string }>();
  const [cert, setCert] = useState<PublicVerification | null>(null);
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

  // Até o formando pagar a taxa, o certificado não é público (nem imprimível por quem tem o código).
  if (!cert.pago) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-bold text-brand-950">Certificado pendente de pagamento</p>
        <p className="mt-2 text-sm text-slate-500">
          O certificado {cert.codigo} do curso «{cert.curso_nome}», emitido por {cert.emissor_nome}, fica disponível
          depois de o formando pagar a taxa, através do link que recebeu.
        </p>
        <Link to={`/verificar?codigo=${cert.codigo}`} className="mt-4 inline-block text-sm font-semibold text-brand-900 hover:underline">
          Ver estado da verificação
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>

      <div className="mx-auto mb-4 flex max-w-[1123px] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
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

      <div className="mx-auto max-w-[1123px] px-4 print:max-w-none print:px-0">
        <CertificateDocument cert={cert} className="shadow-lg print:shadow-none" />
      </div>
    </div>
  );
}
