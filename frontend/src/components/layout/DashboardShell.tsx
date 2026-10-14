import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Award, ChevronDown, LogOut, Menu, PanelLeft, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { GlobalSearch, type SearchScope } from './GlobalSearch';

export interface ShellLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

const COLLAPSED_KEY = 'ml.sidebar.collapsed';
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** Atalho igual ao do ChatGPT: Ctrl/⌘ + Shift + S. */
const SHORTCUT = IS_MAC ? '⇧⌘S' : 'Ctrl+Shift+S';

function isRoot(to: string) {
  return to === '/app' || to === '/admin';
}

/** Preferência por navegador; falha silenciosamente se o armazenamento estiver bloqueado. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

const DESKTOP_QUERY = '(min-width: 1024px)';

function useIsDesktop() {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return matches;
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    /* preferência apenas nesta sessão */
  }
}

function navClass(rail: boolean) {
  return ({ isActive }: { isActive: boolean }) =>
    `relative flex h-10 items-center overflow-hidden rounded-item text-[15px] transition ${
      rail ? 'justify-center' : 'gap-4 pl-4 pr-3'
    } ${
      isActive
        ? 'bg-soft font-semibold text-ink before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-ink'
        : 'text-ink/80 hover:bg-soft/60 hover:text-ink'
    }`;
}

function LogoMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ink text-white">
      <Award size={20} strokeWidth={1.75} />
    </span>
  );
}

