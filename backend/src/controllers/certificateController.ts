import type { Request, Response } from 'express';
import {
  CERT_CODE_RE,
  annulCertificate,
  emitCertificates,
  listCertificates,
  verifyCertificate,
} from '../services/certificateService.js';
import { HttpError } from '../services/courseService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ctx(req: Request) {
  return { token: req.authToken ?? '', userId: req.authUser?.id ?? '' };
}

function fail(res: Response, e: unknown, fallback: string) {
  if (e instanceof HttpError) {
    res.status(e.status).json({ error: e.message });
    return;
  }
  res.status(500).json({ error: fallback });
}

export async function getCertificates(req: Request, res: Response) {
  const cursoId = typeof req.query['curso_id'] === 'string' ? req.query['curso_id'] : undefined;
  if (cursoId !== undefined && !UUID_RE.test(cursoId)) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  try {
    const { token, userId } = ctx(req);
    res.json({ certificates: await listCertificates(token, userId, cursoId) });
  } catch (e) {
    fail(res, e, 'Falha ao listar certificados.');
  }
}

export async function postCourseCertificates(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  try {
    const { token, userId } = ctx(req);
    const summary = await emitCertificates(token, userId, req.params['id'] as string);
    res.status(201).json({ summary });
  } catch (e) {
    fail(res, e, 'Não foi possível emitir os certificados.');
  }
}

export async function postAnnulCertificate(req: Request, res: Response) {
  if (!UUID_RE.test(req.params['id'] ?? '')) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  try {
    const { token } = ctx(req);
    const certificate = await annulCertificate(token, req.params['id'] as string, req.body.motivo);
    res.json({ certificate });
  } catch (e) {
    fail(res, e, 'Não foi possível anular o certificado.');
  }
}

export async function getPublicCertificate(req: Request, res: Response) {
  const codigo = String(req.params['codigo'] ?? '').trim().toUpperCase();
  if (!CERT_CODE_RE.test(codigo)) {
    res.status(404).json({ error: 'Certificado não encontrado. Confirme o código.' });
    return;
  }
  try {
    const certificate = await verifyCertificate(codigo);
    if (!certificate) {
      res.status(404).json({ error: 'Certificado não encontrado. Confirme o código.' });
      return;
    }
    res.json({ certificate });
  } catch (e) {
    fail(res, e, 'Falha ao verificar o certificado.');
  }
}
