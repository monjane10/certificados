import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Search, User, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { courseService, traineeService } from '../../services/courses';
import type { Course, Profile } from '../../types';

export type SearchScope = 'user' | 'admin';

interface PageLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface Result {
  key: string;
  group: string;
  title: string;
  subtitle?: string;
  to: string;
  icon: LucideIcon;
}

const MIN_CHARS = 2;
const LIMIT = 5;
const DEBOUNCE_MS = 250;

/** Remove caracteres com significado nos filtros do PostgREST. */
function sanitize(q: string) {
  return q.replace(/[%_,()*\\]/g, '').trim();
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const SEARCH_PLACEHOLDER: Record<SearchScope, string> = {
  user: 'Pesquisar cursos, formandos...',
  admin: 'Pesquisar utilizadores...',
};

export function GlobalSearch({ scope, pages, autoFocus = false }: { scope: SearchScope; pages: PageLink[]; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<Course[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<Result[]>([]);
  const [failed, setFailed] = useState(false);

  const term = query.trim();

  // Páginas: filtradas localmente desde o primeiro carácter.
  const pageResults = useMemo<Result[]>(() => {
    if (!term) return [];
    const n = normalize(term);
    return pages
      .filter((p) => normalize(p.label).includes(n))
      .map((p) => ({ key: `p:${p.to}`, group: 'Páginas', title: p.label, to: p.to, icon: p.icon }));
  }, [pages, term]);

  // Dados: cursos/formandos (utilizador) ou utilizadores (admin), com debounce.
  useEffect(() => {
    const q = sanitize(term);
    if (q.length < MIN_CHARS) {
      setRemote([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = scope === 'user' ? await searchUserData(q, coursesRef) : await searchAdminData(q);
        if (!cancelled) {
          setRemote(results);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setRemote([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, scope]);

  const results = useMemo(() => [...pageResults, ...remote], [pageResults, remote]);

  useEffect(() => setActive(-1), [results]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function go(to: string) {
    setOpen(false);
    setQuery('');
    navigate(to);
  }

  /** Enter sem resultado seleccionado: abre a lista completa filtrada. */
  function fallbackTarget() {
    const q = encodeURIComponent(term);
    return scope === 'user' ? `/app/cursos?q=${q}` : `/admin/utilizadores?q=${q}`;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && results[active]) go(results[active].to);
      else if (term) go(fallbackTarget());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showPanel = open && term.length > 0;
  const waitingMore = sanitize(term).length < MIN_CHARS;

  return (
    <div ref={boxRef} className="relative w-full">
      <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink" aria-hidden />
      <input
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label={SEARCH_PLACEHOLDER[scope]}
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={SEARCH_PLACEHOLDER[scope]}
        className="h-9 w-full rounded-control border border-line bg-white pl-10 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-soft"
      />

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-card border border-line bg-white p-1.5 shadow-menu md:left-auto md:w-[360px]">
          <ul id={listId} role="listbox" aria-label="Resultados da pesquisa">
            {results.map((r, i) => {
              const Icon = r.icon;
              const first = i === 0 || results[i - 1].group !== r.group;
              return (
                <li key={r.key} role="presentation">
                  {first && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">{r.group}</p>}
                  <button
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.to)}
                    className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left ${i === active ? 'bg-soft' : ''}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-ink" aria-hidden>
                      <Icon size={16} strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {loading && <p className="px-2.5 py-2 text-xs text-muted">A pesquisar...</p>}
          {!loading && failed && <p className="px-2.5 py-2 text-xs text-muted">Não foi possível pesquisar agora. Tente de novo.</p>}
          {!loading && !failed && results.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-muted">
              {waitingMore ? `Escreva pelo menos ${MIN_CHARS} caracteres.` : 'Sem resultados.'}
            </p>
          )}
          {!waitingMore && (
            <p className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[11px] text-muted">
              Enter para ver todos os {scope === 'user' ? 'cursos' : 'utilizadores'} com «{term}»
            </p>
          )}
        </div>
      )}
    </div>
  );
}

async function searchUserData(q: string, coursesRef: { current: Course[] | null }): Promise<Result[]> {
  const n = normalize(q);
  // A lista de cursos é pequena: carrega uma vez e filtra localmente por nome ou código.
  const [courses, trainees] = await Promise.all([
    coursesRef.current ? Promise.resolve(coursesRef.current) : courseService.list(),
    traineeService.search(q),
  ]);
  coursesRef.current = courses;

  const courseResults: Result[] = courses
    .filter((c) => normalize(c.nome).includes(n) || normalize(c.codigo).includes(n))
    .slice(0, LIMIT)
    .map((c) => ({
      key: `c:${c.id}`,
      group: 'Cursos',
      title: c.nome,
      subtitle: `${c.codigo} · ${c.total_formandos ?? 0} formando(s)`,
      to: `/app/cursos/${c.id}`,
      icon: GraduationCap,
    }));

  const traineeResults: Result[] = trainees.slice(0, LIMIT).map((t) => {
    const cursos = t.cursos ?? [];
    const first = cursos[0];
    return {
      key: `f:${t.id}`,
      group: 'Formandos',
      title: t.nome,
      subtitle: first
        ? `Em ${first.nome}${cursos.length > 1 ? ` e mais ${cursos.length - 1}` : ''}`
        : t.email ?? t.contacto ?? undefined,
      // Abre o curso já filtrado pelo nome do formando.
      to: first ? `/app/cursos/${first.id}?q=${encodeURIComponent(t.nome)}` : `/app/cursos`,
      icon: Users,
    };
  });

  return [...courseResults, ...traineeResults];
}

async function searchAdminData(q: string): Promise<Result[]> {
  // RLS: apenas admins lêem todos os perfis (policy profiles_admin_all).
  const { data, error } = await supabase
    .from('profiles')
    .select('id, code, email, organization_name')
    .or(`organization_name.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Pick<Profile, 'id' | 'code' | 'email' | 'organization_name'>[]).map((u) => ({
    key: `u:${u.id}`,
    group: 'Utilizadores',
    title: u.organization_name,
    subtitle: [u.code, u.email].filter(Boolean).join(' · '),
    to: `/admin/utilizadores?q=${encodeURIComponent(u.code)}`,
    icon: User,
  }));
}
