import type { PublicCertificate } from '../../types';

/** Tamanho de desenho de todos os modelos: A4 horizontal a 96 dpi (297 x 210 mm). */
export const CANVAS_W = 1123;
export const CANVAS_H = 794;

export interface TemplateProps {
  cert: PublicCertificate;
}

function longDate(iso: string): string {
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtNota(n: number | null): string {
  return n === null ? '-' : Number(n).toLocaleString('pt-PT', { maximumFractionDigits: 2 });
}

/** Textos do certificado, comuns a todos os modelos. */
export function certificateText(cert: PublicCertificate) {
  const tecnico = cert.tipo === 'tecnico_profissional';
  return {
    tecnico,
    subtitulo: tecnico ? 'Técnico-Profissional' : 'de Participação',
    periodo: cert.data_abertura
      ? `realizado de ${longDate(cert.data_abertura)} a ${longDate(cert.data_encerramento)}`
      : `concluído a ${longDate(cert.data_encerramento)}`,
    nota: fmtNota(cert.nota),
    dataEmissao: longDate(cert.emitido_em),
    verifyUrl: `${window.location.host}/verificar`,
  };
}

/** Frase principal: «Por ter participado/concluído... no curso X, com N horas...». */
export function CertificateBody({ cert, strongClass = '' }: TemplateProps & { strongClass?: string }) {
  const t = certificateText(cert);
  return (
    <>
      {t.tecnico ? 'Por ter concluído com aproveitamento o curso' : 'Por ter participado no curso'}{' '}
      <strong className={strongClass}>«{cert.curso_nome}»</strong>, com a carga horária de{' '}
      <strong className={strongClass}>{cert.carga_horaria} horas</strong>, {t.periodo}
      {t.tecnico ? (
        <>
          , obtendo a classificação final de <strong className={strongClass}>{t.nota} valores</strong>.
        </>
      ) : (
        '.'
      )}
    </>
  );
}

/**
 * Tamanho de letra que faz caber `text` numa linha: mantém `base` até
 * `maxChars` caracteres e reduz proporcionalmente acima disso (nunca abaixo
 * de `min`). Nomes num certificado nunca podem ser cortados.
 */
export function fitFontSize(text: string, base: number, maxChars: number, min = Math.round(base * 0.5)): number {
  return Math.max(min, Math.min(base, Math.floor((base * maxChars) / Math.max(text.length, 1))));
}

/** Iniciais da instituição (substituem o logótipo enquanto não há upload de logo). */
export function initials(nome: string): string {
  const parts = nome
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .filter(Boolean);
  return (parts.slice(0, 3).map((p) => p[0]).join('') || nome.slice(0, 2)).toUpperCase();
}
