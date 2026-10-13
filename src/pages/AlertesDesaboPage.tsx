import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

export default function AlertesDesaboPage() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [etat, setEtat] = useState<'wait' | 'ok' | 'err'>('wait');
  const [msg, setMsg] = useState('');

  usePageMeta(
    MODULES.alertes
      ? {
          title: `Retrait des alertes — ${ASSO.nom}`,
          description: `Ne plus recevoir les alertes de cours de ${ASSO.nom}.`,
          path: '/alertes/desabo',
        }
      : { title: `Page introuvable — ${ASSO.nom}`, path: '/alertes/desabo' },
  );

  useEffect(() => {
    if (!MODULES.alertes) return;
    (async () => {
      const res = await fetch(`/api/alertes?action=desabo&t=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEtat('ok');
        setMsg(data.mail ? `Plus aucun message ne partira vers ${data.mail}.` : 'Vous êtes retiré·e des alertes.');
      } else {
        setEtat('err');
        setMsg(data.error || 'Lien invalide ou déjà utilisé.');
      }
    })();
  }, [token]);

  if (!MODULES.alertes) return <NotFoundPage />;

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <main id="main-content" className="page-chrome-top content-max-width py-14">
        <h1 className="font-display font-black text-brand-black text-[2rem] mb-4">Alertes cours</h1>
        <p className="font-body text-[17px] text-brand-gray max-w-lg">{etat === 'wait' ? 'Un instant…' : msg}</p>
        <Link to="/" className="inline-flex min-h-[44px] items-center mt-6 font-semibold text-orange-primary">
          Retour à l’accueil
        </Link>
      </main>
      <Footer />
    </div>
  );
}
