import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ASSO, MODULES } from '../data/asso';
import { usePageMeta } from '../hooks/usePageMeta';
import Footer from '../sections/Footer';
import NotFoundPage from './NotFoundPage';

type Doc = { id: string; label: string };

export default function AttestationsPage() {
  const [params] = useSearchParams();
  const nLien = params.get('n') || '';
  const mLien = params.get('m') || '';
  const xLien = params.get('x') || '';
  const tLien = params.get('t') || '';
  const [numero, setNumero] = useState(nLien);
  const [mail, setMail] = useState(mLien);
  const [session, setSession] = useState<{ exp: string; token: string; prenom: string; docs: Doc[] } | null>(
    nLien && mLien && xLien && tLien ? { exp: xLien, token: tLien, prenom: '', docs: [] } : null,
  );
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  usePageMeta(
    MODULES.attestations
      ? { title: `Attestations — ${ASSO.nom}`, path: '/attestations' }
      : { title: `Page introuvable — ${ASSO.nom}`, path: '/attestations' },
  );

  useEffect(() => {
    if (!MODULES.attestations || !tLien) return;
    const t = window.setTimeout(() => {
      fetch('/api/attestations?action=types')
        .then((r) => r.json())
        .then((d) => {
          setSession({ exp: xLien, token: tLien, prenom: '', docs: Array.isArray(d.docs) ? d.docs : [] });
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(t);
  }, [tLien, xLien]);

  if (!MODULES.attestations) return <NotFoundPage />;

  async function ouvrir(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/attestations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ouvrir', numero, mail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Vérification impossible.');
        return;
      }
      setSession({
        token: data.token || '',
        exp: data.exp || '',
        prenom: data.prenom || '',
        docs: Array.isArray(data.docs) ? data.docs : [],
      });
    } catch {
      setErr('Réseau coupé. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  }

  async function envoyerLien() {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/attestations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lien', numero, mail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Envoi impossible.');
        return;
      }
      setMsg(data.mailOk ? 'Un lien a été préparé vers votre e-mail (en démo, rien ne part vraiment).' : 'Lien préparé. Le mail n’est pas branché : notez l’adresse ou demandez au bureau.');
    } catch {
      setErr('Réseau coupé. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  }

  function telecharger(type: string) {
    if (!session) return;
    const q = new URLSearchParams({ action: 'pdf', type, n: numero, m: mail, x: session.exp, t: session.token });
    fetch(`/api/attestations?${q}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Téléchargement impossible.');
        }
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${numero || 'attestation'}-${type}.pdf`;
        a.click();
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Téléchargement impossible.'));
  }

  const pret = Boolean(session?.token && session.docs.length);

  return (
    <div className="relative bg-[#F8F7F4] min-h-screen">
      <main id="main-content" className="page-chrome-top content-max-width py-10 sm:py-14 max-w-lg">
        <p className="font-mono text-[11px] tracking-[3px] uppercase text-orange-primary mb-3">Attestations</p>
        <h1 className="font-display font-black text-brand-black text-[clamp(1.8rem,5vw,2.6rem)] leading-tight mb-4">
          Vos documents
        </h1>
        <p className="font-body text-[16px] text-brand-gray mb-6">
          Attestation d’adhésion, reçu fiscal si l’association le propose, et papier pour le comité d’entreprise.
          Indiquez votre numéro et l’e-mail de la fiche.
        </p>
        {!pret ? (
          <form onSubmit={(e) => void ouvrir(e)} className="rounded-2xl bg-white ring-1 ring-black/10 p-6 space-y-4">
            <label className="block">
              <span className="font-semibold text-brand-black">Numéro d’adhérent</span>
              <input
                className="mt-1 w-full min-h-[48px] rounded-xl border border-black/10 bg-[#FDF8F1] px-3"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                autoComplete="off"
                placeholder="ex. ASE-2627-001"
              />
            </label>
            <label className="block">
              <span className="font-semibold text-brand-black">E-mail de la fiche</span>
              <input
                className="mt-1 w-full min-h-[48px] rounded-xl border border-black/10 bg-[#FDF8F1] px-3"
                type="email"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] rounded-full bg-orange-primary text-white font-semibold disabled:opacity-60"
            >
              {busy ? 'Vérification…' : 'Voir mes documents'}
            </button>
            <button
              type="button"
              disabled={busy || !numero || !mail}
              onClick={() => void envoyerLien()}
              className="w-full min-h-[48px] rounded-full border-2 border-orange-primary text-orange-primary font-semibold disabled:opacity-60"
            >
              Recevoir un lien par mail
            </button>
          </form>
        ) : (
          <div className="rounded-2xl bg-white ring-1 ring-black/10 p-6 space-y-4">
            <p className="font-body text-[16px] text-brand-gray">
              {session?.prenom ? `${session.prenom}, ` : ''}choisissez le document à télécharger.
            </p>
            {session?.docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => telecharger(d.id)}
                className="w-full min-h-[48px] rounded-full bg-orange-primary text-white font-semibold"
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
        {err ? <p className="mt-4 font-body text-[16px] text-red-800">{err}</p> : null}
        {msg ? <p className="mt-4 font-body text-[16px] text-brand-olive">{msg}</p> : null}
        <Link to="/" className="inline-flex min-h-[44px] items-center font-semibold text-brand-olive mt-6">
          Retour à l’accueil
        </Link>
      </main>
      <Footer />
    </div>
  );
}
