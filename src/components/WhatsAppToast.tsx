import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { brancherAnnonceWhatsApp } from '../lib/whatsapp';

type ToastState = { visible: boolean; message: string };


export default function WhatsAppToast() {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });

  useEffect(
    () =>
      brancherAnnonceWhatsApp((msg) => {
        setToast({ visible: true, message: msg });
        setTimeout(() => setToast({ visible: false, message: '' }), 2400);
      }),
    [],
  );

  if (!toast.visible) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] pointer-events-none max-w-[min(92vw,360px)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2 px-4 py-2.5 rounded-2xl bg-brand-olive text-white shadow-lg">
        <MessageCircle size={16} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-body text-[13px] font-medium leading-snug">{toast.message}</p>
          <p className="font-body text-[12px] text-white/80 mt-0.5 leading-snug">
            Vous quittez le site vers WhatsApp (Meta).
          </p>
        </div>
      </div>
    </div>
  );
}
