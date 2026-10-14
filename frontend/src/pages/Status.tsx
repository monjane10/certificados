import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center animate-fade-up">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Erro 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-950">Página não encontrada</h1>
      <p className="mt-2 text-sm text-slate-600">O endereço que procurou não existe ou foi movido.</p>
      <Link to="/" className="mt-6"><Button>Voltar ao início</Button></Link>
    </div>
  );
}

export function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center animate-fade-up">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Erro 403</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-950">Acesso não autorizado</h1>
      <p className="mt-2 text-sm text-slate-600">
        Não tem permissão para aceder a esta área. Se acha que é um engano, contacte o administrador.
      </p>
      <div className="mt-6 flex gap-2">
        <Link to="/"><Button variant="secondary">Início</Button></Link>
        <Link to="/app"><Button>Meu painel</Button></Link>
      </div>
    </div>
  );
}
