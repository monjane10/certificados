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

/** Distância até à cor do fundo abaixo da qual o pixel é fundo; até FEATHER fica semitransparente. */
const TOLERANCE = 42;
const FEATHER = 95;

/**
 * Cor do fundo: a mediana dos pixéis da borda. Devolve null se a borda já for
 * quase toda transparente (a imagem já não tem fundo).
 */
function backgroundColor(px: Uint8ClampedArray, w: number, h: number): [number, number, number] | null {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  let transparent = 0;
  let total = 0;
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    total += 1;
    if (px[i + 3] < 128) {
      transparent += 1;
      return;
    }
    rs.push(px[i]);
    gs.push(px[i + 1]);
    bs.push(px[i + 2]);
  };
  for (let x = 0; x < w; x += 1) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 1; y < h - 1; y += 1) {
    sample(0, y);
    sample(w - 1, y);
  }
  if (rs.length === 0 || transparent / total > 0.5) return null;
  const median = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  return [median(rs), median(gs), median(bs)];
}

/**
 * Retira o fundo, seja qual for a cor (detectada pela borda da imagem).
 * Assinatura: retira todos os pixéis da cor do papel, também entre os traços.
 * Logótipo: retira só o fundo ligado à borda, para não apagar partes do
 * desenho com a mesma cor (ex.: letras brancas dentro de uma forma).
 * Em ambos, os contornos ficam semitransparentes, sem serrilhado.
 */
function removeBackground(image: ImageData, kind: BrandingKind) {
  const { data: px, width: w, height: h } = image;
  const bg = backgroundColor(px, w, h);
  if (!bg) return;

  const dist = (p: number) => {
    const i = p * 4;
    const dr = px[i] - bg[0];
    const dg = px[i + 1] - bg[1];
    const db = px[i + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const fade = (p: number, d: number) => {
    const i = p * 4 + 3;
    if (d <= TOLERANCE) px[i] = 0;
    else if (d < FEATHER) px[i] = Math.round(px[i] * ((d - TOLERANCE) / (FEATHER - TOLERANCE)));
  };

  if (kind === 'assinatura') {
    for (let p = 0; p < w * h; p += 1) fade(p, dist(p));
    return;
  }

  // Logótipo: preenchimento a partir da borda (como o «balde de tinta»).
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (seen[p]) return;
    seen[p] = 1;
    if (dist(p) < FEATHER) queue[tail++] = p;
  };
  for (let x = 0; x < w; x += 1) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const d = dist(p);
    fade(p, d);
    // Só o fundo propriamente dito continua a alastrar; os contornos param aqui.
    if (d > TOLERANCE) continue;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
}

/**
 * Prepara a imagem para o certificado: reduz para no máximo `maxSide` px e
 * retira o fundo (ver removeBackground). Devolve sempre PNG (com transparência).
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

  const data = ctx.getImageData(0, 0, w, h);
  removeBackground(data, kind);
  ctx.putImageData(data, 0, 0);

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
