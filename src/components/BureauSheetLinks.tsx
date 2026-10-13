import { Download, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TARIF_LABEL } from '../data/asso';
import { getBureauToken } from '../lib/bureauSession';

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
      : 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-white ring-1 ring-black/10 hover:bg-black/[0.03] text-brand-black font-semibold text-sm w-full sm:w-auto';

  const relancesBtn =
    variant === 'bar'
      ? 'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-[#25D366] text-white text-sm font-semibold'
      : 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/15 text-[#128C4B] font-semibold text-sm w-full sm:w-auto';

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
    <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(17,17,16,0.04)] p-4 space-y-3">
      <h3 className="font-semibold text-brand-black">{google ? 'Tableaux Google' : 'Tableaux'}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">
        Relances (conversion {TARIF_LABEL}, rappel à 7 jours) : bouton vert. Onglets À payer et
        Essais = ce qu’il reste à faire.{' '}
        {google
          ? '« Fait » sur le téléphone ne remplace pas la Sheet. Pour tout voir : tableaux Google.'
          : 'Pour tout voir, ou garder une copie : le fichier Excel (adhérents, essais, horaires, événements).'}
      </p>
      <div className="flex flex-wrap gap-2">
        {links}
        <ExportExcel className={`${btn} ${google ? '' : 'bg-brand-olive text-white ring-0 hover:bg-brand-olive-hover'}`} />
      </div>
    </div>
  );
}
