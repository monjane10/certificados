import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { CourseForm, type CourseFormValues } from '../../components/courses/CourseForm';
import { TraineeForm, type TraineeFormValues } from '../../components/courses/TraineeForm';
import { TraineeTable } from '../../components/courses/TraineeTable';
import { GradeModal } from '../../components/courses/GradeModal';
import { EnrollPanel } from '../../components/courses/EnrollPanel';
import { CourseStatusBadge } from '../../components/courses/CourseStatusBadge';
import { CourseTypeBadge } from '../../components/courses/CourseTypeBadge';
import { CertificatePanel, countEligibility } from '../../components/courses/CertificatePanel';
import { certificateService } from '../../services/certificates';
import { TemplatePicker } from '../../components/certificates/TemplatePicker';
import { templateById } from '../../components/certificates/registry';
import { ConfirmDialog } from '../../components/courses/ConfirmDialog';
import { Modal } from '../../components/courses/Modal';
import { ErrorState, LoadingState } from '../../components/courses/States';
import { courseService, traineeService } from '../../services/courses';
import { NOTA_MINIMA_APROVACAO, type CertificateTemplate, type Course, type EnrollmentView, type Trainee } from '../../types';

function fmtDate(d: string | null): string {
  if (!d) return '-';
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-MZ');
}

/** Período legível; evita "- - -" quando o curso ainda não tem datas. */
function fmtPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return 'Sem datas definidas';
  return `${fmtDate(start)} a ${fmtDate(end)}`;
}

