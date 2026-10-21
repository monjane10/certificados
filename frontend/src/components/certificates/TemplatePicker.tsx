import { Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NOTA_MINIMA_APROVACAO, type CertificateTemplate, type Course, type PublicCertificate } from '../../types';
import { CertificateDocument } from './CertificateDocument';
import { CERTIFICATE_TEMPLATES } from './registry';

/** Certificado de exemplo com os dados do curso, para pré-visualizar os modelos. */
function sampleFor(course: Course, emissor: string, modelo: CertificateTemplate): PublicCertificate {
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    codigo: 'CERT-EXEMPLO',
    tipo: course.tipo,
    modelo,
    formando_nome: 'Nome do Formando',
    curso_nome: course.nome,
    carga_horaria: course.carga_horaria,
    data_abertura: course.data_abertura,
    data_encerramento: course.data_encerramento ?? hoje,
    nota: course.tipo === 'tecnico_profissional' ? Math.max(NOTA_MINIMA_APROVACAO, 15) : null,
    emissor_nome: emissor,
    estado: 'emitido',
    emitido_em: new Date().toISOString(),
    anulado_em: null,
  };
}

export function TemplatePicker({
  course,
  saving,
  onSelect,
}: {
  course: Course;
  saving: boolean;
  onSelect: (modelo: CertificateTemplate) => void;
}) {
  const { profile } = useAuth();
  const emissor = profile?.organization_name ?? 'A sua instituição';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CERTIFICATE_TEMPLATES.map((tpl) => {
        const selected = course.modelo_certificado === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            disabled={saving}
            onClick={() => !selected && onSelect(tpl.id)}
            aria-pressed={selected}
            className={`group rounded-card border-2 bg-white p-2 text-left transition disabled:cursor-wait ${
              selected ? 'border-brand-500' : 'border-transparent hover:border-slate-200'
            }`}
          >
            <CertificateDocument cert={sampleFor(course, emissor, tpl.id)} className="rounded-md border border-slate-200" />
            <div className="mt-2 flex items-start justify-between gap-2 px-1">
              <div>
                <p className="text-sm font-semibold text-brand-950">{tpl.nome}</p>
                <p className="text-xs text-slate-500">{tpl.descricao}</p>
              </div>
              {selected && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Check size={14} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
