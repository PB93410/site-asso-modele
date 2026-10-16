import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import { INTENTIONS, RAISONS, SUGGESTION_MAX, type Intention, type Raison } from '../lib/sondageEssai';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

const choix = 'flex items-center gap-3 min-h-[48px] rounded-xl border border-black/10 bg-white px-3 py-2.5 font-body text-[16px] text-brand-black cursor-pointer has-[:checked]:border-orange-primary has-[:checked]:bg-orange-light';

/** Mini-sondage après l'essai : trois questions, anonyme (aucun nom, aucun numéro). Page non indexée. */
export default function SondageEssaiPage() {
  usePageMeta({
    title: `Votre avis sur l’essai — ${ASSO.nom}`,
    description: 'Trois questions, anonymes, pour nous aider à mieux accueillir.',
    path: '/sondage-essai',
  });
  const [intention, setIntention] = useState<Intention | ''>('');
  const [raison, setRaison] = useState<Raison | ''>('');
  const [suggestion, setSuggestion] = useState('');
  const [bot, setBot] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState(false);
  if (!MODULES.sondageEssai) return <NotFoundPage />;

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!intention) {
      setErreur('Choisissez une réponse à la première question.');
      return;
    }
    setErreur('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/sondage-essai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intention, raison: intention === 'oui' ? '' : raison, suggestion, 'bot-field': bot }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error || 'Envoi impossible');
      setFait(true);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Envoi impossible. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <main id="main-content" className="content-max-width py-10 page-chrome-top">
        <div className="max-w-xl mx-auto space-y-5">
          <h1 className="font-display font-black text-3xl text-brand-black">Votre avis sur l’essai</h1>
          {fait ? (
            <div className="rounded-2xl bg-white border border-black/[0.06] p-5 space-y-2" role="status">
              <p className="flex items-center gap-2 font-body text-[18px] font-semibold text-brand-olive">
                <CheckCircle2 size={22} aria-hidden="true" /> Merci, c’est reçu.
              </p>
              <p className="font-body text-[16px] text-brand-gray">Vos réponses nous aident à mieux accueillir les prochaines personnes.</p>
            </div>
          ) : (
            <form onSubmit={(e) => void envoyer(e)} className="space-y-6" noValidate>
              <p className="font-body text-[16px] text-brand-gray">
                Trois questions, 30 secondes. C’est anonyme : ne mettez ni nom ni numéro de téléphone.
              </p>
              <fieldset className="space-y-2">
                <legend className="font-body text-[17px] font-semibold text-brand-black mb-2">1. Pensez-vous adhérer au club ?</legend>
                {INTENTIONS.map((o) => (
                  <label key={o.id} className={choix}>
                    <input type="radio" name="intention" value={o.id} checked={intention === o.id} onChange={() => setIntention(o.id)} className="h-5 w-5 accent-orange-primary" />
                    {o.label}
                  </label>
                ))}
              </fieldset>
              {intention === 'peut-etre' || intention === 'non' ? (
                <fieldset className="space-y-2">
                  <legend className="font-body text-[17px] font-semibold text-brand-black mb-2">
                    2. Qu’est-ce qui vous retient ? <span className="font-normal text-brand-gray">(facultatif)</span>
                  </legend>
                  {RAISONS.map((o) => (
                    <label key={o.id} className={choix}>
                      <input type="radio" name="raison" value={o.id} checked={raison === o.id} onChange={() => setRaison(o.id)} className="h-5 w-5 accent-orange-primary" />
                      {o.label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div>
                <label htmlFor="suggestion" className="block font-body text-[17px] font-semibold text-brand-black mb-2">
                  {intention === 'peut-etre' || intention === 'non' ? '3' : '2'}. Une idée pour mieux vous accueillir ?{' '}
                  <span className="font-normal text-brand-gray">(facultatif)</span>
                </label>
                <textarea
                  id="suggestion"
                  value={suggestion}
                  maxLength={SUGGESTION_MAX}
                  rows={3}
                  onChange={(e) => setSuggestion(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-[#FDF8F1] px-3 py-2.5 font-body text-[16px] text-brand-black focus:outline-none focus:ring-2 focus:ring-orange-primary/35 focus:border-orange-primary/50 focus:bg-white"
                />
                <p className="font-body text-[14px] text-brand-gray mt-1">{SUGGESTION_MAX - suggestion.length} caractères restants</p>
              </div>
              <div className="hidden" aria-hidden="true">
                <label>
                  Ne pas remplir <input tabIndex={-1} autoComplete="off" value={bot} onChange={(e) => setBot(e.target.value)} />
                </label>
              </div>
              {erreur ? (
                <p role="alert" className="font-body text-[15px] text-red-700">
                  {erreur}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={envoi}
                className="w-full min-h-[48px] rounded-full bg-orange-primary text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {envoi ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
                Envoyer
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
