import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { CourseCards, CourseTable } from '../../components/courses/CourseTable';
import { CourseForm, type CourseFormValues } from '../../components/courses/CourseForm';
import { ConfirmDialog } from '../../components/courses/ConfirmDialog';
import { Modal } from '../../components/courses/Modal';
import { ErrorState, LoadingState } from '../../components/courses/States';
import { courseService } from '../../services/courses';
import { COURSE_STATUSES, COURSE_STATUS_LABELS, type Course, type CourseStatus } from '../../types';

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'todos'>('todos');
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCourses(await courseService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar cursos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Pesquisa vinda do header (`/app/cursos?q=...`).
  useEffect(() => {
    setSearch(searchParams.get('q') ?? '');
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (!q) return true;
      return c.nome.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q);
    });
  }, [courses, search, statusFilter]);

  async function handleUpdate(values: CourseFormValues) {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const updated = await courseService.update(editing.id, {
        nome: values.nome.trim(),
        carga_horaria: values.carga_horaria,
        data_abertura: values.data_abertura || undefined,
        data_encerramento: values.data_encerramento || undefined,
        status: values.status as Course['status'],
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...updated, total_formandos: c.total_formandos } : c)),
      );
      toast.success('Curso actualizado com sucesso.');
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao actualizar o curso.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting || removing) return;
    setRemoving(true);
    try {
      const { removedMatriculas, removedOrphanFormandos } = await courseService.remove(deleting.id);
      setCourses((prev) => prev.filter((c) => c.id !== deleting.id));
      toast.success(
        removedMatriculas > 0
          ? `Curso excluído (${removedMatriculas} matrícula(s) removida(s); ${removedOrphanFormandos} formando(s) órfão(s) removido(s), restantes preservados).`
          : 'Curso excluído com sucesso.',
      );
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir o curso.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">Os meus cursos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {courses.length} curso(s) no total. Crie, consulte, edite e gira os formandos dos seus cursos.
          </p>
        </div>
        <Link to="/app/cursos/novo" className="w-full sm:w-auto">
          <Button className="w-full">Novo curso</Button>
        </Link>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome ou código"
          aria-label="Pesquisar cursos"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CourseStatus | 'todos')}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Filtrar por estado"
        >
          <option value="todos">Todos os estados</option>
          {COURSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {COURSE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Card>

      {loading ? (
        <LoadingState label="A carregar cursos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={courses.length === 0 ? 'Ainda sem cursos' : 'Sem resultados'}
          description={
            courses.length === 0
              ? 'Crie o seu primeiro curso para começar a registar formandos.'
              : 'Nenhum curso corresponde à pesquisa ou ao filtro seleccionado.'
          }
          action={
            courses.length === 0 ? (
              <Link to="/app/cursos/novo">
                <Button>Criar curso</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <CourseTable courses={filtered} onEdit={setEditing} onDelete={setDeleting} />
          </div>
          <div className="lg:hidden">
            <CourseCards courses={filtered} onEdit={setEditing} onDelete={setDeleting} />
          </div>
        </>
      )}

      <Modal open={editing !== null} title="Editar curso" onClose={() => (saving ? null : setEditing(null))}>
        {editing && (
          <CourseForm
            initial={editing}
            saving={saving}
            submitLabel="Guardar alterações"
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir curso"
        description={
          deleting
            ? `Excluir o curso «${deleting.nome}» (${deleting.codigo})? As matrículas associadas (${deleting.total_formandos ?? 0}) serão removidas; formandos inscritos noutros cursos são preservados. Esta acção não pode ser anulada.`
            : ''
        }
        confirmLabel="Excluir curso"
        loading={removing}
        onConfirm={handleDelete}
        onCancel={() => (removing ? null : setDeleting(null))}
      />
    </div>
  );
}
