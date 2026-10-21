import { useRef, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { brandingUrl, prepareImage, uploadBranding, type BrandingKind } from '../../lib/branding';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

const SLOTS: Record<BrandingKind, { titulo: string; ajuda: string; campo: 'logo_path' | 'assinatura_path' }> = {
  logo: {
    titulo: 'Logótipo',
    ajuda: 'PNG com fundo transparente fica melhor. Aparece no topo dos certificados.',
    campo: 'logo_path',
  },
  assinatura: {
    titulo: 'Assinatura',
    ajuda: 'Assine em papel branco, fotografe ou digitalize. O fundo branco é removido automaticamente.',
    campo: 'assinatura_path',
  },
};

// Xadrez para mostrar a transparência das imagens.
const CHECKER = {
  backgroundImage:
    'linear-gradient(45deg,#eef2f7 25%,transparent 25%),linear-gradient(-45deg,#eef2f7 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eef2f7 75%),linear-gradient(-45deg,transparent 75%,#eef2f7 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
};

function ImageSlot({ kind }: { kind: BrandingKind }) {
  const { profile, refreshProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const slot = SLOTS[kind];
  const url = brandingUrl(profile?.[slot.campo]);

  async function handleFile(file: File | undefined) {
    if (!file || !profile || busy) return;
    setBusy(true);
    try {
      const blob = await prepareImage(file, kind);
      const path = await uploadBranding(profile.id, kind, blob);
      await api.updateProfile({ [slot.campo]: path });
      await refreshProfile();
      toast.success(`${slot.titulo} actualizado. Aplica-se aos próximos certificados emitidos.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar a imagem.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    try {
      // O ficheiro fica no bucket: certificados já emitidos continuam a mostrá-lo.
      await api.updateProfile({ [slot.campo]: null });
      await refreshProfile();
      toast.success(`${slot.titulo} removido dos próximos certificados.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao remover.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-brand-950">{slot.titulo}</p>
      <div
        className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-slate-200 p-3"
        style={url ? CHECKER : undefined}
      >
        {url ? (
          <img src={url} alt={slot.titulo} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-center text-xs text-slate-400">
            Sem {slot.titulo.toLowerCase()}.
            <br />
            {kind === 'logo' ? 'Os modelos usam as iniciais da instituição.' : 'Os modelos mostram só a linha de assinatura.'}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-500">{slot.ajuda}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
          <ImageUp size={16} /> {url ? 'Substituir' : 'Carregar'}
        </Button>
        {url && (
          <Button type="button" variant="ghost" disabled={busy} onClick={handleRemove}>
            <Trash2 size={16} /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}

/** Logótipo, assinatura e responsável que aparecem nos certificados emitidos. */
export function CertificateBrandingCard() {
  const { profile, refreshProfile } = useAuth();
  const [nome, setNome] = useState(profile?.responsavel_nome ?? '');
  const [cargo, setCargo] = useState(profile?.responsavel_cargo ?? '');
  const [saving, setSaving] = useState(false);

  async function saveResponsavel(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.updateProfile({ responsavel_nome: nome.trim() || null, responsavel_cargo: cargo.trim() || null });
      await refreshProfile();
      toast.success('Responsável actualizado. Aplica-se aos próximos certificados emitidos.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-bold text-brand-950">Identidade nos certificados</h2>
      <p className="mt-1 text-sm text-slate-500">
        Logótipo, assinatura e responsável que aparecem nos certificados. Cada certificado guarda os dados do momento em
        que foi emitido: alterações aqui aplicam-se às próximas emissões.
      </p>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <ImageSlot kind="logo" />
        <ImageSlot kind="assinatura" />
      </div>

      <form onSubmit={saveResponsavel} className="mt-6 space-y-4 border-t border-slate-100 pt-5" noValidate>
        <p className="text-sm font-medium text-brand-950">Quem assina</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome do responsável"
            placeholder="Ex.: Dra. Marta Cossa"
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            label="Cargo"
            placeholder="Ex.: Directora Pedagógica"
            value={cargo}
            maxLength={80}
            onChange={(e) => setCargo(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">
          Sem nome, os certificados mostram o nome da instituição; sem cargo, mostram «Coordenação».
        </p>
        <Button type="submit" loading={saving}>
          Guardar responsável
        </Button>
      </form>
    </Card>
  );
}
