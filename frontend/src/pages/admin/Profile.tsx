import { ProfileForm } from '../ProfileForm';

export function AdminProfile() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-950">Perfil do administrador</h1>
        <p className="text-sm text-slate-500">Consulte e actualize os dados permitidos.</p>
      </div>
      <ProfileForm />
    </div>
  );
}
