import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
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
  emailError,
  nameError,
  phoneError,
  postalCodeError,
} from '../lib/formValidation';
import { buildHowToJoinSchema } from '../lib/schema';
import { aidesProposees, calculerReste, libelleAides } from '../lib/financement';

const COURSES = [
  'Gym Douce',
  'Renforcement Musculaire',
  'Cardio & Gym',
  'Stretching',
  'Zumba',
  'Pilates',
] as const;

const BUREAU_MODES = PAYMENT_MODES.filter((m) => m !== MODE_CARTE);

const STEPS = [
  { n: 1, label: 'Vous' },
  { n: 2, label: 'Le club' },
  { n: 3, label: 'Cotisation' },
] as const;

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

function birthDateError(value: string): string | null {
  const raw = value.trim();
  if (!raw) {
    return 'Indiquez votre date de naissance (jj/mm/aaaa).';
  }
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) {
    return 'La date de naissance doit être au format jj/mm/aaaa (ex. 14/03/1958).';
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return 'Cette date n’existe pas. Utilisez jj/mm/aaaa.';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dt > today) {
    return 'La date de naissance ne peut pas être dans le futur.';
  }
  let age = today.getFullYear() - year;
  const hadBirthday =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  if (age < 16) {
    return 'L’association accueille à partir de 16 ans.';
  }
  if (age > 120) {
    return 'Vérifiez l’année (quatre chiffres), au format jj/mm/aaaa.';
  }
  return null;
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
  const TOTAL_STEPS = 3;
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

  useEffect(() => {
    if (!success || !paidByCarte) {
      setPaiementReady(false);
      return;
    }
    const t = window.setTimeout(() => setPaiementReady(true), 1600);
    return () => window.clearTimeout(t);
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

  function validateStep(s: number): string | null {
    if (s === 1) {
      return (
        nameError('Prénom', form.prenom) ||
        nameError('Nom', form.nom) ||
        phoneError(form.telephone) ||
        emailError(form.email) ||
        postalCodeError(form.code_postal)
      );
    }
    if (s === 2) {
      const dateErr = birthDateError(form.date_naissance);
      if (dateErr) return dateErr;
      if (!form.droit_image || !form.qs_sport) {
        return 'Deux petites questions encore : photos de cours, et questionnaire santé.';
      }
    }
    return null;
  }

  function goNext() {
    setError(null);
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const contactErr =
      nameError('Prénom', form.prenom) ||
      nameError('Nom', form.nom) ||
      phoneError(form.telephone) ||
      emailError(form.email) ||
      postalCodeError(form.code_postal);
    if (contactErr) {
      setError(contactErr);
      return;
    }
    if (!form.mode_paiement) {
      setError(`Choisissez comment vous souhaitez régler les ${TARIF_LABEL}.`);
      return;
    }
    if (!form.droit_image || !form.qs_sport) {
      setError('Merci de répondre aux deux questions (photos et santé).');
      return;
    }
    const dateErr = birthDateError(form.date_naissance);
    if (dateErr) {
      setError(dateErr);
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
              <div className="flex items-center justify-between mb-2">
                {STEPS.map((s) => (
                  <div key={s.n} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-body font-bold text-sm ${
                        step > s.n
                          ? 'bg-brand-olive text-white'
                          : step === s.n
                            ? 'bg-orange-primary text-white'
                            : 'bg-[#F5EFE6] text-brand-gray'
                      }`}
                    >
                      {step > s.n ? '✓' : s.n}
                    </div>
                    <span
                      className={`mt-1.5 font-body text-[11px] sm:text-[12px] ${
                        step >= s.n ? 'text-orange-primary font-semibold' : 'text-brand-gray'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-1.5 rounded-full bg-[#F5EFE6] overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-primary transition-all duration-300"
                  style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
                />
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display font-bold text-[22px] text-brand-black mb-1">
                    Faisons connaissance
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    Juste de quoi vous rappeler — comme un mot laissé au stand.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="prenom">
                      Prénom <span className="text-orange-primary">*</span>
                    </label>
                    <input
                      id="prenom"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="telephone">
                      Téléphone <span className="text-orange-primary">*</span>
                    </label>
                    <input
                      id="telephone"
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
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-display font-bold text-[22px] text-brand-black mb-1">
                    Un peu de pratique
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    Adresse si vous voulez, puis deux questions simples — pas un dossier
                    administratif.
                  </p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="date_naissance">
                    Date de naissance <span className="text-orange-primary">*</span>
                  </label>
                  <input
                    id="date_naissance"
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
                    aria-describedby="date-naissance-aide"
                    className={inputClass}
                    value={form.date_naissance}
                    onChange={(e) => setField('date_naissance', formatDateNaissance(e.target.value))}
                  />
                  <p id="date-naissance-aide" className="font-body text-[13px] text-brand-gray mt-1.5">
                    Format obligatoire jj/mm/aaaa (ex. 14/03/1958). Dès 16 ans ; à 16-17 ans, un
                    parent valide l&apos;adhésion.
                  </p>
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

                <fieldset className="rounded-2xl bg-gradient-to-br from-orange-primary/10 to-[#FDF8F1] p-4 border border-orange-primary/20">
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

                <fieldset className="rounded-2xl bg-gradient-to-br from-orange-primary/10 to-[#FDF8F1] p-4 border border-orange-primary/20">
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
                </fieldset>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-display font-bold text-[22px] text-brand-black mb-1">
                    La cotisation, à votre façon
                  </h2>
                  <p className="font-body text-[14px] text-brand-gray">
                    {TARIF_LABEL} l'année. Ce formulaire ne prélève rien.
                  </p>
                </div>

                {MODULES.financement ? <BlocAides passSport={passSport} setPassSport={setPassSport} ancv={ancv} setAncv={setAncv} ce={ce} setCe={setCe} inputClass={inputClass} /> : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MODE_CARTE ? (
                  <button
                    type="button"
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
                      N° de chèque
                    </label>
                    <input
                      id="numero_cheque"
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
                    <p className="font-body text-[13px] text-brand-gray mt-1.5 leading-snug">
                      Celui écrit en haut à droite du chèque. Facultatif si vous réglez plus tard au
                      bureau.
                    </p>
                  </div>
                ) : null}

                <fieldset>
                  <legend className={labelClass}>Quels cours vous tentent ? (facultatif)</legend>
                  <div className="flex flex-wrap gap-2">
                    {COURSES.map((c) => (
                      <Chip key={c} active={form.cours.includes(c)} onClick={() => toggleCours(c)}>
                        {form.cours.includes(c) ? `✓ ${c}` : c}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

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

            {error && (
              <p className="font-body text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

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
                  {step === 1 && firstName ? `Continuer, ${firstName}` : 'Continuer'}
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
      <p className="font-body text-[16px] text-brand-black">
        Reste à payer : <strong>{calc.reste} €</strong>
        {l ? <span className="block text-[14px] text-brand-gray mt-1">{l}</span> : null}
      </p>
    </fieldset>
  );
}
