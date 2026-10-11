import { useEffect, useMemo, useRef, useState } from 'react';
import { dossierVide, erreursDossier, normaliserDossier, type Dossier, type ErreurDossier } from '../../src/lib/dossier.js';
import { envoyer, telecharger } from './envoi';
import {
  EtapeAdhesion,
  EtapeAnimateurs,
  EtapeFaq,
  EtapeAssociation,
  EtapeContacts,
  EtapeCours,
  EtapeApparence,
  EtapeFonctions,
  EtapeLieux,
  type PropsEtape,
} from './etapes';
import { avec } from './etat';
import { Bouton, Encadre, Texte, ZoneTexte } from './ui';

const CLE = 'configurateur-dossier-v1';

type IdEtape = 'accueil' | ErreurDossier['etape'] | 'fonctions';

const ETAPES: { id: IdEtape; titre: string; sousTitre?: string }[] = [
  { id: 'accueil', titre: 'Bienvenue' },
  { id: 'association', titre: 'Votre association', sousTitre: 'Son nom, ses activités, sa ville.' },
  { id: 'lieux', titre: 'Vos salles', sousTitre: 'Où se passent les cours.' },
  { id: 'contacts', titre: 'Vous joindre', sousTitre: 'Mail, téléphone, réseaux.' },
  { id: 'adhesion', titre: 'L’adhésion', sousTitre: 'Tarif, essais, paiement.' },
  { id: 'cours', titre: 'Cours et horaires', sousTitre: 'Ce que vous proposez, et quand.' },
  { id: 'animateurs', titre: 'Les animateurs', sousTitre: 'Qui accueille les adhérents.' },
  { id: 'faq', titre: 'Questions fréquentes', sousTitre: 'Ce que l’on vous demande souvent.' },
  { id: 'apparence', titre: 'L’apparence', sousTitre: 'Logo, couleur, photo.' },
  { id: 'fonctions', titre: 'Ce que le site fera', sousTitre: 'Les options, en plus de la vitrine.' },
  { id: 'envoi', titre: 'Envoyer', sousTitre: 'Vérifier et nous transmettre le dossier.' },
];

