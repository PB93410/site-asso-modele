/** Numéro français → chiffres au format WhatsApp (33…), ou null s’il est trop court. */
export function normalizeFrPhone(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length < 9) return null;
  if (d.startsWith('33') && d.length >= 11) return d;
  if (d.startsWith('0') && d.length >= 10) return '33' + d.slice(1);
  if (d.length === 9) return '33' + d;
  return d;
}
