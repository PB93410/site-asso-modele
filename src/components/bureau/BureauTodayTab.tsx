import { ChevronRight, CircleCheck, CreditCard, MessageCircle, Phone, UserCheck, Wallet } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { lireRole, ordonnerActions, retenirRole, ROLES, type RoleBureau } from '../../lib/bureauAFaire';
import { formatTelFr } from '../../lib/bureauSearch';
import { PersonNameButton } from './BureauPersonSheet';
import { Initiales, Statut, Vide } from './ui';
import { carte } from './styles';

type AdhesionItem = {
  row: number;
  nom: string;
  prenom: string;
  tel: string;
  statut: string;
};

/** Créneau du jour avec ses essais attendus. */
export type CreneauDuJour = { slot: string; attendus: number };

type Props = {
  qPeople: string;
  loading: boolean;
  adhesionList: AdhesionItem[];
  ceJour: CreneauDuJour[];
  aPointer: number;
  aConfirmer: number;
  aEncaisser: number;
  relanceP1: number;
  relanceP2: number;
  cartesAPreparer: number;
  onPointer: () => void;
  onCeJour: () => void;
  onConfirmer: () => void;
  onEncaisser: () => void;
  onRelances: () => void;
  onCartes: () => void;
  onOpenPerson: (tel: string, prenom: string) => void;
};

type Action = { cle: string; label: string; aide: string; compte: number; icone: ComponentType<{ className?: string }>; onClick: () => void };

function LigneAction({ a, derniere }: { a: Action; derniere: boolean }) {
  return (
    <button
      type="button"
      onClick={a.onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 min-h-[64px] text-left hover:bg-black/[0.02] ${derniere ? '' : 'border-b border-black/[0.06]'}`}
    >
      <span className="w-10 h-10 rounded-xl bg-brand-olive-soft text-brand-olive inline-flex items-center justify-center shrink-0">
        <a.icone className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-brand-black">{a.label}</span>
        <span className="block text-sm text-slate-500 truncate">{a.aide}</span>
      </span>
      <span className="min-w-[2rem] h-7 px-2.5 rounded-full bg-orange-primary text-white text-sm font-semibold inline-flex items-center justify-center">
        {a.compte}
      </span>
      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
    </button>
  );
}

export default function BureauTodayTab({
  qPeople,
  loading,
  adhesionList,
  ceJour,
  aPointer,
  aConfirmer,
  aEncaisser,
  relanceP1,
  relanceP2,
  cartesAPreparer,
  onPointer,
  onCeJour,
  onConfirmer,
  onEncaisser,
  onRelances,
  onCartes,
  onOpenPerson,
}: Props) {
  const [role, setRole] = useState<RoleBureau>(() => lireRole());
  if (qPeople) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500 px-1">Adhésions trouvées</p>
        {adhesionList.length === 0 && !loading ? (
          <Vide titre="Personne avec ce nom ou ce numéro" aide="Essayez le prénom seul, ou les 4 derniers chiffres du téléphone." />
        ) : (
          <div className={`${carte} overflow-hidden`}>
            {adhesionList.map((item, i) => (
              <div
                key={`adh-${item.row}`}
                className={`flex items-center gap-3 px-4 py-3 ${i < adhesionList.length - 1 ? 'border-b border-black/[0.06]' : ''}`}
              >
                <Initiales prenom={item.prenom} nom={item.nom} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-black truncate">
                    <PersonNameButton prenom={item.prenom} nom={item.nom} tel={item.tel} onOpen={onOpenPerson} />
                  </p>
                  <p className="text-sm text-slate-500 truncate">{formatTelFr(item.tel) || 'Tél. manquant'}</p>
                </div>
                <Statut>{item.statut || 'En attente'}</Statut>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const attendus = ceJour.reduce((n, c) => n + c.attendus, 0);
  const actions: Action[] = [
    { cle: 'pointer', label: 'À pointer', aide: 'Essais passés : venu ou absent ?', compte: aPointer, icone: UserCheck, onClick: onPointer },
    { cle: 'confirmer', label: 'À confirmer', aide: 'Nouvelles demandes d’essai', compte: aConfirmer, icone: Phone, onClick: onConfirmer },
    { cle: 'encaisser', label: 'À encaisser', aide: 'Adhésions en attente de paiement', compte: aEncaisser, icone: Wallet, onClick: onEncaisser },
    { cle: 'relances', label: 'Relances', aide: 'Essais à relancer sur WhatsApp', compte: relanceP1 + relanceP2, icone: MessageCircle, onClick: onRelances },
    { cle: 'cartes', label: 'Cartes à envoyer', aide: 'Adhérents à jour sans carte', compte: cartesAPreparer, icone: CreditCard, onClick: onCartes },
  ];
  const aFaire = ordonnerActions(actions.filter((a) => a.compte > 0), role);
  const rien = actions.filter((a) => a.compte === 0);

  return (
    <div className="space-y-6">
      {ceJour.length > 0 ? (
        <button
          type="button"
          onClick={onCeJour}
          className="w-full text-left rounded-2xl bg-brand-olive text-white p-5 shadow-sm hover:bg-brand-olive-hover"
        >
          <p className="text-sm text-white/80">Aujourd’hui</p>
          <p className="font-display font-bold text-xl leading-tight mt-0.5">
            {attendus} essai{attendus > 1 ? 's' : ''} attendu{attendus > 1 ? 's' : ''}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-white/90">
            {ceJour.map((c) => (
              <li key={c.slot} className="flex justify-between gap-3">
                <span className="truncate">{c.slot}</span>
                <span className="shrink-0">{c.attendus}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
            Voir et pointer <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </p>
        </button>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap px-1">
          <h2 className="text-sm font-semibold text-slate-500">À faire</h2>
          {/* Le rôle ne change que l'ordre de la liste ; il se retient sur ce téléphone. */}
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Je suis">
            <span className="text-sm text-slate-500">Je suis</span>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={role === r.id}
                onClick={() => {
                  setRole(r.id);
                  retenirRole(r.id);
                }}
                className={`min-h-[44px] px-3 rounded-full border text-sm font-medium ${
                  role === r.id ? 'bg-brand-olive text-white border-brand-olive' : 'bg-white border-black/10 text-brand-black'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {loading && aFaire.length === 0 ? (
          <div className={`${carte} p-4 space-y-3`} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-xl bg-black/[0.05] animate-pulse" />
            ))}
          </div>
        ) : aFaire.length === 0 ? (
          <Vide titre="Tout est à jour" aide="Rien à pointer, confirmer ni encaisser." />
        ) : (
          <div className={`${carte} overflow-hidden`}>
            {aFaire.map((a, i) => (
              <LigneAction key={a.cle} a={a} derniere={i === aFaire.length - 1} />
            ))}
          </div>
        )}
        {aFaire.length > 0 && rien.length > 0 && !loading ? (
          <p className="flex items-start gap-2 text-sm text-slate-500 px-1 pt-1">
            <CircleCheck className="w-4 h-4 text-brand-olive shrink-0 mt-0.5" aria-hidden="true" />
            <span>À jour : {rien.map((a) => a.label.toLowerCase()).join(', ')}.</span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
