/**
 * /bureau/connexion-google — référent seulement (session bureau)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import BureauAuthGate from '../components/BureauAuthGate';
import { bureauFetch } from '../lib/bureauApi';
import { ASSO } from '../data/asso';

export default function BureauGoogleConnectPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startOAuth() {
    setError('');
    setBusy(true);
    try {
      const data = await bureauFetch<{ url: string }>('/api/bureau/google/start');
      if (!data.url) throw new Error('URL Google manquante.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec');
      setBusy(false);
    }
  }

  return (
    <BureauAuthGate title="Bureau" subtitle="Connecter le compte Google asso">
      <div className="min-h-screen bg-brand-cream text-brand-black">
        <header className="sticky top-0 z-10 border-b border-black/10 bg-brand-cream/95">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <Link
              to="/bureau?tab=more"
              className="text-sm font-semibold text-orange-primary min-h-[44px] inline-flex items-center"
            >
              ← Autre
            </Link>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-primary/10 flex items-center justify-center">
              <Link2 className="w-6 h-6 text-orange-primary" aria-hidden="true" />
            </div>
            <h1 className="font-display font-bold text-2xl">Connecter Google</h1>
          </div>
          <p className="text-base text-brand-gray leading-relaxed">
            Réservé au référent. Autorise une fois le compte{' '}
            <strong>{ASSO.email}</strong> pour Mail, Agenda et Contacts
            (sync adhérents) — sans donner le mot de passe Gmail aux bénévoles.
          </p>
          <ol className="text-sm text-brand-gray space-y-2 list-decimal pl-5 leading-relaxed">
            <li>Cliquez ci-dessous et choisissez le compte asso (pas un Gmail perso).</li>
            <li>Acceptez Gmail (lire + envoyer), Agenda et Contacts.</li>
            <li>
              Copiez le refresh token dans Netlify →{' '}
              <code className="text-xs">GOOGLE_REFRESH_TOKEN</code>, puis redéployez.
            </li>
          </ol>
          {error ? (
            <p className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void startOAuth()}
            disabled={busy}
            className="w-full sm:w-auto min-h-[48px] px-5 rounded-xl bg-orange-primary text-white font-semibold text-base disabled:opacity-60"
          >
            {busy ? 'Redirection…' : 'Autoriser Gmail, Agenda et Contacts'}
          </button>
          <p className="text-sm text-brand-gray">
            Mode d’emploi détaillé : fichier <strong>DOC-BUREAU-GOOGLE.md</strong> dans le
            projet (sans secrets).
          </p>
        </main>
      </div>
    </BureauAuthGate>
  );
}
