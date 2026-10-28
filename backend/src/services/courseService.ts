import { scopedClient } from '../config/supabase.js';
import { DATES_INCOHERENT_MESSAGE, datesCoherent } from '../schemas/course.js';
import type { CertificateTemplate, Course, CourseType, CourseWithCount, EnrollmentView, Trainee } from '../types/index.js';

// status é o campo calculado public.estado_curso (datas + cancelado), não uma coluna.
const COURSE_COLUMNS =
  'id, nome, carga_horaria, tipo, modelo_certificado, codigo, data_abertura, data_encerramento, cancelado, status:estado_curso, user_id, created_at, updated_at';

const NO_GRADES_MESSAGE = 'Cursos de participação não têm avaliação.';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCourseCode(): string {
  let code = 'CUR-';
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Regista no servidor o erro original do Supabase, que não é enviado ao cliente. */
export function logDbError(context: string, error: { code?: string; message: string; details?: string | null; hint?: string | null }) {
  console.error(`[db] ${context}`, { code: error.code, message: error.message, details: error.details, hint: error.hint });
}

/**
 * Erros levantados pelas nossas funções/triggers SQL (RAISE EXCEPTION, código
 * P0001) trazem uma mensagem pensada para o utilizador; os restantes não.
 */
export function dbError(error: { code?: string; message: string }, status: number, fallback: string) {
  if (error.code !== 'P0001') logDbError(fallback, error);
  return new HttpError(status, error.code === 'P0001' ? error.message : fallback);
}

/** Verifica que o curso existe e pertence ao utilizador do token (RLS + check explícito). */
export async function requireOwnedCourse(accessToken: string, userId: string, courseId: string) {
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('cursos')
    .select(COURSE_COLUMNS)
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw dbError(error, 500, 'Falha ao consultar o curso.');
  if (!data) throw new HttpError(404, 'Curso não encontrado.');
  const course = data as Course;
  if (course.user_id !== userId) throw new HttpError(404, 'Curso não encontrado.');
  return course;
}

export async function listCourses(accessToken: string, userId: string): Promise<CourseWithCount[]> {
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('cursos')
    .select(`${COURSE_COLUMNS}, matriculas(count)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw dbError(error, 500, 'Falha ao listar cursos.');
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
    const nested = row['matriculas'] as Array<{ count: number }> | undefined;
    const rest: Record<string, unknown> = { ...row };
    delete rest['matriculas'];
    return { ...(rest as unknown as Course), total_formandos: nested?.[0]?.count ?? 0 };
  });
}

export interface CoursePayload {
  nome: string;
  carga_horaria: number;
  tipo: CourseType;
  modelo_certificado: CertificateTemplate;
  data_abertura?: string | null;
  data_encerramento?: string | null;
  cancelado?: boolean;
}

export async function insertCourse(accessToken: string, userId: string, payload: CoursePayload): Promise<Course> {
  const client = scopedClient(accessToken);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client
      .from('cursos')
      .insert({
        nome: payload.nome,
        carga_horaria: payload.carga_horaria,
        tipo: payload.tipo,
        modelo_certificado: payload.modelo_certificado,
        codigo: generateCourseCode(),
        data_abertura: payload.data_abertura ?? null,
        data_encerramento: payload.data_encerramento ?? null,
        user_id: userId,
      })
      // Só o id: o campo calculado (status:estado_curso) não está disponível na
      // resposta de um insert; o curso completo é lido a seguir.
      .select('id')
      .maybeSingle();
    if (!error && data) return requireOwnedCourse(accessToken, userId, data.id as string);
    // Colisão de código (unique) -> tenta outro; outro erro -> propaga.
    if (error && error.code === '23505' && error.message.includes('codigo')) continue;
    if (error) {
      logDbError('Não foi possível criar o curso.', error);
      throw new HttpError(
        error.code === '42703' || error.code === 'PGRST204' ? 500 : 400,
        error.code === '42703' || error.code === 'PGRST204'
          ? 'A base de dados não está actualizada: aplique as migrações em falta.'
          : 'Não foi possível criar o curso.',
      );
    }
  }
  throw new HttpError(500, 'Não foi possível gerar um código único. Tente de novo.');
}

export async function patchCourse(
  accessToken: string,
  userId: string,
  courseId: string,
  patch: Partial<CoursePayload>,
): Promise<Course> {
  const current = await requireOwnedCourse(accessToken, userId, courseId);
  // Coerência das datas com os valores já guardados (o schema só compara as enviadas).
  const effective = {
    data_abertura: patch.data_abertura !== undefined ? patch.data_abertura : current.data_abertura,
    data_encerramento: patch.data_encerramento !== undefined ? patch.data_encerramento : current.data_encerramento,
  };
  if (!datesCoherent(effective)) throw new HttpError(400, DATES_INCOHERENT_MESSAGE);
  const client = scopedClient(accessToken);
  // Só passa a participação sem notas lançadas (a BD também o garante).
  if (patch.tipo === 'participacao' && current.tipo !== 'participacao') {
    const { count, error: countError } = await client
      .from('matriculas')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', courseId)
      .not('avaliacao', 'is', null);
    if (countError) throw new HttpError(500, 'Falha ao verificar as notas do curso.');
    if ((count ?? 0) > 0) {
      throw new HttpError(
        409,
        `Não é possível mudar para curso de participação: existem ${count} nota(s) lançada(s). Remova-as primeiro.`,
      );
    }
  }
  const body: Record<string, unknown> = {};
  if (patch.nome !== undefined) body['nome'] = patch.nome;
  if (patch.carga_horaria !== undefined) body['carga_horaria'] = patch.carga_horaria;
  if (patch.tipo !== undefined) body['tipo'] = patch.tipo;
  if (patch.modelo_certificado !== undefined) body['modelo_certificado'] = patch.modelo_certificado;
  if (patch.data_abertura !== undefined) body['data_abertura'] = patch.data_abertura ?? null;
  if (patch.data_encerramento !== undefined) body['data_encerramento'] = patch.data_encerramento ?? null;
  if (patch.cancelado !== undefined) body['cancelado'] = patch.cancelado;
  const { data, error } = await client
    .from('cursos')
    .update(body)
    .eq('id', courseId)
    .eq('user_id', userId)
    .select('id') // ver insertCourse: o estado calculado é lido a seguir
    .maybeSingle();
  if (error) throw dbError(error, 409, 'Não foi possível actualizar o curso.');
  if (!data) throw new HttpError(404, 'Curso não encontrado.');
  return requireOwnedCourse(accessToken, userId, courseId);
}

/**
 * Elimina o curso de forma atómica (função SQL remover_curso): remove as
 * matrículas, preserva formandos com matrículas noutros cursos e limpa apenas
 * os órfãos do próprio utilizador.
 */
export async function removeCourse(
  accessToken: string,
  userId: string,
  courseId: string,
): Promise<{ removedMatriculas: number; removedOrphanFormandos: number }> {
  await requireOwnedCourse(accessToken, userId, courseId);
  const client = scopedClient(accessToken);
  const { data, error } = await client.rpc('remover_curso', { p_curso_id: courseId });
  if (error) throw dbError(error, 409, 'Não foi possível excluir o curso.');
  const result = data as { removed_matriculas?: number; removed_orphan_formandos?: number } | null;
  return {
    removedMatriculas: result?.removed_matriculas ?? 0,
    removedOrphanFormandos: result?.removed_orphan_formandos ?? 0,
  };
}

// --- Formandos (registo central, propriedade directa) -------------------------

export async function requireOwnedTrainee(accessToken: string, userId: string, traineeId: string) {
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('formandos')
    .select('id, nome, email, contacto, user_id, created_at, updated_at')
    .eq('id', traineeId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao consultar o formando.');
  if (!data) throw new HttpError(404, 'Formando não encontrado.');
  const trainee = data as Trainee;
  if (trainee.user_id !== userId) throw new HttpError(404, 'Formando não encontrado.');
  return trainee;
}

export async function listTrainees(accessToken: string, userId: string, q?: string): Promise<Trainee[]> {
  const client = scopedClient(accessToken);
  let query = client
    .from('formandos')
    .select('id, nome, email, contacto, user_id, created_at, updated_at, matriculas(cursos(id, nome))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const term = q?.trim();
  if (term) query = query.ilike('nome', `%${term.replace(/[%_]/g, '')}%`);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'Falha ao listar formandos.');
  // Achata as matrículas em `cursos` (usado pela pesquisa global para abrir o curso certo).
  type Row = Omit<Trainee, 'cursos'> & {
    matriculas?: Array<{ cursos: { id: string; nome: string } | Array<{ id: string; nome: string }> | null }>;
  };
  return ((data ?? []) as unknown as Row[]).map(({ matriculas, ...t }) => ({
    ...t,
    cursos: (matriculas ?? []).flatMap((m) => (Array.isArray(m.cursos) ? m.cursos : m.cursos ? [m.cursos] : [])),
  }));
}

export interface TraineePayload {
  nome: string;
  email?: string | null;
  contacto?: string | null;
}

export async function insertTrainee(
  accessToken: string,
  userId: string,
  payload: TraineePayload,
): Promise<Trainee> {
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('formandos')
    .insert({
      nome: payload.nome,
      email: payload.email ?? null,
      contacto: payload.contacto ?? null,
      user_id: userId,
    })
    .select('id, nome, email, contacto, user_id, created_at, updated_at')
    .maybeSingle();
  if (error || !data) throw new HttpError(400, 'Não foi possível registar o formando.');
  return data as Trainee;
}

export async function patchTrainee(
  accessToken: string,
  userId: string,
  traineeId: string,
  patch: Partial<TraineePayload>,
): Promise<Trainee> {
  await requireOwnedTrainee(accessToken, userId, traineeId);
  const client = scopedClient(accessToken);
  const body: Record<string, unknown> = {};
  if (patch.nome !== undefined) body['nome'] = patch.nome;
  if (patch.email !== undefined) body['email'] = patch.email ?? null;
  if (patch.contacto !== undefined) body['contacto'] = patch.contacto ?? null;
  const { data, error } = await client
    .from('formandos')
    .update(body)
    .eq('id', traineeId)
    .eq('user_id', userId)
    .select('id, nome, email, contacto, user_id, created_at, updated_at')
    .maybeSingle();
  if (error || !data) throw new HttpError(400, 'Não foi possível actualizar o formando.');
  return data as Trainee;
}

// --- Matrículas (ligação N:N + avaliação por curso) ----------------------------

const ENROLL_VIEW =
  'id, formando_id, curso_id, avaliacao, created_at, formandos!inner(id, nome, email, contacto), certificados(id, codigo, estado)';

interface EnrollmentRow {
  id: string;
  formando_id: string;
  curso_id: string;
  avaliacao: number | null;
  created_at: string;
  formandos: { id: string; nome: string; email: string | null; contacto: string | null };
  certificados?: Array<{ id: string; codigo: string; estado: string }>;
}

function toView(row: EnrollmentRow): EnrollmentView {
  const activo = (row.certificados ?? []).find((c) => c.estado === 'emitido');
  return {
    matricula_id: row.id,
    formando_id: row.formando_id,
    curso_id: row.curso_id,
    nome: row.formandos.nome,
    email: row.formandos.email,
    contacto: row.formandos.contacto,
    avaliacao: row.avaliacao,
    matriculado_em: row.created_at,
    certificado: activo ? { id: activo.id, codigo: activo.codigo } : null,
  };
}

export async function listEnrollments(
  accessToken: string,
  userId: string,
  courseId: string,
): Promise<EnrollmentView[]> {
  await requireOwnedCourse(accessToken, userId, courseId);
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('matriculas')
    .select(ENROLL_VIEW)
    .eq('curso_id', courseId)
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'Falha ao listar formandos.');
  return ((data ?? []) as unknown as EnrollmentRow[]).map(toView);
}

/** Matricula um formando JÁ registado. 409 se já estiver neste curso. */
export async function enrollExisting(
  accessToken: string,
  userId: string,
  courseId: string,
  formandoId: string,
): Promise<EnrollmentView> {
  await requireOwnedCourse(accessToken, userId, courseId);
  await requireOwnedTrainee(accessToken, userId, formandoId);
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('matriculas')
    .insert({ formando_id: formandoId, curso_id: courseId })
    .select(ENROLL_VIEW)
    .maybeSingle();
  if (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'Este formando já está matriculado neste curso.');
    }
    throw new HttpError(400, 'Não foi possível matricular o formando.');
  }
  if (!data) throw new HttpError(400, 'Não foi possível matricular o formando.');
  return toView(data as unknown as EnrollmentRow);
}

/** Cria um novo formando e matricula-o no curso (com avaliação opcional). */
export async function enrollNew(
  accessToken: string,
  userId: string,
  courseId: string,
  payload: TraineePayload & { avaliacao?: number | null },
): Promise<EnrollmentView> {
  const course = await requireOwnedCourse(accessToken, userId, courseId);
  if (course.tipo === 'participacao' && payload.avaliacao != null) {
    throw new HttpError(400, NO_GRADES_MESSAGE);
  }
  const trainee = await insertTrainee(accessToken, userId, payload);
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('matriculas')
    .insert({
      formando_id: trainee.id,
      curso_id: courseId,
      avaliacao: payload.avaliacao ?? null,
    })
    .select(ENROLL_VIEW)
    .maybeSingle();
  if (error || !data) {
    // Compensação: evita formando órfão se a matrícula falhar.
    await client.from('formandos').delete().eq('id', trainee.id).eq('user_id', userId);
    throw new HttpError(400, 'Não foi possível matricular o formando.');
  }
  return toView(data as unknown as EnrollmentRow);
}

async function requireOwnedEnrollment(accessToken: string, userId: string, matriculaId: string) {
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('matriculas')
    .select('id, formando_id, curso_id, cursos!inner(id, user_id, tipo)')
    .eq('id', matriculaId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao consultar a matrícula.');
  if (!data) throw new HttpError(404, 'Matrícula não encontrada.');
  const row = data as unknown as {
    id: string;
    formando_id: string;
    curso_id: string;
    cursos: { user_id: string; tipo: CourseType };
  };
  if (!row.cursos || row.cursos.user_id !== userId) throw new HttpError(404, 'Matrícula não encontrada.');
  return row;
}

/** Actualiza apenas a avaliação da matrícula (não toca nos dados pessoais). */
export async function patchEnrollment(
  accessToken: string,
  userId: string,
  matriculaId: string,
  avaliacao: number | null,
): Promise<EnrollmentView> {
  const enrollment = await requireOwnedEnrollment(accessToken, userId, matriculaId);
  if (enrollment.cursos.tipo === 'participacao' && avaliacao !== null) {
    throw new HttpError(400, NO_GRADES_MESSAGE);
  }
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('matriculas')
    .update({ avaliacao })
    .eq('id', matriculaId)
    .select(ENROLL_VIEW)
    .maybeSingle();
  if (error) throw dbError(error, 409, 'Não foi possível actualizar a avaliação.');
  if (!data) throw new HttpError(400, 'Não foi possível actualizar a avaliação.');
  return toView(data as unknown as EnrollmentRow);
}

/**
 * Cancela a matrícula de forma atómica (função SQL remover_matricula):
 * Caso A — era a última: remove também o formando e devolve removedFormando.
 * Caso B — tem outras: preserva formando e restantes matrículas.
 */
export async function removeEnrollment(
  accessToken: string,
  userId: string,
  matriculaId: string,
): Promise<{ removedFormando: boolean; remainingCourses: number }> {
  await requireOwnedEnrollment(accessToken, userId, matriculaId);
  const client = scopedClient(accessToken);
  const { data, error } = await client.rpc('remover_matricula', { p_matricula_id: matriculaId });
  if (error) throw dbError(error, 409, 'Não foi possível excluir a matrícula.');
  const result = data as { removed_formando?: boolean; remaining_courses?: number } | null;
  return {
    removedFormando: result?.removed_formando ?? false,
    remainingCourses: result?.remaining_courses ?? 0,
  };
}