/** Etiqueta escura ao passar o rato ou focar com o teclado, como no ChatGPT. */
function Tip({ label, hint, side = 'right', children }: { label: string; hint?: string; side?: 'right' | 'bottom'; children: ReactNode }) {
  const pos = side === 'right' ? 'left-full top-1/2 ml-2 -translate-y-1/2' : 'left-1/2 top-full mt-1.5 -translate-x-1/2';
  return (
    <div className="group/tip relative">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white group-hover/tip:block group-has-[:focus-visible]/tip:block ${pos}`}
      >
        {label}
        {hint && <span className="ml-2 text-white/60">{hint}</span>}
      </span>
    </div>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-soft font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

const toggleButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-control text-ink/70 transition hover:bg-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20';

export function DashboardShell({
  title,
  links,
  accountLinks = [],
  search,
  children,
}: {
  title: string;
  links: ShellLink[];
  /** Atalhos do menu da conta (header). */
  accountLinks?: ShellLink[];
  /** Âmbito da pesquisa global do header (disponível em todas as páginas da área). */
  search?: SearchScope;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const isDesktop = useIsDesktop();
  // Tablet (md): faixa de ícones sempre visível; a barra completa abre por cima.
  const railMode = !isDesktop || collapsed;
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const accountName = profile?.organization_name ?? user?.email ?? '';
  const accountCode = profile?.code ?? profile?.role ?? '';
  const current = [...links]
    .sort((a, b) => b.to.length - a.to.length)
    .find((l) => (isRoot(l.to) ? pathname === l.to || pathname === `${l.to}/` : pathname.startsWith(l.to)));

  // Fecha menus ao navegar.
  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Ctrl/⌘ + Shift + S: abre/fecha a barra lateral (desktop) ou o menu (ecrãs pequenos).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        setCollapsed((v) => {
          writeCollapsed(!v);
          return !v;
        });
      } else {
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function setCollapsedPersist(next: boolean) {
    setCollapsed(next);
    writeCollapsed(next);
  }

  /** Desktop: expande a barra; tablet: abre a barra completa por cima do conteúdo. */
  function openSidebar() {
    if (isDesktop) setCollapsedPersist(false);
    else setOpen(true);
  }

  /** Na barra fechada, clicar numa zona vazia abre-a (como no ChatGPT). */
  function onRailClick(e: ReactMouseEvent<HTMLElement>) {
    if (railMode && !(e.target as HTMLElement).closest('a,button')) openSidebar();
  }

  async function handleLogout() {
    if (leaving) return;
    setLeaving(true);
    try {
      await signOut();
      toast.success('Sessão terminada com sucesso.');
    } catch {
      toast.error('Falha ao terminar sessão. Tente de novo.');
      setLeaving(false);
      return;
    }
    navigate('/', { replace: true });
  }

  /** `full`/`rail`: desktop aberto/fechado; `drawer`: menu em ecrãs pequenos. */
  function renderSidebar(mode: 'full' | 'rail' | 'drawer') {
    const rail = mode === 'rail';
    return (
      <>
        <div className={`flex h-header shrink-0 items-center ${rail ? 'justify-center' : 'justify-between pl-6 pr-3'}`}>
          {rail ? (
            <Tip label="Abrir barra lateral" hint={SHORTCUT}>
              {/* Logótipo que passa a ícone de abrir ao passar o rato. */}
              <button
                onClick={openSidebar}
                className="group/open flex h-9 w-9 cursor-e-resize items-center justify-center rounded-[10px] focus-visible:outline-none"
                aria-label="Abrir barra lateral"
                aria-expanded={false}
              >
                <span className="group-hover/open:hidden group-focus-visible/open:hidden">
                  <LogoMark />
                </span>
                <span className={`hidden bg-soft group-hover/open:flex group-focus-visible/open:flex ${toggleButtonClass}`}>
                  <PanelLeft size={20} strokeWidth={1.6} />
                </span>
              </button>
            </Tip>
          ) : (
            <>
              <Link to="/" className="flex items-center gap-3" aria-label="Microlegal - página inicial">
                <LogoMark />
                <span className="text-xl font-bold tracking-tight text-ink">Microlegal</span>
              </Link>
              <Tip label="Fechar barra lateral" hint={mode === 'full' ? SHORTCUT : undefined} side="bottom">
                <button
                  onClick={() => (mode === 'drawer' ? setOpen(false) : setCollapsedPersist(true))}
                  className={`${toggleButtonClass} cursor-w-resize`}
                  aria-label="Fechar barra lateral"
                  aria-expanded
                >
                  <PanelLeft size={20} strokeWidth={1.6} />
                </button>
              </Tip>
            </>
          )}
        </div>
        {rail ? (
          <div className="mx-4 mb-2 mt-5 h-px bg-line" aria-hidden />
        ) : (
          <p className="mb-2 mt-5 px-7 text-[11px] font-medium uppercase tracking-wide text-muted">Espaço de trabalho</p>
        )}
        <nav className="space-y-1 px-3" aria-label="Espaço de trabalho">
          {links.map(({ to, label, icon: Icon }) => {
            const item = (
              <NavLink to={to} end={isRoot(to)} className={navClass(rail)}>
                <Icon size={19} strokeWidth={1.6} aria-hidden />
                <span className={rail ? 'sr-only' : undefined}>{label}</span>
              </NavLink>
            );
            return rail ? (
              <Tip key={to} label={label}>
                {item}
              </Tip>
            ) : (
              <div key={to}>{item}</div>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Sidebar desktop */}
      <aside
        onClick={onRailClick}
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-white transition-[width] duration-200 md:flex ${
          railMode ? 'w-[72px] cursor-e-resize' : 'w-sidebar'
        }`}
      >
        {renderSidebar(railMode ? 'rail' : 'full')}
      </aside>

      {/* Sidebar mobile (recolhível) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/20" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(232px,85vw)] flex-col overflow-y-auto border-r border-line bg-white">
            {renderSidebar('drawer')}
          </aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 md:pl-[72px] ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-sidebar'}`}>
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-line bg-white">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-header lg:px-gutter">
            <button
              className="-ml-1 shrink-0 rounded-control p-2 text-ink hover:bg-soft md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir barra lateral"
            >
              <Menu size={22} />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm sm:gap-2.5 sm:text-[15px]">
              <span className="shrink-0 text-muted">{title}</span>
              <span className="shrink-0 text-muted/70" aria-hidden>/</span>
              <span className="truncate font-semibold text-ink">{current?.label ?? title}</span>
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-6">
              {search && (
                <>
                  <div className="hidden w-[280px] md:block">
                    <GlobalSearch scope={search} pages={links} />
                  </div>
                  <span className="hidden h-7 w-px bg-line md:block" aria-hidden />
                </>
              )}

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-control py-1 pl-1 pr-1 text-left hover:bg-soft/60 sm:gap-3 sm:pr-2"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <Avatar name={accountName} size={36} />
                  <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-[180px] truncate text-sm font-bold leading-tight text-ink">{accountName}</span>
                    <span className="block max-w-[180px] truncate text-xs leading-tight text-muted">{accountCode}</span>
                  </span>
                  <ChevronDown size={18} strokeWidth={1.75} className={`shrink-0 text-ink transition ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-56 rounded-card border border-line bg-white p-1.5 shadow-menu">
                    <div className="border-b border-line px-3 pb-2 pt-1.5 sm:hidden">
                      <p className="truncate text-sm font-bold text-ink">{accountName}</p>
                      <p className="truncate text-xs text-muted">{accountCode}</p>
                    </div>
                    {accountLinks.map(({ to, label, icon: Icon }) => (
                      <Link key={to} to={to} role="menuitem" className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm text-ink hover:bg-soft">
                        <Icon size={18} strokeWidth={1.6} aria-hidden />
                        {label}
                      </Link>
                    ))}
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      disabled={leaving}
                      className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm text-ink hover:bg-soft disabled:cursor-wait disabled:opacity-60"
                    >
                      <LogOut size={18} strokeWidth={1.6} aria-hidden />
                      {leaving ? 'A sair...' : 'Terminar sessão'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {search && (
            <div className="px-4 pb-3 sm:px-6 md:hidden">
              <GlobalSearch scope={search} pages={links} />
            </div>
          )}
        </header>

        <main className="min-w-0 px-4 pb-6 pt-4 sm:px-6 lg:px-gutter lg:pb-4 lg:pt-4">
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
