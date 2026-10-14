import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  FileBadge,
  GraduationCap,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

const WHY = [
  {
    icon: <Zap size={22} />,
    t: 'Eficiência Operacional',
    d: 'Menos papel e tarefas manuais: certificados geridos digitalmente do início ao fim.',
  },
  {
    icon: <LayoutDashboard size={22} />,
    t: 'Gestão Integrada',
    d: 'Formações, formandos e certificados centralizados numa única plataforma.',
  },
  {
    icon: <ShieldCheck size={22} />,
    t: 'Segurança',
    d: 'Acesso por perfis, permissões e autorização efectiva no servidor.',
  },
];

const FEATURES = [
  {
    icon: <LayoutDashboard size={22} />,
    t: 'Painel de gestão',
    d: 'Dashboard próprio para administradores e para cada instituição.',
    soon: false,
  },
  {
    icon: <GraduationCap size={22} />,
    t: 'Gestão de formações',
    d: 'Registo de formações e formandos num só lugar.',
    soon: true,
  },
  {
    icon: <FileBadge size={22} />,
    t: 'Emissão de certificados',
    d: 'Participação e Técnico-Profissional, com código único.',
    soon: true,
  },
  {
    icon: <Search size={22} />,
    t: 'Verificação pública',
    d: 'Qualquer pessoa confirma um certificado pelo código.',
    soon: true,
  },
  {
    icon: <Users size={22} />,
    t: 'Gestão de utilizadores',
    d: 'Administração de contas e instituições na plataforma.',
    soon: false,
  },
  {
    icon: <BadgeCheck size={22} />,
    t: 'Perfis e permissões',
    d: 'Separação entre administrador e utilizador em todo o sistema.',
    soon: false,
  },
];

const FAQS = [
  ['Quando posso emitir certificados?', 'A emissão chega numa próxima fase. Por agora, crie a conta e prepare os dados da instituição.'],
  ['Como se valida um certificado?', 'Pelo código único, na página de verificação. O QR code funcional chega depois.'],
  ['Vou pagar alguma coisa?', 'Não. Os preços indicados (100 MT / 150 MT) são apenas referência comercial.'],
];

export function HomePage() {
  return (
    <div className="animate-fade-up bg-white">
      {/* HERO - azul sólido, sem gradiente */}
      <section className="bg-brand-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">
            Bem-vindo à Microlegal
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Certificados digitais para a sua instituição de formação.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Gira formações, emita certificados profissionais e permita que qualquer
            pessoa confirme a sua autenticidade - tudo numa única plataforma.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/registo">
              <Button className="rounded-lg bg-emerald-600 px-7 py-3 text-base hover:bg-emerald-500">
                Criar conta grátis
              </Button>
            </Link>
            <Link to="/#funcionalidades">
              <Button variant="secondary" className="px-7 py-3 text-base">
                Ver funcionalidades
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* O QUE FAZEMOS */}
      <section className="mx-auto max-w-6xl px-4 py-14 text-center md:py-16">
        <h2 className="text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">
          O Que Fazemos
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Uma solução completa para modernizar a certificação de formações,
          com eficiência, organização e confiança.
        </p>
      </section>

      {/* PORQUÊ */}
      <section className="border-t border-slate-100 bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">
            Por Que Escolher a Microlegal?
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.t} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-900 text-white">
                  {w.icon}
                </span>
                <p className="mt-4 text-lg font-bold text-brand-950">{w.t}</p>
                <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:py-16">
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">
          Funcionalidades
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Explore o que a plataforma oferece - e o que está a caminho.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-900">
                  {f.icon}
                </span>
                {f.soon && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Em breve
                  </span>
                )}
              </div>
              <p className="mt-4 text-lg font-bold text-brand-950">{f.t}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PREÇOS */}
      <section className="border-y border-slate-100 bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">
            Preços
          </h2>
          <p className="mt-3 text-center text-sm text-slate-500">
            Valores de referência - sem cobranças nesta fase.
          </p>
          <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
              <p className="font-bold text-brand-950">Certificado de Participação</p>
              <p className="mt-1 text-sm text-slate-500">Workshops, seminários e eventos</p>
              <p className="mt-4 text-3xl font-extrabold text-brand-950">100 MT</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
              <p className="font-bold text-brand-950">Certificado Técnico-Profissional</p>
              <p className="mt-1 text-sm text-slate-500">Formações com avaliação</p>
              <p className="mt-4 text-3xl font-extrabold text-brand-950">150 MT</p>
            </div>
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-16">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">
              Sobre a plataforma
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              A Microlegal está a construir a forma mais simples de emitir e
              validar certificados de formação em Moçambique: sem papel,
              sem deslocações e sem dúvidas sobre autenticidade.
            </p>
            <ul className="mt-5 space-y-2 text-[15px] text-slate-600">
              <li><strong className="text-brand-950">Missão:</strong> simplificar a certificação de formações.</li>
              <li><strong className="text-brand-950">Visão:</strong> ser a referência em certificados digitais verificáveis.</li>
              <li><strong className="text-brand-950">Valores:</strong> simplicidade, transparência e segurança.</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-brand-950 p-8 text-white">
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Contacto</p>
            <p className="mt-3 text-lg font-bold">Fale connosco</p>
            <ul className="mt-3 space-y-1.5 text-[15px] text-slate-300">
              <li>geral@microlegal.co.mz</li>
              <li>+258 84 000 0000</li>
              <li>Maputo, Moçambique</li>
            </ul>
            <Link to="/registo" className="mt-6 inline-flex">
              <Button className="rounded-lg bg-emerald-600 px-6 hover:bg-emerald-500">
                Criar conta grátis
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">
            Perguntas Frequentes
          </h2>
          <div className="mt-8 divide-y divide-slate-100 border-y border-slate-100">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="cursor-pointer list-none text-[17px] font-semibold text-brand-950 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {q}
                    <span className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
