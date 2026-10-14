import { Link } from 'react-router-dom';
import { Award, Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-brand-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Award size={20} /></span>
            <span className="text-lg font-extrabold">Microlegal</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Plataforma de gestão e emissão de certificados digitais de formação.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Plataforma</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/" className="hover:text-white">Início</Link></li>
            <li><Link to="/verificar" className="hover:text-white">Verificar certificado</Link></li>
            <li><Link to="/login" className="hover:text-white">Entrar</Link></li>
            <li><Link to="/registo" className="hover:text-white">Criar conta</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Recursos</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a href="/#certificados" className="hover:text-white">Tipos de certificado</a></li>
            <li><a href="/#faq" className="hover:text-white">Perguntas frequentes</a></li>
            <li><span className="text-slate-500">Pagamentos (em breve)</span></li>
            <li><span className="text-slate-500">Assinatura digital (em breve)</span></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Contactos</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2"><Mail size={15} /> geral@microlegal.co.mz</li>
            <li className="flex items-center gap-2"><Phone size={15} /> +258 84 000 0000</li>
            <li className="flex items-center gap-2"><MapPin size={15} /> Maputo, Moçambique</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Microlegal. Todos os direitos reservados.
      </div>
    </footer>
  );
}
