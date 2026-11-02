export type Role = 'admin' | 'user';

export interface Profile {
  id: string;
  code: string;
  email: string | null;
  phone: string | null;
  organization_name: string;
  role: Role;
  /** Imagens no bucket "branding" e quem assina os certificados. */
  logo_path: string | null;
  assinatura_path: string | null;
  responsavel_nome: string | null;
  responsavel_cargo: string | null;
  created_at: string;
  updated_at: string;
}

export type CourseStatus = 'planeado' | 'em_andamento' | 'concluido' | 'encerrado' | 'cancelado';

export const COURSE_STATUSES: CourseStatus[] = ['planeado', 'em_andamento', 'concluido', 'encerrado', 'cancelado'];

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  planeado: 'Planeado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  encerrado: 'Encerrado',
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
  cancelado: boolean;
  /** Preenchido ao encerrar: o curso e as matrículas ficam só de leitura. */
  encerrado_em: string | null;
  /** Calculado no servidor a partir das datas e de cancelado. */
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
  logo_path: string | null;
  assinatura_path: string | null;
  responsavel_nome: string | null;
  responsavel_cargo: string | null;
  estado: CertificateState;
  emitido_em: string;
  anulado_em: string | null;
  motivo_anulacao: string | null;
  /** Link privado do formando: /c/<acesso_token>. */
  acesso_token: string;
  /** Taxa paga pelo formando, em MT (participação 100, técnico-profissional 150). */
  taxa_valor: number;
  pago_em: string | null;
  /** Certificado anulado de onde veio o pagamento (reemissão depois de uma correcção). */
  pago_herdado_de: string | null;
  whatsapp_enviado_em: string | null;
  /** Contacto actual do formando (para o envio por WhatsApp). */
  formando_contacto: string | null;
  /** Pedido de correcção do formando ainda por resolver. */
  correcao: CorrectionRequest | null;
}

/** Pedido de correcção dos dados, feito pelo formando a partir do seu link. */
export interface CorrectionRequest {
  mensagem: string;
  criado_em: string;
}

/** Dados impressos no certificado (o que os modelos desenham). */
export type PublicCertificate = Omit<
  Certificate,
  | 'id'
  | 'matricula_id'
  | 'curso_id'
  | 'formando_id'
  | 'motivo_anulacao'
  | 'acesso_token'
  | 'taxa_valor'
  | 'pago_em'
  | 'pago_herdado_de'
  | 'whatsapp_enviado_em'
  | 'formando_contacto'
  | 'correcao'
>;

/**
 * Verificação pública: antes do pagamento só vêm código, tipo, curso, emissor
 * e estado (pago: false); depois do pagamento vêm todos os dados impressos.
 */
export type PublicVerification =
  | (PublicCertificate & { pago: true })
  | (Pick<PublicCertificate, 'codigo' | 'tipo' | 'curso_nome' | 'emissor_nome' | 'estado' | 'emitido_em' | 'anulado_em'> & {
      pago: false;
    });

export type PaymentMethod = 'mpesa' | 'emola';

/** Pagamento mostrado ao formando: o confirmado (comprovativo) ou o último pedido. */
export interface StudentPayment {
  estado: 'pendente' | 'pago' | 'falhado';
  erro: string | null;
  referencia: string;
  metodo: PaymentMethod;
  valor: number;
  /** Mascarado: 84 *** 4567. */
  telefone: string;
  criado_em: string;
  actualizado_em: string;
}

/** Página do formando (link privado): dados completos, contacto da instituição, pagamento e taxa. */
export type StudentCertificate = PublicCertificate & {
  emissor_telefone: string | null;
  emissor_email: string | null;
  pago: boolean;
  pago_em: string | null;
  /** O pagamento veio de um certificado anterior, anulado para corrigir dados. */
  pagamento_herdado: boolean;
  taxa_valor: number;
  pagamento: StudentPayment | null;
  correcao: CorrectionRequest | null;
};

export interface EmissionSummary {
  total: number;
  emitidos: number;
  jaEmitidos: number;
  semNota: number;
  reprovados: number;
}
