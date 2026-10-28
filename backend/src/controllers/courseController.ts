import type { Request, Response } from 'express';
import { enrollExistingSchema, enrollNewSchema } from '../schemas/trainee.js';
import {
  HttpError,
  closeCourse,
  enrollExisting,
  enrollNew,
  insertCourse,
  listCourses,
  listEnrollments,
  listTrainees,
  patchCourse,
  patchEnrollment,
  patchTrainee,
  removeCourse,
  removeEnrollment,
  reopenCourse,
  requireOwnedCourse,
} from '../services/courseService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ctx(req: Request) {
  return { token: req.authToken ?? '', userId: req.authUser?.id ?? '' };
}

function badId(res: Response) {
  res.status(400).json({ error: 'Identificador inválido.' });
}

function fail(res: Response, e: unknown, fallback: string) {
  if (e instanceof HttpError) {
    res.status(e.status).json({ error: e.message });
    return;
  }
  res.status(500).json({ error: fallback });
}

// --- Cursos ---------------------------------------------------------------

export async function getCourses(req: Request, res: Response) {
  try {
    const { token, userId } = ctx(req);
    res.json({ courses: await listCourses(token, userId) });
  } catch (e) {
    fail(res, e, 'Falha ao listar cursos.');
  }
}

export async function postCourse(req: Request, res: Response) {
  try {
    const { token, userId } = ctx(req);
    // user_id/codigo do corpo são ignorados: propriedade vem do token.
    const course = await insertCourse(token, userId, req.body);
    res.status(201).json({ course });
  } catch (e) {
    fail(res, e, 'Não foi possível criar o curso.');
  }
}

export async function getCourse(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const id = req.params['id'] as string;
    const course = await requireOwnedCourse(token, userId, id);
    const enrollments = await listEnrollments(token, userId, id);
    res.json({ course: { ...course, total_formandos: enrollments.length }, enrollments });
  } catch (e) {
    fail(res, e, 'Falha ao consultar o curso.');
  }
}

export async function patchCourseById(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const course = await patchCourse(token, userId, req.params['id'] as string, req.body);
    res.json({ course });
  } catch (e) {
    fail(res, e, 'Não foi possível actualizar o curso.');
  }
}

export async function postCloseCourse(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    res.json({ course: await closeCourse(token, userId, req.params['id'] as string) });
  } catch (e) {
    fail(res, e, 'Não foi possível encerrar o curso.');
  }
}

export async function postReopenCourse(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    res.json({ course: await reopenCourse(token, userId, req.params['id'] as string) });
  } catch (e) {
    fail(res, e, 'Não foi possível reabrir o curso.');
  }
}

export async function deleteCourseById(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const result = await removeCourse(token, userId, req.params['id'] as string);
    res.json({ ok: true, ...result });
  } catch (e) {
    fail(res, e, 'Não foi possível excluir o curso.');
  }
}

// --- Formandos (registo central) --------------------------------------------

export async function getTrainees(req: Request, res: Response) {
  try {
    const { token, userId } = ctx(req);
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    res.json({ trainees: await listTrainees(token, userId, q) });
  } catch (e) {
    fail(res, e, 'Falha ao listar formandos.');
  }
}

export async function patchTraineeById(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const trainee = await patchTrainee(token, userId, req.params['id'] as string, req.body);
    res.json({ trainee });
  } catch (e) {
    fail(res, e, 'Não foi possível actualizar o formando.');
  }
}

// --- Matrículas ---------------------------------------------------------------

export async function getEnrollments(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const enrollments = await listEnrollments(token, userId, req.params['id'] as string);
    res.json({ enrollments });
  } catch (e) {
    fail(res, e, 'Falha ao listar formandos.');
  }
}

export async function postEnrollment(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const courseId = req.params['id'] as string;
    // curso_id do corpo é ignorado: vem do path + propriedade verificada.
    if (req.body !== null && typeof req.body === 'object' && 'formando_id' in req.body) {
      const parsed = enrollExistingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors });
        return;
      }
      const enrollment = await enrollExisting(token, userId, courseId, parsed.data.formando_id);
      res.status(201).json({ enrollment });
      return;
    }
    const parsed = enrollNewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const enrollment = await enrollNew(token, userId, courseId, parsed.data);
    res.status(201).json({ enrollment });
  } catch (e) {
    fail(res, e, 'Não foi possível matricular o formando.');
  }
}

export async function patchEnrollmentById(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['matriculaId'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const enrollment = await patchEnrollment(
      token,
      userId,
      req.params['matriculaId'] as string,
      req.body?.avaliacao ?? null,
    );
    res.json({ enrollment });
  } catch (e) {
    fail(res, e, 'Não foi possível actualizar a avaliação.');
  }
}

export async function deleteEnrollmentById(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['matriculaId'] ?? '')) {
    badId(res);
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const result = await removeEnrollment(token, userId, req.params['matriculaId'] as string);
    res.json({ ok: true, ...result });
  } catch (e) {
    fail(res, e, 'Não foi possível excluir a matrícula.');
  }
}
