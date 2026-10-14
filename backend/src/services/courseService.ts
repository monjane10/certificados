import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import type { Course, CourseWithCount, EnrollmentView, Trainee } from '../types/index.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCourseCode(): string {
  let code = 'CUR-';
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

function scopedClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Verifica que o curso existe e pertence ao utilizador do token (RLS + check explícito). */
export async function requireOwnedCourse(accessToken: string, userId: string, courseId: string) {
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('cursos')
    .select('id, nome, carga_horaria, codigo, data_abertura, data_encerramento, status, user_id, created_at, updated_at')
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao consultar o curso.');
  if (!data) throw new HttpError(404, 'Curso não encontrado.');
  const course = data as Course;
  if (course.user_id !== userId) throw new HttpError(404, 'Curso não encontrado.');
  return course;
}

export async function listCourses(accessToken: string, userId: string): Promise<CourseWithCount[]> {
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('cursos')
    .select('id, nome, carga_horaria, codigo, data_abertura, data_encerramento, status, user_id, created_at, updated_at, matriculas(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'Falha ao listar cursos.');
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
  data_abertura?: string;
  data_encerramento?: string;
  status: string;
}

export async function insertCourse(accessToken: string, userId: string, payload: CoursePayload): Promise<Course> {
  const client = scopedClient(accessToken);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client
      .from('cursos')
      .insert({
        nome: payload.nome,
        carga_horaria: payload.carga_horaria,
        codigo: generateCourseCode(),
        data_abertura: payload.data_abertura ?? null,
        data_encerramento: payload.data_encerramento ?? null,
        status: payload.status,
        user_id: userId,
      })
      .select('id, nome, carga_horaria, codigo, data_abertura, data_encerramento, status, user_id, created_at, updated_at')
      .maybeSingle();
    if (!error && data) return data as Course;
    // Colisão de código (unique) -> tenta outro; outro erro -> propaga.
    if (error && error.code === '23505' && error.message.includes('codigo')) continue;
    if (error) throw new HttpError(400, 'Não foi possível criar o curso.');
  }
  throw new HttpError(500, 'Não foi possível gerar um código único. Tente de novo.');
}

export async function patchCourse(
  accessToken: string,
  userId: string,
  courseId: string,
  patch: Partial<CoursePayload>,
): Promise<Course> {
  await requireOwnedCourse(accessToken, userId, courseId);
  const client = scopedClient(accessToken);
  const body: Record<string, unknown> = {};
  if (patch.nome !== undefined) body['nome'] = patch.nome;
  if (patch.carga_horaria !== undefined) body['carga_horaria'] = patch.carga_horaria;
  if (patch.data_abertura !== undefined) body['data_abertura'] = patch.data_abertura ?? null;
  if (patch.data_encerramento !== undefined) body['data_encerramento'] = patch.data_encerramento ?? null;
  if (patch.status !== undefined) body['status'] = patch.status;
  const { data, error } = await client
    .from('cursos')
    .update(body)
    .eq('id', courseId)
    .eq('user_id', userId)
    .select('id, nome, carga_horaria, codigo, data_abertura, data_encerramento, status, user_id, created_at, updated_at')
    .maybeSingle();
  if (error) throw new HttpError(400, 'Não foi possível actualizar o curso.');
  if (!data) throw new HttpError(404, 'Curso não encontrado.');
  return data as Course;
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
  if (error) throw new HttpError(400, 'Não foi possível excluir o curso.');
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
  email?: string;
  contacto?: string;
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
  'id, formando_id, curso_id, avaliacao, created_at, formandos!inner(id, nome, email, contacto)';

interface EnrollmentRow {
  id: string;
  formando_id: string;
  curso_id: string;
  avaliacao: number | null;
  created_at: string;
  formandos: { id: string; nome: string; email: string | null; contacto: string | null };
}

function toView(row: EnrollmentRow): EnrollmentView {
  return {
    matricula_id: row.id,
    formando_id: row.formando_id,
    curso_id: row.curso_id,
    nome: row.formandos.nome,
    email: row.formandos.email,
    contacto: row.formandos.contacto,
    avaliacao: row.avaliacao,
    matriculado_em: row.created_at,
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
  await requireOwnedCourse(accessToken, userId, courseId);
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
    .select('id, formando_id, curso_id, cursos!inner(id, user_id)')
    .eq('id', matriculaId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao consultar a matrícula.');
  if (!data) throw new HttpError(404, 'Matrícula não encontrada.');
  const row = data as unknown as { id: string; formando_id: string; curso_id: string; cursos: { user_id: string } };
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
  await requireOwnedEnrollment(accessToken, userId, matriculaId);
  const client = scopedClient(accessToken);
  const { data, error } = await client
    .from('matriculas')
    .update({ avaliacao })
    .eq('id', matriculaId)
    .select(ENROLL_VIEW)
    .maybeSingle();
  if (error || !data) throw new HttpError(400, 'Não foi possível actualizar a avaliação.');
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
  if (error) throw new HttpError(400, 'Não foi possível excluir a matrícula.');
  const result = data as { removed_formando?: boolean; remaining_courses?: number } | null;
  return {
    removedFormando: result?.removed_formando ?? false,
    remainingCourses: result?.remaining_courses ?? 0,
  };
}
