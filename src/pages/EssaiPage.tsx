import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { waUrl as clubWaUrl } from '../data/siteData';
import { ASSO, COURS_ESSAI_LABEL, MODULES, NB_ESSAIS, TARIF_LABEL } from '../data/asso';
import ContactDirect from '../components/ContactDirect';
import { useScheduleFromSheet } from '../hooks/useSheetData';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  msgContactEssai,
  resolveCreneau,
  slotLabel,
  slotValue,
} from '../lib/essaiMessages';
import { buildDateEssaiCell, formatEssaiDateLabel } from '../lib/essaiDates';
import { essaiFormError } from '../lib/formValidation';
import { buildHowToJoinSchema } from '../lib/schema';

const MSG_UN_CRENEAU =
  NB_ESSAIS > 1
    ? `Vous avez droit à ${COURS_ESSAI_LABEL}. Cette demande = 1 créneau. Les autres se réservent après, sur cette même page.`
    : 'Cette demande = 1 créneau.';

function UnCreneauNote({ className = '' }: { className?: string }) {
  return (
    <p className={`font-body text-[16px] text-brand-black leading-relaxed ${className}`}>
      {MSG_UN_CRENEAU}
    </p>
  );
}

export default function EssaiPage() {
  const [params] = useSearchParams();
  const preset = params.get('cours') || '';
  const presetDate = params.get('date') || '';
  const fromForum = params.get('source') === 'forum';

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [cours, setCours] = useState(preset);
  const [dateEssai, setDateEssai] = useState(presetDate);
  const [bot, setBot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [listeAttente, setListeAttente] = useState(false);
  const [savedDateLabel, setSavedDateLabel] = useState('');
  const { schedule } = useScheduleFromSheet();

  usePageMeta({
    title: `Essai gratuit à ${ASSO.ville} (${ASSO.codePostal}) — ${ASSO.nom}`,
    description: `Réservez un essai gratuit à ${ASSO.ville} (${ASSO.codePostal}), sans engagement. ${ASSO.accroche}. Le créneau s’affiche tout de suite.`,
    path: '/essai',
  });

  const selectedKey = useMemo(() => {
    if (!cours && !dateEssai) return '';
    const match = schedule.find(
      (row) =>
        row.course === cours && slotValue(row.day, row.time) === dateEssai
    );
    if (match) return `${match.course}|${slotValue(match.day, match.time)}`;
    if (cours) return `course:${cours}`;
    return '';
  }, [cours, dateEssai, schedule]);

  const creneau = useMemo(() => {
    const info = resolveCreneau(schedule, cours, dateEssai);
    if (savedDateLabel) {
      return { ...info, dayTime: savedDateLabel, hasSlot: true };
    }
    if (cours && dateEssai) {
      const lab = formatEssaiDateLabel(buildDateEssaiCell(cours, dateEssai));
      if (lab) return { ...info, dayTime: lab, hasSlot: true };
    }
    return info;
  }, [schedule, cours, dateEssai, savedDateLabel]);
  const contactWa = clubWaUrl(msgContactEssai(prenom, creneau));

  function pickSlot(course: string, day: string, time: string) {
    const value = slotValue(day, time);
    if (cours === course && dateEssai === value) {
      setCours('');
      setDateEssai('');
      return;
    }
    setCours(course);
    setDateEssai(value);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const fieldErr = essaiFormError(prenom, nom, telephone);
    if (fieldErr) {
      setError(fieldErr);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/essai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom: prenom.trim(),
          nom: nom.trim(),
          telephone: telephone.trim(),
          cours,
          date_essai: dateEssai,
          creneau: (() => {
            const row = schedule.find((r) => r.course === cours && slotValue(r.day, r.time) === dateEssai);
            return row ? slotLabel(row.day, row.time, row.course) : '';
          })(),
          source: fromForum ? 'forum' : 'site',
          'bot-field': bot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Envoi impossible');
      }
      setSavedDateLabel(typeof data.dateLabel === 'string' ? data.dateLabel : '');
      setListeAttente(Boolean(data.listeAttente));
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('L’enregistrement a échoué. Écrivez-nous directement sur WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full min-h-[48px] rounded-xl border border-black/10 bg-[#FDF8F1] px-3 py-2.5 font-body text-[16px] text-brand-black placeholder:text-brand-gray/55 focus:outline-none focus:ring-2 focus:ring-orange-primary/35 focus:border-orange-primary/50 focus:bg-white';
  const labelClass = 'block font-body font-medium text-[14px] text-brand-black mb-1.5';

  return (
    <main id="main-content" className="min-h-screen bg-brand-cream text-brand-black pt-[72px] pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHowToJoinSchema()) }}
      />
      <div className="content-max-width max-w-[560px] mx-auto px-4">
        {!success && (
          <header className="mb-8 pt-8">
            <p className="font-mono text-[11px] tracking-[2px] uppercase text-orange-primary font-semibold mb-3">
              {fromForum ? 'Forum des associations' : 'Essai'}
            </p>
            <h1 className="font-display font-black text-[28px] md:text-[36px] leading-[1.05] text-brand-black mb-3">
              Venez essayer, sans rien signer.
            </h1>
            {MODULES.essais ? <UnCreneauNote className="mb-3" /> : null}
            <p className="font-body text-[16px] text-brand-gray leading-relaxed">
              {!MODULES.essais
                ? 'Rien à payer le jour de l’essai. Venez en tenue souple, avec une bouteille d’eau.'
                : fromForum
                  ? 'Au stand : prénom, nom et téléphone, puis un créneau ci-dessous si vous le connaissez. Rien à payer le jour de l’essai.'
                  : 'Indiquez votre prénom, votre nom et votre téléphone. Rien à payer le jour de l’essai.'}
            </p>
          </header>
        )}

        {success ? (
          <div
            role="status"
            className="rounded-2xl border border-brand-olive/30 bg-white p-8 text-center mt-6"
          >
            <CheckCircle2 className="mx-auto text-brand-olive mb-3" size={40} />
            <h2 className="font-display font-black text-[26px] text-brand-black mb-2">
              {prenom.trim() ? `Merci ${prenom.trim()} !` : 'Merci !'}
            </h2>
            <p className="font-body font-semibold text-[17px] text-brand-olive mb-3">
              {listeAttente
                ? 'Ce créneau est complet. Vous êtes sur la liste d’attente : le bureau vous prévient si une place se libère.'
                : 'Demande envoyée.'}
              {!listeAttente && NB_ESSAIS > 1
                ? ` C’est le créneau n°1. Il restera ${NB_ESSAIS - 1} essai${NB_ESSAIS > 2 ? 's' : ''}, à réserver ici quand vous voudrez.`
                : ''}
            </p>
            <UnCreneauNote className="mb-4 text-left max-w-sm mx-auto" />
            {creneau.hasSlot && creneau.dayTime ? (
              <div className="text-left max-w-sm mx-auto mb-4 rounded-xl bg-brand-cream border border-black/10 px-4 py-3">
                <p className="font-body text-[15px] text-brand-black leading-relaxed">
                  <strong>{creneau.course || 'Essai'}</strong>
                  {creneau.dayTime ? ` — ${creneau.dayTime}` : ''}
                </p>
                {creneau.salle ? (
                  <p className="font-body text-[14px] text-brand-gray mt-1">
                    {creneau.salle}
                    {creneau.adresse ? ` · ${creneau.adresse}` : ''}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="font-body text-[15px] text-brand-gray leading-relaxed mb-4">
                {creneau.course
                  ? `Cours indiqué : ${creneau.course}. Le bureau vous proposera un horaire.`
                  : 'Vous n’avez pas choisi d’horaire : le bureau vous proposera un créneau.'}
              </p>
            )}
            <p className="font-body text-[15px] text-brand-gray leading-relaxed mb-4">
              Vous pouvez venir avec ce créneau. Le bureau confirme par téléphone ou WhatsApp
              seulement si quelque chose change, souvent le jour même.
              Rien à payer le jour de l&apos;essai.
            </p>
            <ul className="font-body text-[14px] text-brand-gray space-y-2 mb-5 text-left max-w-sm mx-auto">
              <li>
                <strong className="text-brand-black">Tenue</strong> — souple, baskets, une bouteille
                d&apos;eau.
              </li>
              {creneau.kind === 'unknown'
                ? ASSO.lieux.map((l) => (
                    <li key={l.id}>
                      <strong className="text-brand-black">{l.nom}</strong> — {l.rue}.
                    </li>
                  ))
                : null}
            </ul>
            <div className="flex flex-col gap-3">
              <a
                href={contactWa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full bg-brand-olive hover:bg-brand-olive-hover text-white font-body font-semibold"
              >
                <MessageCircle size={18} />
                Écrire sur WhatsApp
              </a>
              <p className="font-body text-[13px] text-brand-gray">
                L&apos;adhésion n&apos;est pas obligatoire.{' '}
                <Link to="/inscription" className="text-brand-olive underline underline-offset-2 font-medium">
                  Formulaire {TARIF_LABEL}
                </Link>
                {' '}si le cours vous convient.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setSavedDateLabel('');
                  setCours('');
                  setDateEssai('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center justify-center w-full min-h-[44px] rounded-full border border-orange-primary text-orange-primary font-body font-semibold hover:bg-orange-primary/10"
              >
                Réserver un autre créneau
              </button>
              <Link
                to="/"
                className="flex items-center justify-center w-full min-h-[44px] rounded-full border border-black/15 text-brand-black font-body font-semibold hover:bg-black/[0.03]"
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        ) : !MODULES.essais ? (
          <ContactDirect motif="essai" />
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl bg-white border border-black/10 p-5 md:p-8"
          >
            <p className="hidden" aria-hidden="true">
              <label>
                Ne pas remplir
                <input value={bot} onChange={(e) => setBot(e.target.value)} tabIndex={-1} autoComplete="off" />
              </label>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="prenom">
                  Prénom <span className="text-orange-primary">*</span>
                </label>
                <input
                  id="prenom"
                  name="prenom"
                  className={inputClass}
                  autoComplete="given-name"
                  placeholder="Marie"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="nom">
                  Nom <span className="text-orange-primary">*</span>
                </label>
                <input
                  id="nom"
                  name="nom"
                  className={inputClass}
                  autoComplete="family-name"
                  placeholder="Dupont"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="telephone">
                Téléphone <span className="text-orange-primary">*</span>
              </label>
              <input
                id="telephone"
                className={inputClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="06 ou 07…"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                required
              />
              <p className="mt-1.5 font-body text-[13px] text-brand-gray">
                Le bureau rappelle sur ce numéro (appel ou WhatsApp).
              </p>
            </div>

            <fieldset className="rounded-2xl bg-brand-cream p-4 border border-black/10">
              <legend className="font-body text-sm font-semibold text-brand-black px-1">
                {NB_ESSAIS > 1
                  ? `Premier créneau (vous pourrez en poser ${NB_ESSAIS - 1} autre${NB_ESSAIS > 2 ? 's' : ''} ensuite)`
                  : 'Créneau'}{' '}
                <span className="font-normal text-brand-gray">(facultatif)</span>
              </legend>
              <UnCreneauNote className="mb-3" />
              <p className="font-body text-[13px] text-brand-gray mb-3">
                Laissez « Je ne sais pas encore » si vous hésitez — le bureau proposera un créneau.
              </p>
              <div className="flex flex-wrap gap-2">
                {schedule.map((row) => {
                  const key = `${row.course}|${slotValue(row.day, row.time)}`;
                  const active = selectedKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickSlot(row.course, row.day, row.time)}
                      title={formatEssaiDateLabel(buildDateEssaiCell(row.course, slotValue(row.day, row.time)))}
                      className={`min-h-[44px] rounded-full px-3.5 py-2 font-body text-[13px] sm:text-[14px] border transition-colors ${
                        active
                          ? 'bg-orange-primary text-white border-orange-primary'
                          : 'bg-white text-brand-black border-black/15 hover:border-orange-primary'
                      }`}
                    >
                      {slotLabel(row.day, row.time, row.course)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setCours('');
                    setDateEssai('');
                  }}
                  className={`min-h-[44px] rounded-full px-3.5 py-2 font-body text-[13px] sm:text-[14px] border transition-colors ${
                    !cours && !dateEssai
                      ? 'bg-brand-olive-soft text-brand-olive border-brand-olive'
                      : 'bg-white text-brand-black border-black/15 hover:border-brand-olive'
                  }`}
                >
                  Je ne sais pas encore
                </button>
              </div>
            </fieldset>

            <p className="font-body text-sm text-brand-gray leading-relaxed rounded-2xl bg-[#FDF8F1] p-4">
              Le bureau utilise prénom, nom et téléphone pour l’essai (appel ou WhatsApp).{' '}
              <Link to="/confidentialite" className="text-brand-olive underline">
                Confidentialité
              </Link>
              .
            </p>

            {error && (
              <p className="font-body text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
                <a
                  href={contactWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-1 underline font-medium"
                >
                  Écrire directement sur WhatsApp →
                </a>
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[52px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px] disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              Réserver ce créneau
            </button>

            <a
              href={contactWa}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full min-h-[44px] rounded-full border border-brand-olive text-brand-olive font-body text-[14px] font-semibold hover:bg-brand-olive-soft"
            >
              <MessageCircle size={16} />
              Ou écrire sur WhatsApp
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
