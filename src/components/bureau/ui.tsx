/**
 * Briques visuelles du bureau : mêmes coins, mêmes couleurs, mêmes tailles partout.
 * Couleur d'accent : brand-olive (asso.config.js → couleurs.secondaire).
 */
import type { ComponentType, ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { carte } from './styles';

const TEINTES = [
  'bg-violet-100 text-violet-800',
  'bg-sky-100 text-sky-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-lime-100 text-lime-800',
];

/** Pastille aux initiales, couleur stable pour une même personne. */
export function Initiales({ prenom, nom, taille = 'md' }: { prenom: string; nom: string; taille?: 'sm' | 'md' }) {
  const p = String(prenom || '').trim();
  const n = String(nom || '').trim();
  const lettres = `${p.charAt(0)}${n.charAt(0)}`.toUpperCase() || '?';
  let h = 0;
  for (const c of `${p} ${n}`.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const dim = taille === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <span aria-hidden="true" className={`${dim} ${TEINTES[h % TEINTES.length]} shrink-0 rounded-full inline-flex items-center justify-center font-semibold`}>
      {lettres}
    </span>
  );
}

const STATUTS: Record<string, string> = {
  'à venir': 'bg-amber-100 text-amber-900',
  confirmé: 'bg-sky-100 text-sky-900',
  venu: 'bg-emerald-100 text-emerald-900',
  absent: 'bg-slate-100 text-slate-700',
  annulé: 'bg-slate-100 text-slate-700',
  relancé: 'bg-violet-100 text-violet-900',
  adhérent: 'bg-emerald-100 text-emerald-900',
  'en attente': 'bg-amber-100 text-amber-900',
  'à jour': 'bg-emerald-100 text-emerald-900',
};

/** Statut en pastille colorée (À venir, Confirmé, Venu, Absent…). */
export function Statut({ children }: { children: string }) {
  const t = String(children || '').trim();
  if (!t) return null;
  const couleur = STATUTS[t.toLowerCase()] || 'bg-slate-100 text-slate-700';
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${couleur}`}>{t}</span>;
}

/** Choix exclusif en pilules (vues d'une liste). */
export function Segments<T extends string>({
  options,
  valeur,
  onChange,
  label,
}: {
  options: { id: T; label: string; compte?: number }[];
  valeur: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 p-1 rounded-2xl bg-black/[0.04]">
      {options.map((o) => {
        const actif = o.id === valeur;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.id)}
            className={`flex-1 min-w-0 min-h-[40px] px-2 rounded-xl text-[13px] sm:text-sm font-semibold whitespace-nowrap truncate transition-colors ${
              actif ? 'bg-white text-brand-black shadow-sm ring-1 ring-black/5' : 'text-slate-600 hover:text-brand-black'
            }`}
          >
            {o.label}
            {o.compte ? <span className={`ml-1.5 ${actif ? 'text-brand-olive' : 'text-slate-400'}`}>{o.compte}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Liste vide : une phrase qui rassure, pas une excuse. */
export function Vide({ titre, aide, icone: Icone = CheckCircle2 }: { titre: string; aide?: string; icone?: ComponentType<{ className?: string }> }) {
  return (
    <div className={`${carte} px-4 py-10 text-center`}>
      <span className="mx-auto mb-3 w-12 h-12 rounded-full bg-brand-olive-soft text-brand-olive inline-flex items-center justify-center">
        <Icone className="w-6 h-6" />
      </span>
      <p className="font-semibold text-brand-black">{titre}</p>
      {aide ? <p className="text-sm text-slate-500 mt-1">{aide}</p> : null}
    </div>
  );
}

/** Intertitre de groupe dans une liste. */
export function Intertitre({ children, compte }: { children: ReactNode; compte?: number }) {
  return (
    <h3 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">
      {children}
      {compte ? <span className="text-brand-olive normal-case tracking-normal">{compte}</span> : null}
    </h3>
  );
}

/** En-tête de page : titre, phrase d'aide, retour éventuel. */
export function EnTete({ titre, aide, onRetour, retour = 'Autre', action }: { titre: string; aide?: ReactNode; onRetour?: () => void; retour?: string; action?: ReactNode }) {
  return (
    <div className="space-y-2">
      {onRetour ? (
        <button
          type="button"
          onClick={onRetour}
          className="-ml-2 inline-flex items-center gap-1.5 min-h-[40px] px-2 rounded-xl text-sm font-semibold text-brand-olive hover:bg-brand-olive-soft"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {retour}
        </button>
      ) : null}
      <div className="flex items-start gap-3 px-1">
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-2xl text-brand-black leading-tight">{titre}</h2>
          {aide ? <p className="text-sm text-slate-500 mt-1 leading-relaxed">{aide}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

/** Bouton « ← Autre » (ou autre retour) en tête de sous-page. */
export function Retour({ onClick, label = 'Autre' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 inline-flex items-center gap-1.5 min-h-[40px] px-2 rounded-xl text-sm font-semibold text-brand-olive hover:bg-brand-olive-soft"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  );
}

/** Groupe de lignes de menu, sous un petit titre. */
export function MenuGroupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-500 px-1">{titre}</h3>
      <div className={`${carte} overflow-hidden divide-y divide-black/[0.06]`}>{children}</div>
    </section>
  );
}

/** Ligne de menu : icône, libellé, aide, compteur éventuel ; bouton ou lien. */
export function MenuLigne({
  icone: Icone,
  label,
  aide,
  compte = 0,
  onClick,
  to,
  discret = false,
}: {
  icone: ComponentType<{ className?: string }>;
  label: string;
  aide?: string;
  compte?: number;
  onClick?: () => void;
  to?: string;
  discret?: boolean;
}) {
  const classe = 'w-full flex items-center gap-3 px-4 py-3 min-h-[64px] text-left hover:bg-black/[0.02]';
  const contenu = (
    <>
      <span
        className={`w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0 ${
          discret ? 'bg-black/[0.04] text-slate-500' : 'bg-brand-olive-soft text-brand-olive'
        }`}
      >
        <Icone className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-semibold ${discret ? 'text-slate-600' : 'text-brand-black'}`}>{label}</span>
        {aide ? <span className="block text-sm text-slate-500 truncate">{aide}</span> : null}
      </span>
      {compte > 0 ? (
        <span className="min-w-[2rem] h-7 px-2.5 rounded-full bg-orange-primary text-white text-sm font-semibold inline-flex items-center justify-center">
          {compte}
        </span>
      ) : null}
      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classe}>
        {contenu}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classe}>
      {contenu}
    </button>
  );
}
