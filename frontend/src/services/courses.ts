import { apiRequest as req } from '../lib/http';
import type { Course, EnrollmentView, Trainee } from '../types';

export interface CourseInput {
  nome: string;
  carga_horaria: number;
  tipo: Course['tipo'];
  /** Opcional na criação: o backend usa 'classico' por defeito. */
  modelo_certificado?: Course['modelo_certificado'];
  /** Obrigatórias: o estado é calculado a partir delas. */
  data_abertura: string;
  data_encerramento: string;
}

/** O estado não se envia: vem das datas; só o cancelamento é manual. */
export type CourseUpdate = Partial<CourseInput> & {
  cancelado?: boolean;
};

export const courseService = {
  async list(): Promise<Course[]> {
    const json = await req('/api/courses');
    return (json['courses'] as Course[]) ?? [];
  },
  async get(id: string): Promise<{ course: Course; enrollments: EnrollmentView[] }> {
    const json = await req(`/api/courses/${id}`);
    return {
      course: json['course'] as Course,
      enrollments: (json['enrollments'] as EnrollmentView[]) ?? [],
    };
  },
  async create(payload: CourseInput): Promise<Course> {
    const json = await req('/api/courses', { method: 'POST', body: payload });
    return json['course'] as Course;
  },
  /** As datas podem ser alteradas mas não apagadas. */
  async update(id: string, patch: CourseUpdate): Promise<Course> {
    const json = await req(`/api/courses/${id}`, { method: 'PATCH', body: patch });
    return json['course'] as Course;
  },
  /** Encerra o curso: fica só de leitura e passa a permitir emitir certificados. */
  async close(id: string): Promise<Course> {
    const json = await req(`/api/courses/${id}/close`, { method: 'POST' });
    return json['course'] as Course;
  },
  /** Reabre um curso encerrado para voltar a permitir alterações. */
  async reopen(id: string): Promise<Course> {
    const json = await req(`/api/courses/${id}/reopen`, { method: 'POST' });
    return json['course'] as Course;
  },
  async remove(id: string): Promise<{ removedMatriculas: number; removedOrphanFormandos: number }> {
    const json = await req(`/api/courses/${id}`, { method: 'DELETE' });
    return {
      removedMatriculas: (json['removedMatriculas'] as number) ?? 0,
      removedOrphanFormandos: (json['removedOrphanFormandos'] as number) ?? 0,
    };
  },
};

export interface TraineeInput {
  nome: string;
  email?: string;
  contacto?: string;
  avaliacao?: number | null;
}

export const traineeService = {
  /** Pesquisa formandos já registados do utilizador (para matricular). */
  async search(q?: string): Promise<Trainee[]> {
    const json = await req(`/api/trainees${q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    return (json['trainees'] as Trainee[]) ?? [];
  },
  /** Cria novo formando e matricula-o no curso (409 se duplicado). */
  async enrollNew(courseId: string, payload: TraineeInput): Promise<EnrollmentView> {
    const json = await req(`/api/courses/${courseId}/trainees`, { method: 'POST', body: payload });
    return json['enrollment'] as EnrollmentView;
  },
  /** Matricula vários formandos já registados de uma vez; os já matriculados são ignorados. */
  async enrollMany(courseId: string, formandoIds: string[]): Promise<EnrollmentView[]> {
    const json = await req(`/api/courses/${courseId}/trainees`, { method: 'POST', body: { formando_ids: formandoIds } });
    return (json['enrollments'] as EnrollmentView[]) ?? [];
  },
  /** Actualiza dados pessoais (reflecte-se em todos os cursos); null limpa o campo. */
  async updatePersonal(
    id: string,
    patch: { nome?: string; email?: string | null; contacto?: string | null },
  ): Promise<Trainee> {
    const json = await req(`/api/trainees/${id}`, { method: 'PATCH', body: patch });
    return json['trainee'] as Trainee;
  },
  /** Actualiza a avaliação APENAS nesta matrícula/curso. */
  async updateGrade(matriculaId: string, avaliacao: number | null): Promise<EnrollmentView> {
    const json = await req(`/api/enrollments/${matriculaId}`, { method: 'PATCH', body: { avaliacao } });
    return json['enrollment'] as EnrollmentView;
  },
  /** Cancela a matrícula; o backend decide Caso A (remove formando) vs. B. */
  async unenroll(matriculaId: string): Promise<{ removedFormando: boolean; remainingCourses: number }> {
    const json = await req(`/api/enrollments/${matriculaId}`, { method: 'DELETE' });
    return {
      removedFormando: Boolean(json['removedFormando']),
      remainingCourses: (json['remainingCourses'] as number) ?? 0,
    };
  },
};
