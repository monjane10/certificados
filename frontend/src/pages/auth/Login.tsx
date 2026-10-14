import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Password obrigatória'),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: Form) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      if (error) throw error;
      if (!data.session) {
        toast.info('Verifique o seu email para confirmar a conta antes de entrar.');
        return;
      }
      // Lê o perfil para decidir o destino (admin vs user).
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .maybeSingle();
      toast.success('Sessão iniciada com sucesso.');
      if (from) navigate(from, { replace: true });
      else navigate((profile as { role?: string } | null)?.role === 'admin' ? '/admin' : '/app', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no login. Verifique os dados.');
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 animate-fade-up">
      <Card>
        <h1 className="text-2xl font-extrabold text-brand-950">Entrar</h1>
        <p className="mt-1 text-sm text-slate-500">Aceda ao painel da sua instituição.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" placeholder="nome@instituicao.co.mz" required
            error={formState.errors.email?.message} {...register('email')} />
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-brand-950">
              Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  formState.errors.password ? 'border-red-400' : 'border-slate-200'
                }`}
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar password' : 'Mostrar password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formState.errors.password && <p className="text-xs text-red-600">{formState.errors.password.message}</p>}
          </div>
          <Button type="submit" loading={formState.isSubmitting} className="w-full">
            {formState.isSubmitting ? 'A entrar…' : 'Entrar'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Ainda não tem conta? <Link to="/registo" className="font-semibold text-brand-900 hover:underline">Criar conta</Link>
        </p>
      </Card>
    </div>
  );
}
