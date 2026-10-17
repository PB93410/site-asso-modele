import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Phone,
  CreditCard,
  Landmark,
} from 'lucide-react';
import { SITE_CONFIG } from '../data/siteData';
import {
  ASSO,
  ESSAIS_LABEL,
  IBAN,
  MODE_CARTE,
  MODULES,
  PAIEMENTS_BUREAU,
  PAIEMENT_NOM,
  PAYMENT_MODES,
  TARIF_LABEL,
} from '../data/asso';
import ContactDirect from '../components/ContactDirect';
import { SEASON_LABEL } from '../data/CONFIG';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  ETAPES_ADHESION,
  NB_ETAPES,
  erreurEtape,
  premiereEtapeIncomplete,
  progressionEtape,
} from '../lib/adhesionEtapes';
import { buildHowToJoinSchema } from '../lib/schema';
import { aidesProposees, calculerReste, libelleAides } from '../lib/financement';
import { CONNU_PARRAINAGE, connuDepuisLien } from '../lib/parrainage';

const COURSES = [
  'Gym Douce',
  'Renforcement Musculaire',
  'Cardio & Gym',
  'Stretching',
  'Zumba',
  'Pilates',
] as const;

const BUREAU_MODES = PAYMENT_MODES.filter((m) => m !== MODE_CARTE);

type FormState = {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  date_naissance: string;
  adresse: string;
  code_postal: string;
  ville: string;
  mode_paiement: string;
  numero_cheque: string;
  droit_image: string;
  qs_sport: string;
  deja_adherent: string;
  connu: string;
  parrain: string;
  cours: string[];
  message: string;
  'bot-field': string;
};

const initial: FormState = {
  prenom: '',
  nom: '',
  telephone: '',
  email: '',
  date_naissance: '',
  adresse: '',
  code_postal: '',
  ville: ASSO.ville,
  mode_paiement: '',
  numero_cheque: '',
  droit_image: '',
  qs_sport: '',
  deja_adherent: '',
  connu: '',
  parrain: '',
  cours: [],
  message: '',
  'bot-field': '',
};

