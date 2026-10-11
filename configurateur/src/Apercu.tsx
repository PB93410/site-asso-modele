import { couleurLisible, couleurSurvol, type Dossier } from '../../src/lib/dossier.js';

/** Aperçu fidèle aux couleurs : haut de la page d'accueil et carte d'adhérent. */

function useCouleurs(d: Dossier) {
  const primaire = couleurLisible(d.apparence.couleur) || '#334155';
  return { primaire, survol: couleurSurvol(primaire) };
}

export function ApercuAccueil({ d }: { d: Dossier }) {
  const { primaire } = useCouleurs(d);
  const nomCourt = d.association.nomCourt || d.association.sigle || 'Votre asso';
  const fond = d.apparence.hero
    ? `linear-gradient(90deg, rgba(17,17,16,.82), rgba(17,17,16,.35)), url(${d.apparence.hero}) center/cover`
    : `linear-gradient(135deg, ${primaire}, #1A1916)`;
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white" aria-label="Aperçu de la page d’accueil">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111110] text-white">
        {d.apparence.logo ? <img src={d.apparence.logo} alt="" className="w-7 h-7 object-contain rounded" /> : null}
        <span className="font-extrabold tracking-wide text-[14px] uppercase truncate">{nomCourt}</span>
        <span className="ml-auto rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: primaire }}>
          Essayer un cours
        </span>
      </div>
      <div className="px-4 py-8 text-white" style={{ background: fond }}>
        <p className="text-[12px] uppercase tracking-widest opacity-80">Saison {d.saison.label}</p>
        <p className="mt-1 text-[24px] leading-tight font-black max-w-[16rem]">
          {d.association.slogan || 'Bouger à son rythme, ensemble'}
        </p>
        <p className="mt-2 text-[13px] opacity-90">
          {d.association.accroche || 'Vos activités'}
          {d.association.ville ? ` à ${d.association.ville}` : ''}
        </p>
        <span className="inline-block mt-4 rounded-full px-4 py-2 text-[13px] font-semibold" style={{ background: primaire }}>
          {Number(d.adhesion.essais) > 0 ? `${d.adhesion.essais} essai${Number(d.adhesion.essais) > 1 ? 's' : ''} gratuit${Number(d.adhesion.essais) > 1 ? 's' : ''}` : 'Adhérer'}
        </span>
      </div>
    </div>
  );
}

export function ApercuCarte({ d }: { d: Dossier }) {
  const { primaire } = useCouleurs(d);
  const [a, b] = d.saison.label.split('-');
  const numero = `${d.association.sigle || 'ASSO'}-${(a || '').slice(2)}${(b || '').slice(2)}-001`;
  return (
    <div
      className="relative w-full aspect-[1011/638] rounded-[5%] overflow-hidden bg-[#111110] text-white shadow-md"
      aria-label="Aperçu de la carte d’adhérent"
    >
      <div className="absolute left-0 top-0 w-[2.9%] h-[78%]" style={{ background: primaire }} />
      <div className="absolute left-0 top-[78%] w-full h-[1.1%]" style={{ background: primaire }} />
      <div className="absolute left-0 top-[79.1%] w-full bottom-0 bg-[#1A1916]" />
      {d.apparence.logo ? (
        <img src={d.apparence.logo} alt="" className="absolute right-[2%] top-[4.4%] w-[20.8%] aspect-square object-contain rounded-full" />
      ) : null}
      <p className="absolute left-[6.3%] top-[6%] font-extrabold text-[clamp(14px,5vw,30px)] leading-none uppercase" style={{ color: primaire }}>
        {d.association.nomCourt || d.association.sigle || 'ASSO'}
      </p>
      <p className="absolute left-[6.3%] top-[19%] text-[clamp(6px,1.4vw,9px)] tracking-[0.24em] text-[#B2AEA7] uppercase">
        {[d.association.ville, d.association.codePostal, d.association.anneeCreation ? `depuis ${d.association.anneeCreation}` : '']
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="absolute left-[6.3%] top-[41%] text-[clamp(7px,1.6vw,11px)] tracking-[0.22em]" style={{ color: primaire }}>
        ADHÉRENT
      </p>
      <p className="absolute left-[6.3%] top-[50%] font-extrabold text-[clamp(16px,6vw,36px)] leading-none">CAMILLE EXEMPLE</p>
      <p className="absolute left-[6.3%] bottom-[4%] font-bold text-[clamp(9px,2.4vw,15px)]">{d.saison.label.replace('-', ' – ')}</p>
      <p className="absolute right-[5%] bottom-[3.5%] font-extrabold text-[clamp(11px,3.4vw,22px)]" style={{ color: primaire }}>
        {numero}
      </p>
    </div>
  );
}
