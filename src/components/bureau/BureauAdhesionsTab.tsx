import { CheckCircle2, ExternalLink, MessageCircle } from 'lucide-react';
import { formatTelFr } from '../../lib/bureauSearch';
import { PersonNameButton } from './BureauPersonSheet';

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
    <div className="space-y-3">
      <h2 className="font-display font-bold text-lg">À payer</h2>
      <p className="text-base text-slate-600">Un paiement en ligne ne passe pas tout seul en À jour.</p>
      {pendingVisible.length === 0 && !loading && (
        <div className="rounded-2xl bg-brand-cream border border-[#E8E6E1] px-4 py-8 text-center text-brand-olive">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
          <p className="font-medium text-base">
            {qPeople ? 'Personne avec ce nom ou ce numéro' : 'Rien à encaisser pour le moment'}
          </p>
        </div>
      )}
      {pendingVisible.map((item) => {
        const isBusy = busyRow === `adh-${item.row}`;
        const telLabel = formatTelFr(item.tel);
        const wa = telLabel ? waUrl(item.tel, msgRelancePaiement(item.prenom)) : null;
        const sheetHref = sheetRangeUrl(adherentsSheetUrl, item.row);
        const meta = [item.mode, item.montant, formatDemandeShort(item.dateDemande)]
          .filter(Boolean)
          .join(' · ');
        return (
          <article
            key={item.row}
            className="rounded-2xl bg-white border border-[#E8E6E1] border-l-[4px] border-l-orange-primary px-4 py-3 space-y-1.5"
          >
            <h3 className="font-semibold text-base text-brand-black leading-snug">
              <PersonNameButton prenom={item.prenom} nom={item.nom} tel={item.tel} onOpen={onOpenPerson} />
            </h3>
            {String(item.mode || '').startsWith('Chèque') ? (
              <p className="text-sm text-brand-gray">
                {item.detail?.trim() ? item.detail.trim() : 'n° non saisi'}
              </p>
            ) : null}
            {meta ? <p className="text-base text-brand-gray">{meta}</p> : null}
            {telLabel ? <p className="text-base text-brand-gray">{telLabel}</p> : null}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 max-[700px]:grid max-[700px]:grid-cols-2">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl border border-[#25D366] bg-transparent text-[#25D366] font-semibold text-sm max-[700px]:w-full"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  WhatsApp
                </a>
              ) : null}
              {sheetHref ? (
                <a
                  href={sheetHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl border border-[#E8E6E1] bg-white font-semibold text-sm max-[700px]:w-full"
                >
                  Ouvrir la feuille
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              ) : null}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onAskPay(item)}
                className="h-11 min-h-[44px] px-3 rounded-xl bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm disabled:opacity-60 max-[700px]:w-full"
              >
                {isBusy ? 'Enregistrement…' : 'J’ai reçu l’argent'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
