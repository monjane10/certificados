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

export type CourseType = 'participacao' | 'tecnico_profissional';

export interface Course {
  id: string;
  nome: string;
  carga_horaria: number;
  tipo: CourseType;
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
  /** Certificado activo (emitido) desta matrícula, se existir. */
  certificado: { id: string; codigo: string } | null;
}

export type CertificateState = 'emitido' | 'anulado';

/** Certificado com snapshot dos dados no momento da emissão. */
export interface Certificate {
  id: string;
  codigo: string;
  matricula_id: string | null;
  curso_id: string;
  formando_id: string;
  tipo: CourseType;
  formando_nome: string;
  curso_nome: string;
  carga_horaria: number;
  data_abertura: string | null;
  data_encerramento: string;
  nota: number | null;
  emissor_nome: string;
  estado: CertificateState;
  emitido_em: string;
  anulado_em: string | null;
  motivo_anulacao: string | null;
}

/** Dados públicos devolvidos pela verificação (sem ids internos). */
export type PublicCertificate = Pick<
  Certificate,
  | 'codigo'
  | 'tipo'
  | 'formando_nome'
  | 'curso_nome'
  | 'carga_horaria'
  | 'data_abertura'
  | 'data_encerramento'
  | 'nota'
  | 'emissor_nome'
  | 'estado'
  | 'emitido_em'
  | 'anulado_em'
>;

export interface EmissionSummary {
  total: number;
  emitidos: number;
  jaEmitidos: number;
  semNota: number;
  reprovados: number;
}
