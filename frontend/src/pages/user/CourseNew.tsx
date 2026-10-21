import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { CourseForm, type CourseFormValues } from '../../components/courses/CourseForm';
import { courseService } from '../../services/courses';
import type { Course } from '../../types';

export function CourseNewPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  async function handleCreate(values: CourseFormValues) {
    if (saving) return;
    setSaving(true);
    try {
      const course = await courseService.create({
        nome: values.nome.trim(),
        carga_horaria: values.carga_horaria,
        tipo: values.tipo as Course['tipo'],
        data_abertura: values.data_abertura || undefined,
        data_encerramento: values.data_encerramento || undefined,
        status: values.status as Course['status'],
      });
      toast.success(`Curso «${course.nome}» criado com sucesso (${course.codigo}).`);
      navigate(`/app/cursos/${course.id}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao criar o curso.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/app/cursos" className="text-sm font-semibold text-brand-900 hover:underline">
        Voltar aos cursos
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">Novo curso</h1>
        <p className="mt-1 text-sm text-slate-500">Preencha os dados do curso. O código é gerado automaticamente.</p>
      </div>
      <Card className="max-w-2xl">
        <CourseForm saving={saving} submitLabel="Criar curso" onSubmit={handleCreate} />
      </Card>
    </div>
  );
}
