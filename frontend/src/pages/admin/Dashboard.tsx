import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Card, StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

export function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<{ totalUsers: number; certificatesIssued: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.adminOverview();
        setStats({
          totalUsers: Number(data['totalUsers'] ?? 0),
          certificatesIssued: Number(data['certificatesIssued'] ?? 0),
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao carregar indicadores.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label="A carregar dashboard..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">Dashboard administrativo</h1>
        <p className="mt-1 text-sm text-slate-500">Bem-vindo, {profile?.organization_name}. Gestão global da plataforma.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de utilizadores" value={String(stats?.totalUsers ?? 0)} hint="Via API protegida (role admin)" />
        <StatCard label="Certificados emitidos" value={String(stats?.certificatesIssued ?? 0)} hint="Activos (não anulados)" />
        <StatCard label="Validações" value="0" hint="Verificação pública em preparação" />
        <StatCard label="Formações activas" value="0" hint="Módulo em preparação" />
      </div>
      <Card>
        <h2 className="font-bold text-brand-950">Actividade recente</h2>
        <div className="mt-4">
          <EmptyState title="Sem actividade para mostrar" description="Os eventos da plataforma (novos registos, emissões, validações) aparecerão aqui quando os módulos correspondentes forem implementados." />
        </div>
      </Card>
    </div>
  );
}
