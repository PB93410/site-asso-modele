import { CalendarCheck, ChevronRight, Phone, Users, Wallet, ListOrdered } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { MODULES } from '../../data/asso';
import { bureauFetch } from '../../lib/bureauApi';
import { cartesApercu, coursPresquePleins, semaineYmd, type ApercuCarte } from '../../lib/bureauApercu';
import { carte } from './styles';

type Props = {
  loading: boolean;
  essaisARappeler: number;
  paiementsEnAttente: number;
  adherents: number;
  todayYmd: string;
  onTab: (tab: 'adhesions' | 'essais') => void;
};

const ICONES: Record<ApercuCarte['id'], ComponentType<{ className?: string }>> = {
  essais: Phone,
  paiements: Wallet,
  coursPleins: ListOrdered,
  presences: CalendarCheck,
  adherents: Users,
};

/** Cartes « en un coup d'œil » en tête de l'accueil du bureau. Modules éteints : carte absente. */
export default function BureauApercu({ loading, essaisARappeler, paiementsEnAttente, adherents, todayYmd, onTab }: Props) {
  const [coursPleins, setCoursPleins] = useState<string[] | null>(null);
  const [presences, setPresences] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    if (MODULES.listeAttente) {
      bureauFetch<{ files: { STATUT?: string; COURS?: string; CRENEAU?: string }[] }>('/api/liste-attente?action=files')
        .then((r) => !stop && setCoursPleins(coursPresquePleins(r.files || [])))
        .catch(() => !stop && setCoursPleins([]));
    }
    if (MODULES.presences) {
      const { lundi, dimanche } = semaineYmd(todayYmd);
      bureauFetch<{ total?: number }>(`/api/presence?action=stats&from=${lundi}&to=${dimanche}`)
        .then((r) => !stop && setPresences(Number(r.total) || 0))
        .catch(() => !stop && setPresences(0));
    }
    return () => {
      stop = true;
    };
  }, [todayYmd]);

  const cartes = cartesApercu(
    {
      essaisARappeler: loading ? null : essaisARappeler,
      paiementsEnAttente: loading ? null : paiementsEnAttente,
      coursPleins,
      presencesSemaine: presences,
      adherents: loading ? null : adherents,
    },
    MODULES,
  );

  return (
    <section aria-labelledby="apercu-titre">
      <h2 id="apercu-titre" className="text-sm font-semibold text-slate-600 px-1 mb-2">
        En un coup d’œil
      </h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-busy={loading || undefined}>
        {cartes.map((c) => {
          const Icone = ICONES[c.id];
          const classe = `${carte} group h-full min-h-[112px] p-4 flex flex-col gap-2 text-left hover:ring-black/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-olive`;
          const contenu = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0 ${
                    c.urgent ? 'bg-orange-primary text-white' : 'bg-brand-olive-soft text-brand-olive'
                  }`}
                >
                  <Icone className="w-5 h-5" />
                </span>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" aria-hidden="true" />
              </span>
              <span className="font-display font-bold text-3xl leading-none text-brand-black">
                {c.compte === null ? <span className="text-slate-400">…</span> : c.compte}
              </span>
              <span className="block font-semibold text-brand-black leading-tight">{c.label}</span>
              <span className="block text-sm text-slate-600 leading-snug">{c.aide}</span>
            </>
          );
          const libelle = `${c.label} : ${c.compte === null ? 'chargement' : c.compte}. ${c.aide}`;
          return (
            <li key={c.id}>
              {'href' in c.cible ? (
                <Link to={c.cible.href} className={classe} aria-label={libelle}>
                  {contenu}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`${classe} w-full`}
                  aria-label={libelle}
                  onClick={() => 'tab' in c.cible && onTab(c.cible.tab)}
                >
                  {contenu}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
