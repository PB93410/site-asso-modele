import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

export default function ListeAttentePlacePage() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [etat, setEtat] = useState<'wait' | 'ok' | 'err' | 'deja'>('wait');
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState<{ prenom?: string; cours?: string }>({});

  usePageMeta(
    MODULES.listeAttente
      ? { title: `Une place s’est libérée — ${ASSO.nom}`, path: '/liste-attente/place' }
      : { title: `Page introuvable — ${ASSO.nom}`, path: '/liste-attente/place' },
  );

  useEffect(() => {
    if (!MODULES.listeAttente) return;
    (async () => {
      const res = await fetch(`/api/liste-attente?action=claim&t=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (data.deja) {
        setEtat('deja');
        setMsg('Cette place est déjà acceptée.');
        return;
      }
      if (!res.ok) {
        setEtat('err');
        setMsg(data.error || 'Lien invalide ou déjà utilisé.');
        return;
      }
      setInfo({ prenom: data.prenom, cours: data.cours });
      setEtat('ok');
    })();
  }, [token]);

  if (!MODULES.listeAttente) return <NotFoundPage />;

  async function accepter() {
    const res = await fetch('/api/liste-attente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEtat('err');
      setMsg(data.error || 'Impossible d’accepter.');
      return;
    }
    setEtat('deja');
    setMsg(`${data.prenom || 'C’est noté'} : la place${data.cours ? ` pour ${data.cours}` : ''} est à vous. Le bureau confirme le créneau.`);
  }

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <main id="main-content" className="page-chrome-top content-max-width py-10 sm:py-14 max-w-lg">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">Liste d’attente</p>
        <h1 className="font-display font-black text-brand-black text-[clamp(1.8rem,5vw,2.6rem)] leading-tight mb-4">
          Une place s’est libérée
        </h1>
        {etat === 'wait' ? <p className="font-body text-[16px] text-brand-gray">Vérification du lien…</p> : null}
        {etat === 'ok' ? (
          <div className="rounded-2xl bg-white ring-1 ring-black/10 p-6 space-y-4">
            <p className="font-body text-[16px] text-brand-gray">
              {info.prenom ? `${info.prenom}, ` : ''}
              {info.cours ? `une place est libre pour ${info.cours}.` : 'une place est libre.'} Répondez maintenant : le délai est limité.
            </p>
            <button
              type="button"
              onClick={() => void accepter()}
              className="w-full min-h-[48px] rounded-full bg-orange-primary text-white font-semibold"
            >
              J’accepte la place
            </button>
          </div>
        ) : null}
        {etat === 'deja' || etat === 'err' ? (
          <p className={`font-body text-[16px] ${etat === 'err' ? 'text-red-800' : 'text-brand-gray'}`}>{msg}</p>
        ) : null}
        <Link to="/" className="inline-flex min-h-[44px] items-center font-semibold text-brand-olive mt-6">
          Retour à l’accueil
        </Link>
      </main>
      <Footer />
    </div>
  );
}
