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

export type CourseType = 'participacao' | 'tecnico_profissional';

export const COURSE_TYPES: CourseType[] = ['participacao', 'tecnico_profissional'];

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  participacao: 'Participação',
  tecnico_profissional: 'Técnico-profissional',
};

export const COURSE_TYPE_DESCRIPTIONS: Record<CourseType, string> = {
  participacao: 'Sem avaliação. Certificado de participação.',
  tecnico_profissional: 'Nota de 0 a 20 por formando. Certificado com nota.',
};

/** Modelos visuais de certificado; o desenho de cada um está em components/certificates. */
export type CertificateTemplate = 'classico' | 'ondas_azuis' | 'violeta' | 'dourado' | 'minimalista';

/** Nota mínima (0-20) para aprovação em cursos técnico-profissionais. */
export const NOTA_MINIMA_APROVACAO = 10;

export interface Course {
  id: string;
  nome: string;
  carga_horaria: number;
  tipo: CourseType;
  modelo_certificado: CertificateTemplate;
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
  /** Certificado activo (emitido) desta matrícula, se existir. */
  certificado: { id: string; codigo: string } | null;
}

export type CertificateState = 'emitido' | 'anulado';

/** Certificado com os dados copiados no momento da emissão. */
export interface Certificate {
  id: string;
  codigo: string;
  matricula_id: string | null;
  curso_id: string;
  formando_id: string;
  tipo: CourseType;
  modelo: CertificateTemplate;
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

/** Dados devolvidos pela verificação pública. */
export type PublicCertificate = Omit<
  Certificate,
  'id' | 'matricula_id' | 'curso_id' | 'formando_id' | 'motivo_anulacao'
>;

export interface EmissionSummary {
  total: number;
  emitidos: number;
  jaEmitidos: number;
  semNota: number;
  reprovados: number;
}
