import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

type Info = { session: string; date: string; cours: string; horaire: string; lieu: string; asso: string };

export default function PresencePage() {
  const [params] = useSearchParams();
  const session = params.get('s') || '';
  const token = params.get('t') || '';
  const [info, setInfo] = useState<Info | null>(null);
  const [erreur, setErreur] = useState('');
  const [numero, setNumero] = useState('');
  const [mail, setMail] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [ok, setOk] = useState<{ prenom: string; deja: boolean; cours: string } | null>(null);

  usePageMeta(
    MODULES.presences
      ? {
          title: `Pointer — ${ASSO.nom}`,
          description: `Pointer votre présence à ${ASSO.nom}.`,
          path: '/presence',
        }
      : { title: `Page introuvable — ${ASSO.nom}`, path: '/presence' },
  );

  useEffect(() => {
    if (!MODULES.presences || !session || !token) return;
    let stop = false;
    (async () => {
      const res = await fetch(`/api/presence?action=info&s=${encodeURIComponent(session)}&t=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (stop) return;
      if (!res.ok) {
        setErreur(data.error || 'Ce QR n’est plus valable.');
        return;
      }
      setInfo(data);
    })();
    return () => {
      stop = true;
    };
  }, [session, token]);

  const titre = useMemo(() => {
    if (!info?.cours) return 'Pointer à la séance';
    return info.horaire ? `${info.cours} — ${info.horaire}` : info.cours;
  }, [info]);

  if (!MODULES.presences) return <NotFoundPage />;

  async function pointer(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkin', session, token, numero, mail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error || 'Pointage impossible.');
        return;
      }
      setOk({ prenom: data.prenom || '', deja: Boolean(data.deja), cours: data.cours || info?.cours || '' });
    } catch {
      setErreur('Réseau coupé. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <main id="main-content" className="page-chrome-top content-max-width py-10 sm:py-14">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">Présence</p>
        <h1 className="font-display font-black text-brand-black text-[clamp(1.8rem,5vw,2.6rem)] leading-tight mb-3">
          {titre}
        </h1>
        {info?.lieu ? <p className="font-body text-[16px] text-brand-gray mb-6">{info.lieu}</p> : null}

        {ok ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/10 p-6 sm:p-8 max-w-lg">
            <p className="font-display font-bold text-[22px] text-brand-black mb-2">
              {ok.deja ? 'Déjà pointé' : 'C’est noté'}
            </p>
            <p className="font-body text-[16px] text-brand-gray leading-relaxed">
              {ok.deja
                ? `${ok.prenom || 'Vous'} : votre présence à ce cours est déjà enregistrée aujourd’hui.`
                : `${ok.prenom || 'Merci'}, votre présence${ok.cours ? ` à ${ok.cours}` : ''} est enregistrée.`}
            </p>
            <Link to="/" className="inline-flex items-center justify-center min-h-[44px] mt-6 font-semibold text-orange-primary">
              Retour à l’accueil
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void pointer(e)} className="rounded-2xl bg-white ring-1 ring-black/10 p-6 sm:p-8 max-w-lg space-y-4">
            <p className="font-body text-[16px] text-brand-gray leading-relaxed">
              Indiquez votre numéro d’adhérent <strong className="text-brand-black">ou</strong> l’e-mail de la fiche. Un seul pointage par séance et par jour.
            </p>
            <label className="block">
              <span className="block font-semibold text-brand-black mb-1">Numéro d’adhérent</span>
              <input
                className="w-full min-h-[48px] rounded-xl border border-black/15 px-3 text-[17px]"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                autoComplete="off"
                placeholder={`ex. ${ASSO.sigle}-2627-001`}
              />
            </label>
            <label className="block">
              <span className="block font-semibold text-brand-black mb-1">Ou votre e-mail</span>
              <input
                type="email"
                className="w-full min-h-[48px] rounded-xl border border-black/15 px-3 text-[17px]"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <input type="text" name="bot-field" className="hidden" tabIndex={-1} autoComplete="off" />
            {erreur ? (
              <p role="alert" className="font-medium text-red-800">
                {erreur}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={envoi || !info}
              className="w-full min-h-[48px] rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold text-[16px] disabled:opacity-60"
            >
              {envoi ? 'Enregistrement…' : 'Je suis là'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