export function CourseDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [showEnroll, setShowEnroll] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState<EnrollmentView | null>(null);
  const [editingGrade, setEditingGrade] = useState<EnrollmentView | null>(null);
  const [deleting, setDeleting] = useState<EnrollmentView | null>(null);
  const [editingCourse, setEditingCourse] = useState(false);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmEmit, setConfirmEmit] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { course: c, enrollments: list } = await courseService.get(id);
      setCourse(c);
      setEnrollments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar o curso.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pesquisa global do header (`/app/cursos/:id?q=nome`) filtra os formandos.
  useEffect(() => {
    setSearch(searchParams.get('q') ?? '');
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter(
      (e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        (e.contacto ?? '').toLowerCase().includes(q),
    );
  }, [enrollments, search]);

  function bumpTotal(delta: number) {
    setCourse((prev) =>
      prev ? { ...prev, total_formandos: (prev.total_formandos ?? enrollments.length) + delta } : prev,
    );
  }

  async function handleEnrollNew(values: TraineeFormValues) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await traineeService.enrollNew(id, {
        nome: values.nome,
        email: values.email || undefined,
        contacto: values.contacto || undefined,
        avaliacao: course?.tipo === 'participacao' ? null : (values.avaliacao ?? null),
      });
      setEnrollments((prev) => [created, ...prev]);
      bumpTotal(1);
      toast.success(`Formando «${created.nome}» matriculado com sucesso.`);
      setShowEnroll(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao matricular o formando.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEnrollExisting(t: Trainee) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await traineeService.enrollExisting(id, t.id);
      setEnrollments((prev) => [created, ...prev]);
      bumpTotal(1);
      toast.success(`Formando «${created.nome}» matriculado com sucesso.`);
      setShowEnroll(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao matricular o formando.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePersonal(values: TraineeFormValues) {
    if (!editingPersonal || saving) return;
    setSaving(true);
    try {
      const updated = await traineeService.updatePersonal(editingPersonal.formando_id, {
        nome: values.nome,
        email: values.email || null,
        contacto: values.contacto || null,
      });
      setEnrollments((prev) =>
        prev.map((e) =>
          e.formando_id === updated.id
            ? { ...e, nome: updated.nome, email: updated.email, contacto: updated.contacto }
            : e,
        ),
      );
      toast.success('Dados pessoais actualizados em todos os cursos.');
      setEditingPersonal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao actualizar o formando.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateGrade(avaliacao: number | null) {
    if (!editingGrade || saving) return;
    setSaving(true);
    try {
      const updated = await traineeService.updateGrade(editingGrade.matricula_id, avaliacao);
      setEnrollments((prev) => prev.map((e) => (e.matricula_id === updated.matricula_id ? updated : e)));
      toast.success('Avaliação actualizada apenas neste curso.');
      setEditingGrade(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao actualizar a avaliação.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnenroll() {
    if (!deleting || removing) return;
    setRemoving(true);
    try {
      const { removedFormando, remainingCourses } = await traineeService.unenroll(deleting.matricula_id);
      setEnrollments((prev) => prev.filter((e) => e.matricula_id !== deleting.matricula_id));
      bumpTotal(-1);
      if (removedFormando) {
        toast.success(`Matrícula cancelada. «${deleting.nome}» não tinha outras matrículas e foi removido definitivamente.`);
      } else {
        toast.success(
          `Matrícula cancelada. «${deleting.nome}» continua inscrito em ${remainingCourses} outro(s) curso(s); dados pessoais preservados.`,
        );
      }
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao cancelar a matrícula.');
    } finally {
      setRemoving(false);
    }
  }

  async function handleUpdateCourse(values: CourseFormValues) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await courseService.update(id, {
        nome: values.nome.trim(),
        carga_horaria: values.carga_horaria,
        tipo: values.tipo as Course['tipo'],
        data_abertura: values.data_abertura || null,
        data_encerramento: values.data_encerramento || null,
        cancelado: values.cancelado,
      });
      setCourse((prev) => (prev ? { ...updated, total_formandos: prev.total_formandos } : updated));
      toast.success('Curso actualizado com sucesso.');
      setEditingCourse(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao actualizar o curso.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEmit() {
    if (emitting) return;
    setEmitting(true);
    try {
      const s = await certificateService.emitForCourse(id);
      const fora = [
        s.semNota > 0 ? `${s.semNota} sem nota` : null,
        s.reprovados > 0 ? `${s.reprovados} reprovado(s)` : null,
      ].filter(Boolean);
      toast.success(
        `${s.emitidos} certificado(s) emitido(s).` + (fora.length ? ` Ficaram de fora: ${fora.join(', ')}.` : ''),
      );
      setConfirmEmit(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao emitir os certificados.');
    } finally {
      setEmitting(false);
    }
  }

  async function handleTemplate(modelo: CertificateTemplate) {
    if (savingTemplate) return;
    setSavingTemplate(true);
    try {
      const updated = await courseService.update(id, { modelo_certificado: modelo });
      setCourse((prev) => (prev ? { ...updated, total_formandos: prev.total_formandos } : updated));
      const emitidos = enrollments.filter((e) => e.certificado).length;
      toast.success(
        `Modelo «${templateById(modelo).nome}» seleccionado.` +
          (emitidos > 0 ? ` Os ${emitidos} certificado(s) já emitido(s) passam a usar este modelo.` : ''),
      );
      setChoosingTemplate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao alterar o modelo.');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteCourse() {
    if (removing) return;
    setRemoving(true);
    try {
      const { removedMatriculas, removedOrphanFormandos } = await courseService.remove(id);
      toast.success(
        `Curso excluído (${removedMatriculas} matrícula(s) removida(s)). ` +
          (removedOrphanFormandos > 0
            ? `${removedOrphanFormandos} formando(s) sem outros cursos removido(s); os restantes foram preservados.`
            : 'Formandos com outros cursos foram preservados.'),
      );
      navigate('/app/cursos', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir o curso.');
      setRemoving(false);
    }
  }

  if (loading) return <LoadingState label="A carregar curso..." />;
  if (error || !course)
    return (
      <div className="space-y-4">
        <Link to="/app/cursos" className="text-sm font-semibold text-brand-900 hover:underline">
          Voltar aos cursos
        </Link>
        <ErrorState message={error ?? 'Curso não encontrado.'} onRetry={load} />
      </div>
    );

  const comNotas = course.tipo === 'tecnico_profissional';
  const elig = countEligibility(course, enrollments);
  const emitDescription = comNotas
    ? `Serão emitidos ${elig.elegivel} certificado(s) técnico-profissional(is) para os formandos com nota igual ou superior a ${NOTA_MINIMA_APROVACAO}.` +
      (elig.sem_nota + elig.reprovado > 0
        ? ` Ficam de fora ${elig.sem_nota} sem nota e ${elig.reprovado} reprovado(s).`
        : '') +
      ' Depois de emitido, a nota do formando fica bloqueada (para alterar é preciso anular o certificado).'
    : `Serão emitidos ${elig.elegivel} certificado(s) de participação, um para cada formando matriculado que ainda não o tem.`;

  return (
    <div className="space-y-6">
      <Link to="/app/cursos" className="text-sm font-semibold text-brand-900 hover:underline">
        Voltar aos cursos
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">{course.nome}</h1>
              <CourseStatusBadge status={course.status} />
              <CourseTypeBadge tipo={course.tipo} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {course.codigo} · {course.carga_horaria}h · {enrollments.length} formando(s)
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {fmtPeriod(course.data_abertura, course.data_encerramento)}
            </p>
          </div>
          <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button variant="secondary" onClick={() => setEditingCourse(true)}>
              Editar curso
            </Button>
            <Button variant="danger" onClick={() => setConfirmDeleteCourse(true)}>
              Excluir
            </Button>
          </div>
        </div>
      </Card>

      <CertificatePanel
        course={course}
        enrollments={enrollments}
        onEmit={() => setConfirmEmit(true)}
        onChooseTemplate={() => setChoosingTemplate(true)}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-brand-950">Formandos</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Matriculados no curso «{course.nome}».{' '}
            {comNotas
              ? `Aprovação a partir de ${NOTA_MINIMA_APROVACAO} valores.`
              : 'Curso de participação: sem avaliação.'}
          </p>
        </div>
        <Button onClick={() => setShowEnroll(true)} className="w-full sm:w-auto">
          Registar formando
        </Button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Pesquisar por nome, email ou contacto"
        aria-label="Pesquisar formandos"
        className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-soft"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={enrollments.length === 0 ? 'Ainda sem formandos' : 'Sem resultados'}
          description={
            enrollments.length === 0
              ? 'Registe um novo formando ou matricule um formando já registado.'
              : 'Nenhum formando corresponde à pesquisa.'
          }
          action={
            enrollments.length === 0 ? (
              <Button onClick={() => setShowEnroll(true)}>Registar formando</Button>
            ) : undefined
          }
        />
      ) : (
        <TraineeTable
          enrollments={filtered}
          comNotas={comNotas}
          onEditPersonal={setEditingPersonal}
          onEditGrade={setEditingGrade}
          onDelete={setDeleting}
        />
      )}

      <Modal open={showEnroll} title={`Registar formando em ${course.nome}`} onClose={() => (saving ? null : setShowEnroll(false))}>
        <EnrollPanel
          saving={saving}
          comNotas={comNotas}
          onEnrollNew={handleEnrollNew}
          onEnrollExisting={handleEnrollExisting}
          onCancel={() => setShowEnroll(false)}
        />
      </Modal>

      <Modal open={editingPersonal !== null} title="Editar dados pessoais" onClose={() => (saving ? null : setEditingPersonal(null))}>
        {editingPersonal && (
          <>
            <p className="-mt-2 mb-3 text-xs leading-relaxed text-slate-500">
              Reflecte-se em todos os cursos onde o formando esteja inscrito. A avaliação edita-se
              separadamente, por curso.
            </p>
            <TraineeForm
              initial={{ nome: editingPersonal.nome, email: editingPersonal.email, contacto: editingPersonal.contacto }}
              saving={saving}
              submitLabel="Guardar alterações"
              onSubmit={handleUpdatePersonal}
              onCancel={() => setEditingPersonal(null)}
            />
          </>
        )}
      </Modal>

      <Modal open={editingGrade !== null} title="Editar avaliação" onClose={() => (saving ? null : setEditingGrade(null))}>
        {editingGrade && (
          <GradeModal
            enrollment={editingGrade}
            saving={saving}
            onSave={handleUpdateGrade}
            onCancel={() => setEditingGrade(null)}
          />
        )}
      </Modal>

      <Modal open={editingCourse} title="Editar curso" onClose={() => (saving ? null : setEditingCourse(false))}>
        <CourseForm initial={course} saving={saving} submitLabel="Guardar alterações" onSubmit={handleUpdateCourse} onCancel={() => setEditingCourse(false)} />
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Cancelar matrícula"
        description={deleting ? `Cancelar a matrícula de «${deleting.nome}» no curso «${course.nome}»? Se não tiver outras matrículas, o registo do formando será removido definitivamente; caso contrário, os dados pessoais e as outras matrículas são preservados.` : ''}
        confirmLabel="Cancelar matrícula"
        loading={removing}
        onConfirm={handleUnenroll}
        onCancel={() => (removing ? null : setDeleting(null))}
      />

      <Modal
        open={choosingTemplate}
        size="xl"
        title="Modelo de certificado"
        onClose={() => (savingTemplate ? null : setChoosingTemplate(false))}
      >
        <p className="-mt-2 mb-4 text-sm text-slate-500">
          Pré-visualização com os dados deste curso. O modelo aplica-se a todos os certificados do curso, incluindo os já
          emitidos (o conteúdo não muda, só a aparência).
        </p>
        <TemplatePicker course={course} saving={savingTemplate} onSelect={handleTemplate} />
      </Modal>

      <ConfirmDialog
        open={confirmEmit}
        title="Emitir certificados"
        description={`${emitDescription} Modelo: ${templateById(course.modelo_certificado).nome}.`}
        confirmLabel={`Emitir ${elig.elegivel} certificado(s)`}
        danger={false}
        loading={emitting}
        onConfirm={handleEmit}
        onCancel={() => (emitting ? null : setConfirmEmit(false))}
      />

      <ConfirmDialog
        open={confirmDeleteCourse}
        title="Excluir curso"
        description={`Excluir o curso «${course.nome}» (${course.codigo})? As ${enrollments.length} matrícula(s) serão removidas. Formandos inscritos noutros cursos são preservados; apenas os registos sem outras matrículas nem dependências serão eliminados. Esta acção não pode ser anulada.`}
        confirmLabel="Excluir curso"
        loading={removing}
        onConfirm={handleDeleteCourse}
        onCancel={() => (removing ? null : setConfirmDeleteCourse(false))}
      />
    </div>
  );
}
