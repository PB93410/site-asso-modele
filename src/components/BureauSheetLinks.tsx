import { Download, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TARIF_LABEL } from '../data/asso';
import { getBureauToken } from './BureauAuthGate';

type Props = {
  essaisUrl: string;
  adherentsUrl: string;
  variant?: 'bar' | 'card';
};

/** Télécharge toutes les données du bureau en un fichier Excel (/api/bureau-export). */
function ExportExcel({ className }: { className: string }) {
  const [etat, setEtat] = useState<'' | 'encours' | 'erreur'>('');
  const telecharger = async () => {
    setEtat('encours');
    try {
      const res = await fetch('/api/bureau-export', { headers: { Authorization: `Bearer ${getBureauToken() || ''}` } });
      if (!res.ok) throw new Error(String(res.status));
      const nom = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'donnees.xlsx';
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setEtat('');
    } catch {
      setEtat('erreur');
    }
  };
  return (
    <>
      <button type="button" onClick={telecharger} disabled={etat === 'encours'} className={className}>
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        {etat === 'encours' ? 'Préparation…' : 'Télécharger tout (Excel)'}
      </button>
      {etat === 'erreur' ? (
        <p role="alert" className="w-full text-sm text-red-700">
          Le téléchargement n’a pas marché. Réessayez dans un instant.
        </p>
      ) : null}
    </>
  );
}

/** Liens tableaux Google (si les données y sont) et export Excel — mail / agenda = routes /bureau/*. */
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

  const google = Boolean(essaisUrl || adherentsUrl);
  return (
    <div className="rounded-xl border border-black/10 p-4 space-y-3 bg-white">
      <h3 className="font-display font-bold text-base text-brand-black">{google ? 'Tableaux Google' : 'Tableaux'}</h3>
      <p className="text-sm text-brand-gray leading-relaxed">
        Relances (conversion {TARIF_LABEL}, rappel à 7 jours) : bouton vert. Onglets À payer et
        Essais = ce qu’il reste à faire.{' '}
        {google
          ? '« Fait » sur le téléphone ne remplace pas la Sheet. Pour tout voir : tableaux Google.'
          : 'Pour tout voir, ou garder une copie : le fichier Excel (adhérents, essais, horaires, événements).'}
      </p>
      <div className="flex flex-wrap gap-2">
        {links}
        <ExportExcel className={google ? 'inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border border-black/10 bg-white font-semibold text-[15px] text-brand-black w-full sm:w-auto' : btn} />
      </div>
    </div>
  );
}
