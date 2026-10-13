/** Ouverture de WhatsApp avec un court message de confirmation (affiché par <WhatsAppToast />). */

let annoncer: ((message: string) => void) | null = null;

/** Branche l'affichage du message ; renvoie de quoi le débrancher. */
export function brancherAnnonceWhatsApp(fn: (message: string) => void): () => void {
  annoncer = fn;
  return () => {
    if (annoncer === fn) annoncer = null;
  };
}

/** Ouvre WhatsApp après un court message de confirmation. */
export function openWhatsApp(url: string, message = 'Ouverture de WhatsApp…') {
  window.open(url, '_blank', 'noopener,noreferrer');
  annoncer?.(message);
}
