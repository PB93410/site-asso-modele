import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export default function AlertesPage() {
  const [mail, setMail] = useState('');
  const [consent, setConsent] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ok, setOk] = useState(false);
  const [pushOk, setPushOk] = useState('');
  const [vapid, setVapid] = useState('');

  usePageMeta(
    MODULES.alertes
      ? {
          title: `Alertes cours — ${ASSO.nom}`,
          description: `Recevoir un message si un cours de ${ASSO.nom} est annulé ou déplacé.`,
          path: '/alertes',
        }
      : { title: `Page introuvable — ${ASSO.nom}`, path: '/alertes' },
  );

  useEffect(() => {
    if (!MODULES.alertes) return;
    fetch('/api/alertes?action=vapid')
      .then((r) => r.json())
      .then((d) => setVapid(String(d.publicKey || '')))
      .catch(() => {});
  }, []);

  if (!MODULES.alertes) return <NotFoundPage />;

  async function abonner(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    try {
      const res = await fetch('/api/alertes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abo', mail, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error || 'Inscription impossible.');
        return;
      }
      setOk(true);
    } catch {
      setErreur('Réseau coupé. Réessayez dans un instant.');
    }
  }

  async function activerPush() {
    setPushOk('');
    if (!vapid || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushOk('Les notifications ne sont pas disponibles sur cet appareil.');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw-alertes.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushOk('Autorisation refusée. Vous recevrez seulement les e-mails.');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToBytes(vapid),
      });
      const res = await fetch('/api/alertes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abo', mail, consent: true, push: sub.toJSON() }),
      });
      if (!res.ok) throw new Error('abo');
      setPushOk('Cet appareil recevra aussi une notification.');
    } catch {
      setPushOk('Notification impossible ici. L’e-mail suffit.');
    }
  }

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <nav aria-label="Fil d'Ariane" className="bg-white border-b border-black/[0.06] page-chrome-top">
        <div className="content-max-width py-3">
          <ol className="flex items-center gap-2 font-body text-[13px]">
            <li>
              <Link to="/" className="text-brand-gray hover:text-brand-black">
                Accueil
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={14} className="text-brand-gray" />
            </li>
            <li className="text-brand-black font-medium">Alertes cours</li>
          </ol>
        </div>
      </nav>
      <main id="main-content" className="content-max-width py-10 sm:py-14">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">Dernière minute</p>
        <h1 className="font-display font-black text-brand-black text-[clamp(1.8rem,5vw,2.8rem)] leading-tight mb-4">
          Un cours annulé ou déplacé ?
        </h1>
        <p className="font-body text-[17px] text-brand-gray max-w-[36rem] mb-8">
          Laissez votre e-mail. Le bureau vous prévient si une séance change. Vous pouvez vous retirer à tout moment. Rien d’autre n’est demandé.
        </p>

        {ok ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/10 p-6 max-w-lg space-y-4">
            <p className="font-display font-bold text-[22px] text-brand-black">C’est noté</p>
            <p className="font-body text-[16px] text-brand-gray">
              Un message partira à {mail} seulement si un cours change. Un lien pour se retirer figure dans chaque mail.
            </p>
            {vapid ? (
              <button
                type="button"
                onClick={() => void activerPush()}
                className="min-h-[44px] px-5 rounded-full bg-brand-olive text-white font-semibold"
              >
                Aussi sur cet appareil
              </button>
            ) : null}
            {pushOk ? <p className="font-body text-[15px] text-brand-gray">{pushOk}</p> : null}
          </div>
        ) : (
          <form onSubmit={(e) => void abonner(e)} className="rounded-2xl bg-white ring-1 ring-black/10 p-6 max-w-lg space-y-4">
            <label className="block">
              <span className="block font-semibold text-brand-black mb-1">Votre e-mail</span>
              <input
                type="email"
                required
                className="w-full min-h-[48px] rounded-xl border border-black/15 px-3 text-[17px]"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="flex gap-3 items-start">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="font-body text-[15px] text-brand-gray">
                J’accepte de recevoir uniquement les alertes de cours (annulation ou changement). Conservation : jusqu’à désinscription, ou 2 ans sans message. Voir la{' '}
                <Link to="/confidentialite#alertes" className="text-orange-primary underline">
                  confidentialité
                </Link>
                .
              </span>
            </label>
            <input type="text" name="bot-field" className="hidden" tabIndex={-1} autoComplete="off" />
            {erreur ? (
              <p role="alert" className="font-medium text-red-800">
                {erreur}
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px]"
            >
              M’inscrire aux alertes
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
