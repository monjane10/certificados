import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function UserSettings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handlePasswordReset() {
    if (!user?.email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      toast.success('Email de reposição de password enviado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao pedir reposição.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-950">Definições da conta</h1>
        <p className="text-sm text-slate-500">Sessão: {user?.email}</p>
      </div>
      <Card>
        <h2 className="font-bold text-brand-950">Segurança</h2>
        <p className="mt-1 text-sm text-slate-600">Altere a password através de um link seguro enviado para o seu email.</p>
        <Button variant="secondary" loading={loading} onClick={handlePasswordReset} className="mt-3">
          Enviar link de reposição
        </Button>
      </Card>
      <Card>
        <h2 className="font-bold text-brand-950">Sessão</h2>
        <p className="mt-1 text-sm text-slate-600">Termine a sessão neste dispositivo.</p>
        <Button variant="danger" className="mt-3" onClick={async () => { await signOut(); toast.success('Sessão terminada com sucesso.'); window.location.href = '/'; }}>
          Terminar sessão
        </Button>
      </Card>
    </div>
  );
}
