import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, ShieldCheck } from 'lucide-react';
import { certificateService } from '../../services/certificates';
import { CertificateDocument } from '../../components/certificates/CertificateDocument';
import { Spinner } from '../../components/ui/Spinner';
import type { PublicCertificate } from '../../types';

// A4 horizontal sem margens; o certificado é impresso a escala 1 (1123x794 px ≈ 297x210 mm)
// e com as cores de fundo (por defeito os browsers não imprimem fundos).
const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .cert-frame { width: 297mm !important; height: 210mm !important; aspect-ratio: auto !important; }
  .cert-scaler { transform: none !important; }
  .cert-frame, .cert-frame * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

/** Certificado no modelo escolhido para o curso, pronto a imprimir ou guardar em PDF. */
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
