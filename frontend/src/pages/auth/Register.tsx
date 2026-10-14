import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const schema = z
  .object({
    organization_name: z.string().trim().min(2, 'Indique o nome da escola, instituição ou profissional').max(120),
    email: z.string().email('Email inválido'),
    phone: z.string().trim().min(9, 'Telefone inválido').max(20).regex(/^[+0-9][0-9\s-]*$/, 'Telefone inválido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string().min(1, 'Confirme a password'),
  })
  .refine((d) => d.password === d.confirm, { message: 'As passwords não coincidem', path: ['confirm'] });

type Form = z.infer<typeof schema>;

export function RegisterPage() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Form) {
    try {
      // O perfil é SEMPRE 'user': o trigger do servidor ignora qualquer role.
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        options: {
          data: {
            organization_name: values.organization_name.trim(),
            phone: values.phone.trim(),
          },
        },
      });
      if (error) throw error;
      if (!data.session) {
        toast.info('Conta criada. Verifique o seu email para confirmar antes de entrar.');
        navigate('/login');
        return;
      }
      toast.success('Conta criada com sucesso.');
      navigate('/app', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no registo.');
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 animate-fade-up">
      <Card>
        <h1 className="text-2xl font-extrabold text-brand-950">Criar conta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registo com email e password (Supabase Auth). O telefone é apenas dado de perfil -
          sem verificação por SMS nesta fase. O código de utilizador é gerado pelo sistema.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Input label="Nome da escola, instituição ou profissional" placeholder="Ex.: Escola Secundária X" required
            error={formState.errors.organization_name?.message} {...register('organization_name')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" autoComplete="email" placeholder="nome@instituicao.co.mz" required
              error={formState.errors.email?.message} {...register('email')} />
            <Input label="Telefone" type="tel" autoComplete="tel" placeholder="+258 84 000 0000" required
              error={formState.errors.phone?.message} {...register('phone')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-brand-950">Password <span className="text-red-600">*</span></label>
              <div className="relative">
                <input id="password" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 8 caracteres"
                  {...register('password')}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${formState.errors.password ? 'border-red-400' : 'border-slate-200'}`} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label="Mostrar/ocultar password"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formState.errors.password && <p className="text-xs text-red-600">{formState.errors.password.message}</p>}
            </div>
            <Input label="Confirmar password" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Repita a password" required
              error={formState.errors.confirm?.message} {...register('confirm')} />
          </div>
          <Button type="submit" loading={formState.isSubmitting} className="w-full">
            {formState.isSubmitting ? 'A criar conta…' : 'Criar conta'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Já tem conta? <Link to="/login" className="font-semibold text-brand-900 hover:underline">Entrar</Link>
        </p>
      </Card>
    </div>
  );
}
