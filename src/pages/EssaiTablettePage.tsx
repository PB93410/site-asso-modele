import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { ACTIVITIES } from '../data/siteData';
import { ASSO, COURS_ESSAI_LABEL, MODULES, NB_ESSAIS, essaisOuverts } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import { emailError, essaiFormError } from '../lib/formValidation';
import { SECONDES_AVANT_RAZ, SECONDES_INACTIVITE, aDesDonnees } from '../lib/modeTablette';
import NotFoundPage from './NotFoundPage';

/**
 * Mode tablette du forum (modules.tablette) : une tablette posée sur le stand, les visiteurs s'inscrivent à un essai eux-mêmes.
 * Plein écran, trois champs, aucun lien vers le reste du site. Après chaque envoi — ou après un temps sans
 * toucher l'écran — tout est effacé : la personne suivante ne voit jamais les données de la précédente.
 * Les demandes arrivent comme celles de /essai (source « Forum »).
 */

const COURS = ACTIVITIES.map((a) => a.name);
const champ =
  'w-full min-h-[64px] rounded-2xl border-2 border-black/10 bg-white px-4 py-3 font-body text-[22px] text-brand-black placeholder:text-brand-gray/70 focus:outline-none focus:ring-4 focus:ring-orange-primary/30 focus:border-orange-primary';
const etiquette = 'block font-body font-semibold text-[18px] text-brand-black mb-2';

function Fermes() {
  return (
    <main className="min-h-screen bg-[#F8F7F4] text-brand-black flex items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-4">
        <h1 className="font-display font-black text-[40px] leading-tight">Les essais sont terminés pour cette saison.</h1>
        <p className="font-body text-[22px] text-brand-gray">
          Vous pouvez adhérer à tout moment. Une question ? {ASSO.telephone}
        </p>
      </div>
    </main>
  );
}

export default function EssaiTablettePage() {
  const [ouverts] = useState(() => essaisOuverts());
  if (!MODULES.tablette || !MODULES.essais) return <NotFoundPage />;
  return ouverts ? <Tablette /> : <Fermes />;
}

