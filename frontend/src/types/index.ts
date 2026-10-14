export type Role = 'admin' | 'user';

export interface Profile {
  id: string;
  code: string;
  email: string | null;
  phone: string | null;
  organization_name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export type CourseStatus = 'planeado' | 'em_andamento' | 'concluido' | 'cancelado';

export const COURSE_STATUSES: CourseStatus[] = ['planeado', 'em_andamento', 'concluido', 'cancelado'];

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  planeado: 'Planeado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export interface Course {
  id: string;
  nome: string;
  carga_horaria: number;
  codigo: string;
  data_abertura: string | null;
  data_encerramento: string | null;
  status: CourseStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
  total_formandos?: number;
}

export interface Trainee {
  id: string;
  nome: string;
  email: string | null;
  contacto: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  /** Cursos onde o formando está matriculado (devolvido pela pesquisa). */
  cursos?: Array<{ id: string; nome: string }>;
}

/** Vista de formando matriculado num curso (matrícula + dados pessoais). */
export interface EnrollmentView {
  matricula_id: string;
  formando_id: string;
  curso_id: string;
  nome: string;
  email: string | null;
  contacto: string | null;
  avaliacao: number | null;
  matriculado_em: string;
}
