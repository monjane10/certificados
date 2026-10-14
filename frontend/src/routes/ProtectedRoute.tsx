import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/ui/Spinner';
import type { Role } from '../types';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, profile, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) return <div className="mx-auto max-w-6xl p-6"><Spinner label="A verificar sessão…" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Conta criada mas email ainda por confirmar / perfil ainda a ser criado.
  if (!profile) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold text-brand-950">A finalizar a sua conta…</h1>
        <p className="mt-2 text-sm text-slate-600">
          {profileError ?? 'O seu perfil está a ser criado. Se confirmou o email recentemente, aguarde uns segundos e recarregue a página.'}
        </p>
        <button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white">
          Recarregar
        </button>
      <Toaster richColors closeButton position="top-right" />
      </div>
    );
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/nao-autorizado" replace />;
  }

  return (
    <>
      <Outlet />
      <Toaster richColors closeButton position="top-right" />
    </>
  );
}
