import { Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { eligibilityOf } from '../../lib/certificates';
import { NOTA_MINIMA_APROVACAO, type EnrollmentView } from '../../types';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-MZ');
}

interface Props {
  enrollments: EnrollmentView[];
  /** false em cursos de participação: sem coluna de nota nem acção "Nota". */
  comNotas: boolean;
  onEditPersonal: (e: EnrollmentView) => void;
  onEditGrade: (e: EnrollmentView) => void;
  onDelete: (e: EnrollmentView) => void;
}

const actionClass =
  'rounded-control px-2.5 py-1.5 text-muted hover:bg-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
const dangerClass =
  'rounded-control px-2.5 py-1.5 text-muted hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

const LOCKED_HINT = 'Tem certificado emitido. Anule-o em Certificados para alterar.';

/** Estado do certificado da matrícula (emitido, pronto ou motivo de exclusão). */
function CertificateStatus({ enrollment, comNotas }: { enrollment: EnrollmentView; comNotas: boolean }) {
  const status = eligibilityOf({ tipo: comNotas ? 'tecnico_profissional' : 'participacao' }, enrollment);
  if (status === 'emitido' && enrollment.certificado) {
    return (
      <Link
        to={`/certificado/${enrollment.certificado.codigo}`}
        target="_blank"
        className="font-mono text-xs font-semibold text-accent-700 hover:underline"
      >
        {enrollment.certificado.codigo}
      </Link>
    );
  }
  const label = { elegivel: 'Pronto a emitir', sem_nota: 'Sem nota', reprovado: 'Não elegível', emitido: '' }[status];
  const tone = { elegivel: 'text-muted', sem_nota: 'text-amber-700', reprovado: 'text-red-700', emitido: '' }[status];
  return <span className={`text-xs font-medium ${tone}`}>{label}</span>;
}

/** Situação face à nota mínima; sem nota lançada não há situação. */
function GradeResult({ avaliacao }: { avaliacao: number | null }) {
  if (avaliacao === null) return null;
  const aprovado = avaliacao >= NOTA_MINIMA_APROVACAO;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        aprovado ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {aprovado ? 'Aprovado' : 'Reprovado'}
    </span>
  );
}

/** Tabela em ecrãs largos; cartões no telemóvel e tablet (sem scroll horizontal nem colunas escondidas). */
export function TraineeTable(props: Props) {
  return (
    <>
      <div className="hidden lg:block">
        <TraineeRows {...props} />
      </div>
      <div className="lg:hidden">
        <TraineeCards {...props} />
      </div>
    </>
  );
}

function TraineeRows({ enrollments, comNotas, onEditPersonal, onEditGrade, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-soft/50 text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-semibold">Nome</th>
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">Contacto</th>
            {comNotas && <th className="px-4 py-3 font-semibold">Avaliação</th>}
            <th className="px-4 py-3 font-semibold">Matrícula</th>
            <th className="px-4 py-3 font-semibold">Certificado</th>
            <th className="px-4 py-3 text-right font-semibold">Acções</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((t) => (
            <tr key={t.matricula_id} className="border-b border-line last:border-0 hover:bg-soft/30">
              <td className="px-4 py-3 font-semibold text-ink">{t.nome}</td>
              <td className="px-4 py-3 text-muted">{t.email ?? '-'}</td>
              <td className="px-4 py-3 text-muted">{t.contacto ?? '-'}</td>
              {comNotas && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-muted">{t.avaliacao ?? '-'}</span>
                    <GradeResult avaliacao={t.avaliacao} />
                  </div>
                </td>
              )}
              <td className="px-4 py-3 text-xs text-muted">{fmtDateTime(t.matriculado_em)}</td>
              <td className="px-4 py-3">
                <CertificateStatus enrollment={t} comNotas={comNotas} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 text-sm font-medium">
                  <button onClick={() => onEditPersonal(t)} className={actionClass}>
                    Dados
                  </button>
                  {comNotas && (
                    <button
                      onClick={() => onEditGrade(t)}
                      disabled={Boolean(t.certificado)}
                      title={t.certificado ? LOCKED_HINT : undefined}
                      className={actionClass}
                    >
                      Nota
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(t)}
                    disabled={Boolean(t.certificado)}
                    title={t.certificado ? LOCKED_HINT : undefined}
                    className={dangerClass}
                  >
                    Remover
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TraineeCards({ enrollments, comNotas, onEditPersonal, onEditGrade, onDelete }: Props) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {enrollments.map((t) => (
        <li key={t.matricula_id} className="flex flex-col rounded-card border border-line bg-white">
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
            <div className="min-w-0">
              <p className="break-words font-semibold text-ink">{t.nome}</p>
              <p className="mt-0.5 text-xs text-muted">Matrícula {fmtDateTime(t.matriculado_em)}</p>
              <p className="mt-1">
                <CertificateStatus enrollment={t} comNotas={comNotas} />
              </p>
            </div>
            {comNotas && (
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div className="rounded-control bg-soft px-2.5 py-1 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Nota</p>
                  <p className="text-sm font-bold tabular-nums text-ink">{t.avaliacao ?? '-'}</p>
                </div>
                <GradeResult avaliacao={t.avaliacao} />
              </div>
            )}
          </div>
          <dl className="mt-2.5 space-y-1.5 px-4 text-sm">
            <div className="flex items-center gap-2 text-muted">
              <dt>
                <Mail size={14} strokeWidth={1.6} aria-label="Email" />
              </dt>
              <dd className="min-w-0 break-all">{t.email ?? 'Sem email'}</dd>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <dt>
                <Phone size={14} strokeWidth={1.6} aria-label="Contacto" />
              </dt>
              <dd>{t.contacto ?? 'Sem contacto'}</dd>
            </div>
          </dl>
          <div className={`mt-3 grid border-t border-line text-sm font-medium ${comNotas ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button onClick={() => onEditPersonal(t)} className="py-2.5 text-ink hover:bg-soft">
              Dados
            </button>
            {comNotas && (
              <button
                onClick={() => onEditGrade(t)}
                disabled={Boolean(t.certificado)}
                title={t.certificado ? LOCKED_HINT : undefined}
                className="border-x border-line py-2.5 text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                Nota
              </button>
            )}
            <button
              onClick={() => onDelete(t)}
              disabled={Boolean(t.certificado)}
              title={t.certificado ? LOCKED_HINT : undefined}
              className={`py-2.5 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 ${comNotas ? '' : 'border-l border-line'}`}
            >
              Remover
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
