import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TARIF_LABEL } from '../data/asso';

type Props = {
  essaisUrl: string;
  adherentsUrl: string;
  variant?: 'bar' | 'card';
};

/** Liens tableaux Google seulement — mail / agenda = routes /bureau/* (pas Google). */
export default function BureauSheetLinks({
  essaisUrl,
  adherentsUrl,
  variant = 'bar',
}: Props) {
  const btn =
    variant === 'bar'
      ? 'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-black/10 bg-white text-sm font-semibold text-brand-black hover:border-orange-primary hover:text-orange-primary'
      : 'inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl bg-orange-primary text-white font-semibold text-[15px] hover:bg-orange-primary/90 w-full sm:w-auto';

  const relancesBtn =
    variant === 'bar'
      ? 'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-[#25D366] text-white text-sm font-semibold'
      : 'inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl bg-[#25D366] text-white font-semibold text-[15px] w-full sm:w-auto';

  const links = (
    <>
      <Link to="/bureau/relances" className={relancesBtn}>
        Relances WhatsApp
      </Link>
      {essaisUrl ? (
        <a
          href={essaisUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
        >
          Tableau Essais
          <ExternalLink className="w-4 h-4 shrink-0" />
        </a>
      ) : null}
      {adherentsUrl ? (
        <a
          href={adherentsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
        >
          Tableau Adhérents
          <ExternalLink className="w-4 h-4 shrink-0" />
        </a>
      ) : null}
    </>
  );

  if (variant === 'bar') {
    return (
      <div className="max-w-3xl mx-auto px-4 pb-2 flex flex-wrap gap-2">
        {links}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 p-4 space-y-3 bg-white">
      <h3 className="font-display font-bold text-base text-brand-black">Tableaux Google</h3>
      <p className="text-sm text-brand-gray leading-relaxed">
        Relances (conversion {TARIF_LABEL}, rappel à 7 jours) : bouton vert. « Fait » sur le
        téléphone ne remplace pas la Sheet. Onglets À payer et Essais = ce qu’il reste à
        faire. Pour tout voir : tableaux Google.
      </p>
      <div className="flex flex-wrap gap-2">{links}</div>
    </div>
  );
}
