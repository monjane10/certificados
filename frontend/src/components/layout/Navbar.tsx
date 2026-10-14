import { Link, useNavigate } from 'react-router-dom';
import { Award, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const dashboardHref = profile?.role === 'admin' ? '/admin' : '/app';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-900 text-white">
            <Award size={20} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-brand-950">Microlegal</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link to="/" className="hover:text-brand-900">Início</Link>
          <a href="/#vantagens" className="hover:text-brand-900">Vantagens</a>
          <a href="/#certificados" className="hover:text-brand-900">Certificados</a>
          <Link to="/verificar" className="hover:text-brand-900">Verificar</Link>
          <a href="/#faq" className="hover:text-brand-900">FAQ</a>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button onClick={() => navigate(dashboardHref)}>Abrir painel</Button>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50">
                Entrar
              </Link>
              <Button onClick={() => navigate('/registo')}>Criar conta</Button>
            </>
          )}
        </div>
        <button className="rounded-lg p-2 text-brand-950 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1 text-sm font-medium">
            <Link to="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-50">Início</Link>
            <Link to="/verificar" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-slate-50">Verificar certificado</Link>
            {user ? (
              <Button onClick={() => navigate(dashboardHref)}>Abrir painel</Button>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" onClick={() => setOpen(false)} className="flex-1"><Button variant="secondary" className="w-full">Entrar</Button></Link>
                <Link to="/registo" onClick={() => setOpen(false)} className="flex-1"><Button className="w-full">Criar conta</Button></Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