function charger(): Dossier | null {
  try {
    const raw = localStorage.getItem(CLE);
    return raw ? normaliserDossier(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const brouillon = useMemo(() => charger(), []);
  const [d, setD] = useState<Dossier>(() => brouillon || dossierVide());
  const [i, setI] = useState(0);
  const [envoi, setEnvoi] = useState<'' | 'en-cours' | 'envoye' | 'simule' | 'erreur'>('');
  const [msgEnvoi, setMsgEnvoi] = useState('');
  const haut = useRef<HTMLHeadingElement>(null);

  // Brouillon gardé dans ce navigateur, pour reprendre plus tard.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CLE, JSON.stringify(d));
      } catch {
        // stockage plein ou bloqué : le questionnaire marche quand même
      }
    }, 400);
    return () => clearTimeout(t);
  }, [d]);

  const erreurs = useMemo(() => erreursDossier(d), [d]);
  const etape = ETAPES[i];
  const erreursEtape = erreurs.filter((e) => e.etape === etape.id);
  const [vuesEtapes, setVues] = useState<Set<string>>(new Set());
  const montrerErreurs = vuesEtapes.has(etape.id) || etape.id === 'envoi';
  const erreur = (champ: string) => (montrerErreurs ? erreurs.find((e) => e.champ === champ)?.message : undefined);
  const maj = (chemin: string, valeur: unknown) => setD((prev) => avec(prev, chemin, valeur));
  const props: PropsEtape = { d, maj, erreur };

  function aller(n: number) {
    setVues((v) => new Set(v).add(etape.id));
    setI(Math.max(0, Math.min(ETAPES.length - 1, n)));
    window.scrollTo({ top: 0 });
    setTimeout(() => haut.current?.focus(), 50);
  }

  async function lancerEnvoi() {
    setEnvoi('en-cours');
    setMsgEnvoi('');
    try {
      setEnvoi(await envoyer(d));
    } catch (e) {
      setEnvoi('erreur');
      setMsgEnvoi(e instanceof Error ? e.message : 'L’envoi n’a pas abouti.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="font-extrabold text-[17px]">Créer le site de votre association</span>
          {i > 0 ? <span className="ml-auto text-[14px] text-slate-500">Étape {i} sur {ETAPES.length - 1}</span> : null}
        </div>
        {i > 0 ? (
          <div className="h-1.5 bg-slate-100" aria-hidden="true">
            <div className="h-full bg-slate-800 transition-all" style={{ width: `${(i / (ETAPES.length - 1)) * 100}%` }} />
          </div>
        ) : null}
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <h1 ref={haut} tabIndex={-1} className="text-[28px] sm:text-[34px] font-black leading-tight outline-none">
          {etape.id === 'accueil' ? 'Votre site, sans technique' : etape.titre}
        </h1>
        {etape.sousTitre ? <p className="mt-1 text-[17px] text-slate-600">{etape.sousTitre}</p> : null}

        <div className="mt-8">
          {etape.id === 'accueil' ? (
            <Accueil brouillon={Boolean(brouillon?.association.nom)} nom={d.association.nom} onCommencer={() => aller(1)} onRecommencer={() => {
              setD(dossierVide());
              aller(1);
            }} />
          ) : null}
          {etape.id === 'association' ? <EtapeAssociation {...props} /> : null}
          {etape.id === 'lieux' ? <EtapeLieux {...props} /> : null}
          {etape.id === 'contacts' ? <EtapeContacts {...props} /> : null}
          {etape.id === 'adhesion' ? <EtapeAdhesion {...props} /> : null}
          {etape.id === 'cours' ? <EtapeCours {...props} /> : null}
          {etape.id === 'animateurs' ? <EtapeAnimateurs {...props} /> : null}
          {etape.id === 'faq' ? <EtapeFaq {...props} /> : null}
          {etape.id === 'apparence' ? <EtapeApparence {...props} /> : null}
          {etape.id === 'fonctions' ? <EtapeFonctions {...props} /> : null}
          {etape.id === 'envoi' ? (
            <EtapeEnvoi
              {...props}
              erreurs={erreurs}
              allerA={(id) => aller(ETAPES.findIndex((e) => e.id === id))}
              envoi={envoi}
              msgEnvoi={msgEnvoi}
              onEnvoyer={() => void lancerEnvoi()}
            />
          ) : null}
        </div>

        {i > 0 && etape.id !== 'envoi' ? (
          <nav className="mt-10 flex items-center gap-3 border-t border-slate-200 pt-6" aria-label="Étapes">
            <Bouton variante="secondaire" onClick={() => aller(i - 1)}>
              ← Retour
            </Bouton>
            <span className="text-[14px] text-slate-500 hidden sm:inline">
              {erreursEtape.length && montrerErreurs ? `${erreursEtape.length} point(s) à compléter` : 'Enregistré dans ce navigateur'}
            </span>
            <Bouton className="ml-auto" onClick={() => aller(i + 1)}>
              Continuer →
            </Bouton>
          </nav>
        ) : null}
        {etape.id === 'envoi' && envoi !== 'envoye' && envoi !== 'simule' ? (
          <div className="mt-8">
            <Bouton variante="secondaire" onClick={() => aller(i - 1)}>
              ← Retour
            </Bouton>
          </div>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <p className="max-w-4xl mx-auto px-4 py-4 text-[13px] text-slate-500">
          Outil proposé par PB Consulting. Vos réponses restent dans ce navigateur jusqu’à l’envoi.
        </p>
      </footer>
    </div>
  );
}

function Accueil({
  brouillon,
  nom,
  onCommencer,
  onRecommencer,
}: {
  brouillon: boolean;
  nom: string;
  onCommencer: () => void;
  onRecommencer: () => void;
}) {
  return (
    <div className="space-y-6 text-[17px] leading-relaxed">
      <p>
        Décrivez votre association en <strong>une demi-heure environ</strong>. Nous préparons votre site à partir de vos réponses, puis nous vous le montrons
        avant de le mettre en ligne.
      </p>
      <Encadre>
        <p className="font-semibold">À avoir sous la main</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>les horaires de vos cours et l’adresse des salles ;</li>
          <li>le tarif de la cotisation ;</li>
          <li>votre logo et une photo de cours, si vous en avez (sinon, pas grave).</li>
        </ul>
      </Encadre>
      <p className="text-[15px] text-slate-600">Vous pouvez vous arrêter à tout moment : vos réponses sont gardées dans ce navigateur, sur cet appareil.</p>
      <div className="flex flex-wrap gap-3">
        {brouillon ? (
          <>
            <Bouton onClick={onCommencer}>Reprendre{nom ? ` « ${nom} »` : ''} →</Bouton>
            <Bouton variante="discret" onClick={onRecommencer}>
              Tout recommencer
            </Bouton>
          </>
        ) : (
          <Bouton onClick={onCommencer}>Commencer →</Bouton>
        )}
      </div>
    </div>
  );
}

const NOMS_ETAPES: Record<string, string> = Object.fromEntries(ETAPES.map((e) => [e.id, e.titre]));

function EtapeEnvoi({
  d,
  maj,
  erreur,
  erreurs,
  allerA,
  envoi,
  msgEnvoi,
  onEnvoyer,
}: PropsEtape & {
  erreurs: ErreurDossier[];
  allerA: (id: string) => void;
  envoi: string;
  msgEnvoi: string;
  onEnvoyer: () => void;
}) {
  if (envoi === 'envoye' || envoi === 'simule') {
    return (
      <div className="space-y-5 text-[17px]">
        <Encadre ton="ok">
          <p className="font-bold text-[19px]">Merci, c’est envoyé !</p>
          <p className="mt-1">
            {envoi === 'simule' ? '(Essai en local : rien n’est parti.) ' : ''}Nous préparons le site de « {d.association.nom} » et revenons vers vous à{' '}
            <strong>{d.contact.email}</strong> pour vous le montrer.
          </p>
        </Encadre>
        <Bouton variante="secondaire" onClick={() => telecharger(d)}>
          Garder une copie du dossier
        </Bouton>
      </div>
    );
  }

  const reste = erreurs.filter((e) => e.etape !== 'envoi');
  const parEtape = [...new Set(reste.map((e) => e.etape))];
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Texte label="Votre nom" autoComplete="name" value={d.contact.nom} onChange={(v) => maj('contact.nom', v)} erreur={erreur('contact.nom')} />
        <Texte label="Votre rôle" facultatif value={d.contact.role} onChange={(v) => maj('contact.role', v)} placeholder="ex. Secrétaire" />
        <Texte
          label="Votre e-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={d.contact.email}
          onChange={(v) => maj('contact.email', v.trim())}
          erreur={erreur('contact.email')}
        />
        <Texte label="Votre téléphone" facultatif type="tel" inputMode="tel" value={d.contact.telephone} onChange={(v) => maj('contact.telephone', v)} />
      </div>
      <ZoneTexte label="Quelque chose à ajouter ?" facultatif value={d.remarques} onChange={(v) => maj('remarques', v)} />

      {reste.length ? (
        <Encadre ton="attention">
          <p className="font-semibold">Il manque encore quelques réponses :</p>
          <ul className="mt-2 space-y-2">
            {parEtape.map((id) => (
              <li key={id}>
                <button type="button" className="underline underline-offset-4 font-medium" onClick={() => allerA(id)}>
                  {NOMS_ETAPES[id]}
                </button>{' '}
                — {reste.filter((e) => e.etape === id).map((e) => e.message).join(' ')}
              </li>
            ))}
          </ul>
        </Encadre>
      ) : null}

      <p className="text-[14px] text-slate-600 leading-relaxed">
        En envoyant, vous transmettez ces informations à PB Consulting pour créer le site de l’association. Vos coordonnées servent seulement à vous recontacter
        à ce sujet. Les informations de l’association seront publiées sur son site.
      </p>
      {envoi === 'erreur' ? <Encadre ton="attention">{msgEnvoi}</Encadre> : null}
      <div className="flex flex-wrap gap-3">
        <Bouton onClick={onEnvoyer} disabled={erreurs.length > 0 || envoi === 'en-cours'}>
          {envoi === 'en-cours' ? 'Envoi…' : 'Envoyer le dossier'}
        </Bouton>
        <Bouton variante="secondaire" onClick={() => telecharger(d)}>
          Télécharger le dossier
        </Bouton>
      </div>
    </div>
  );
}
