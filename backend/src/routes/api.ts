import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { publicVerifyLimiter, sensitiveLimiter } from '../middlewares/rateLimit.js';
import { validateBody } from '../middlewares/validate.js';
import { annulCertificateSchema } from '../schemas/certificate.js';
import {
  getCertificates,
  getPublicCertificate,
  postAnnulCertificate,
  postCourseCertificates,
} from '../controllers/certificateController.js';
import { updateProfileSchema } from '../schemas/profile.js';
import { createCourseSchema, updateCourseSchema } from '../schemas/course.js';
import {
  updateEnrollmentSchema,
  updateTraineePersonalSchema,
} from '../schemas/trainee.js';
import {
  deleteCourseById,
  deleteEnrollmentById,
  getCourse,
  getCourses,
  getEnrollments,
  getTrainees,
  patchCourseById,
  patchEnrollmentById,
  patchTraineeById,
  postCloseCourse,
  postCourse,
  postEnrollment,
  postReopenCourse,
} from '../controllers/courseController.js';
import {
  getMe,
  getOwnProfile,
  patchOwnProfile,
  adminOverview,
} from '../controllers/profileController.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'microlegal-certificados-server', time: new Date().toISOString() });
});

router.get('/me', sensitiveLimiter, authenticate, getMe);
router.get('/profile', sensitiveLimiter, authenticate, getOwnProfile);
router.patch('/profile', sensitiveLimiter, authenticate, validateBody(updateProfileSchema), patchOwnProfile);

// Exemplo de rota administrativa com autorização efectiva no backend.
router.get('/admin/overview', sensitiveLimiter, authenticate, requireRole('admin'), adminOverview);

// Sprint 2 - Cursos (propriedade sempre derivada do token; nunca de user_id do cliente).
router.get('/courses', authenticate, getCourses);
router.post('/courses', sensitiveLimiter, authenticate, validateBody(createCourseSchema), postCourse);
router.get('/courses/:id', authenticate, getCourse);
router.patch('/courses/:id', sensitiveLimiter, authenticate, validateBody(updateCourseSchema), patchCourseById);
router.delete('/courses/:id', sensitiveLimiter, authenticate, deleteCourseById);
// Encerrar congela o curso e as matrículas; só depois se emitem certificados.
router.post('/courses/:id/close', sensitiveLimiter, authenticate, postCloseCourse);
router.post('/courses/:id/reopen', sensitiveLimiter, authenticate, postReopenCourse);

// Sprint 2 (N:N) - Formandos (registo central) e matrículas.
// O curso_id vem sempre do path + propriedade verificada; nunca do corpo.
router.get('/trainees', authenticate, getTrainees);
router.patch('/trainees/:id', sensitiveLimiter, authenticate, validateBody(updateTraineePersonalSchema), patchTraineeById);
router.get('/courses/:id/trainees', authenticate, getEnrollments);
router.post('/courses/:id/trainees', sensitiveLimiter, authenticate, postEnrollment);
router.patch('/enrollments/:matriculaId', sensitiveLimiter, authenticate, validateBody(updateEnrollmentSchema), patchEnrollmentById);
router.delete('/enrollments/:matriculaId', sensitiveLimiter, authenticate, deleteEnrollmentById);

// Certificados: emissão em lote por curso, anulação e verificação pública.
router.get('/certificates', authenticate, getCertificates);
router.post('/courses/:id/certificates', sensitiveLimiter, authenticate, postCourseCertificates);
router.post('/certificates/:id/annul', sensitiveLimiter, authenticate, validateBody(annulCertificateSchema), postAnnulCertificate);
router.get('/public/certificates/:codigo', publicVerifyLimiter, getPublicCertificate);

export default router;
