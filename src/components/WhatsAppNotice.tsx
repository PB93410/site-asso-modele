/** Mention RGPD sous les liens vers WhatsApp (Meta). */
export const WA_NOTICE = 'Vous quittez le site vers WhatsApp (Meta).';

export default function WhatsAppNotice({ className = '' }: { className?: string }) {
  return (
    <p
      className={`font-body text-[11px] leading-snug text-brand-gray opacity-60 ${className}`}
      role="note"
    >
      {WA_NOTICE}
    </p>
  );
}
