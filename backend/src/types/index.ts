export interface Profile {
  id: string;
  code: string;
  email: string | null;
  phone: string | null;
  organization_name: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface AuthContextUser {
  id: string;
  email?: string;
  profile: Profile | null;
}

export type CourseStatus = 'planeado' | 'em_andamento' | 'concluido' | 'cancelado';

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
}

export interface CourseWithCount extends Course {
  total_formandos: number;
}

export interface Trainee {
  id: string;
  nome: string;
  email: string | null;
  contacto: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  /** Cursos onde o formando está matriculado (apenas na listagem). */
  cursos?: Array<{ id: string; nome: string }>;
}

export interface Enrollment {
  id: string;
  formando_id: string;
  curso_id: string;
  avaliacao: number | null;
  created_at: string;
  updated_at: string;
}

/** Vista de formando matriculado num curso (junção matrícula + formando). */
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
