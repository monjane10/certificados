import { Link } from 'react-router-dom';
import type { Course } from '../../types';
import { CourseStatusBadge } from './CourseStatusBadge';

function fmtDate(d: string | null): string {
  if (!d) return '-';
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-MZ');
}

/** Período legível; evita "- - -" quando o curso ainda não tem datas. */
function fmtPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return 'Sem datas definidas';
  return `${fmtDate(start)} a ${fmtDate(end)}`;
}

function Actions({ course, onEdit, onDelete }: { course: Course; onEdit: (c: Course) => void; onDelete: (c: Course) => void }) {
  return (
    <div className="flex items-center justify-end gap-1 text-sm font-medium">
      <Link to={`/app/cursos/${course.id}`} className="rounded-lg px-2.5 py-1.5 text-brand-900 hover:bg-brand-50">
        Detalhes
      </Link>
      <button onClick={() => onEdit(course)} className="rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-brand-900">
        Editar
      </button>
      <button onClick={() => onDelete(course)} className="rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-red-50 hover:text-red-700">
        Excluir
      </button>
    </div>
  );
}

export function CourseTable({
  courses,
  onEdit,
  onDelete,
}: {
  courses: Course[];
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-soft/50 text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-semibold">Curso</th>
            <th className="px-4 py-3 font-semibold">Código</th>
            <th className="px-4 py-3 font-semibold">Carga</th>
            <th className="px-4 py-3 font-semibold">Período</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 text-right font-semibold">Formandos</th>
            <th className="px-4 py-3 text-right font-semibold">Acções</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-soft/30">
              <td className="px-4 py-3 font-semibold text-ink">
                <Link to={`/app/cursos/${c.id}`} className="hover:underline">
                  {c.nome}
                </Link>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.codigo}</td>
              <td className="px-4 py-3 tabular-nums text-slate-600">{c.carga_horaria}h</td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {fmtPeriod(c.data_abertura, c.data_encerramento)}
              </td>
              <td className="px-4 py-3">
                <CourseStatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.total_formandos ?? 0}</td>
              <td className="px-4 py-3">
                <Actions course={c} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CourseCards({
  courses,
  onEdit,
  onDelete,
}: {
  courses: Course[];
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
}) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {courses.map((c) => (
        <li key={c.id} className="flex flex-col rounded-card border border-line bg-white">
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
            <div className="min-w-0">
              <Link to={`/app/cursos/${c.id}`} className="break-words font-semibold text-ink hover:underline">
                {c.nome}
              </Link>
              <p className="mt-0.5 font-mono text-xs text-muted">{c.codigo}</p>
            </div>
            <CourseStatusBadge status={c.status} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 px-4 text-xs">
            <div>
              <dt className="text-muted">Carga</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink">{c.carga_horaria}h</dd>
            </div>
            <div>
              <dt className="text-muted">Formandos</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink">{c.total_formandos ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted">Período</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {c.data_abertura || c.data_encerramento ? (
                  <>
                    {fmtDate(c.data_abertura)}
                    <br />
                    {fmtDate(c.data_encerramento)}
                  </>
                ) : (
                  'Sem datas'
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-3 grid grid-cols-3 border-t border-line text-sm font-medium">
            <Link to={`/app/cursos/${c.id}`} className="py-2.5 text-center text-ink hover:bg-soft">
              Detalhes
            </Link>
            <button onClick={() => onEdit(c)} className="border-x border-line py-2.5 text-ink hover:bg-soft">
              Editar
            </button>
            <button onClick={() => onDelete(c)} className="py-2.5 text-red-700 hover:bg-red-50">
              Excluir
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
