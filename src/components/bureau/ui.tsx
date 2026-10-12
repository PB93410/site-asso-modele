/**
 * Briques visuelles du bureau : mêmes coins, mêmes couleurs, mêmes tailles partout.
 * Couleur d'accent : brand-olive (asso.config.js → couleurs.secondaire).
 */
import type { ComponentType, ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
