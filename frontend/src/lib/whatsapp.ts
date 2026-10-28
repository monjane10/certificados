import type { Certificate } from '../types';

/** Link privado do formando (pré-visualização, pagamento e certificado). */
export function studentLink(token: string): string {
  return `${window.location.origin}/c/${token}`;
}

/**
 * Número no formato do WhatsApp (258XXXXXXXXX). Aceita "84 123 4567",
 * "+258 84...", "00258..."; devolve null se não for um número moçambicano válido.
 */
export function whatsappNumber(contacto: string | null): string | null {
  if (!contacto) return null;
  let digits = contacto.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && /^8[2-7]/.test(digits)) return `258${digits}`;
  if (digits.length === 12 && /^2588[2-7]/.test(digits)) return digits;
  return null;
}

export function whatsappMessage(c: Pick<Certificate, 'formando_nome' | 'curso_nome' | 'emissor_nome' | 'taxa_valor' | 'acesso_token'>): string {
  const primeiroNome = c.formando_nome.trim().split(/\s+/)[0];
  return [
    `Olá ${primeiroNome}!`,
    `O seu certificado do curso «${c.curso_nome}», emitido por ${c.emissor_nome}, está pronto.`,
    `Para o ver e descarregar, abra o link abaixo. A taxa do certificado é de ${c.taxa_valor} MT, paga por M-Pesa ou e-Mola.`,
    studentLink(c.acesso_token),
  ].join('\n\n');
}

/** Abre o WhatsApp (app ou web) com a mensagem pronta, a partir da conta de quem envia. */
export function whatsappUrl(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
