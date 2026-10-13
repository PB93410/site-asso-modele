import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import { useScheduleFromSheet } from '../hooks/useSheetData';
import { libelleDate, libelleHeure, parisMaintenant, sansCoursLe } from '../lib/accueil';
import { seances } from '../lib/mesCours';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

/** Espace adhérent sans mot de passe : e-mail → code → session de 90 jours (cookie). */

type Doc = { id: string; label: string };
type Fiche = {
  cle: string;
  prenom: string;
  nom: string;
  numero: string;
  statut: string;
  aJour: boolean;
  mode: string;
  montant: string;
  datePaiement: string;
  paiement: { montant: string; reference: string; url: string; nom: string; iban: string; autres: string[] } | null;
  carte: boolean;
  wallet: boolean;
  attestations: Doc[];
  presences: { total: number; dernieres: { date: string; cours: string; horaire: string }[] } | null;
  droitImage: string;
  mesCours: { cours: string[]; choisis: boolean };
  agenda: string;
  reinscription: {
    possible: boolean;
    faite: string;
    tel: string;
    adresse: string;
    codePostal: string;
    ville: string;
    droitImage: string;
    cours: string[];
  } | null;
};
type PeriodeReinscription = { saison: string; au: string; cours: string[]; modes: string[] };
type Moi = {
  connecte: boolean;
  mail?: string;
  fiches?: Fiche[];
  signaler?: boolean;
  contact?: string;
  coursClub?: string[];
  reinscription?: PeriodeReinscription | null;
};
type Etape = 'chargement' | 'mail' | 'code' | 'lien' | 'espace';

const API = '/api/espace';
const champ = 'mt-1 w-full min-h-[48px] rounded-xl border border-black/10 bg-[#FDF8F1] px-3 text-[16px]';
const bouton = 'w-full min-h-[48px] rounded-full bg-orange-primary text-white font-semibold disabled:opacity-60';
const boutonSecondaire =
  'inline-flex items-center justify-center min-h-[48px] px-5 rounded-full border-2 border-orange-primary text-orange-primary font-semibold';
const url = (action: string, f: Fiche, extra: Record<string, string> = {}) =>
  `${API}?${new URLSearchParams({ action, cle: f.cle, ...extra })}`;

async function poster(action: string, corps: Record<string, unknown> = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...corps }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Une erreur est survenue. Réessayez.');
  return data;
}

/** « 2026-10-13 » → « 13/10/2026 ». */
const dateFr = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : s);

function Carte({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/10 p-5 sm:p-6 space-y-3">
      <h2 className="font-display font-bold text-[20px] text-brand-black">{titre}</h2>
      {children}
    </section>
  );
}

function Signaler({ fiche, contact }: { fiche: Fiche; contact: string }) {
  const [message, setMessage] = useState('');
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok'>('');
  const [err, setErr] = useState('');
  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setEtat('envoi');
    try {
      await poster('signaler', { cle: fiche.cle, message });
      setEtat('ok');
      setMessage('');
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Envoi impossible.');
      setEtat('');
    }
  }
  if (etat === 'ok') {
    return <p className="font-body text-[16px] text-brand-olive">Merci, le bureau a reçu votre message et mettra votre fiche à jour.</p>;
  }
  return (
    <form onSubmit={(e) => void envoyer(e)} className="space-y-3">
      <label className="block">
        <span className="font-body text-[16px] text-brand-gray">
          Nouvelle adresse, nouveau téléphone, autre e-mail… Le bureau corrige votre fiche.
        </span>
        <textarea
          className={`${champ} min-h-[96px] py-2`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1500}
          required
        />
      </label>
      <button type="submit" disabled={etat === 'envoi' || message.trim().length < 3} className={bouton}>
        {etat === 'envoi' ? 'Envoi…' : 'Envoyer au bureau'}
      </button>
      {err ? (
        <p className="font-body text-[15px] text-red-800">
          {err} {contact ? `(${contact})` : ''}
        </p>
      ) : null}
    </form>
  );
}

