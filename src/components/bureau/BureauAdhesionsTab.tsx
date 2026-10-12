import { ExternalLink, MessageCircle, Search, Wallet } from 'lucide-react';
import { formatTelFr } from '../../lib/bureauSearch';
import { PersonNameButton } from './BureauPersonSheet';
import { EnTete, Initiales, Vide } from './ui';
import { bouton, carte } from './styles';

type AdhesionItem = {
  row: number;
  nom: string;
  prenom: string;
  tel: string;
  mode: string;
  montant: string;
  detail: string;
  dateDemande: string;
};

type Props<T extends AdhesionItem> = {
  pendingVisible: T[];
  loading: boolean;
  qPeople: string;
  busyRow: string | null;
  adherentsSheetUrl: string;
  onAskPay: (item: T) => void;
  waUrl: (tel: string, text: string) => string | null;
  msgRelancePaiement: (prenom: string) => string;
  sheetRangeUrl: (base: string, row: number) => string;
  formatDemandeShort: (raw: string) => string;
  onOpenPerson: (tel: string, prenom: string) => void;
};

export default function BureauAdhesionsTab<T extends AdhesionItem>({
  pendingVisible,
  loading,
  qPeople,
  busyRow,
  adherentsSheetUrl,
  onAskPay,
  waUrl,
  msgRelancePaiement,
  sheetRangeUrl,
  formatDemandeShort,
  onOpenPerson,
}: Props<T>) {
  return (
    <div className="space-y-5">
      <EnTete titre="À payer" aide="Un paiement en ligne ne passe pas tout seul en À jour : confirmez-le ici quand l’argent est arrivé." />
      {pendingVisible.length === 0 && !loading ? (
        qPeople ? (
          <Vide icone={Search} titre="Personne avec ce nom ou ce numéro" />
        ) : (
          <Vide icone={Wallet} titre="Rien à encaisser pour le moment" aide="Les nouvelles adhésions apparaissent ici." />
        )
      ) : null}
      {pendingVisible.map((item) => {
        const isBusy = busyRow === `adh-${item.row}`;
        const telLabel = formatTelFr(item.tel);
        const wa = telLabel ? waUrl(item.tel, msgRelancePaiement(item.prenom)) : null;
        const sheetHref = sheetRangeUrl(adherentsSheetUrl, item.row);
        const cheque = String(item.mode || '').startsWith('Chèque');
        return (
          <article key={item.row} className={`${carte} p-4 space-y-3`}>
            <div className="flex items-start gap-3">
              <Initiales prenom={item.prenom} nom={item.nom} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-brand-black leading-snug">
                  <PersonNameButton prenom={item.prenom} nom={item.nom} tel={item.tel} onOpen={onOpenPerson} />
                </h3>
                <p className="text-sm text-slate-500">
                  {[item.mode, cheque ? item.detail?.trim() || 'n° non saisi' : '', formatDemandeShort(item.dateDemande)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {telLabel ? <p className="text-sm text-slate-500 tabular-nums">{telLabel}</p> : null}
              </div>
              {item.montant ? (
                <span className="shrink-0 font-display font-bold text-lg text-brand-black tabular-nums">
                  {/€/.test(item.montant) ? item.montant : `${item.montant} €`}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onAskPay(item)}
                className={`${bouton.principal} col-span-2`}
              >
                {isBusy ? 'Enregistrement…' : 'J’ai reçu l’argent'}
              </button>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={`${bouton.whatsapp} ${sheetHref ? '' : 'col-span-2'}`}>
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  Relancer
                </a>
              ) : null}
              {sheetHref ? (
                <a href={sheetHref} target="_blank" rel="noopener noreferrer" className={`${bouton.secondaire} ${wa ? '' : 'col-span-2'}`}>
                  Feuille
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