function formatDateNaissance(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const jj = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const aaaa = digits.slice(4, 8);
  if (digits.length <= 2) return jj;
  if (digits.length <= 4) return `${jj}/${mm}`;
  return `${jj}/${mm}/${aaaa}`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[44px] px-4 rounded-full font-body text-[14px] font-medium border transition-colors ${
        active
          ? 'bg-orange-primary text-white border-orange-primary'
          : 'bg-white text-brand-black border-black/15 hover:border-orange-primary/50'
      }`}
    >
      {children}
    </button>
  );
}

/** Référence de la demande : à rappeler au bureau, et en libellé du virement. */
function ReferenceDemande({ reference, virement, montant }: { reference: string; virement: boolean; montant: string }) {
  return (
    <div className="max-w-sm mx-auto text-left rounded-2xl bg-[#FDF8F1] p-4 my-4 space-y-1.5">
      <p className="font-body text-[13px] text-brand-gray">Votre référence</p>
      <p className="font-mono text-[20px] font-bold tracking-wider text-brand-black select-all">{reference}</p>
      {virement ? (
        <p className="font-body text-[14px] text-brand-gray leading-relaxed">
          Virement de {montant} à l’ordre de {ASSO.nom}, avec cette référence dans le libellé : le
          bureau reconnaît ainsi votre paiement.
          {IBAN ? (
            <>
              {' '}IBAN : <strong className="font-mono text-brand-black whitespace-nowrap">{IBAN}</strong>
            </>
          ) : (
            ' Le bureau vous donne l’IBAN.'
          )}
        </p>
      ) : (
        <p className="font-body text-[13px] text-brand-gray leading-snug">À rappeler si vous contactez le bureau.</p>
      )}
    </div>
  );
}

/** Message au retour de la page de paiement en ligne (/api/paiement-retour). */
function RetourPaiement({ etat, lienPaiement }: { etat: string; lienPaiement: string }) {
  const reessayer = lienPaiement ? (
    <a
      href={lienPaiement}
      className="inline-flex items-center justify-center gap-2 w-full min-h-[52px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px]"
    >
      <CreditCard size={18} /> Réessayer le paiement
    </a>
  ) : null;
  const textes: Record<string, string> = {
    ok: 'Le bureau prépare votre carte d’adhérent. À très vite au cours !',
    attente: `${PAIEMENT_NOM} confirme votre paiement. Inutile de recommencer : votre adhésion sera validée toute seule dans quelques minutes.`,
    deja: 'Cette adhésion est déjà réglée : rien de plus à faire.',
    refuse: 'Le paiement n’a pas abouti, rien n’a été prélevé. Vous pouvez réessayer, ou régler au bureau.',
    annule: 'Paiement interrompu, rien n’a été prélevé. Vous pouvez reprendre quand vous voulez.',
    erreur: `La page de paiement n’a pas pu s’ouvrir. Réessayez dans un instant, ou réglez au bureau : ${PAIEMENTS_BUREAU}.`,
    patienter: 'Trop d’essais d’affilée : patientez quelques minutes avant de réessayer.',
    introuvable: 'Nous ne retrouvons pas cette demande. Contactez le bureau, il vous aidera.',
  };
  const avecBouton = ['refuse', 'annule', 'erreur', 'patienter'].includes(etat);
  return (
    <div className="max-w-sm mx-auto text-left space-y-3 mb-2">
      <p className="font-body text-[15px] text-brand-gray leading-relaxed">{textes[etat] || textes.attente}</p>
      {avecBouton ? reessayer : null}
    </div>
  );
}

export default function InscriptionPage() {
  const [searchParams] = useSearchParams();
  const alreadyOk = searchParams.get('ok') === '1';
  const modeParam = (searchParams.get('mode') || '').toLowerCase();
  const wantsCarte =
    Boolean(MODE_CARTE) && (modeParam === 'carte' || modeParam === 'cb');
  const [form, setForm] = useState<FormState>(() => ({
    ...initial,
    mode_paiement: wantsCarte ? MODE_CARTE : '',
    connu: connuDepuisLien(searchParams.toString()),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(alreadyOk);
  const [listeAttente, setListeAttente] = useState(false);
  const [passSport, setPassSport] = useState(false);
  const [ancv, setAncv] = useState('');
  const [ce, setCe] = useState('');
  const [paidByCarte, setPaidByCarte] = useState(alreadyOk && wantsCarte);
  // Paiement en ligne branché (HelloAsso) : référence de la demande, lien de paiement, retour de HelloAsso.
  const refParam = (searchParams.get('ref') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
  const [reference, setReference] = useState(alreadyOk ? refParam : '');
  const [lienPaiement, setLienPaiement] = useState(
    alreadyOk && refParam && (searchParams.get('hp') === '1' || searchParams.has('paiement'))
      ? `/api/paiement?ref=${encodeURIComponent(refParam)}`
      : ''
  );
  const [parVirement, setParVirement] = useState(alreadyOk && modeParam === 'virement');
  // Montant à régler (reste à payer après les aides), sinon le tarif.
  const montantParam = (searchParams.get('m') || '').replace(/[^\d.,]/g, '').slice(0, 8);
  const [aPayer, setAPayer] = useState(alreadyOk && montantParam ? `${montantParam} €` : TARIF_LABEL);
  const retourPaiement = alreadyOk ? searchParams.get('paiement') || '' : '';
  const [step, setStep] = useState(1);
  const [paiementReady, setPaiementReady] = useState(false);
  const [errorField, setErrorField] = useState<string | null>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const erreurRef = useRef<HTMLParagraphElement>(null);
  const premierRendu = useRef(true);
  // Arrivée sur le récapitulatif : un double clic sur « Continuer » n'envoie pas la demande.
  const recapPret = useRef(false);
  const TOTAL_STEPS = NB_ETAPES;
  const etapeCourante = ETAPES_ADHESION[step - 1];
  const calc = calculerReste(ASSO.adhesion.tarif, { passSport, ancv, ce }, ASSO.financement);
  const isCarte = Boolean(MODE_CARTE) && form.mode_paiement === MODE_CARTE;
  const isBureau = Boolean(form.mode_paiement) && !isCarte;
  const isCheque = form.mode_paiement.startsWith('Chèque');

  usePageMeta({
    title: `Inscription ${ASSO.nom} ${SEASON_LABEL} — ${TARIF_LABEL}/an`,
    description: `Inscrivez-vous à ${ASSO.nom} (${ASSO.ville}, ${ASSO.codePostal}). Cotisation ${TARIF_LABEL}/an${ESSAIS_LABEL ? `, ${ESSAIS_LABEL}` : ''}. Paiement : ${PAYMENT_MODES.join(', ')}.`,
    ogTitle: `Inscription ${ASSO.nom} ${SEASON_LABEL} — ${TARIF_LABEL}/an`,
    ogDescription: `Cotisation ${TARIF_LABEL}/an • Formulaire simple, le bureau vous recontacte.`,
    path: '/inscription',
  });

  useEffect(() => {
    if (!success) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [success]);

  // Lien « Adhérer en 1 minute » envoyé par le bureau (/inscription?e=JETON) : on reprend prénom, nom et
  // téléphone de l'essai. Le jeton ne contient aucune donnée ; sans lui, ou s'il est périmé, rien ne change.
  const lienEssai = searchParams.get('e') || '';
  const [reprise, setReprise] = useState(false);
  useEffect(() => {
    if (!lienEssai || alreadyOk) return;
    let alive = true;
    fetch(`/api/adhesion-prefill?e=${encodeURIComponent(lienEssai)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { prenom?: string; nom?: string; telephone?: string } | null) => {
        if (!alive || !d?.prenom) return;
        setForm((prev) => ({
          ...prev,
          prenom: prev.prenom || d.prenom || '',
          nom: prev.nom || d.nom || '',
          telephone: prev.telephone || d.telephone || '',
        }));
        setReprise(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lienEssai, alreadyOk]);

  useEffect(() => {
    if (!success || !paidByCarte) return;
    const t = window.setTimeout(() => setPaiementReady(true), 1600);
    return () => {
      window.clearTimeout(t);
      setPaiementReady(false);
    };
  }, [success, paidByCarte]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'mode_paiement' && !String(value || '').startsWith('Chèque')) {
        next.numero_cheque = '';
      }
      return next;
    });
  }

  function toggleCours(name: string) {
    setForm((prev) => ({
      ...prev,
      cours: prev.cours.includes(name)
        ? prev.cours.filter((c) => c !== name)
        : [...prev.cours, name],
    }));
  }

  // Changement d'étape : le titre prend le focus (lecteur d'écran et clavier).
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    titreRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    recapPret.current = false;
    if (step !== TOTAL_STEPS) return;
    const t = window.setTimeout(() => {
      recapPret.current = true;
    }, 800);
    return () => window.clearTimeout(t);
  }, [step, TOTAL_STEPS]);

  function montrerErreur(champ: string | null, message: string) {
    setError(message);
    setErrorField(champ);
    window.setTimeout(() => {
      const el = champ ? document.getElementById(champ) : null;
      (el || erreurRef.current)?.focus();
    }, 0);
  }

  function allerA(n: number) {
    setError(null);
    setErrorField(null);
    const cible = Math.min(Math.max(n, 1), TOTAL_STEPS);
    setStep(cible);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    const err = erreurEtape(step, form, { tarifLabel: TARIF_LABEL });
    if (err) {
      montrerErreur(err.champ, err.message);
      return;
    }
    allerA(step + 1);
  }

  function goBack() {
    allerA(step - 1);
  }

  const recapitulatif: { label: string; valeur: string; etape: number }[] = [
    { label: 'Nom', valeur: `${form.prenom.trim()} ${form.nom.trim()}`.trim(), etape: 1 },
    { label: 'Date de naissance', valeur: form.date_naissance, etape: 1 },
    {
      label: 'Contact',
      valeur: [form.telephone.trim(), form.email.trim()].filter(Boolean).join(' · '),
      etape: 2,
    },
    {
      label: 'Adresse',
      valeur:
        [form.adresse.trim(), `${form.code_postal.trim()} ${form.ville.trim()}`.trim()].filter(Boolean).join(', ') ||
        'Non précisée',
      etape: 2,
    },
    { label: 'Cours', valeur: form.cours.join(', ') || 'Pas encore choisi', etape: 3 },
    {
      label: 'Photos / santé',
      valeur: `Photos : ${form.droit_image || '?'} · Questionnaire santé : ${form.qs_sport === 'Oui' ? 'fait' : 'pas encore'}`,
      etape: 3,
    },
    {
      label: 'Paiement',
      valeur: `${form.mode_paiement || 'À choisir'}${form.numero_cheque ? ` (n° ${form.numero_cheque})` : ''}`,
      etape: 4,
    },
    ...(MODULES.financement
      ? [
          {
            label: 'Reste à payer',
            valeur: `${calc.reste} €${libelleAides(calc) ? ` (${libelleAides(calc)})` : ''}`,
            etape: 4,
          },
        ]
      : [{ label: 'Cotisation', valeur: TARIF_LABEL, etape: 4 }]),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorField(null);

    if (step < TOTAL_STEPS) {
      goNext();
      return;
    }
    if (!recapPret.current) return;
    const incomplet = premiereEtapeIncomplete(form, { tarifLabel: TARIF_LABEL });
    if (incomplet) {
      setStep(incomplet.etape);
      montrerErreur(incomplet.champ, incomplet.message);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        email: form.email.trim(),
        date_naissance: form.date_naissance,
        adresse: form.adresse.trim(),
        code_postal: form.code_postal.trim(),
        ville: form.ville.trim(),
        mode_paiement: form.mode_paiement,
        numero_cheque: form.mode_paiement.startsWith('Chèque')
          ? form.numero_cheque.trim().slice(0, 20)
          : '',
        droit_image: form.droit_image,
        qs_sport: form.qs_sport,
        deja_adherent: form.deja_adherent || 'Non renseigné',
        connu: form.connu,
        parrain: MODULES.parrainage && form.connu === CONNU_PARRAINAGE ? form.parrain.trim() : '',
        cours: form.cours.join(', ') || 'Non précisé',
        message: form.message.trim(),
        'bot-field': form['bot-field'],
        ...(MODULES.financement
          ? { pass_sport: passSport ? 'oui' : '', ancv, ce }
          : {}),
      };

      const res = await fetch('/api/adhesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Erreur d’envoi (HTTP ${res.status})`);
      }

      const carte = form.mode_paiement.startsWith('Carte');
      const virement = form.mode_paiement === 'Virement';
      const ref = typeof data.reference === 'string' ? data.reference : '';
      const lien = typeof data.paiementUrl === 'string' ? data.paiementUrl : '';
      const montant = /^\d+([.,]\d+)?$/.test(String(data.montant ?? '')) ? String(data.montant) : '';
      setPaidByCarte(carte);
      setListeAttente(Boolean(data.listeAttente));
      setParVirement(virement);
      setReference(ref);
      setLienPaiement(lien);
      setAPayer(montant ? `${montant} €` : TARIF_LABEL);
      setSuccess(true);
      const q = new URLSearchParams({ ok: '1' });
      if (carte) q.set('mode', 'carte');
      if (virement) q.set('mode', 'virement');
      if (ref) q.set('ref', ref);
      if (lien) q.set('hp', '1');
      if (montant && `${montant} €` !== TARIF_LABEL) q.set('m', montant);
      window.history.replaceState(null, '', `/inscription?${q.toString()}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setError(
        detail
          ? `${detail} — ou contactez le bureau par WhatsApp / email.`
          : 'L’envoi a échoué. Réessayez ou contactez le bureau par WhatsApp ou email.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full min-h-[48px] rounded-xl border border-black/10 bg-[#FDF8F1] px-3 py-2.5 font-body text-[15px] text-brand-black placeholder:text-brand-gray/55 focus:outline-none focus:ring-2 focus:ring-orange-primary/35 focus:border-orange-primary/50 focus:bg-white';
  const labelClass = 'block font-body text-sm font-medium text-brand-black mb-1.5';
  const firstName = form.prenom.trim();

  return (
    <main id="main-content" className="min-h-screen bg-brand-cream text-brand-black pt-[72px] pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHowToJoinSchema()) }}
      />
      <div className="content-max-width max-w-2xl mx-auto px-4">
        {!success && (
          <header className="mb-8 pt-8">
            <p className="font-mono text-[11px] tracking-[2px] uppercase text-orange-primary font-semibold mb-3">
              Adhésion · {SEASON_LABEL}
            </p>
            <h1 className="font-display font-black text-[28px] md:text-[36px] leading-[1.05] text-brand-black mb-3">
              On est contents de vous accueillir.
            </h1>
            <p className="font-body text-[16px] text-brand-gray leading-relaxed max-w-[36rem]">
              Trois minutes, sans pression. Cotisation {TARIF_LABEL} l&apos;année, {ASSO.adhesion.inclus}.
              Le bureau vous rappelle — ce n&apos;est pas un paiement automatique.
            </p>
            <p className="font-body text-[15px] text-brand-gray mt-3">
              Pas encore décidé ?{' '}
              <Link to="/essai" className="text-brand-olive underline underline-offset-2 font-semibold">
                Préférer un essai d&apos;abord
              </Link>
            </p>
          </header>
        )}

        {success ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-brand-olive/30 bg-white p-8 text-center mt-6"
          >
            <CheckCircle2 className="mx-auto text-brand-olive mb-3" size={40} />
            <h2 className="font-display font-black text-[26px] md:text-[30px] text-brand-black mb-2 leading-tight">
              {retourPaiement === 'ok'
                ? 'Bienvenue au club !'
                : firstName
                  ? `Merci ${firstName} !`
                  : 'Merci !'}
            </h2>
            <p className="font-body font-semibold text-[17px] text-brand-olive mb-3">
              {listeAttente
                ? 'Ce cours est complet. Vous êtes sur la liste d’attente : le bureau vous prévient si une place se libère.'
                : retourPaiement === 'ok'
                ? 'Paiement reçu : votre adhésion est validée.'
                : 'Votre demande est bien arrivée au bureau.'}
            </p>
            {retourPaiement ? (
              <RetourPaiement etat={retourPaiement} lienPaiement={lienPaiement} />
            ) : lienPaiement ? (
              <div className="max-w-sm mx-auto text-left space-y-3 mb-2">
                <p className="font-body text-[15px] text-brand-gray leading-relaxed">
                  Dernière étape : réglez {aPayer} en ligne, par carte, sur la page sécurisée de{' '}
                  {PAIEMENT_NOM}. Votre adhésion est validée dès le paiement, sans attendre le bureau.
                </p>
                <a
                  href={lienPaiement}
                  className="inline-flex items-center justify-center gap-2 w-full min-h-[52px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px]"
                >
                  <CreditCard size={18} /> Payer {aPayer} maintenant
                </a>
                <p className="font-body text-[13px] text-brand-gray leading-snug">
                  Pas maintenant ? Gardez cette page : le bouton marche aussi plus tard. {PAIEMENT_NOM} peut
                  proposer un pourboire facultatif : vous pouvez le mettre à 0.
                </p>
              </div>
            ) : (
            <ol className="font-body text-[14px] text-brand-gray space-y-2 mb-5 text-left max-w-md mx-auto list-decimal list-inside">
              <li>Le bureau relit votre demande (souvent le jour même).</li>
              <li>
                {paidByCarte
                  ? `Quand vous serez prêt, vous pourrez ouvrir ${PAIEMENT_NOM} pour les ${TARIF_LABEL} (ce n’est pas automatique).`
                  : parVirement
                    ? `Vous faites le virement de ${aPayer}, avec la référence ci-dessous en libellé.`
                    : `Vous réglez ${TARIF_LABEL} au bureau : ${PAIEMENTS_BUREAU}.`}
              </li>
              <li>Vous recevez la confirmation d&apos;adhésion et le créneau.</li>
            </ol>
            )}
            {reference && retourPaiement !== 'ok' ? (
              <ReferenceDemande reference={reference} virement={parVirement} montant={aPayer} />
            ) : null}
            {lienPaiement || retourPaiement ? null : paidByCarte ? (
              <div className="max-w-sm mx-auto text-left space-y-3">
                <p className="font-body text-[14px] text-brand-gray leading-relaxed">
                  {PAIEMENT_NOM} ne s’ouvre pas tout seul. Quand vous serez prêt, ce bouton ouvre la page
                  de paiement (nouvel onglet).
                </p>
                {paiementReady ? (
                  <a
                    href={SITE_CONFIG.paiementUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full min-h-[52px] rounded-full border-2 border-orange-primary text-orange-primary font-semibold text-[16px] hover:bg-orange-primary hover:text-white"
                  >
                    Ouvrir {PAIEMENT_NOM} pour {TARIF_LABEL} <ExternalLink size={16} />
                  </a>
                ) : (
                  <p className="font-body text-[14px] text-brand-gray text-center min-h-[52px] flex items-center justify-center">
                    Un instant — votre demande est bien au bureau.
                  </p>
                )}
              </div>
            ) : (
              <p className="font-body text-[15px] text-brand-gray leading-relaxed max-w-md mx-auto">
                Bureau : <strong className="text-brand-black">{ASSO.telephone}</strong>.
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <a
                href={`https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(
                  'Bonjour, je viens d’envoyer ma demande d’inscription.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center px-5 rounded-full bg-brand-olive hover:bg-brand-olive-hover text-white font-semibold text-sm"
              >
                Écrire sur WhatsApp
              </a>
              <Link
                to="/"
                className="inline-flex min-h-[44px] items-center px-5 rounded-full border border-black/10 font-semibold text-sm hover:bg-black/5"
              >
                Retour à l'accueil
              </Link>
            </div>
          </div>
        ) : !MODULES.adhesion ? (
          <ContactDirect motif="adhesion" />
        ) : (
          <form
            noValidate
            aria-label="Formulaire d’adhésion"
            onSubmit={handleSubmit}
            className="rounded-2xl border border-black/10 bg-white p-5 sm:p-8 space-y-5"
          >
            <p className="hidden" aria-hidden="true">
              <label>
                Ne pas remplir
                <input
                  name="bot-field"
                  value={form['bot-field']}
                  onChange={(e) => setField('bot-field', e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </p>


            <div className="mb-1">
              <p className="font-body text-[14px] text-brand-gray mb-2" aria-live="polite">
                Étape {step} sur {TOTAL_STEPS} : <strong className="text-brand-black">{etapeCourante.label}</strong>
              </p>
              <ol className="flex items-start justify-between mb-2" aria-label="Étapes de l’adhésion">
                {ETAPES_ADHESION.map((s) => (
                  <li
                    key={s.n}
                    aria-current={step === s.n ? 'step' : undefined}
                    className="flex flex-col items-center flex-1 min-w-0"
                  >
                    {s.n < step ? (
                      <button
                        type="button"
                        onClick={() => allerA(s.n)}
                        className="w-11 h-11 rounded-full flex items-center justify-center font-body font-bold text-sm bg-brand-olive text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-olive"
                        aria-label={`Revenir à l’étape ${s.n} : ${s.label} (faite)`}
                      >
                        <span aria-hidden="true">✓</span>
                      </button>
                    ) : (
                      <span
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-body font-bold text-sm ${
                          step === s.n ? 'bg-orange-primary text-white' : 'bg-[#F5EFE6] text-brand-gray'
                        }`}
                        aria-hidden="true"
                      >
                        {s.n}
                      </span>
                    )}
                    <span
                      className={`mt-1.5 font-body text-[11px] sm:text-[12px] text-center leading-tight ${
                        step === s.n ? 'text-orange-primary font-semibold' : step > s.n ? 'text-brand-olive' : 'text-brand-gray'
                      } ${step === s.n ? '' : 'hidden sm:block'}`}
                    >
                      <span className="sr-only">{step > s.n ? 'Faite : ' : step === s.n ? 'En cours : ' : 'À venir : '}</span>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
              <div
                role="progressbar"
                aria-label="Progression de l’adhésion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressionEtape(step)}
                aria-valuetext={`Étape ${step} sur ${TOTAL_STEPS}`}
                className="h-2 rounded-full bg-[#F5EFE6] overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-orange-primary transition-all duration-300 motion-reduce:transition-none"
                  style={{ width: `${progressionEtape(step)}%` }}
                />
              </div>
              {MODULES.financement && step >= 4 ? (
                <p className="mt-3 font-body text-[15px] text-brand-black" aria-live="polite">
                  Reste à payer : <strong>{calc.reste} €</strong>
                </p>
              ) : null}
            </div>

            {reprise && step <= 2 ? (
              <p role="status" className="font-body text-[14px] text-brand-black rounded-xl bg-orange-light border border-orange-primary/20 px-3 py-2">
                Nous avons repris vos coordonnées de l’essai : vérifiez-les. Il ne reste que quelques réponses.
              </p>
            ) : null}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2
                    ref={titreRef}
                    tabIndex={-1}
                    className="font-display font-bold text-[22px] text-brand-black mb-1 focus:outline-none"
                  >
                    {ETAPES_ADHESION[0].titre}
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    Votre nom et votre date de naissance, pour la licence.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="prenom">
                      Prénom <span className="text-orange-primary">*</span>
                    </label>
                    <input
                      id="prenom"
                    aria-invalid={errorField === 'prenom' || undefined}
                    aria-describedby={errorField === 'prenom' ? 'adhesion-erreur' : undefined}
                      name="prenom"
                      required
                      className={inputClass}
                      value={form.prenom}
                      onChange={(e) => setField('prenom', e.target.value)}
                      autoComplete="given-name"
                      placeholder="Marie"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="nom">
                      Nom <span className="text-orange-primary">*</span>
                    </label>
                    <input
                      id="nom"
                    aria-invalid={errorField === 'nom' || undefined}
                    aria-describedby={errorField === 'nom' ? 'adhesion-erreur' : undefined}
                      name="nom"
                      required
                      className={inputClass}
                      value={form.nom}
                      onChange={(e) => setField('nom', e.target.value)}
                      autoComplete="family-name"
                      placeholder="Dupont"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="date_naissance">
                    Date de naissance <span className="text-orange-primary">*</span>
                  </label>
                  <input
                    id="date_naissance"
                    aria-invalid={errorField === 'date_naissance' || undefined}
                    name="date_naissance"
                    type="text"
                    inputMode="numeric"
                    autoComplete="bday"
                    placeholder="jj/mm/aaaa"
                    maxLength={10}
                    minLength={10}
                    required
                    pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
                    title="Format obligatoire : jj/mm/aaaa"
                    aria-required="true"
                    aria-describedby={errorField === 'date_naissance' ? 'adhesion-erreur date-naissance-aide' : 'date-naissance-aide'}
                    className={inputClass}
                    value={form.date_naissance}
                    onChange={(e) => setField('date_naissance', formatDateNaissance(e.target.value))}
                  />
                  <p id="date-naissance-aide" className="font-body text-[13px] text-brand-gray mt-1.5">
                    Format obligatoire jj/mm/aaaa (ex. 14/03/1958). Dès 16 ans ; à 16-17 ans, un
                    parent valide l&apos;adhésion.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2
                    ref={titreRef}
                    tabIndex={-1}
                    className="font-display font-bold text-[22px] text-brand-black mb-1 focus:outline-none"
                  >
                    {firstName ? `${ETAPES_ADHESION[1].titre}, ${firstName}` : ETAPES_ADHESION[1].titre}
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    Le téléphone suffit. Le reste est facultatif.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="telephone">
                      Téléphone <span className="text-orange-primary">*</span>
                    </label>
                    <input
                      id="telephone"
                    aria-invalid={errorField === 'telephone' || undefined}
                    aria-describedby={errorField === 'telephone' ? 'adhesion-erreur' : undefined}
                      name="telephone"
                      type="tel"
                      required
                      className={inputClass}
                      value={form.telephone}
                      onChange={(e) => setField('telephone', e.target.value)}
                      autoComplete="tel"
                      placeholder="06 ou 07…"
                    />
                    <p className="font-body text-[12px] text-brand-gray mt-1.5 flex items-center gap-1">
                      <Phone size={12} /> Le bureau rappelle, souvent le jour même.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="email">
                      Email <span className="font-normal text-brand-gray">(si vous en avez un)</span>
                    </label>
                    <input
                      id="email"
                    aria-invalid={errorField === 'email' || undefined}
                    aria-describedby={errorField === 'email' ? 'adhesion-erreur' : undefined}
                      name="email"
                      type="email"
                      className={inputClass}
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      autoComplete="email"
                      placeholder="facultatif"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="adresse">
                    Adresse
                  </label>
                  <input
                    id="adresse"
                    name="adresse"
                    className={inputClass}
                    value={form.adresse}
                    onChange={(e) => setField('adresse', e.target.value)}
                    autoComplete="street-address"
                    placeholder="Rue, numéro…"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="code_postal">
                      Code postal
                    </label>
                    <input
                      id="code_postal"
                    aria-invalid={errorField === 'code_postal' || undefined}
                    aria-describedby={errorField === 'code_postal' ? 'adhesion-erreur' : undefined}
                      name="code_postal"
                      className={inputClass}
                      value={form.code_postal}
                      onChange={(e) => setField('code_postal', e.target.value)}
                      autoComplete="postal-code"
                      inputMode="numeric"
                      placeholder={ASSO.codePostal}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="ville">
                      Ville
                    </label>
                    <input
                      id="ville"
                      name="ville"
                      className={inputClass}
                      value={form.ville}
                      onChange={(e) => setField('ville', e.target.value)}
                      autoComplete="address-level2"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2
                    ref={titreRef}
                    tabIndex={-1}
                    className="font-display font-bold text-[22px] text-brand-black mb-1 focus:outline-none"
                  >
                    {ETAPES_ADHESION[2].titre}
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    Les cours qui vous tentent, puis deux petites questions.
                  </p>
                </div>
                <fieldset>
                  <legend className={labelClass}>Quels cours vous tentent ? <span className="font-normal text-brand-gray">(facultatif, plusieurs possibles)</span></legend>
                  <div className="flex flex-wrap gap-2">
                    {COURSES.map((c) => (
                      <Chip key={c} active={form.cours.includes(c)} onClick={() => toggleCours(c)}>
                        {form.cours.includes(c) ? `✓ ${c}` : c}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <fieldset id="droit_image" tabIndex={-1} aria-describedby={errorField === 'droit_image' ? 'adhesion-erreur' : undefined} className="focus:outline-none focus:ring-2 focus:ring-orange-primary/40 rounded-2xl bg-gradient-to-br from-orange-primary/10 to-[#FDF8F1] p-4 border border-orange-primary/20">
                  <legend className="font-body text-sm font-semibold text-brand-black px-1">
                    Photos pendant les cours <span className="text-orange-primary">*</span>
                  </legend>
                  <p className="font-body text-[13px] text-brand-gray mb-3">
                    Parfois on prend une photo de groupe (site, Facebook ou Instagram de
                    l&apos;asso). Oui = vous acceptez ; vous pouvez changer d’avis plus tard par
                    mail. Le dossier d’inscription, lui, ne dépend pas de cette réponse.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Chip active={form.droit_image === 'Oui'} onClick={() => setField('droit_image', 'Oui')}>
                      Oui, pas de souci
                    </Chip>
                    <Chip active={form.droit_image === 'Non'} onClick={() => setField('droit_image', 'Non')}>
                      Non, je préfère éviter
                    </Chip>
                  </div>
                </fieldset>
                <fieldset id="qs_sport" tabIndex={-1} aria-describedby={errorField === 'qs_sport' ? 'adhesion-erreur' : undefined} className="focus:outline-none focus:ring-2 focus:ring-orange-primary/40 rounded-2xl bg-gradient-to-br from-orange-primary/10 to-[#FDF8F1] p-4 border border-orange-primary/20">
                  <legend className="font-body text-sm font-semibold text-brand-black px-1">
                    Questionnaire santé QS-SPORT <span className="text-orange-primary">*</span>
                  </legend>
                  <p className="font-body text-[13px] text-brand-gray mb-3">
                    Pas de certificat médical pour le loisir. Une petite déclaration santé
                    suffit. Vous l'avez déjà remplie ?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Chip active={form.qs_sport === 'Oui'} onClick={() => setField('qs_sport', 'Oui')}>
                      Oui, c'est fait
                    </Chip>
                    <Chip active={form.qs_sport === 'Non'} onClick={() => setField('qs_sport', 'Non')}>
                      Pas encore
                    </Chip>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className={labelClass}>Vous étiez déjà au club l'an dernier ?</legend>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      active={form.deja_adherent === 'Oui'}
                      onClick={() => setField('deja_adherent', 'Oui')}
                    >
                      Oui, je reviens
                    </Chip>
                    <Chip
                      active={form.deja_adherent === 'Non'}
                      onClick={() => setField('deja_adherent', 'Non')}
                    >
                      Non, c'est une première
                    </Chip>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className={labelClass}>
                    Comment nous avez-vous connus ?{' '}
                    <span className="font-normal text-brand-gray">(facultatif)</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Forum des associations',
                      'Google / internet',
                      ...(MODULES.parrainage ? [CONNU_PARRAINAGE] : []),
                      'Bouche à oreille',
                      'Mairie / flyer',
                      'Je revenais déjà',
                      'Autre',
                    ].map((opt) => (
                      <Chip
                        key={opt}
                        active={form.connu === opt}
                        onClick={() => setField('connu', form.connu === opt ? '' : opt)}
                      >
                        {opt}
                      </Chip>
                    ))}
                  </div>
                  {MODULES.parrainage && form.connu === CONNU_PARRAINAGE ? (
                    <div className="mt-3">
                      <label className={labelClass} htmlFor="parrain">
                        Qui vous a invité ?{' '}
                        <span className="font-normal text-brand-gray">(facultatif, pour le remercier)</span>
                      </label>
                      <input
                        id="parrain"
                        type="text"
                        className={inputClass}
                        value={form.parrain}
                        maxLength={60}
                        autoComplete="off"
                        onChange={(e) => setField('parrain', e.target.value)}
                      />
                    </div>
                  ) : null}
                </fieldset>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2
                    ref={titreRef}
                    tabIndex={-1}
                    className="font-display font-bold text-[22px] text-brand-black mb-1 focus:outline-none"
                  >
                    {ETAPES_ADHESION[3].titre}
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    {TARIF_LABEL} l'année. Ce formulaire ne prélève rien.
                  </p>
                </div>
                {MODULES.financement ? <BlocAides passSport={passSport} setPassSport={setPassSport} ancv={ancv} setAncv={setAncv} ce={ce} setCe={setCe} inputClass={inputClass} /> : null}
                <div
                  id="mode_paiement"
                  role="group"
                  aria-label="Moyen de paiement"
                  tabIndex={-1}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 focus:outline-none focus:ring-2 focus:ring-orange-primary/40 rounded-2xl"
                >
                  {MODE_CARTE ? (
                  <button
                    type="button"
                    aria-pressed={isCarte}
                    onClick={() => setField('mode_paiement', MODE_CARTE)}
                    className={`text-left rounded-2xl border-2 p-4 min-h-[108px] transition-colors ${
                      isCarte
                        ? 'border-orange-primary bg-orange-primary text-white shadow-[0_8px_24px_rgba(196,83,9,0.28)]'
                        : 'border-orange-primary/20 bg-[#FFF4EB] hover:border-orange-primary/50'
                    }`}
                  >
                    <CreditCard className={`mb-2 ${isCarte ? 'text-white' : 'text-orange-primary'}`} size={22} />
                    <p className="font-display font-bold text-[16px]">Carte en ligne</p>
                    <p className={`font-body text-[13px] mt-1 ${isCarte ? 'text-white/90' : 'text-brand-gray'}`}>
                      {PAIEMENT_NOM}, ensuite. Pas de prélèvement automatique.
                    </p>
                  </button>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={isBureau}
                    onClick={() => {
                      if (!isBureau) setField('mode_paiement', BUREAU_MODES[0] ?? 'Autre');
                    }}
                    className={`text-left rounded-2xl border-2 p-4 min-h-[108px] transition-colors ${
                      isBureau
                        ? 'border-orange-primary bg-orange-primary text-white shadow-[0_8px_24px_rgba(196,83,9,0.28)]'
                        : 'border-orange-primary/20 bg-[#FFF4EB] hover:border-orange-primary/50'
                    }`}
                  >
                    <Landmark className={`mb-2 ${isBureau ? 'text-white' : 'text-orange-primary'}`} size={22} />
                    <p className="font-display font-bold text-[16px]">Au bureau</p>
                    <p className={`font-body text-[13px] mt-1 ${isBureau ? 'text-white/90' : 'text-brand-gray'}`}>
                      {PAIEMENTS_BUREAU}
                    </p>
                  </button>
                </div>

                {isBureau && (
                  <fieldset>
                    <legend className={labelClass}>Précisez le moyen</legend>
                    <div className="flex flex-wrap gap-2">
                      {BUREAU_MODES.map((m) => (
                        <Chip
                          key={m}
                          active={form.mode_paiement === m}
                          onClick={() => setField('mode_paiement', m)}
                        >
                          {m.replace(' (chèques-vacances)', '')}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>
                )}

                {isCheque ? (
                  <div>
                    <label className={labelClass} htmlFor="numero_cheque">
                      N° de chèque <span className="text-orange-primary">*</span>
                    </label>
                    <input
                      id="numero_cheque"
                      aria-invalid={errorField === 'numero_cheque' || undefined}
                      aria-describedby={errorField === 'numero_cheque' ? 'adhesion-erreur numero-cheque-aide' : 'numero-cheque-aide'}
                      name="numero_cheque"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={20}
                      className={inputClass}
                      value={form.numero_cheque}
                      onChange={(e) => setField('numero_cheque', e.target.value.slice(0, 20))}
                      placeholder="Ex. 1234567"
                    />
                    <p id="numero-cheque-aide" className="font-body text-[13px] text-brand-gray mt-1.5 leading-snug">
                      Celui écrit en haut à droite du chèque. Pas encore de chéquier sous la main ?
                      Choisissez espèces ou « Autre », le bureau ajustera.
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h2
                    ref={titreRef}
                    tabIndex={-1}
                    className="font-display font-bold text-[22px] text-brand-black mb-1 focus:outline-none"
                  >
                    {ETAPES_ADHESION[4].titre}
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    Relisez, corrigez si besoin, puis envoyez.
                  </p>
                </div>
                <dl className="rounded-2xl bg-[#FDF8F1] border border-black/10 divide-y divide-black/[0.06]">
                  {recapitulatif.map((r) => (
                    <div key={r.label} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 px-4 py-3">
                      <dt className="font-body text-[14px] text-brand-gray sm:w-40 shrink-0">{r.label}</dt>
                      <dd className="font-body text-[15px] text-brand-black flex-1 min-w-0 break-words">{r.valeur}</dd>
                      <button
                        type="button"
                        onClick={() => allerA(r.etape)}
                        className="self-start min-h-[44px] px-3 -my-2 font-body text-[14px] font-semibold text-orange-primary underline underline-offset-2"
                      >
                        Modifier<span className="sr-only"> : {r.label}</span>
                      </button>
                    </div>
                  ))}
                </dl>
                <div>
                  <label className={labelClass} htmlFor="message">
                    Un mot pour le bureau ?
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    className={`${inputClass} min-h-[96px] py-3`}
                    value={form.message}
                    onChange={(e) => setField('message', e.target.value)}
                    placeholder="Créneau, question, besoin d’un essai d’abord…"
                  />
                </div>
                <p className="font-body text-sm text-brand-gray leading-relaxed rounded-2xl bg-[#FDF8F1] p-4">
                  Ces infos servent à traiter l’inscription et à vous recontacter. Pas de
                  paiement ici.{' '}
                  <Link to="/confidentialite" className="text-orange-primary underline">
                    Confidentialité
                  </Link>
                  .
                </p>
              </div>
            )}

            <div aria-live="assertive">
              {error && (
                <p
                  id="adhesion-erreur"
                  ref={erreurRef}
                  tabIndex={-1}
                  role="alert"
                  className="font-body text-[15px] text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2 focus:outline-none"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="min-h-[52px] rounded-full border border-black/15 font-body font-semibold text-[15px] text-brand-black px-6 hover:bg-black/[0.03] order-2 sm:order-1"
                >
                  Retour
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 min-h-[52px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px] order-1 sm:order-2"
                >
                  {`Continuer : ${ETAPES_ADHESION[step].label.toLowerCase()}`}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[52px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px] disabled:opacity-60 inline-flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    'Envoyer ma demande'
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function BlocAides({
  passSport,
  setPassSport,
  ancv,
  setAncv,
  ce,
  setCe,
  inputClass,
}: {
  passSport: boolean;
  setPassSport: (v: boolean) => void;
  ancv: string;
  setAncv: (v: string) => void;
  ce: string;
  setCe: (v: string) => void;
  inputClass: string;
}) {
  const p = aidesProposees(ASSO.financement);
  const calc = calculerReste(ASSO.adhesion.tarif, { passSport, ancv, ce }, ASSO.financement);
  const l = libelleAides(calc);
  return (
    <fieldset className="rounded-2xl bg-white border border-black/10 p-4 space-y-3">
      <legend className="font-display font-bold text-[18px] text-brand-black px-1">Aides possibles</legend>
      <p className="font-body text-[14px] text-brand-gray">
        Cochez ce qui vous concerne. Le bureau vérifiera. Rien n’est prélevé ici.
      </p>
      {p.passSport ? (
        <label className="flex gap-3 items-center min-h-[44px]">
          <input type="checkbox" className="w-5 h-5" checked={passSport} onChange={(e) => setPassSport(e.target.checked)} />
          <span className="font-body text-[16px] text-brand-black">Pass&apos;Sport ({p.passSport} €)</span>
        </label>
      ) : null}
      {p.ancvMax ? (
        <label className="block">
          <span className="font-semibold text-brand-black">Chèques ANCV (max. {p.ancvMax} €)</span>
          <input
            className={`${inputClass} mt-1`}
            inputMode="numeric"
            value={ancv}
            onChange={(e) => setAncv(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0"
          />
        </label>
      ) : null}
      {p.comiteEntreprise ? (
        <label className="block">
          <span className="font-semibold text-brand-black">Aide comité d’entreprise (max. {p.comiteEntreprise} €)</span>
          <input
            className={`${inputClass} mt-1`}
            inputMode="numeric"
            value={ce}
            onChange={(e) => setCe(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0"
          />
        </label>
      ) : null}
      <p className="font-body text-[16px] text-brand-black" aria-live="polite">
        Reste à payer : <strong>{calc.reste} €</strong>
        {l ? <span className="block text-[14px] text-brand-gray mt-1">{l}</span> : null}
      </p>
    </fieldset>
  );
}
