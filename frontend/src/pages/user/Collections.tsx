import { Card } from '../../components/ui/Card';
import { EmptyState, ComingSoonBadge } from '../../components/ui/EmptyState';

export function UserCertificates() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">Certificados</h1>
        <ComingSoonBadge />
      </div>
      <p className="text-sm text-slate-500">Secção preparada para o módulo de emissão (próximas sprints). Nenhuma emissão simulada aqui.</p>
      <Card>
        <EmptyState title="Emissão ainda indisponível"
          description="Nesta sprint o módulo de emissão não está implementado. Aqui serão listados, criados e geridos os seus certificados (Participação 100 MT · Técnico-Profissional 150 MT - preços de referência)." />
      </Card>
    </div>
  );
}
