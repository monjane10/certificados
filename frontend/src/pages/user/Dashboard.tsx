import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  CircleHelp,
  FileBadge,
  GraduationCap,
  Lightbulb,
  Plus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { StatCard, formatCount } from '../../components/ui/Card';
import { courseService } from '../../services/courses';
import type { Course } from '../../types';
import bannerIllustration from '../../assets/banner-illustration.svg';

const SUPPORT_EMAIL = 'geral@microlegal.co.mz';
const RECENT_LIMIT = 3;

const panel = 'rounded-card border border-line bg-white px-5 pb-3.5 pt-3.5';
const panelTitle = 'text-base font-bold leading-tight tracking-tight text-ink';

function traineesLabel(n: number) {
  return `${n} ${n === 1 ? 'formando inscrito' : 'formandos inscritos'}`;
}

/** Miniatura do curso: não existe imagem de curso no modelo actual, por isso usa o padrão da marca. */
function CourseThumb() {
  return (
    <div className="relative aspect-[172/96] w-[88px] shrink-0 overflow-hidden rounded-control bg-ink sm:w-[96px]" aria-hidden>
      <svg viewBox="0 0 172 96" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" fill="none">
        <path d="M0 92 C60 80 104 50 128 0" stroke="#3E5C9E" strokeWidth="1" />
        <path d="M30 96 C88 82 128 52 150 0" stroke="#3E5C9E" strokeWidth="1" />
        <path d="M120 96 C140 84 160 74 172 70 V96Z" fill="#1B3272" />
      </svg>
      <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white">
        <GraduationCap size={12} strokeWidth={1.6} />
      </span>
    </div>
  );
}

function RecentCourseRow({ course }: { course: Course }) {
  const total = course.total_formandos ?? 0;
  return (
    <li className="flex flex-wrap items-center gap-4 py-2.5 sm:flex-nowrap sm:gap-4">
      <CourseThumb />
      <div className="min-w-0 flex-1">
        <Link to={`/app/cursos/${course.id}`} className="line-clamp-2 block break-words text-sm font-semibold text-ink hover:underline sm:line-clamp-1">
          {course.nome}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <Users size={14} strokeWidth={1.6} aria-hidden />
          {traineesLabel(total)}
        </p>
        {total === 0 && (
          <span className="mt-1 inline-flex whitespace-nowrap rounded-full bg-soft px-2 py-px text-[11px] font-medium text-ink">Sem inscrições</span>
        )}
      </div>
      <Link
        to={`/app/cursos/${course.id}`}
        className="inline-flex h-8 w-full shrink-0 items-center justify-center gap-2 rounded-control border border-line bg-white px-3.5 text-[13px] font-semibold text-ink transition hover:bg-soft sm:w-auto"
      >
        Gerir curso <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
      </Link>
    </li>
  );
}

function QuickLink({ to, icon: Icon, title, description }: { to: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-item border border-line px-3 py-2 transition hover:bg-soft/50">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-ink" aria-hidden>
        <Icon size={16} strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="block text-xs leading-4 text-muted">{description}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.6} className="shrink-0 text-ink" aria-hidden />
    </Link>
  );
}

