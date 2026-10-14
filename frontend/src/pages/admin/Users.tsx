import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import type { Profile } from '../../types';

export function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  // Pesquisa global do header: organização, código ou email.
  const q = (searchParams.get('q') ?? '').replace(/[%_,()*\\]/g, '').trim();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // RLS: apenas admins lêem todas as linhas (policy profiles_admin_all).
        let query = supabase
          .from('profiles')
          .select('id, code, email, phone, organization_name, role, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(50);
        if (q) query = query.or(`organization_name.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%`);
        const { data, error } = await query;
        if (error) throw error;
        setUsers((data as Profile[]) ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao listar utilizadores.');
      } finally {
        setLoading(false);
      }
    })();
  }, [q]);

  if (loading) return <Spinner label="A carregar utilizadores..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-950">Gestão de utilizadores</h1>
        <p className="text-sm text-slate-500">
          Interface inicial: listagem funcional. Edição de perfis, suspensão e promoção a admin - <strong>em preparação</strong> para próximas sprints.
        </p>
      </div>
      {q && (
        <p className="text-sm text-slate-500">
          Resultados para «{q}» ·{' '}
          <Link to="/admin/utilizadores" className="font-semibold text-brand-900 hover:underline">Limpar pesquisa</Link>
        </p>
      )}
      <Card>
        {users.length === 0 ? (
          <EmptyState title="Nenhum utilizador encontrado"
            description="Ainda não existem registos visíveis ou a sua sessão não tem permissão de leitura global." />
        ) : (
          <>
          <ul className="divide-y divide-line md:hidden">
            {users.map((u) => (
              <li key={u.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words font-semibold text-ink">{u.organization_name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === 'admin' ? 'bg-ink text-white' : 'bg-soft text-ink'}`}>
                    {u.role}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-muted">{u.code}</p>
                <p className="mt-0.5 break-all text-sm text-muted">{u.email ?? 'Sem email'}</p>
                <p className="mt-0.5 text-xs text-muted">Criado em {new Date(u.created_at).toLocaleDateString('pt-MZ')}</p>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Organização</th>
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Perfil</th>
                  <th className="py-2">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-brand-950">{u.organization_name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{u.code}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === 'admin' ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500">{new Date(u.created_at).toLocaleDateString('pt-MZ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
