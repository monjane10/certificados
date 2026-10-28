import { FileBadge, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { closeBlockReason, courseBlockReason, eligibilityOf } from '../../lib/certificates';
import { templateById } from '../certificates/registry';
import { useAuth } from '../../contexts/AuthContext';
import { NOTA_MINIMA_APROVACAO, type Course, type EnrollmentView } from '../../types';

export function countEligibility(course: Course, enrollments: EnrollmentView[]) {
  const counts = { emitido: 0, elegivel: 0, sem_nota: 0, reprovado: 0 };
  for (const e of enrollments) counts[eligibilityOf(course, e)] += 1;
  return counts;
}

/**
 * Encerramento e emissão em lote. Concluído -> «Encerrar curso» (congela o
 * curso); encerrado -> «Emitir» (um clique para todos os elegíveis) e «Reabrir».
 */
export function CertificatePanel({
  course,
  enrollments,
  onEmit,
  onClose,
  onReopen,
  onChooseTemplate,
}: {
  course: Course;
  enrollments: EnrollmentView[];
  onEmit: () => void;
  onClose: () => void;
  onReopen: () => void;
  onChooseTemplate: () => void;
}) {
  const { profile } = useAuth();
  const counts = countEligibility(course, enrollments);
  const faltaIdentidade = !profile?.logo_path || !profile?.assinatura_path;
  const blocked = courseBlockReason(course);
  const tecnico = course.tipo === 'tecnico_profissional';
  const podeEncerrar = course.status === 'concluido';
  const closeBlocked = podeEncerrar ? closeBlockReason(course, enrollments) : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand-950">
            <FileBadge size={18} strokeWidth={1.8} aria-hidden /> Certificados
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {tecnico
              ? `Emitidos para os formandos com nota igual ou superior a ${NOTA_MINIMA_APROVACAO} valores.`
              : 'Curso de participação: emitidos para todos os formandos matriculados.'}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Emitidos</dt>
              <dd className="font-bold tabular-nums text-brand-950">{counts.emitido}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Prontos a emitir</dt>
              <dd className="font-bold tabular-nums text-brand-950">{counts.elegivel}</dd>
            </div>
            {tecnico && (
              <>
                <div>
                  <dt className="text-xs text-slate-500">Sem nota</dt>
                  <dd className="font-bold tabular-nums text-amber-700">{counts.sem_nota}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Reprovados</dt>
                  <dd className="font-bold tabular-nums text-red-700">{counts.reprovado}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
            <Palette size={15} strokeWidth={1.8} aria-hidden />
            Modelo: <strong className="text-brand-950">{templateById(course.modelo_certificado).nome}</strong>
            <button type="button" onClick={onChooseTemplate} className="font-semibold text-brand-900 hover:underline">
              Escolher modelo
            </button>
          </p>
          {faltaIdentidade && (
            <p className="mt-1 text-sm text-slate-500">
              {!profile?.logo_path && !profile?.assinatura_path
                ? 'Sem logótipo nem assinatura.'
                : !profile?.logo_path
                  ? 'Sem logótipo.'
                  : 'Sem assinatura.'}{' '}
              <Link to="/app/perfil" className="font-semibold text-brand-900 hover:underline">
                Adicionar no Perfil
              </Link>{' '}
              antes de emitir.
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          {podeEncerrar ? (
            <Button onClick={onClose} disabled={Boolean(closeBlocked)} className="w-full sm:w-auto">
              Encerrar curso
            </Button>
          ) : (
            <Button onClick={onEmit} disabled={Boolean(blocked) || counts.elegivel === 0} className="w-full sm:w-auto">
              {counts.elegivel > 0 ? `Emitir ${counts.elegivel} certificado(s)` : 'Emitir certificados'}
            </Button>
          )}
          {course.status === 'encerrado' && (
            <button type="button" onClick={onReopen} className="text-center text-sm font-semibold text-brand-900 hover:underline">
              Reabrir curso
            </button>
          )}
          {counts.emitido > 0 && (
            <Link to={`/app/certificados?curso=${course.id}`} className="text-center text-sm font-semibold text-brand-900 hover:underline">
              Ver certificados emitidos
            </Link>
          )}
        </div>
      </div>
      {closeBlocked ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{closeBlocked}</p>
      ) : podeEncerrar ? (
        <p className="mt-3 text-sm text-slate-500">
          O curso terminou. Encerre-o para congelar os dados e as notas e poder emitir os certificados.
        </p>
      ) : blocked ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{blocked}</p>
      ) : counts.elegivel === 0 && enrollments.length > 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {counts.emitido === enrollments.length
            ? 'Todos os formandos já têm certificado.'
            : 'Nenhum formando cumpre os critérios para emissão neste momento.'}
        </p>
      ) : enrollments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Matricule formandos para poder emitir certificados.</p>
      ) : null}
    </Card>
  );
}
