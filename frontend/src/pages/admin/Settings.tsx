import { Card } from '../../components/ui/Card';
import { ComingSoonBadge } from '../../components/ui/EmptyState';

export function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">Configurações da plataforma</h1>
        <p className="mt-1 text-sm text-slate-500">Interface inicial - as opções editáveis chegam nas próximas sprints.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { t: 'Preçário comercial', d: 'Participação 100 MT · Técnico-Profissional 150 MT. Edição futura.' },
          { t: 'Modelos de certificado', d: 'Gestão de layouts e campos. Funcionalidade futura.' },
          { t: 'Pagamentos', d: 'Integração de cobranças. Funcionalidade futura.' },
          { t: 'Assinatura digital / QR', d: 'Validação avançada. Funcionalidade futura.' },
        ].map((c) => (
          <Card key={c.t}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-brand-950">{c.t}</p>
              <ComingSoonBadge />
            </div>
            <p className="mt-1 text-sm text-slate-600">{c.d}</p>
            <button disabled className="mt-3 cursor-not-allowed rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400">
              Indisponível
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
