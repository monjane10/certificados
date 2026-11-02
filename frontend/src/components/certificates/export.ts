import type { PublicCertificate } from '../../types';
import { CANVAS_H, CANVAS_W } from './shared';

/**
 * Exportação do certificado (o nó é o desenho a escala 1 de CertificateDocument).
 * As bibliotecas só se carregam quando o formando descarrega.
 */
async function render(node: HTMLElement, format: 'png' | 'jpeg'): Promise<string> {
  const { toJpeg, toPng } = await import('html-to-image');
  const options = {
    width: CANVAS_W,
    height: CANVAS_H,
    // 2x: nítido impresso em A4 e com zoom no telemóvel.
    pixelRatio: 2,
    // Evita usar a cópia do logótipo/assinatura em cache sem cabeçalhos CORS.
    cacheBust: true,
    backgroundColor: '#ffffff',
    style: { transform: 'none' },
  };
  return format === 'png' ? toPng(node, options) : toJpeg(node, { ...options, quality: 0.92 });
}

function fileName(cert: Pick<PublicCertificate, 'codigo'>, ext: string): string {
  return `certificado-${cert.codigo}.${ext}`;
}

function saveDataUrl(dataUrl: string, name: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Imagem PNG, para partilhar no WhatsApp ou nas redes sociais. */
export async function downloadImage(node: HTMLElement, cert: PublicCertificate) {
  saveDataUrl(await render(node, 'png'), fileName(cert, 'png'));
}

/** PDF A4 horizontal, do tamanho exacto do certificado. */
export async function downloadPdf(node: HTMLElement, cert: PublicCertificate) {
  const [{ jsPDF }, image] = await Promise.all([import('jspdf'), render(node, 'jpeg')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: `Certificado ${cert.codigo} - ${cert.formando_nome}`,
    subject: cert.curso_nome,
    author: cert.emissor_nome,
  });
  pdf.addImage(image, 'JPEG', 0, 0, 297, 210);
  pdf.save(fileName(cert, 'pdf'));
}