function Tablette() {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [cours, setCours] = useState('');
  const [email, setEmail] = useState('');
  const [bot, setBot] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Prénom de la personne venue de s'inscrire ; non nul = écran « merci ». */
  const [merci, setMerci] = useState<string | null>(null);
  const [reste, setReste] = useState(SECONDES_AVANT_RAZ);
  const premierChamp = useRef<HTMLInputElement>(null);

  usePageMeta({
    title: `Essai gratuit — Forum — ${ASSO.nom}`,
    description: 'Inscription à un essai gratuit sur la tablette du stand.',
    path: '/essai/tablette',
  });

  const raz = useCallback(() => {
    setPrenom('');
    setNom('');
    setTelephone('');
    setCours('');
    setEmail('');
    setBot('');
    setErreur(null);
    setMerci(null);
    setReste(SECONDES_AVANT_RAZ);
    window.setTimeout(() => premierChamp.current?.focus(), 50);
  }, []);

  // Après l'envoi : compte à rebours, puis écran vierge pour la personne suivante.
  useEffect(() => {
    if (merci === null) return;
    const t = window.setInterval(() => {
      setReste((s) => {
        if (s <= 1) {
          raz();
          return SECONDES_AVANT_RAZ;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [merci, raz]);

  // Sans toucher l'écran avec des données saisies : on efface.
  useEffect(() => {
    if (merci !== null || !aDesDonnees({ prenom, nom, telephone, cours, email })) return;
    const t = window.setTimeout(raz, SECONDES_INACTIVITE * 1000);
    return () => window.clearTimeout(t);
  }, [prenom, nom, telephone, cours, email, merci, raz]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const faute = essaiFormError(prenom, nom, telephone) || (MODULES.essaiMail ? emailError(email) : null);
    if (faute) {
      setErreur(faute);
      return;
    }
    setEnvoi(true);
    try {
      const res = await fetch('/api/essai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom: prenom.trim(),
          nom: nom.trim(),
          telephone: telephone.trim(),
          ...(MODULES.essaiMail && email.trim() ? { email: email.trim() } : {}),
          cours,
          date_essai: '',
          creneau: '',
          source: 'forum',
          'bot-field': bot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Envoi impossible');
      setReste(SECONDES_AVANT_RAZ);
      setMerci(prenom.trim());
    } catch {
      setErreur('Ça n’a pas marché. Réessayez, ou voyez avec un bénévole du stand.');
    } finally {
      setEnvoi(false);
    }
  }

  if (merci !== null) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] text-brand-black flex items-center justify-center p-8">
        <div role="status" aria-live="polite" className="max-w-2xl w-full text-center space-y-6 rounded-3xl bg-white border border-black/10 p-10">
          <CheckCircle2 className="mx-auto text-brand-olive" size={72} aria-hidden="true" />
          <h1 className="font-display font-black text-[48px] leading-tight">{merci ? `Merci ${merci} !` : 'Merci !'}</h1>
          <p className="font-body font-semibold text-[26px] text-brand-olive">C’est noté.</p>
          <p className="font-body text-[22px] text-brand-gray leading-relaxed">
            Le bureau vous rappelle pour choisir votre créneau. Rien à payer le jour de l’essai.
          </p>
          <p className="font-body text-[18px] text-brand-gray">Prêt pour la personne suivante dans {reste} s</p>
          <button
            type="button"
            onClick={raz}
            className="min-h-[64px] px-10 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-body font-semibold text-[22px]"
          >
            Personne suivante
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7F4] text-brand-black p-6 md:p-10">
      <div className="mx-auto max-w-5xl grid gap-8 lg:grid-cols-[1fr_320px] items-start">
        <section>
          <p className="font-mono text-[14px] tracking-[2px] uppercase text-orange-primary font-semibold mb-2">
            {ASSO.nomCourt || ASSO.nom} · Forum des associations
          </p>
          <h1 className="font-display font-black text-[44px] md:text-[56px] leading-[1.02] mb-3">Essayez gratuitement.</h1>
          <p className="font-body text-[22px] text-brand-gray leading-relaxed mb-6">
            {NB_ESSAIS > 0 ? `${COURS_ESSAI_LABEL} offert${NB_ESSAIS > 1 ? 's' : ''}, sans rien signer. ` : ''}Remplissez ces trois lignes : un bénévole vous rappelle.
          </p>

          <form onSubmit={envoyer} className="space-y-5 rounded-3xl bg-white border border-black/10 p-6 md:p-8">
            <p className="hidden" aria-hidden="true">
              <label>
                Ne pas remplir
                <input value={bot} onChange={(e) => setBot(e.target.value)} tabIndex={-1} autoComplete="off" />
              </label>
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={etiquette} htmlFor="t-prenom">
                  Prénom
                </label>
                <input
                  id="t-prenom"
                  ref={premierChamp}
                  className={champ}
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                />
              </div>
              <div>
                <label className={etiquette} htmlFor="t-nom">
                  Nom
                </label>
                <input
                  id="t-nom"
                  className={champ}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                />
              </div>
            </div>
            <div>
              <label className={etiquette} htmlFor="t-tel">
                Téléphone
              </label>
              <input
                id="t-tel"
                className={champ}
                type="tel"
                inputMode="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                autoComplete="off"
                placeholder="06 ou 07…"
                enterKeyHint={MODULES.essaiMail ? 'next' : 'done'}
              />
            </div>
            {MODULES.essaiMail ? (
              <div>
                <label className={etiquette} htmlFor="t-mail">
                  E-mail <span className="font-normal text-brand-gray">(facultatif, pour le rappel de la veille)</span>
                </label>
                <input
                  id="t-mail"
                  className={champ}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  placeholder="marie@exemple.fr"
                  enterKeyHint="done"
                />
              </div>
            ) : null}
            <fieldset>
              <legend className={etiquette}>
                Un cours qui vous tente ? <span className="font-normal text-brand-gray">(facultatif)</span>
              </legend>
              <div className="flex flex-wrap gap-3">
                {COURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCours(cours === c ? '' : c)}
                    aria-pressed={cours === c}
                    className={`min-h-[56px] px-6 rounded-full border-2 font-body font-semibold text-[19px] ${
                      cours === c
                        ? 'bg-orange-primary border-orange-primary text-white'
                        : 'bg-white border-black/15 text-brand-black'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>

            {erreur ? (
              <p role="alert" className="font-body text-[19px] text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                {erreur}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={envoi}
              className="w-full min-h-[72px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-body font-semibold text-[24px] disabled:opacity-60 inline-flex items-center justify-center gap-3"
            >
              {envoi ? (
                <>
                  <Loader2 className="animate-spin" size={26} aria-hidden="true" />
                  Envoi…
                </>
              ) : (
                'Je m’inscris à l’essai'
              )}
            </button>
          </form>
        </section>

        <aside className="rounded-3xl bg-white border border-black/10 p-6 text-center space-y-3 lg:mt-24">
          {/* Le QR du bureau (public/assets/qr-essai.png, voir Autre → Aide) ; caché s'il n'a pas été déposé. */}
          <img
            src="/assets/qr-essai.png"
            alt="QR code pour s’inscrire depuis son téléphone"
            width={600}
            height={600}
            onError={(e) => {
              e.currentTarget.closest('aside')?.setAttribute('hidden', '');
            }}
            className="mx-auto w-[220px] h-[220px]"
          />
          <p className="font-display font-black text-[24px] leading-tight">Plus simple sur votre téléphone ?</p>
          <p className="font-body text-[17px] text-brand-gray">Scannez ce code avec l’appareil photo.</p>
        </aside>
      </div>
    </main>
  );
}
