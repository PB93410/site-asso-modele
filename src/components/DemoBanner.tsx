import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

/** Mode démo (`npm run demo`) : données fictives, rien n’est envoyé. */
export const DEMO = import.meta.env.VITE_DEMO === '1';

export default function DemoBanner() {
  const [open, setOpen] = useState(true);
  // Dans le bureau, la barre de navigation occupe le bas de l’écran (téléphone) : on passe au-dessus.
  const bureau = useLocation().pathname === '/bureau';
  if (!DEMO || !open) return null;
  return (
    <div
      role="note"
      className={`fixed left-3 ${bureau ? 'bottom-[84px] lg:bottom-3 lg:left-auto lg:right-3' : 'bottom-3'} z-[60] max-w-[calc(100vw-24px)] sm:max-w-sm rounded-2xl bg-brand-black/95 text-white shadow-lg px-4 py-3 pr-10 font-body text-[14px] leading-snug`}
    >
      <p>
        <strong>Démo</strong> — données fictives, rien n’est envoyé ni enregistré.
      </p>
      <p className="mt-1 text-white/80">
        <Link to="/bureau" className="underline underline-offset-2 text-white">
          Espace bureau
        </Link>{' '}
        : mot de passe <strong className="text-white">demo</strong>.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Masquer"
        className="absolute top-1.5 right-1.5 w-9 h-9 inline-flex items-center justify-center rounded-full text-white/80 hover:text-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
