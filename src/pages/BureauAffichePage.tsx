import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BureauAuthGate from '../components/BureauAuthGate';
import {
  ASSO,
  COURS_ESSAI_LABEL,
  INCLUS_LABEL,
  NB_ESSAIS,
  SITE_URL,
  TARIF_LABEL,
  lieuAdresse,
} from '../data/asso';
import { SEASON_LABEL } from '../data/CONFIG';
import { useScheduleFromSheet } from '../hooks/useSheetData';

/**
 * Affiche A4 à imprimer (pharmacie, boulangerie, mairie…).
 * Tout vient de asso.config.js, le planning est lu en direct : réimprimer après un changement d’horaire.
 * Le QR est dessiné ici, il pointe vers /essai (ou vers l’accueil si l’association ne propose pas d’essai).
 */

const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
.affiche-sheet, .affiche-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  html, body { background: #fff !important; }
  .no-print { display: none !important; }
  .affiche-wrap { padding: 0 !important; overflow: visible !important; background: #fff !important; }
  .affiche-sheet { box-shadow: none !important; margin: 0 !important; }
}
`;

const INK = '#111110';
const CREAM = '#F8F2E8';
const LIGHT = '#F59E3B';

const PRIMAIRE = ASSO.couleurs.primaire;
const SECONDAIRE = ASSO.couleurs.secondaire;

/** Couleur par salle (1re = couleur principale, 2e = secondaire, les autres alternent) : on repère où aller. */
function salleColor(location: string) {
  const n = location.trim().toLowerCase();
  const i = ASSO.lieux.findIndex((l) => l.nom.toLowerCase() === n || l.id === n);
  return i > 0 && i % 2 === 1 ? SECONDAIRE : PRIMAIRE;
}

function useQr(url: string) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((m) => (m.default ?? m).toDataURL(url, { margin: 0, width: 600, errorCorrectionLevel: 'M' }))
      .then((data: string) => {
        if (alive) setSrc(data);
      })
      .catch(() => {
        if (alive) setSrc('');
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return src;
}

function Affiche() {
  const { schedule, loading } = useScheduleFromSheet();
  const avecEssai = NB_ESSAIS > 0;
  const cible = avecEssai ? `${SITE_URL}/essai` : SITE_URL;
  const qr = useQr(cible);
  const nbCours = schedule.length;
  const depuis = ASSO.anneeCreation ? `${ASSO.ville} · depuis ${ASSO.anneeCreation}` : ASSO.ville;

  return (
    <main className="min-h-screen bg-slate-200 text-brand-black">
      <style>{PRINT_CSS}</style>

      <div className="no-print max-w-[210mm] mx-auto px-4 pt-6 pb-4">
        <Link to="/bureau" className="text-sm text-slate-600 underline">
          ← Retour au bureau
        </Link>
        <h1 className="font-display font-black text-2xl mt-2">Affiche planning A4</h1>
        <p className="text-[15px] text-slate-700 mt-1 leading-relaxed">
          Le planning vient du Sheet : après un changement d’horaire, revenez ici et réimprimez.
          Impression couleur, A4, « Marges : aucune » et « Graphiques d’arrière-plan » cochés si
          l’option existe. Pour un PDF : choisir « Enregistrer au format PDF » comme imprimante.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={loading || !qr}
          className="mt-3 inline-flex items-center justify-center min-h-[48px] px-6 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-semibold disabled:opacity-50"
        >
          {loading || !qr ? 'Chargement…' : 'Imprimer / enregistrer en PDF'}
        </button>
      </div>

      <div className="affiche-wrap overflow-x-auto px-4 pb-10">
        <article
          className="affiche-sheet relative mx-auto shadow-xl flex flex-col overflow-hidden font-body"
          style={{ width: '210mm', height: '297mm', boxSizing: 'border-box', background: CREAM, color: INK }}
        >
          {/* Photo + titre */}
          <section className="relative shrink-0" style={{ height: '116mm' }}>
            <img
              src={ASSO.heroImage}
              alt=""
              width={1344}
              height={768}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: 'center 40%' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(17,17,16,0.55) 0%, rgba(17,17,16,0.05) 35%, rgba(17,17,16,0.25) 55%, rgba(17,17,16,0.88) 100%)',
              }}
            />

            <div className="absolute flex items-center" style={{ top: '9mm', left: '11mm', gap: '4mm' }}>
              <img
                src={ASSO.logo}
                alt={`Logo ${ASSO.nom}`}
                width={512}
                height={512}
                className="rounded-full bg-white object-contain"
                style={{ width: '30mm', height: '30mm', boxShadow: '0 0 0 1.2mm #fff, 0 2mm 6mm rgba(0,0,0,0.45)' }}
              />
              <div className="text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)', maxWidth: '85mm' }}>
                <p className="font-display font-black leading-none uppercase" style={{ fontSize: '17pt', letterSpacing: '0.5pt' }}>
                  {ASSO.nom}
                </p>
                <p className="font-semibold" style={{ fontSize: '11pt', marginTop: '1.2mm' }}>
                  {depuis}
                </p>
              </div>
            </div>

            <span
              className="absolute font-display font-bold uppercase text-white rounded-full"
              style={{
                top: '11mm',
                right: '11mm',
                fontSize: '10.5pt',
                letterSpacing: '1pt',
                padding: '1.6mm 4mm',
                background: 'rgba(17,17,16,0.7)',
                border: '0.35mm solid rgba(255,255,255,0.6)',
              }}
            >
              Saison {SEASON_LABEL.replace('-', '/')}
            </span>

            <h2
              className="absolute font-display font-black text-white"
              style={{
                left: '11mm',
                bottom: '9mm',
                width: '135mm',
                fontSize: '34pt',
                lineHeight: 1,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {ASSO.slogan}
            </h2>

            {/* Pastille */}
            {avecEssai ? (
              <div
                className="absolute rounded-full text-white text-center flex flex-col items-center justify-center"
                style={{
                  right: '10mm',
                  bottom: '-19mm',
                  width: '50mm',
                  height: '50mm',
                  background: PRIMAIRE,
                  transform: 'rotate(-9deg)',
                  boxShadow: `0 0 0 1.6mm ${CREAM}, 0 3mm 8mm rgba(0,0,0,0.35)`,
                  zIndex: 2,
                }}
              >
                <span className="font-display font-black leading-none" style={{ fontSize: '46pt' }}>
                  {NB_ESSAIS}
                </span>
                <span className="font-display font-black uppercase leading-tight" style={{ fontSize: '13pt' }}>
                  {COURS_ESSAI_LABEL.replace(/^\d+\s*/, '')}
                </span>
                <span
                  className="font-display font-black uppercase leading-none rounded-full"
                  style={{ fontSize: '14pt', marginTop: '1.5mm', padding: '1mm 3.5mm', background: '#fff', color: PRIMAIRE }}
                >
                  gratuits
                </span>
              </div>
            ) : null}
          </section>

          {/* Planning */}
          <section className="flex-1 flex flex-col" style={{ padding: '7mm 11mm 0' }}>
            <p className="font-display font-black leading-tight" style={{ fontSize: '18pt', width: '120mm' }}>
              {nbCours > 0 ? `${nbCours} cours par semaine,` : ASSO.accroche}
              <br />
              <span style={{ color: PRIMAIRE }}>tous niveaux</span>
            </p>

            <div className="grid grid-cols-2" style={{ gap: '3mm', marginTop: '5mm' }}>
              {schedule.map((row) => (
                <div
                  key={`${row.day}-${row.time}-${row.course}`}
                  className="bg-white flex"
                  style={{ borderRadius: '3.5mm', overflow: 'hidden', boxShadow: '0 0.6mm 2mm rgba(0,0,0,0.12)' }}
                >
                  <div style={{ width: '2.4mm', background: salleColor(row.location) }} />
                  <div style={{ padding: '2.2mm 4mm' }}>
                    <p className="font-bold" style={{ fontSize: '11.5pt', color: salleColor(row.location) }}>
                      {row.day} · {row.time}
                    </p>
                    <p className="font-display font-black leading-tight" style={{ fontSize: '15pt', marginTop: '0.4mm' }}>
                      {row.course}
                    </p>
                    <p style={{ fontSize: '10.5pt', color: '#57534E', marginTop: '0.4mm' }}>{row.location}</p>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '10pt', color: '#57534E', marginTop: '3mm' }}>
              {ASSO.lieux.map((lieu) => (
                <span key={lieu.id} style={{ marginRight: '6mm' }}>
                  <span className="font-bold" style={{ color: salleColor(lieu.nom) }}>■</span> {lieu.nom},{' '}
                  {lieuAdresse(lieu)}
                </span>
              ))}
            </p>
          </section>

          {/* Bandeau QR */}
          <section
            className="shrink-0 flex items-center text-white"
            style={{ background: INK, padding: '6.5mm 11mm', gap: '7mm' }}
          >
            <div className="bg-white shrink-0" style={{ padding: '2mm', borderRadius: '3mm' }}>
              {qr ? (
                <img
                  src={qr}
                  alt={avecEssai ? 'QR code vers le formulaire d’essai' : `QR code vers ${SITE_URL}`}
                  width={600}
                  height={600}
                  style={{ width: '36mm', height: '36mm', display: 'block' }}
                />
              ) : (
                <div style={{ width: '36mm', height: '36mm' }} />
              )}
            </div>
            <div>
              <p className="font-display font-black leading-tight" style={{ fontSize: '21pt' }}>
                {avecEssai ? 'Scannez, choisissez' : 'Scannez pour'}
                <br />
                <span style={{ color: LIGHT }}>{avecEssai ? 'votre créneau.' : 'nous retrouver.'}</span>
              </p>
              <p className="font-semibold" style={{ fontSize: '12pt', marginTop: '2.5mm' }}>
                {cible.replace(/^https?:\/\//, '')}
              </p>
              {ASSO.telephone ? (
                <p style={{ fontSize: '12pt', marginTop: '1mm' }}>
                  Une question ? <strong>{ASSO.telephone}</strong>
                </p>
              ) : null}
              <p style={{ fontSize: '10.5pt', marginTop: '2mm', color: 'rgba(255,255,255,0.75)' }}>
                {avecEssai ? 'Puis' : 'Adhésion :'} {TARIF_LABEL} l’année, tous les cours
                {INCLUS_LABEL ? `, ${INCLUS_LABEL}` : ''}.
              </p>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}

export default function BureauAffichePage() {
  return (
    <BureauAuthGate>
      <Affiche />
    </BureauAuthGate>
  );
}
