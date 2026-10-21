import { ProfileForm } from '../ProfileForm';
import { CertificateBrandingCard } from '../../components/profile/CertificateBrandingCard';

export function UserProfile() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-950">Perfil e dados da instituição</h1>
        <p className="text-sm text-slate-500">Consulte e actualize os dados permitidos.</p>
      </div>
      <ProfileForm />
      <CertificateBrandingCard />
    </div>
  );
}
