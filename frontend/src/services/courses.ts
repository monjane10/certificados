import { supabase } from '../lib/supabase';
import type { Course, EnrollmentView, Trainee } from '../types';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
  const json = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) {
    throw new Error(json.error ?? `Erro ${res.status}`);
  }
  return json;
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(await authHeader()) },
  });
  return handle(res);
}

export interface CourseInput {
  nome: string;
  carga_horaria: number;
  data_abertura?: string;
  data_encerramento?: string;
  status: Course['status'];
}

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
    const json = await req('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return json['course'] as Course;
  },
  async update(id: string, patch: Partial<CourseInput>): Promise<Course> {
    const json = await req(`/api/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
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
    const json = await req(`/api/courses/${courseId}/trainees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return json['enrollment'] as EnrollmentView;
  },
  /** Matricula um formando já registado (409 se já matriculado). */
  async enrollExisting(courseId: string, formandoId: string): Promise<EnrollmentView> {
    const json = await req(`/api/courses/${courseId}/trainees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formando_id: formandoId }),
    });
    return json['enrollment'] as EnrollmentView;
  },
  /** Actualiza dados pessoais (reflecte-se em todos os cursos). */
  async updatePersonal(id: string, patch: Partial<TraineeInput>): Promise<Trainee> {
    const json = await req(`/api/trainees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return json['trainee'] as Trainee;
  },
  /** Actualiza a avaliação APENAS nesta matrícula/curso. */
  async updateGrade(matriculaId: string, avaliacao: number | null): Promise<EnrollmentView> {
    const json = await req(`/api/enrollments/${matriculaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avaliacao }),
    });
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
