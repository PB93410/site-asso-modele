import { Component, type ReactNode, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import DemoBanner from './components/DemoBanner';
import HomePage from './pages/HomePage';
import EssaiPage from './pages/EssaiPage';
import InscriptionPage from './pages/InscriptionPage';
import TarifsPage from './pages/TarifsPage';
import { ASSO, AUTOUR_PATH, MODULES } from './data/asso';

// Espace bureau : chargé seulement quand on ouvre /bureau (jamais pour les visiteurs).
const BureauPage = lazy(() => import('./pages/BureauPage'));
const BureauMailPage = lazy(() => import('./pages/BureauMailPage'));
const BureauAgendaPage = lazy(() => import('./pages/BureauAgendaPage'));
const BureauGoogleConnectPage = lazy(() => import('./pages/BureauGoogleConnectPage'));
const BureauRelancesPage = lazy(() => import('./pages/BureauRelancesPage'));

const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const MentionsLegalesPage = lazy(() => import('./pages/MentionsLegalesPage'));
const ConfidentialitePage = lazy(() => import('./pages/ConfidentialitePage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const AutourPage = lazy(() => import('./pages/AutourPage'));
const BlogListPage = lazy(() => import('./pages/BlogListPage'));
const BlogArticlePage = lazy(() => import('./pages/BlogArticlePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const CartesApercuPage = import.meta.env.DEV
  ? lazy(() => import('./pages/CartesApercuPage'))
  : null;

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center" aria-busy="true">
      <span className="font-body text-sm text-brand-gray">Chargement…</span>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
    const msg = String(error?.message || error || '');
    const chunkFail =
      /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module/i.test(
        msg,
      );
    if (!chunkFail || typeof sessionStorage === 'undefined') return;
    const key = 'asso-chunk-reload';
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }
  componentDidUpdate(_prev: unknown, prevState: { error: Error | null }) {
    if (prevState.error && !this.state.error && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('asso-chunk-reload');
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '6rem 1.5rem', fontFamily: 'system-ui', maxWidth: 560, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Une erreur est survenue</h1>
          <p style={{ color: '#5C5A54', marginBottom: 16 }}>
            Rechargez la page (Ctrl + F5 ou vider le cache). Si le problème continue, contactez le
            bureau ({ASSO.telephone}).
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('asso-chunk-reload');
              window.location.reload();
            }}
            style={{
              display: 'inline-block',
              marginBottom: 12,
              padding: '10px 18px',
              borderRadius: 999,
              border: 'none',
              background: ASSO.couleurs.primaire,
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recharger
          </button>
          <div>
            <a href="/" className="text-orange-primary font-semibold">
              Retour à l'accueil
            </a>
          </div>
          {import.meta.env.DEV ? (
            <pre style={{ marginTop: 24, fontSize: 12, color: '#888', whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const location = useLocation();
  const isBureau = location.pathname.startsWith('/bureau');
  const isBenevoles = location.pathname.startsWith('/benevoles');
  const hidePublicChrome = isBureau || isBenevoles;

  return (
    <div className="relative">
      {!hidePublicChrome && <Navigation />}
      <DemoBanner />
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogArticlePage />} />
            <Route path="/benevoles" element={<Navigate to="/bureau" replace />} />
            <Route path="/benevoles/*" element={<Navigate to="/bureau" replace />} />
            {/* Fonctions activées dans asso.config.js → modules */}
            {MODULES.mail ? (
              <>
                <Route path="/bureau/mail" element={<BureauMailPage />} />
                <Route path="/bureau/agenda" element={<BureauAgendaPage />} />
                <Route path="/bureau/connexion-google" element={<BureauGoogleConnectPage />} />
              </>
            ) : null}
            {MODULES.bureau ? (
              <>
                <Route path="/bureau/relances" element={<BureauRelancesPage />} />
                <Route path="/bureau" element={<BureauPage />} />
                {CartesApercuPage ? (
                  <Route path="/bureau/apercu-cartes" element={<CartesApercuPage />} />
                ) : null}
              </>
            ) : (
              <Route path="/bureau/*" element={<NotFoundPage />} />
            )}
            <Route path="/inscription" element={<InscriptionPage />} />
            <Route path="/tarifs" element={<TarifsPage />} />
            <Route path="/essai" element={<EssaiPage />} />
            <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
            <Route path="/confidentialite" element={<ConfidentialitePage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path={AUTOUR_PATH} element={<AutourPage />} />
            <Route path="/:slug" element={<ActivityPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
