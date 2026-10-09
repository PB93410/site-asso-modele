import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { BANDEAU_END, ESSAI_CTA_UNTIL } from '../data/CONFIG';
import { ESSAIS_LABEL, NB_ESSAIS, TARIF_LABEL } from '../data/asso';

export default function StickyOfferBar() {
  const path = useLocation().pathname;
  const hideOnLead = path.startsWith('/essai') || path.startsWith('/inscription');

  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const heroBandeauOn = NB_ESSAIS > 0 && Date.now() < BANDEAU_END;
  const essaiCta = Date.now() < ESSAI_CTA_UNTIL;

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (hideOnLead || heroBandeauOn || !visible || dismissed) return null;

  return (
    <div className="fixed top-[56px] sm:top-[72px] left-0 right-0 z-40 bg-[#1A1916]/95 backdrop-blur-sm border-b border-orange-primary/20 max-[380px]:top-[52px]">
      <div className="content-max-width min-h-[32px] sm:min-h-[36px] py-1 flex items-center justify-center gap-1.5 sm:gap-3 px-2 sm:px-4">
        {essaiCta ? (
          <p className="font-body font-medium text-[10px] sm:text-[12px] text-white truncate leading-tight">
            <span className="hidden sm:inline">{ESSAIS_LABEL} — </span>
            <a
              href="/essai"
              data-analytics="CTA-StickyBar-Essai"
              className="text-orange-primary hover:underline font-semibold"
            >
              Réserver un créneau →
            </a>
          </p>
        ) : (
          <p className="font-body font-medium text-[10px] sm:text-[12px] text-white truncate leading-tight">
            <span className="hidden sm:inline">Saison en cours — {TARIF_LABEL}/an — </span>
            <span className="sm:hidden">{TARIF_LABEL}/an — </span>
            <a
              href="/inscription"
              data-analytics="CTA-StickyBar-Adherer"
              className="text-orange-primary hover:underline font-semibold"
            >
              Adhérer →
            </a>
          </p>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-brand-gray hover:text-white shrink-0 ml-1 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
