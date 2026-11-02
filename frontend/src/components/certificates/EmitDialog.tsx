import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { Modal } from '../courses/Modal';
import { CourseTypeBadge } from '../courses/CourseTypeBadge';
import { countEligibility } from '../courses/CertificatePanel';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { courseService } from '../../services/courses';
import { certificateService } from '../../services/certificates';
import type { Course } from '../../types';

/** Curso terminado e o que falta para emitir. */
interface Row {
  course: Course;
  /** Só nos encerrados (os concluídos ainda têm de ser encerrados na página do curso). */
  counts: ReturnType<typeof countEligibility> | null;
}

function rank(r: Row): number {
  if (r.counts && r.counts.elegivel > 0) return 0;
  if (!r.counts) return 1;
  return 2;
}

/**
 * Emissão a partir da página de Certificados: lista os cursos terminados e
 * emite em lote os de cada curso encerrado, com as mesmas regras da página do
 * curso (participação: todos; técnico-profissional: nota mínima).
 */
export function EmitDialog({ open, onClose, onEmitted }: { open: boolean; onClose: () => void; onEmitted: () => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emitting, setEmitting] = useState<string | null>(null);

  const rowFor = useCallback(async (course: Course): Promise<Row> => {
    if (course.status !== 'encerrado') return { course, counts: null };
    const { course: fresh, enrollments } = await courseService.get(course.id);
    return { course: fresh, counts: countEligibility(fresh, enrollments) };
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      const courses = (await courseService.list()).filter((c) => c.status === 'encerrado' || c.status === 'concluido');
      const loaded = await Promise.all(courses.map(rowFor));
      setRows(loaded.sort((a, b) => rank(a) - rank(b) || a.course.nome.localeCompare(b.course.nome, 'pt')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar os cursos.');
    }
  }, [rowFor]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function emit(course: Course) {
    if (emitting) return;
    setEmitting(course.id);
    try {
      const s = await certificateService.emitForCourse(course.id);
      const fora = [
        s.semNota > 0 ? `${s.semNota} sem nota` : null,
        s.reprovados > 0 ? `${s.reprovados} reprovado(s)` : null,
      ].filter(Boolean);
      toast.success(
        `«${course.nome}»: ${s.emitidos} certificado(s) emitido(s).` + (fora.length ? ` Ficaram de fora: ${fora.join(', ')}.` : ''),
      );
      const updated = await rowFor(course);
      setRows((prev) => prev?.map((r) => (r.course.id === course.id ? updated : r)) ?? prev);
      onEmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao emitir os certificados.');
    } finally {
      setEmitting(null);
    }
  }

  const faltaIdentidade = !profile?.logo_path || !profile?.assinatura_path;

  return (
    <Modal open={open} title="Emitir certificados" onClose={() => (emitting ? null : onClose())}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Os certificados emitem-se por curso, para todos os formandos elegíveis de uma vez. Cada formando recebe o seu
          como «por pagar», pronto a enviar pelo WhatsApp.
        </p>

        {faltaIdentidade && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {!profile?.logo_path && !profile?.assinatura_path
              ? 'Ainda não tem logótipo nem assinatura.'
              : !profile?.logo_path
                ? 'Ainda não tem logótipo.'
                : 'Ainda não tem assinatura.'}{' '}
            <Link to="/app/perfil" className="font-semibold underline">
              Adicione-os no Perfil
            </Link>{' '}
            antes de emitir.
          </p>
        )}

        {error ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="secondary" onClick={() => void load()}>
              Tentar de novo
            </Button>
          </div>
        ) : !rows ? (
          <Spinner label="A carregar os cursos..." />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-5 text-center">
            <p className="font-semibold text-ink">Nenhum curso terminado</p>
            <p className="mt-1 text-sm text-muted">
              Os certificados emitem-se depois de o curso terminar e ser encerrado.
            </p>
            <Link to="/app/cursos" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-900 hover:underline">
              Ir para cursos <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {rows.map(({ course, counts }) => (
              <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-ink">{course.nome}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <CourseTypeBadge tipo={course.tipo} />
                    <span className={counts && counts.elegivel > 0 ? 'font-semibold text-brand-900' : 'text-muted'}>
                      {!counts
                        ? 'Terminado: encerre o curso primeiro'
                        : counts.elegivel > 0
                          ? `${counts.elegivel} pronto(s) a emitir`
                          : counts.emitido > 0
                            ? 'Todos os certificados emitidos'
                            : 'Nenhum formando elegível'}
                    </span>
                  </div>
                </div>
                {!counts ? (
                  <Link
                    to={`/app/cursos/${course.id}`}
                    className="inline-flex items-center gap-1.5 rounded-button border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-soft"
                  >
                    Abrir curso <ArrowRight size={15} />
                  </Link>
                ) : counts.elegivel > 0 ? (
                  <Button onClick={() => void emit(course)} loading={emitting === course.id} disabled={emitting !== null}>
                    Emitir {counts.elegivel}
                  </Button>
                ) : counts.emitido > 0 ? (
                  <CircleCheck size={20} className="text-accent-600" aria-label="Completo" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
