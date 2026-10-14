import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const schema = z.object({
  organization_name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  phone: z.string().trim().min(9, 'Telefone inválido').max(20).regex(/^[+0-9][0-9\s-]*$/, 'Telefone inválido'),
});

type Form = z.infer<typeof schema>;

/** Formulário partilhado de perfil (admin e user). Apenas campos autorizados. */
export function ProfileForm() {
  const { profile, refreshProfile } = useAuth();
  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    values: {
      organization_name: profile?.organization_name ?? '',
      phone: profile?.phone ?? '',
    },
  });

  async function onSubmit(values: Form) {
    try {
      await api.updateProfile(values);
      await refreshProfile();
      toast.success('Perfil actualizado com sucesso.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao actualizar perfil.');
    }
  }

  return (
    <Card>
      <h2 className="font-bold text-brand-950">Dados da instituição / profissional</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
        <Input label="Nome da escola, instituição ou profissional" required
          error={formState.errors.organization_name?.message} {...register('organization_name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefone" type="tel" required error={formState.errors.phone?.message} {...register('phone')} />
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-brand-950">Código do sistema</span>
            <input value={profile?.code ?? ''} disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-600" />
            <p className="text-xs text-slate-500">Gerado pelo sistema. Não pode ser alterado.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-brand-950">Email</span>
            <input value={profile?.email ?? ''} disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600" />
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-brand-950">Perfil de acesso</span>
            <input value={profile?.role ?? ''} disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600" />
            <p className="text-xs text-slate-500">O perfil não pode ser alterado pelo próprio utilizador.</p>
          </div>
        </div>
        <Button type="submit" loading={formState.isSubmitting}>
          {formState.isSubmitting ? 'A guardar…' : 'Guardar alterações'}
        </Button>
      </form>
    </Card>
  );
}
