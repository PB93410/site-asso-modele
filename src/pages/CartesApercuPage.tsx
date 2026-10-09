import { SEASON_PREFIX } from '../data/CONFIG';
import BureauCartesTab from '../components/bureau/BureauCartesTab';

/** Aperçu local uniquement. Noms inventés, aucun envoi. */
const EXEMPLES = [
  {
    row: 1,
    nom: 'MARTIN',
    prenom: 'Camille',
    tel: '0612345678',
    mail: 'camille.martin@example.fr',
    numero: `${SEASON_PREFIX}901`,
    statut: 'À jour',
  },
  {
    row: 2,
    nom: 'BERNARD',
    prenom: 'Jean',
    tel: '0698765432',
    mail: '',
    numero: `${SEASON_PREFIX}902`,
    statut: 'À jour',
  },
  {
    row: 3,
    nom: 'ROBERT',
    prenom: 'Aline',
    tel: '0677889900',
    mail: 'aline.robert@example.fr',
    numero: `${SEASON_PREFIX}903`,
    statut: 'À jour',
    carte: '06/10/2026',
  },
];

export default function CartesApercuPage() {
  return (
    <div data-bureau-root className="min-h-screen bg-brand-cream pb-8">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/10">
        <div className="max-w-3xl mx-auto px-4 py-2.5">
          <h1 className="font-display font-bold text-lg text-brand-black">Bureau</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4">
        <p className="text-sm text-brand-gray mb-3">Aperçu. Noms d’exemple, rien n’est envoyé.</p>
        <BureauCartesTab items={EXEMPLES} loading={false} qPeople="" />
      </main>
    </div>
  );
}
