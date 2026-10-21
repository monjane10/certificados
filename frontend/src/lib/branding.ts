import { supabase } from './supabase';

/** Bucket público com logótipos e assinaturas (pasta por utilizador). */
export const BRANDING_BUCKET = 'branding';

export type BrandingKind = 'logo' | 'assinatura';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_INPUT_BYTES = 5 * 1024 * 1024;

/** URL público de uma imagem do bucket (null se não houver). */
export function brandingUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

/**
 * Prepara a imagem para o certificado: reduz para no máximo `maxSide` px e,
 * na assinatura, torna transparente o fundo claro do papel digitalizado.
 * Devolve sempre PNG (mantém a transparência).
 */
export async function prepareImage(file: File, kind: BrandingKind): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Formato não suportado. Use PNG, JPG ou WebP.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Imagem demasiado grande (máx. 5 MB).');

  const img = await loadImage(file);
  const maxSide = kind === 'logo' ? 600 : 900;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.drawImage(img, 0, 0, w, h);

  if (kind === 'assinatura') {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      // Luminosidade alta = papel: transparente; transição suave nos contornos do traço.
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum > 215) px[i + 3] = 0;
      else if (lum > 160) px[i + 3] = Math.round(px[i + 3] * ((215 - lum) / 55));
    }
    ctx.putImageData(data, 0, 0);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a imagem.'))), 'image/png'),
  );
}

/** Envia a imagem para "<userId>/<kind>-<timestamp>.png" e devolve o caminho. */
export async function uploadBranding(userId: string, kind: BrandingKind, blob: Blob): Promise<string> {
  // Nome novo a cada envio: certificados já emitidos mantêm a imagem antiga.
  const path = `${userId}/${kind}-${Date.now()}.png`;
  const { error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(`Falha ao enviar a imagem: ${error.message}`);
  return path;
}