export function UserDashboard() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await courseService.list();
        if (mounted) setCourses(list);
      } catch {
        if (mounted) setFailed(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const courseCount = courses?.length ?? null;
  const traineeCount = courses ? courses.reduce((acc, c) => acc + (c.total_formandos ?? 0), 0) : null;
  const recent = courses
    ? [...courses].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, RECENT_LIMIT)
    : [];

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden rounded-banner bg-soft md:min-h-[168px]">
        <div className="relative z-10 flex flex-col justify-center px-5 pb-2 pt-5 sm:px-8 md:min-h-[168px] md:max-w-[56%] md:py-4 lg:max-w-[58%]">
          <h1 className="font-serif text-[22px] font-bold leading-[1.05] tracking-[-0.01em] text-ink sm:text-[26px]">
            Partilhe conhecimento.
            <br />
            Crie oportunidades.
          </h1>
          <p className="mt-1.5 max-w-[380px] text-[13px] leading-relaxed text-muted sm:text-sm sm:leading-[1.4]">
            Gerencie os seus cursos, formandos e certificados, num só lugar, de forma simples e eficiente.
          </p>
          <Link
            to="/app/cursos/novo"
            className="mt-3 inline-flex h-9 items-center gap-2 self-start rounded-button bg-ink px-4 text-[13px] font-semibold text-white transition hover:bg-brand-950"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            Criar curso
          </Link>
        </div>
        <img
          src={bannerIllustration}
          alt=""
          className="mx-auto mt-2 block w-full max-w-[340px] px-3 md:absolute md:bottom-0 md:right-3 md:mx-0 md:mt-0 md:h-auto md:w-[42%] md:max-w-[380px] md:px-0 lg:h-[160px] lg:w-auto lg:max-w-[44%]"
        />
      </section>

      {/* Indicadores */}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <StatCard
          label="Meus cursos"
          value={failed ? '-' : formatCount(courseCount)}
          hint="Criar e gerir em Cursos"
          icon={<GraduationCap size={17} strokeWidth={1.6} />}
        />
        <StatCard
          label="Formandos inscritos"
          value={failed ? '-' : formatCount(traineeCount)}
          hint="Total nos seus cursos"
          icon={<Users size={17} strokeWidth={1.6} />}
        />
        <StatCard
          label="Certificados"
          value={formatCount(0)}
          hint="Emissão em próximas sprints"
          icon={<FileBadge size={17} strokeWidth={1.6} />}
        />
      </div>

      {/* Área inferior */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[2fr_1fr]">
        <section className={panel}>
          <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
            <h2 className={panelTitle}>Cursos recentes</h2>
            <Link to="/app/cursos" className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-ink hover:underline">
              Ver todos <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>

          {failed ? (
            <p className="py-8 text-center text-sm text-muted">Não foi possível carregar os seus cursos. Tente recarregar a página.</p>
          ) : courses === null ? (
            <p className="py-8 text-center text-sm text-muted">A carregar cursos...</p>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-start gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-ink">Ainda sem cursos</p>
                <p className="mt-1 text-sm text-muted">Crie o seu primeiro curso para começar a registar formandos.</p>
              </div>
              <Link
                to="/app/cursos/novo"
                className="inline-flex h-9 items-center gap-2 rounded-control border border-line px-4 text-sm font-semibold text-ink hover:bg-soft"
              >
                <Plus size={17} strokeWidth={1.75} aria-hidden /> Criar curso
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line border-b border-line">
              {recent.map((c) => (
                <RecentCourseRow key={c.id} course={c} />
              ))}
            </ul>
          )}

          {courses && courses.length > 0 && traineeCount === 0 && (
            <div className="mt-2.5 flex flex-col gap-3 rounded-item bg-soft px-3.5 py-1.5 sm:min-h-[40px] sm:flex-row sm:items-center">
              <span className="flex flex-1 items-center gap-3 text-[13px] text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70" aria-hidden>
                  <Lightbulb size={14} strokeWidth={1.6} />
                </span>
                O próximo passo é trazer os seus formandos.
              </span>
              <Link to="/app/cursos" className="inline-flex items-center gap-2 self-end text-[13px] font-semibold text-ink hover:underline sm:self-auto">
                Abrir cursos <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
              </Link>
            </div>
          )}
        </section>

        <section className={panel}>
          <h2 className={panelTitle}>Acesso rápido</h2>
          <div className="mt-2.5 grid gap-2 md:grid-cols-2 lg:grid-cols-1">
            <QuickLink
              to="/app/cursos"
              icon={Users}
              title="Gerir formandos"
              description="Adicione e acompanhe as inscrições nos seus cursos."
            />
            <QuickLink
              to="/app/certificados"
              icon={FileBadge}
              title="Consultar certificados"
              description="Emissão disponível em breve."
            />
          </div>
          <div className="mt-2.5">
            <p className="flex items-center gap-2 border-t border-line pt-2.5 text-[13px] text-muted">
              <CircleHelp size={15} strokeWidth={1.6} className="shrink-0" aria-hidden />
              <span>
                Precisa de ajuda?{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
                  Fale connosco <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                </a>
              </span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