function Choix({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`min-h-[44px] px-4 rounded-full font-semibold text-[15px] ${actif ? 'bg-brand-black text-white' : 'bg-white ring-1 ring-black/15 text-brand-black'}`}
    >
      {children}
    </button>
  );
}

/** Réinscription pour la saison suivante : fiche reprise, on ne demande que ce qui change. */
function Reinscription({ f, periode, onFait }: { f: Fiche; periode: PeriodeReinscription; onFait: () => void }) {
  const r = f.reinscription!;
  const saison = periode.saison.replace('-', '/');
  const [ouvert, setOuvert] = useState(false);
  const [tel, setTel] = useState(r.tel);
  const [adresse, setAdresse] = useState(r.adresse);
  const [codePostal, setCodePostal] = useState(r.codePostal);
  const [ville, setVille] = useState(r.ville);
  const [cours, setCours] = useState<string[]>(r.cours.filter((c) => periode.cours.includes(c)));
  const [mode, setMode] = useState('');
  const [droitImage, setDroitImage] = useState(r.droitImage === 'Oui' || r.droitImage === 'Non' ? r.droitImage : '');
  const [qsSport, setQsSport] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (r.faite) {
    return (
      <Carte titre={`Saison ${saison}`}>
        <p className="font-body text-[16px] text-brand-olive font-semibold">Réinscription reçue le {r.faite}.</p>
        <p className="font-body text-[15px] text-brand-gray">
          Vous paierez à la rentrée. La nouvelle carte arrivera quand le paiement sera confirmé.
        </p>
      </Carte>
    );
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await poster('reinscrire', {
        cle: f.cle,
        telephone: tel,
        adresse,
        code_postal: codePostal,
        ville,
        cours,
        mode_paiement: mode,
        droit_image: droitImage,
        qs_sport: qsSport,
        message,
      });
      onFait();
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (!ouvert) {
    return (
      <Carte titre={`Saison ${saison}`}>
        <p className="font-body text-[16px] text-brand-gray">
          Gardez votre place : votre fiche est déjà remplie, vous vérifiez et vous choisissez vos cours. Le paiement se
          fait à la rentrée.
        </p>
        <button type="button" onClick={() => setOuvert(true)} className={bouton}>
          Me réinscrire pour {saison}
        </button>
      </Carte>
    );
  }

  const legende = 'font-semibold text-brand-black';
  return (
    <Carte titre={`Réinscription ${saison}`}>
      <form onSubmit={(e) => void envoyer(e)} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className={legende}>Vos coordonnées (corrigez si besoin)</legend>
          <label className="block">
            <span className="font-body text-[15px] text-brand-gray">Téléphone</span>
            <input className={champ} inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} required />
          </label>
          <label className="block">
            <span className="font-body text-[15px] text-brand-gray">Adresse</span>
            <input className={champ} autoComplete="street-address" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </label>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <label className="block">
              <span className="font-body text-[15px] text-brand-gray">Code postal</span>
              <input className={champ} inputMode="numeric" autoComplete="postal-code" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} />
            </label>
            <label className="block">
              <span className="font-body text-[15px] text-brand-gray">Ville</span>
              <input className={champ} autoComplete="address-level2" value={ville} onChange={(e) => setVille(e.target.value)} />
            </label>
          </div>
          <p className="font-body text-[14px] text-brand-gray">Nom, date de naissance ou e-mail à changer ? Dites-le dans le message en bas.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={legende}>Vos cours en {saison}</legend>
          <div className="flex flex-wrap gap-2">
            {periode.cours.map((c) => (
              <Choix key={c} actif={cours.includes(c)} onClick={() => setCours((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}>
                {c}
              </Choix>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={legende}>Vous paierez à la rentrée par…</legend>
          <div className="flex flex-wrap gap-2">
            {periode.modes.map((m) => (
              <Choix key={m} actif={mode === m} onClick={() => setMode(m)}>
                {m}
              </Choix>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={legende}>Photos pendant les cours</legend>
          <p className="font-body text-[14px] text-brand-gray">Parfois une photo de groupe (site, réseaux de l’association).</p>
          <div className="flex flex-wrap gap-2">
            <Choix actif={droitImage === 'Oui'} onClick={() => setDroitImage('Oui')}>
              Oui, pas de souci
            </Choix>
            <Choix actif={droitImage === 'Non'} onClick={() => setDroitImage('Non')}>
              Non, je préfère éviter
            </Choix>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={legende}>Questionnaire santé QS-SPORT pour {saison}</legend>
          <p className="font-body text-[14px] text-brand-gray">À remplir chaque saison. Vous l’avez fait ?</p>
          <div className="flex flex-wrap gap-2">
            <Choix actif={qsSport === 'Oui'} onClick={() => setQsSport('Oui')}>
              Oui, c’est fait
            </Choix>
            <Choix actif={qsSport === 'Non'} onClick={() => setQsSport('Non')}>
              Pas encore
            </Choix>
          </div>
        </fieldset>

        <label className="block">
          <span className={legende}>Un message pour le bureau ? (facultatif)</span>
          <textarea className={`${champ} min-h-[80px] py-2`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={800} />
        </label>

        <button type="submit" disabled={busy || !cours.length || !mode || !droitImage || !qsSport} className={bouton}>
          {busy ? 'Envoi…' : 'Valider ma réinscription'}
        </button>
        {!busy && (!cours.length || !mode || !droitImage || !qsSport) ? (
          <p className="font-body text-[14px] text-brand-gray">Choisissez au moins un cours et répondez aux trois questions.</p>
        ) : null}
        {err ? <p className="font-body text-[15px] text-red-800">{err}</p> : null}
      </form>
    </Carte>
  );
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** « 2026-10-19 » → « lundi 19 octobre ». */
const jourLong = (ymd: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${ymd}T12:00:00Z`));

/** Mes cours : ceux que je suis, les prochaines séances (vacances comprises), et l'agenda du téléphone. */
function MesCours({ f, coursClub }: { f: Fiche; coursClub: string[] }) {
  const { schedule } = useScheduleFromSheet();
  const [cours, setCours] = useState<string[]>(f.mesCours.cours);
  const [edition, setEdition] = useState(!f.mesCours.cours.length);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [aujourdhui] = useState(() => parisMaintenant(new Date()).ymd);
  const prochaines = seances(schedule, cours, { du: aujourdhui, jours: 14, saison: ASSO.saison });
  const sans = sansCoursLe(aujourdhui, ASSO.saison);
  // Vacances qui commencent dans les deux semaines : on les annonce.
  const dans14 = new Date(Date.parse(`${aujourdhui}T12:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10);
  const pause = (ASSO.saison.pauses || []).find((p) => p.du > aujourdhui && p.du <= dans14);

  async function enregistrer() {
    setBusy(true);
    setInfo('');
    try {
      const d = await poster('mes-cours', { cle: f.cle, cours });
      setCours(d.cours);
      setEdition(false);
    } catch (x) {
      setInfo(x instanceof Error ? x.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function copier() {
    await navigator.clipboard.writeText(f.agenda).catch(() => window.prompt('Lien de l’agenda :', f.agenda));
    setInfo('Lien copié : collez-le dans votre agenda (« Ajouter un calendrier » → « Par URL »).');
  }

  return (
    <Carte titre="Mes cours">
      {edition ? (
        <>
          <p className="font-body text-[15px] text-brand-gray">Cochez les cours que vous suivez cette saison.</p>
          <div className="flex flex-wrap gap-2">
            {coursClub.map((c) => (
              <Choix key={c} actif={cours.includes(c)} onClick={() => setCours((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}>
                {c}
              </Choix>
            ))}
          </div>
          <button type="button" disabled={busy || !cours.length} onClick={() => void enregistrer()} className={bouton}>
            {busy ? 'Enregistrement…' : 'Enregistrer mes cours'}
          </button>
        </>
      ) : (
        <>
          <p className="font-body text-[16px] text-brand-black">
            {cours.join(', ')}{' '}
            <button type="button" onClick={() => setEdition(true)} className="font-semibold text-brand-olive underline min-h-[44px]">
              changer
            </button>
          </p>
          {sans?.raison === 'vacances' ? (
            <p className="font-body text-[15px] text-brand-gray">
              Pas de cours pendant les {sans.libelle} : reprise {libelleDate(sans.reprise)}.
            </p>
          ) : null}
          {prochaines.length ? (
            <ul className="font-body text-[15px] text-brand-black space-y-1">
              {prochaines.slice(0, 6).map((s, i) => (
                <li key={i}>
                  {majuscule(s.ymd === aujourdhui ? 'aujourd’hui' : jourLong(s.ymd))} · {libelleHeure(s.debut)} ·{' '}
                  <strong>{s.creneau.course}</strong>
                  {s.creneau.location ? <span className="text-brand-gray"> — {s.creneau.location}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-[15px] text-brand-gray">Pas de séance dans les deux semaines qui viennent.</p>
          )}
          {pause ? (
            <p className="font-body text-[15px] text-brand-gray">
              {majuscule(pause.libelle)} à partir du {jourLong(pause.du)}, reprise {libelleDate(pause.reprise)}.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-1">
            <a href={f.agenda.replace(/^https?:/, 'webcal:')} className={boutonSecondaire}>
              Ajouter à mon agenda
            </a>
            <button type="button" onClick={() => void copier()} className="min-h-[44px] font-semibold text-brand-olive">
              Copier le lien de l’agenda
            </button>
          </div>
          <p className="font-body text-[14px] text-brand-gray">
            L’agenda de votre téléphone se met à jour tout seul : vacances, jours fériés et cours annulés compris.
          </p>
        </>
      )}
      {info ? <p className="font-body text-[15px] text-brand-gray">{info}</p> : null}
    </Carte>
  );
}

/** Photos : l'adhérent change sa réponse ; la fiche est mise à jour et le bureau prévenu. */
function Photos({ f }: { f: Fiche }) {
  const [valeur, setValeur] = useState(f.droitImage);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  async function choisir(v: 'Oui' | 'Non') {
    if (v === valeur) return;
    setBusy(true);
    setInfo('');
    try {
      await poster('droit-image', { cle: f.cle, valeur: v });
      setValeur(v);
      setInfo(v === 'Non' ? 'C’est noté : plus de photo où l’on vous reconnaît. Le bureau est prévenu.' : 'C’est noté, merci. Le bureau est prévenu.');
    } catch (x) {
      setInfo(x instanceof Error ? x.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Carte titre="Photos pendant les cours">
      <p className="font-body text-[15px] text-brand-gray">
        Parfois une photo de groupe pour le site ou les réseaux de l’association. Vous pouvez changer d’avis à tout moment.
      </p>
      <div className="flex flex-wrap gap-2">
        <Choix actif={valeur === 'Oui'} onClick={() => void choisir('Oui')}>
          {busy && valeur !== 'Oui' ? '…' : 'Oui, pas de souci'}
        </Choix>
        <Choix actif={valeur === 'Non'} onClick={() => void choisir('Non')}>
          {busy && valeur !== 'Non' ? '…' : 'Non, je préfère éviter'}
        </Choix>
      </div>
      {info ? <p className="font-body text-[15px] text-brand-olive">{info}</p> : null}
    </Carte>
  );
}

function VueFiche({ f, moi, onMaj }: { f: Fiche; moi: Moi; onMaj: () => void }) {
  const statut = f.aJour ? 'À jour' : f.statut === 'En attente' ? 'En attente de paiement' : f.statut || '—';
  return (
    <div className="space-y-4">
      {moi.reinscription && f.reinscription?.possible ? (
        <Reinscription f={f} periode={moi.reinscription} onFait={onMaj} />
      ) : null}
      <Carte titre={`${f.prenom} ${f.nom}`.trim() || 'Ma fiche'}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-body text-[16px]">
          <dt className="text-brand-gray">Saison</dt>
          <dd className="text-brand-black">{ASSO.saison.label.replace('-', '/')}</dd>
          <dt className="text-brand-gray">Adhésion</dt>
          <dd className={f.aJour ? 'text-brand-olive font-semibold' : 'text-brand-black font-semibold'}>{statut}</dd>
          {f.numero ? (
            <>
              <dt className="text-brand-gray">Numéro</dt>
              <dd className="text-brand-black font-mono">{f.numero}</dd>
            </>
          ) : null}
          {f.aJour && f.mode ? (
            <>
              <dt className="text-brand-gray">Réglé</dt>
              <dd className="text-brand-black">
                {f.montant ? `${f.montant} € · ` : ''}
                {f.mode}
                {f.datePaiement ? ` · ${dateFr(f.datePaiement)}` : ''}
              </dd>
            </>
          ) : null}
        </dl>
      </Carte>

      {f.mesCours && f.agenda ? <MesCours f={f} coursClub={moi.coursClub || []} /> : null}

      {f.paiement ? (
        <Carte titre="Reste à payer">
          <p className="font-body text-[16px] text-brand-black">
            <strong>{f.paiement.montant} €</strong> pour la saison {ASSO.saison.label.replace('-', '/')}.
          </p>
          {f.paiement.url ? (
            <a href={f.paiement.url} className={`${bouton} inline-flex items-center justify-center`}>
              Payer en ligne{f.paiement.nom ? ` (${f.paiement.nom})` : ''}
            </a>
          ) : null}
          {f.paiement.iban ? (
            <p className="font-body text-[15px] text-brand-gray">
              Par virement : IBAN <span className="font-mono text-brand-black">{f.paiement.iban}</span>
              {f.paiement.reference ? (
                <>
                  , en indiquant <span className="font-mono text-brand-black">{f.paiement.reference}</span>
                </>
              ) : null}
              .
            </p>
          ) : null}
          {f.paiement.autres.length ? (
            <p className="font-body text-[15px] text-brand-gray">Ou au bureau : {f.paiement.autres.join(', ')}.</p>
          ) : null}
          <p className="font-body text-[14px] text-brand-gray">Déjà payé ? Le bureau le confirme dès que le paiement arrive.</p>
        </Carte>
      ) : null}

      {f.carte ? (
        <Carte titre="Ma carte d’adhérent">
          <img
            src={url('carte', f)}
            alt={`Carte d’adhérent de ${f.prenom} ${f.nom}`}
            className="w-full max-w-[420px] rounded-xl ring-1 ring-black/10"
          />
          <div className="flex flex-wrap gap-3">
            <a href={url('carte', f)} download className={boutonSecondaire}>
              Télécharger
            </a>
            {f.wallet ? (
              <a href={url('wallet', f)} className={boutonSecondaire}>
                Ajouter à Apple Wallet
              </a>
            ) : null}
          </div>
        </Carte>
      ) : null}

      {f.attestations.length ? (
        <Carte titre="Mes attestations">
          <div className="flex flex-wrap gap-3">
            {f.attestations.map((d) => (
              <a key={d.id} href={url('attestation', f, { type: d.id })} download className={boutonSecondaire}>
                {d.label}
              </a>
            ))}
          </div>
        </Carte>
      ) : null}

      {f.presences ? (
        <Carte titre="Mes présences">
          <p className="font-body text-[16px] text-brand-black">
            {f.presences.total
              ? `${f.presences.total} séance${f.presences.total > 1 ? 's' : ''} pointée${f.presences.total > 1 ? 's' : ''} cette saison.`
              : 'Aucune séance pointée pour l’instant.'}
          </p>
          {f.presences.dernieres.length ? (
            <ul className="font-body text-[15px] text-brand-gray space-y-1">
              {f.presences.dernieres.map((p, i) => (
                <li key={i}>
                  {dateFr(p.date)} · {p.cours}
                  {p.horaire ? ` · ${p.horaire}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </Carte>
      ) : null}

      <Photos f={f} />

      <Carte titre="Signaler un changement">
        {moi.signaler ? (
          <Signaler fiche={f} contact={moi.contact || ''} />
        ) : (
          <p className="font-body text-[16px] text-brand-gray">
            Écrivez au bureau : <a href={`mailto:${moi.contact}`} className="text-brand-olive font-semibold">{moi.contact}</a>.
          </p>
        )}
      </Carte>
    </div>
  );
}

export default function EspacePage() {
  const [etape, setEtape] = useState<Etape>('chargement');
  const [mail, setMail] = useState('');
  const [code, setCode] = useState('');
  const [moi, setMoi] = useState<Moi | null>(null);
  const [choix, setChoix] = useState(0);
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  usePageMeta({ title: `${MODULES.espace ? 'Mon espace adhérent' : 'Page introuvable'} — ${ASSO.nom}`, path: '/espace' });

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`${API}?action=moi`);
      const data: Moi = await res.json();
      if (data.connecte) {
        setMoi(data);
        setEtape('espace');
      } else setEtape('mail');
    } catch {
      setErr('Réseau coupé. Rechargez la page dans un instant.');
      setEtape('mail');
    }
  }, []);

  useEffect(() => {
    if (!MODULES.espace) return;
    // Lien du mail : e-mail et code après le #. On les retire tout de suite de l'adresse.
    const h = new URLSearchParams(window.location.hash.slice(1));
    const t = window.setTimeout(() => {
      if (h.get('m') && h.get('c')) {
        setMail(h.get('m') || '');
        setCode(h.get('c') || '');
        setEtape('lien');
        window.history.replaceState(null, '', window.location.pathname);
      } else void charger();
    }, 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  if (!MODULES.espace) return <NotFoundPage />;

  async function demander(e?: FormEvent) {
    e?.preventDefault();
    setErr('');
    setInfo('');
    setBusy(true);
    try {
      const d = await poster('demander', { mail });
      setInfo(d.demo?.code ? `${d.message} En démo, le code est ${d.demo.code}.` : d.message);
      setCode('');
      setEtape('code');
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function verifier(e?: FormEvent) {
    e?.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await poster('verifier', { mail, code });
      setInfo('');
      await charger();
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Vérification impossible.');
      if (etape === 'lien') setEtape('mail');
    } finally {
      setBusy(false);
    }
  }

  async function deconnecter() {
    await poster('deconnecter').catch(() => {});
    setMoi(null);
    setCode('');
    setEtape('mail');
  }

  const fiches = moi?.fiches || [];
  const fiche = fiches[Math.min(choix, Math.max(0, fiches.length - 1))];

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <main id="main-content" className="page-chrome-top content-max-width py-10 sm:py-14 max-w-xl">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">Espace adhérent</p>
        <h1 className="font-display font-black text-brand-black text-[clamp(1.8rem,5vw,2.6rem)] leading-tight mb-4">
          {etape === 'espace' && fiche ? `Bonjour ${fiche.prenom}` : 'Mon espace'}
        </h1>

        {etape === 'chargement' ? <p className="font-body text-[16px] text-brand-gray">Chargement…</p> : null}

        {etape === 'mail' ? (
          <>
            <p className="font-body text-[16px] text-brand-gray mb-6">
              Votre carte, ce qu’il reste à payer, vos attestations et vos présences. Pas de mot de passe : indiquez l’e-mail
              donné à l’inscription, vous recevez un code.
            </p>
            <form onSubmit={(e) => void demander(e)} className="rounded-2xl bg-white ring-1 ring-black/10 p-6 space-y-4">
              <label className="block">
                <span className="font-semibold text-brand-black">Votre e-mail</span>
                <input
                  className={champ}
                  type="email"
                  value={mail}
                  onChange={(e) => setMail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <button type="submit" disabled={busy || !mail} className={bouton}>
                {busy ? 'Envoi…' : 'Recevoir mon code'}
              </button>
            </form>
          </>
        ) : null}

        {etape === 'code' ? (
          <form onSubmit={(e) => void verifier(e)} className="rounded-2xl bg-white ring-1 ring-black/10 p-6 space-y-4">
            {info ? <p className="font-body text-[16px] text-brand-gray">{info}</p> : null}
            <label className="block">
              <span className="font-semibold text-brand-black">Code reçu par mail (6 chiffres)</span>
              <input
                className={`${champ} font-mono tracking-[0.3em] text-[20px]`}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
                required
              />
            </label>
            <button type="submit" disabled={busy || code.replace(/\D/g, '').length !== 6} className={bouton}>
              {busy ? 'Vérification…' : 'Ouvrir mon espace'}
            </button>
            <button
              type="button"
              onClick={() => {
                setErr('');
                setEtape('mail');
              }}
              className="w-full min-h-[44px] font-semibold text-brand-olive"
            >
              Pas reçu ? Changer d’e-mail ou renvoyer un code
            </button>
          </form>
        ) : null}

        {etape === 'lien' ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/10 p-6 space-y-4">
            <p className="font-body text-[16px] text-brand-gray">
              Ouvrir l’espace de <strong className="text-brand-black">{mail}</strong> sur cet appareil ? Il restera ouvert
              90 jours, sauf si vous vous déconnectez.
            </p>
            <button type="button" disabled={busy} onClick={() => void verifier()} className={bouton}>
              {busy ? 'Ouverture…' : 'Ouvrir mon espace'}
            </button>
          </div>
        ) : null}

        {etape === 'espace' && moi ? (
          <div className="space-y-4">
            {fiches.length > 1 ? (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fiches de cette adresse">
                {fiches.map((f, i) => (
                  <button
                    key={f.cle}
                    type="button"
                    role="tab"
                    aria-selected={i === choix}
                    onClick={() => setChoix(i)}
                    className={`min-h-[44px] px-4 rounded-full font-semibold ${i === choix ? 'bg-brand-black text-white' : 'bg-white ring-1 ring-black/10 text-brand-black'}`}
                  >
                    {f.prenom || f.nom}
                  </button>
                ))}
              </div>
            ) : null}
            {fiche ? (
              <VueFiche key={fiche.cle} f={fiche} moi={moi} onMaj={() => void charger()} />
            ) : (
              <p className="font-body text-[16px] text-brand-gray">
                Aucune fiche avec cette adresse pour la saison. Écrivez au bureau : {moi.contact}.
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              <a href={`${API}?action=donnees`} download className="inline-flex min-h-[44px] items-center font-semibold text-brand-olive">
                Télécharger mes données
              </a>
              <button type="button" onClick={() => void deconnecter()} className="min-h-[44px] font-semibold text-brand-olive">
                Me déconnecter
              </button>
            </div>
          </div>
        ) : null}

        {err ? <p className="mt-4 font-body text-[16px] text-red-800">{err}</p> : null}
        <Link to="/" className="inline-flex min-h-[44px] items-center font-semibold text-brand-olive mt-6">
          Retour à l’accueil
        </Link>
      </main>
      <Footer />
    </div>
  );
}
