import { Mail, Phone } from 'lucide-react';
import type { EnrollmentView } from '../../types';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-MZ');
}

interface Props {
  enrollments: EnrollmentView[];
  onEditPersonal: (e: EnrollmentView) => void;
  onEditGrade: (e: EnrollmentView) => void;
  onDelete: (e: EnrollmentView) => void;
}

const actionClass = 'rounded-control px-2.5 py-1.5 text-muted hover:bg-soft hover:text-ink';
const dangerClass = 'rounded-control px-2.5 py-1.5 text-muted hover:bg-red-50 hover:text-red-700';

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

function TraineeRows({ enrollments, onEditPersonal, onEditGrade, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-soft/50 text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-semibold">Nome</th>
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">Contacto</th>
            <th className="px-4 py-3 font-semibold">Avaliação</th>
            <th className="px-4 py-3 font-semibold">Matrícula</th>
            <th className="px-4 py-3 text-right font-semibold">Acções</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((t) => (
            <tr key={t.matricula_id} className="border-b border-line last:border-0 hover:bg-soft/30">
              <td className="px-4 py-3 font-semibold text-ink">{t.nome}</td>
              <td className="px-4 py-3 text-muted">{t.email ?? '-'}</td>
              <td className="px-4 py-3 text-muted">{t.contacto ?? '-'}</td>
              <td className="px-4 py-3 tabular-nums text-muted">{t.avaliacao ?? '-'}</td>
              <td className="px-4 py-3 text-xs text-muted">{fmtDateTime(t.matriculado_em)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 text-sm font-medium">
                  <button onClick={() => onEditPersonal(t)} className={actionClass}>
                    Dados
                  </button>
                  <button onClick={() => onEditGrade(t)} className={actionClass}>
                    Nota
                  </button>
                  <button onClick={() => onDelete(t)} className={dangerClass}>
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

function TraineeCards({ enrollments, onEditPersonal, onEditGrade, onDelete }: Props) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {enrollments.map((t) => (
        <li key={t.matricula_id} className="flex flex-col rounded-card border border-line bg-white">
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
            <div className="min-w-0">
              <p className="break-words font-semibold text-ink">{t.nome}</p>
              <p className="mt-0.5 text-xs text-muted">Matrícula {fmtDateTime(t.matriculado_em)}</p>
            </div>
            <div className="shrink-0 rounded-control bg-soft px-2.5 py-1 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Nota</p>
              <p className="text-sm font-bold tabular-nums text-ink">{t.avaliacao ?? '-'}</p>
            </div>
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
          <div className="mt-3 grid grid-cols-3 border-t border-line text-sm font-medium">
            <button onClick={() => onEditPersonal(t)} className="py-2.5 text-ink hover:bg-soft">
              Dados
            </button>
            <button onClick={() => onEditGrade(t)} className="border-x border-line py-2.5 text-ink hover:bg-soft">
              Nota
            </button>
            <button onClick={() => onDelete(t)} className="py-2.5 text-red-700 hover:bg-red-50">
              Remover
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
