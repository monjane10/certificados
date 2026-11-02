import { Link } from 'react-router-dom';
import {
  Building2,
  Download,
  FileBadge,
  GraduationCap,
  Layers,
  MessageCircle,
  Palette,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { BrandName } from '../../components/layout/BrandName';
import { BRAND } from '../../lib/brand';

// Links com aspecto de botão (um <button> dentro de um <a> não é HTML válido).
const ctaBase =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
const ctaPrimary = `${ctaBase} bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-400`;
const ctaSecondary = `${ctaBase} border border-line bg-white text-ink hover:bg-soft focus-visible:ring-white/60`;

const STEPS = [
  {
    t: 'Registe cursos e formandos',
    d: 'Crie o curso, matricule os formandos e lance as notas nos cursos técnico-profissionais.',
  },
  {
    t: 'Emita com um clique',
    d: 'Quando o curso termina, encerre-o e emita os certificados de todos os formandos elegíveis de uma vez.',
  },
  {
    t: 'Envie pelo WhatsApp',
    d: 'Cada formando recebe um link privado, paga a taxa por M-Pesa ou e-Mola e descarrega o certificado.',
  },
  {
    t: 'Verificação por QR',
    d: 'Quem receber o certificado lê o código QR e confirma na hora que é autêntico.',
  },
];

const WHY = [
  {
    icon: <Building2 size={22} />,
    t: 'Para a instituição',
    d: 'Sem papel, sem impressões e sem custos: a conta é gratuita e a taxa do certificado é paga pelo formando.',
  },
  {
    icon: <GraduationCap size={22} />,
    t: 'Para o formando',
    d: 'Recebe o certificado no telemóvel, paga com M-Pesa ou e-Mola e guarda-o em PDF para sempre.',
  },
  {
    icon: <ShieldCheck size={22} />,
    t: 'Para quem contrata',
    d: 'Cada certificado tem código único e QR: falsificar deixa de compensar, verificar leva segundos.',
  },
];

const FEATURES = [
  { icon: <Layers size={22} />, t: 'Emissão em lote', d: 'Todos os certificados de um curso num só clique, só para quem cumpre os critérios.' },
  { icon: <Palette size={22} />, t: 'Modelos com a sua marca', d: 'Cinco modelos, com o logótipo da instituição e a assinatura do responsável.' },
  { icon: <MessageCircle size={22} />, t: 'Envio pelo WhatsApp', d: 'Mensagem pronta com o link do formando, enviada do WhatsApp da instituição.' },
  { icon: <Smartphone size={22} />, t: 'M-Pesa e e-Mola', d: 'O formando paga no telemóvel e recebe o comprovativo na página do certificado.' },
  { icon: <Download size={22} />, t: 'PDF e imagem', d: 'Certificado em PDF A4 para imprimir e em imagem para partilhar.' },
  { icon: <QrCode size={22} />, t: 'Verificação pública', d: 'Código QR e código único em cada certificado, verificáveis por qualquer pessoa.' },
  { icon: <Wrench size={22} />, t: 'Correcção de dados', d: 'O formando avisa de um erro; ao reemitir, o pagamento passa para o certificado novo.' },
  { icon: <UserCheck size={22} />, t: 'Anulação rastreável', d: 'Certificados anulados nunca se apagam: a verificação mostra que foram anulados.' },
];

const FAQS = [
  [
    'Quanto custa à instituição?',
    'Nada. A conta é gratuita. Cada formando paga a taxa do seu certificado (100 MT de participação, 150 MT técnico-profissional) para o desbloquear.',
  ],
  [
    'Quando posso emitir certificados?',
    'Quando o curso terminar: encerre-o e emita, com um clique, os certificados de todos os formandos elegíveis (participação: todos; técnico-profissional: nota igual ou superior a 10).',
  ],
  [
    'Como recebe o formando o certificado?',
    'Por um link privado que a instituição envia pelo WhatsApp. O formando confirma os seus dados, paga por M-Pesa ou e-Mola e descarrega o certificado em PDF ou imagem.',
  ],
  [
    'Como se verifica um certificado?',
    'Lendo o código QR com a câmara do telemóvel, ou introduzindo o código (CERT-…) na página de verificação.',
  ],
  [
    'E se houver um erro nos dados?',
    'O formando avisa a instituição a partir do seu link. A instituição corrige e emite de novo; se o formando já tiver pago, não paga outra vez.',
  ],
];

export function HomePage() {
  return (
    <div className="animate-fade-up bg-white">
      {/* HERO - azul sólido, sem gradiente */}
      <section className="bg-brand-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">
            <BrandName suffixClass="text-white" />
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Certificados digitais verificáveis para a sua instituição de formação.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Emita certificados com o seu logótipo e assinatura, envie-os aos formandos pelo WhatsApp e deixe que
            qualquer pessoa confirme a autenticidade pelo código QR.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/registo" className={`${ctaPrimary} px-7 py-3 text-base`}>
              Criar conta grátis
            </Link>
            <Link to="/verificar" className={`${ctaSecondary} px-7 py-3 text-base`}>
              <QrCode size={18} /> Verificar um certificado
            </Link>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 md:py-16">
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">Como funciona</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Do fim do curso ao certificado no telemóvel do formando, sem papel e sem deslocações.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-4 text-lg font-bold text-brand-950">{s.t}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* VANTAGENS */}
      <section id="vantagens" className="scroll-mt-20 border-t border-slate-100 bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">
            Porquê o {BRAND.nome}?
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
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">Funcionalidades</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Tudo o que precisa para certificar formações, num só lugar.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-900">{f.icon}</span>
              <p className="mt-4 text-lg font-bold text-brand-950">{f.t}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="scroll-mt-20 border-y border-slate-100 bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-brand-950 md:text-3xl">Preços</h2>
          <p className="mt-3 text-center text-slate-600">
            Gratuito para a instituição. Cada formando paga o seu certificado por M-Pesa ou e-Mola.
          </p>
          <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
              <FileBadge size={22} className="mx-auto text-brand-900" />
              <p className="mt-3 font-bold text-brand-950">Certificado de Participação</p>
              <p className="mt-1 text-sm text-slate-500">Workshops, seminários e eventos</p>
              <p className="mt-4 text-3xl font-extrabold text-brand-950">100 MT</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
              <GraduationCap size={22} className="mx-auto text-brand-900" />
              <p className="mt-3 font-bold text-brand-950">Certificado Técnico-Profissional</p>
              <p className="mt-1 text-sm text-slate-500">Formações com avaliação e nota final</p>
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
              Sobre o <BrandName suffixClass="text-emerald-600" />
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              O {BRAND.nome} é a forma mais simples de emitir e validar certificados de formação em Moçambique: sem
              papel, sem deslocações e sem dúvidas sobre autenticidade.
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
              <li>
                <a href={`mailto:${BRAND.email}`} className="hover:text-white">{BRAND.email}</a>
              </li>
              <li>{BRAND.telefone}</li>
              <li>{BRAND.local}</li>
            </ul>
            <Link to="/registo" className={`${ctaPrimary} mt-6 px-6 py-2.5 text-sm`}>
              Criar conta grátis
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-slate-100">
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
