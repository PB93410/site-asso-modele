/**
 * Gate d’auth partagée bureau / bénévoles
 * Réutilise POST /api/bureau-auth + sessionStorage asso-bureau-token
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { ASSO } from '../data/asso';
import { getBureauToken, getBureauRole, setBureauRole, setBureauToken } from '../lib/bureauSession';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export default function BureauAuthGate({
  title = 'Espace interne',
  subtitle = `${ASSO.nom} — accès bureau / bénévoles`,
  children,
}: Props) {
  const [token, setToken] = useState<string | null>(() => getBureauToken());
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/bureau-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        role?: string;
        error?: string;
      };
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Mot de passe incorrect');
      }
      setBureauToken(data.token);
      if (data.role === 'seance' || data.role === 'admin') setBureauRole(data.role);
      setToken(data.token);
      setPassword('');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Échec de connexion');
    } finally {
      setLoggingIn(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl ring-1 ring-black/[0.06] shadow-xl shadow-black/[0.04] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
<div className="w-12 h-12 rounded-2xl bg-brand-olive text-white font-display font-bold text-sm flex items-center justify-center" aria-hidden="true">
              {ASSO.sigle.slice(0, 3)}
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-brand-black">{title}</h1>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="bureau-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Mot de passe
              </label>
              <input
                id="bureau-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                className="w-full rounded-xl border-0 ring-1 ring-black/10 bg-white px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-olive"
                placeholder="••••••••"
              />
            </div>
            {loginError && (
              <div className="flex items-start gap-2 text-red-800 text-sm bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2" role="alert">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{loginError}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loggingIn || !password}
              className="w-full rounded-xl bg-brand-olive hover:bg-brand-olive-hover disabled:opacity-60 text-white font-semibold py-3.5 text-base min-h-[48px]"
            >
              {loggingIn ? 'Connexion…' : 'Entrer'}
            </button>
          </form>
          <p className="mt-4 text-xs text-slate-400 text-center">
            Même mot de passe que l’espace Bureau. Page non indexée.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function BureauSeanceReserve({ children }: { children: ReactNode }) {
  if (getBureauRole() !== 'seance') return <>{children}</>;
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="font-display font-bold text-xl text-brand-black">Réservé au bureau</p>
        <Link
          to="/bureau"
          className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-brand-olive text-white font-semibold"
        >
          Retour
        </Link>
      </div>
    </div>
  );
}
