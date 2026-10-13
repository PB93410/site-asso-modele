import { useRef, useState } from 'react';
import {
  JOURS,
  configDepuisDossier,
  contraste,
  couleurLisible,
  saisonCourante,
  sigleDepuis,
  telAffiche,
  whatsappDepuis,
  type Dossier,
} from '../../src/lib/dossier.js';
import { remplir, valeursTexte } from '../../src/lib/gabarit.js';
import MODELE from '../../asso.config.js';
import FAQ_MODELE from '../../contenu/faq.json';
import { couleursProposees } from '../../src/lib/prereglages.js';
import { chercherAdresse, chercherAssociation, type AdresseTrouvee, type AssociationTrouvee } from './api';
import { ApercuAccueil, ApercuCarte } from './Apercu';
import { ImportExistant } from './ImportExistant';
import { couleurDuLogo, preparerLogo, preparerPhoto, preparerPortrait } from './images';
import { Bouton, Case, Champ, Choix, Encadre, Texte, ZoneTexte } from './ui';

export type PropsEtape = {
  d: Dossier;
  maj: (chemin: string, valeur: unknown) => void;
  erreur: (champ: string) => string | undefined;
  onDossier?: (next: Dossier) => void;
};

// ---------------------------------------------------------------------------

export function EtapeAssociation({ d, maj, erreur }: PropsEtape) {
  const a = d.association;
  const [q, setQ] = useState('');
  const [etat, setEtat] = useState<'' | 'cherche' | 'vide' | 'panne' | 'choisi'>('');
  const [trouves, setTrouves] = useState<AssociationTrouvee[]>([]);

  async function chercher() {
    setEtat('cherche');
    setTrouves([]);
    try {
      const r = await chercherAssociation(q);
      setTrouves(r);
      setEtat(r.length ? '' : 'vide');
    } catch {
      setEtat('panne');
    }
  }

  async function choisir(t: AssociationTrouvee) {
    maj('association', {
      ...a,
      nom: t.nom,
      siret: t.siret,
      rna: t.rna,
      anneeCreation: t.anneeCreation,
      siege: t.siege,
      ville: t.ville,
      codePostal: t.codePostal,
      sigle: a.sigle || sigleDepuis(t.nom),
    });
    setTrouves([]);
    setEtat('choisi');
    try {
      const [commune] = await chercherAdresse(`${t.codePostal} ${t.ville}`, true);
      if (commune) {
        maj('association.departement', commune.departement);
        maj('association.region', commune.region);
      }
    } catch {
      // département et région restent à saisir
    }
  }

  return (
    <div className="space-y-6">
      <Encadre>
        <p className="font-semibold">Gagnez du temps : retrouvez votre association.</p>
        <p className="mt-1">Tapez son nom et sa ville, ou son numéro RNA (W…) ou SIRET. Les informations officielles se remplissent seules.</p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-[17px]"
            value={q}
            placeholder="ex. Gym volontaire Vaujours"
            aria-label="Nom, ville, RNA ou SIRET de l’association"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void chercher()}
          />
          <Bouton onClick={() => void chercher()} disabled={q.trim().length < 3 || etat === 'cherche'}>
            {etat === 'cherche' ? 'Recherche…' : 'Chercher'}
          </Bouton>
        </div>
        {etat === 'vide' ? <p className="mt-2">Aucune association trouvée. Essayez autrement, ou remplissez à la main ci-dessous.</p> : null}
        {etat === 'choisi' ? (
          <p className="mt-2 font-medium">C’est rempli. Vérifiez le nom ci-dessous : le nom officiel est souvent abrégé (« Ass Gymn… »).</p>
        ) : null}
        {etat === 'panne' ? <p className="mt-2">La recherche ne répond pas pour le moment. Remplissez à la main ci-dessous.</p> : null}
        {trouves.length ? (
          <ul className="mt-3 space-y-2">
            {trouves.map((t) => (
              <li key={`${t.siret}${t.rna}${t.nom}`}>
                <button
                  type="button"
                  onClick={() => void choisir(t)}
                  className="w-full text-left rounded-xl border border-slate-300 bg-white p-3 hover:border-slate-800"
                >
                  <span className="block font-semibold">{t.nom}</span>
                  <span className="block text-[14px] text-slate-600">
                    {t.codePostal} {t.ville}
                    {t.anneeCreation ? ` · créée en ${t.anneeCreation}` : ''}
                    {t.rna ? ` · ${t.rna}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Encadre>

      <Texte label="Nom de l’association" value={a.nom} onChange={(v) => maj('association.nom', v)} erreur={erreur('association.nom')} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Texte
          label="Nom court"
          value={a.nomCourt}
          onChange={(v) => maj('association.nomCourt', v)}
          aide="Affiché en haut du site et sur la carte. Court : 3 à 12 lettres."
          placeholder={a.sigle || 'ex. GV Tilleuls'}
        />
        <Texte
          label="Sigle"
          value={a.sigle}
          onChange={(v) => maj('association.sigle', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          erreur={erreur('association.sigle')}
          aide={a.nom && !a.sigle ? `Suggestion : ${sigleDepuis(a.nom)}` : 'Sert aux numéros de carte (ex. GVT-2627-001).'}
        />
      </div>
      <Texte
        label="Vos activités, en quelques mots"
        value={a.accroche}
        onChange={(v) => maj('association.accroche', v)}
        erreur={erreur('association.accroche')}
        placeholder="ex. Gym douce, Pilates, Marche nordique"
        aide="Séparées par des virgules. C’est ce que les gens tapent dans Google."
      />
      <Texte
        label="Une phrase d’accueil"
        facultatif
        value={a.slogan}
        onChange={(v) => maj('association.slogan', v)}
        placeholder="ex. Bouger à son rythme, ensemble"
      />
      <div className="grid sm:grid-cols-3 gap-4">
        <Texte label="Ville" value={a.ville} onChange={(v) => maj('association.ville', v)} erreur={erreur('association.ville')} />
        <Texte
          label="Code postal"
          value={a.codePostal}
          inputMode="numeric"
          onChange={(v) => maj('association.codePostal', v.replace(/\D/g, '').slice(0, 5))}
          erreur={erreur('association.codePostal')}
        />
        <Texte
          label="Créée en"
          facultatif
          value={a.anneeCreation}
          inputMode="numeric"
          onChange={(v) => maj('association.anneeCreation', v.replace(/\D/g, '').slice(0, 4))}
          erreur={erreur('association.anneeCreation')}
        />
      </div>
      <Texte
        label="Communes voisines d’où viennent vos adhérents"
        facultatif
        value={a.communesVoisines.join(', ')}
        onChange={(v) => maj('association.communesVoisines', v.split(',').map((x) => x.trimStart()))}
        aide="Séparées par des virgules. Aide à être trouvé dans Google depuis ces communes."
      />

      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-[16px]">Mentions légales (siège, responsable, numéros)</summary>
        <div className="mt-4 space-y-4">
          <Texte label="Adresse du siège social" value={a.siege} onChange={(v) => maj('association.siege', v)} />
          <Texte
            label="Responsable de la publication"
            value={a.responsablePublication}
            onChange={(v) => maj('association.responsablePublication', v)}
            placeholder="ex. La présidente de l’association"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Texte label="Numéro RNA" facultatif value={a.rna} onChange={(v) => maj('association.rna', v.toUpperCase())} placeholder="W…" />
            <Texte label="SIRET" facultatif value={a.siret} inputMode="numeric" onChange={(v) => maj('association.siret', v.replace(/\D/g, ''))} />
          </div>
          <Texte label="Assureur (responsabilité civile)" facultatif value={a.assureur} onChange={(v) => maj('association.assureur', v)} />
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RechercheAdresse({ onChoix }: { onChoix: (a: AdresseTrouvee) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<AdresseTrouvee[]>([]);
  const [panne, setPanne] = useState(false);
  const attente = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function taper(v: string) {
    setQ(v);
    clearTimeout(attente.current);
    attente.current = setTimeout(async () => {
      try {
        setRes(await chercherAdresse(v));
        setPanne(false);
      } catch {
        setPanne(true);
      }
    }, 350);
  }

  return (
    <div className="space-y-2">
      <input
        className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-[17px]"
        value={q}
        placeholder="Tapez l’adresse, ex. 3 allée des Tilleuls Villeneuve"
        aria-label="Rechercher l’adresse"
        onChange={(e) => taper(e.target.value)}
      />
      {panne ? <p className="text-[14px] text-slate-600">Recherche indisponible : saisissez l’adresse dans les champs ci-dessous.</p> : null}
      {res.length && q ? (
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {res.map((r) => (
            <li key={r.label}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-[16px]"
                onClick={() => {
                  onChoix(r);
                  setRes([]);
                  setQ('');
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function EtapeLieux({ d, maj, erreur }: PropsEtape) {
  const lieux = d.lieux;
  const ajouter = () => maj('lieux', [...lieux, { nom: '', rue: '', codePostal: d.association.codePostal, ville: d.association.ville, acces: '' }]);
  return (
    <div className="space-y-6">
      <p className="text-[17px] text-slate-700">Les salles, gymnases ou lieux de rendez-vous où se passent vos cours.</p>
      {erreur('lieux') ? <p className="text-red-700 font-medium">{erreur('lieux')}</p> : null}
      {lieux.map((l, i) => (
        <fieldset key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <legend className="px-2 font-semibold text-[16px]">Salle {i + 1}</legend>
          <Texte
            label="Nom de la salle"
            value={l.nom}
            onChange={(v) => maj(`lieux.${i}.nom`, v)}
            placeholder="ex. Gymnase Jean Moulin"
            erreur={erreur(`lieux[${i}]`)}
          />
          <Champ label="Adresse" aide={l.rue ? `${l.rue}, ${l.codePostal || ''} ${l.ville || ''}${l.lat ? ' · position GPS enregistrée' : ''}` : undefined}>
            <RechercheAdresse
              onChoix={(r) => maj(`lieux.${i}`, { ...l, rue: r.rue, codePostal: r.codePostal, ville: r.ville, lat: r.lat, lon: r.lon })}
            />
          </Champ>
          <details>
            <summary className="cursor-pointer text-[15px] text-slate-700">Saisir l’adresse à la main</summary>
            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              <Texte label="Rue" value={l.rue} onChange={(v) => maj(`lieux.${i}.rue`, v)} />
              <Texte label="Code postal" value={l.codePostal || ''} onChange={(v) => maj(`lieux.${i}.codePostal`, v.replace(/\D/g, '').slice(0, 5))} />
              <Texte label="Ville" value={l.ville || ''} onChange={(v) => maj(`lieux.${i}.ville`, v)} />
            </div>
          </details>
          <Texte
            label="Comment y accéder"
            facultatif
            value={l.acces || ''}
            onChange={(v) => maj(`lieux.${i}.acces`, v)}
            placeholder="ex. Parking derrière la mairie, entrée côté parc"
          />
          <Bouton variante="danger" onClick={() => maj('lieux', lieux.filter((_, j) => j !== i))}>
            Retirer cette salle
          </Bouton>
        </fieldset>
      ))}
      <Bouton variante="secondaire" onClick={ajouter}>
        + Ajouter une salle
      </Bouton>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function EtapeContacts({ d, maj, erreur }: PropsEtape) {
  const c = d.contacts;
  const mobile = Boolean(whatsappDepuis(c.telephone));
  return (
    <div className="space-y-5">
      <p className="text-[17px] text-slate-700">Ce que verront les visiteurs pour vous contacter.</p>
      <Texte
        label="E-mail de l’association"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={c.email}
        onChange={(v) => maj('contacts.email', v.trim())}
        erreur={erreur('contacts.email')}
        aide="Une adresse partagée par le bureau, plutôt qu’une adresse personnelle."
      />
      <Texte
        label="Téléphone"
        type="tel"
        inputMode="tel"
        value={c.telephone}
        onChange={(v) => maj('contacts.telephone', v)}
        erreur={erreur('contacts.telephone')}
        aide="Le numéro que le bureau accepte de voir affiché sur internet."
      />
      {c.telephone && telAffiche(c.telephone) !== c.telephone ? (
        <Bouton variante="discret" onClick={() => maj('contacts.telephone', telAffiche(c.telephone))}>
          Écrire {telAffiche(c.telephone)}
        </Bouton>
      ) : null}
      {mobile ? (
        <Case
          label="Ce numéro répond sur WhatsApp"
          aide="Un bouton « Écrire sur WhatsApp » apparaîtra sur le site."
          checked={c.whatsapp}
          onChange={(v) => maj('contacts.whatsapp', v)}
        />
      ) : null}
      <Texte
        label="Adresse du site, si vous en avez déjà une"
        facultatif
        value={c.siteSouhaite}
        onChange={(v) => maj('contacts.siteSouhaite', v.trim())}
        placeholder="ex. www.gym-tilleuls.fr"
        aide="Sinon, laissez vide : nous en parlerons ensemble."
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <Texte label="Page Facebook" facultatif value={c.facebook} onChange={(v) => maj('contacts.facebook', v.trim())} placeholder="https://www.facebook.com/…" />
        <Texte label="Compte Instagram" facultatif value={c.instagram} onChange={(v) => maj('contacts.instagram', v.trim())} placeholder="https://www.instagram.com/…" />
      </div>
      <Texte
        label="Lien « Laisser un avis Google »"
        facultatif
        value={c.avisGoogle}
        onChange={(v) => maj('contacts.avisGoogle', v.trim())}
        aide="Si l’association a une fiche Google. Sinon, laissez vide."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

const PAIEMENTS = ['chèque', 'espèces', 'chèques ANCV', 'Coupons sport', 'virement', 'Pass’Sport'];

export function EtapeAdhesion({ d, maj, erreur }: PropsEtape) {
  const ad = d.adhesion;
  const [enLigne, setEnLigne] = useState(Boolean(ad.paiementUrl));
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Texte
          label="Cotisation annuelle (€)"
          inputMode="decimal"
          value={ad.tarif || ''}
          onChange={(v) => maj('adhesion.tarif', Number(v.replace(',', '.').replace(/[^\d.]/g, '')) || 0)}
          erreur={erreur('adhesion.tarif')}
        />
        <Choix
          label="Séances d’essai gratuites"
          value={String(ad.essais)}
          onChange={(v) => maj('adhesion.essais', Number(v))}
          options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 0 ? 'Aucune' : `${n} séance${n > 1 ? 's' : ''}` }))}
        />
      </div>
      <Texte
        label="Ce que comprend la cotisation"
        facultatif
        value={ad.inclus}
        onChange={(v) => maj('adhesion.inclus', v)}
        placeholder="ex. licence et assurance comprises"
      />

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <legend className="px-2 font-semibold text-[16px]">Fédération</legend>
        <Texte
          label="Nom de la fédération"
          facultatif
          value={d.federation.nom}
          onChange={(v) => maj('federation.nom', v)}
          aide="Laissez vide si l’association n’est affiliée à aucune fédération."
        />
        {d.federation.nom ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Texte label="Sigle" value={d.federation.sigle} onChange={(v) => maj('federation.sigle', v.toUpperCase())} />
            <Texte label="Site de la fédération" facultatif value={d.federation.url} onChange={(v) => maj('federation.url', v.trim())} />
          </div>
        ) : null}
      </fieldset>

      <Case
        label="Paiement en ligne possible"
        aide="Avec HelloAsso (gratuit), le site peut valider l’adhésion tout seul dès le paiement. Avec une autre plateforme, le site met un lien et le bureau pointe chaque paiement à la main."
        checked={enLigne}
        onChange={(v) => {
          setEnLigne(v);
          if (!v) maj('adhesion', { ...ad, paiementNom: '', paiementUrl: '' });
        }}
      />
      {enLigne ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Texte label="Plateforme" value={ad.paiementNom} onChange={(v) => maj('adhesion.paiementNom', v)} list="plateformes" placeholder="ex. HelloAsso" />
          <Texte
            label="Lien de votre page de paiement"
            value={ad.paiementUrl}
            onChange={(v) => maj('adhesion.paiementUrl', v.trim())}
            erreur={erreur('adhesion.paiementUrl')}
            placeholder="https://www.helloasso.com/associations/…"
          />
          <datalist id="plateformes">
            <option value="HelloAsso" />
            <option value="Yapla" />
            <option value="AssoConnect" />
          </datalist>
        </div>
      ) : null}

      <Texte
        label="IBAN pour le virement"
        facultatif
        value={ad.iban || ''}
        onChange={(v) => maj('adhesion.iban', v.toUpperCase())}
        erreur={erreur('adhesion.iban')}
        placeholder="FR76 …"
      />

      <Champ label="Autres moyens de paiement acceptés par le bureau">
        <div className="flex flex-wrap gap-2">
          {PAIEMENTS.map((p) => {
            const on = ad.autresPaiements.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => maj('adhesion.autresPaiements', on ? ad.autresPaiements.filter((x) => x !== p) : [...ad.autresPaiements, p])}
                className={`min-h-[44px] rounded-full px-4 text-[15px] font-medium border ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}
              >
                {on ? '✓ ' : ''}
                {p}
              </button>
            );
          })}
        </div>
      </Champ>
    </div>
  );
}

// ---------------------------------------------------------------------------

const NIVEAUX = ['Tous niveaux', 'Débutants', 'Reprise en douceur', 'Intermédiaire', 'Confirmés'];

export function EtapeCours({ d, maj, erreur, onDossier }: PropsEtape) {
  const saison = saisonCourante();
  const [an] = saison.split('-').map(Number);
  const saisons = [saison, `${an + 1}-${an + 2}`];
  const nomsCours = d.cours.map((c) => c.nom).filter((n) => n.trim());
  const nomsSalles = d.lieux.map((l) => l.nom).filter((n) => n.trim());
  const ajouterCreneau = () =>
    maj('planning', [...d.planning, { jour: 'Lundi', debut: '', fin: '', cours: nomsCours[0] || '', lieu: nomsSalles[0] || '', note: '' }]);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Choix label="Saison" value={d.saison.label} onChange={(v) => maj('saison.label', v)} options={saisons.map((s) => ({ value: s, label: s }))} />
        <Texte
          label="Reprise des cours"
          type="date"
          value={d.saison.reprise}
          onChange={(v) => maj('saison.reprise', v)}
          erreur={erreur('saison.reprise')}
        />
      </div>

      <section className="space-y-3">
        <h3 className="text-[18px] font-bold">Vos cours</h3>
        {erreur('cours') ? <p className="text-red-700 font-medium">{erreur('cours')}</p> : null}
        {d.cours.map((c, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <Texte label={`Cours ${i + 1}`} value={c.nom} onChange={(v) => maj(`cours.${i}.nom`, v)} placeholder="ex. Gym douce" />
            <ZoneTexte
              label="En une ou deux phrases"
              facultatif
              rows={2}
              value={c.description}
              onChange={(v) => maj(`cours.${i}.description`, v)}
              aide="Pour qui, ce qu’on y fait. C’est le texte de la page du cours : nous le relirons avec vous."
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <Choix
                label="Niveau"
                value={c.niveau || 'Tous niveaux'}
                onChange={(v) => maj(`cours.${i}.niveau`, v)}
                options={NIVEAUX.map((n) => ({ value: n, label: n }))}
              />
              <Texte
                label="Ce que ça apporte"
                facultatif
                value={(c.bienfaits || []).join(', ')}
                onChange={(v) => maj(`cours.${i}.bienfaits`, v.split(',').map((x) => x.trimStart()).slice(0, 3))}
                placeholder="ex. Équilibre, Souplesse, Bonne humeur"
                aide="2 ou 3 mots, séparés par des virgules."
              />
            </div>
            <Bouton variante="danger" onClick={() => maj('cours', d.cours.filter((_, j) => j !== i))}>
              Retirer ce cours
            </Bouton>
          </div>
        ))}
        <Bouton variante="secondaire" onClick={() => maj('cours', [...d.cours, { nom: '', description: '' }])}>
          + Ajouter un cours
        </Bouton>
      </section>

      {onDossier ? (
        <ImportExistant d={d} onDossier={onDossier} variante="planning" />
      ) : null}

      <section className="space-y-3">
        <h3 className="text-[18px] font-bold">Les horaires de la semaine</h3>
        {!nomsCours.length ? (
          <p className="text-slate-600">Ajoutez d’abord vos cours ci-dessus.</p>
        ) : (
          <>
            {d.planning.map((p, i) => {
              const msg = erreur(`planning[${i}]`);
              return (
                <div key={i} className={`rounded-2xl border bg-white p-4 ${msg ? 'border-red-300' : 'border-slate-200'}`}>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <Choix label="Jour" value={p.jour} onChange={(v) => maj(`planning.${i}.jour`, v)} options={JOURS.map((j) => ({ value: j, label: j }))} />
                    <Texte label="Début" type="time" value={p.debut} onChange={(v) => maj(`planning.${i}.debut`, v)} />
                    <Texte label="Fin" type="time" value={p.fin} onChange={(v) => maj(`planning.${i}.fin`, v)} />
                    <Choix
                      label="Cours"
                      value={p.cours}
                      onChange={(v) => maj(`planning.${i}.cours`, v)}
                      options={[{ value: '', label: '—' }, ...nomsCours.map((n) => ({ value: n, label: n }))]}
                    />
                    <Choix
                      label="Salle"
                      value={p.lieu}
                      onChange={(v) => maj(`planning.${i}.lieu`, v)}
                      options={[{ value: '', label: '—' }, ...nomsSalles.map((n) => ({ value: n, label: n }))]}
                    />
                  </div>
                  {msg ? <p className="mt-2 text-red-700 text-[14px] font-medium">{msg}</p> : null}
                  <Bouton variante="danger" className="mt-1" onClick={() => maj('planning', d.planning.filter((_, j) => j !== i))}>
                    Retirer ce créneau
                  </Bouton>
                </div>
              );
            })}
            <Bouton variante="secondaire" onClick={ajouterCreneau}>
              + Ajouter un créneau
            </Bouton>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

const TEINTES = [...new Set(['#C45309', '#B91C1C', '#BE185D', '#7C3AED', '#1D4ED8', '#0E7490', '#047857', '#4D7C0F', ...couleursProposees()])];

export function EtapeApparence({ d, maj, erreur }: PropsEtape) {
  const ap = d.apparence;
  const [msg, setMsg] = useState('');
  const lisible = couleurLisible(ap.couleur);
  const corrigee = lisible && lisible !== ap.couleur.toUpperCase();

  async function logo(file?: File) {
    if (!file) return;
    setMsg('');
    try {
      const url = await preparerLogo(file);
      maj('apparence.logo', url);
      const c = await couleurDuLogo(url).catch(() => null);
      if (c) {
        maj('apparence.couleur', c);
        setMsg(`Couleur reprise de votre logo : ${c}. Vous pouvez la changer ci-dessous.`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Logo illisible.');
    }
  }

  async function photo(file?: File) {
    if (!file) return;
    setMsg('');
    try {
      maj('apparence.hero', await preparerPhoto(file));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Photo illisible.');
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,22rem)] gap-8">
      <div className="space-y-6">
        <Champ label="Votre logo" facultatif aide="PNG, JPEG ou SVG. Sans logo, nous créons un monogramme avec vos initiales." erreur={erreur('apparence.logo')}>
          <div className="flex flex-wrap items-center gap-3">
            {ap.logo ? <img src={ap.logo} alt="Logo choisi" className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-white" /> : null}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => void logo(e.target.files?.[0])} className="text-[15px] max-w-full" />
            {ap.logo ? (
              <Bouton variante="danger" onClick={() => maj('apparence.logo', '')}>
                Retirer
              </Bouton>
            ) : null}
          </div>
        </Champ>

        <Champ label="Couleur principale" aide="Celle des boutons. Une couleur trop claire est assombrie pour rester lisible.">
          <div className="flex flex-wrap items-center gap-2">
            {TEINTES.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`Couleur ${t}`}
                aria-pressed={ap.couleur.toUpperCase() === t}
                onClick={() => maj('apparence.couleur', t)}
                className={`w-11 h-11 rounded-full border-4 ${ap.couleur.toUpperCase() === t ? 'border-slate-900' : 'border-white'} shadow`}
                style={{ background: t }}
              />
            ))}
            <label className="inline-flex items-center gap-2 text-[15px] ml-1">
              Autre :
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(ap.couleur) ? ap.couleur : '#334155'} onChange={(e) => maj('apparence.couleur', e.target.value.toUpperCase())} className="w-11 h-11 rounded" />
            </label>
          </div>
        </Champ>
        {corrigee ? (
          <Encadre ton="attention">
            Votre couleur <strong>{ap.couleur}</strong> est trop claire pour du texte blanc (contraste {contraste(ap.couleur)?.toFixed(1)}:1). Le site utilisera{' '}
            <span className="inline-block w-4 h-4 align-middle rounded" style={{ background: lisible }} /> <strong>{lisible}</strong>, la même teinte en plus foncé.
          </Encadre>
        ) : null}
        {msg ? <Encadre>{msg}</Encadre> : null}

        <Champ label="Une photo de vos cours" facultatif aide="Une vraie photo de séance rassure beaucoup. Elle est recadrée automatiquement. Vérifiez que les personnes visibles sont d’accord.">
          <div className="flex flex-wrap items-center gap-3">
            {ap.hero ? <img src={ap.hero} alt="Photo choisie" className="w-28 h-16 object-cover rounded-lg border border-slate-200" /> : null}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void photo(e.target.files?.[0])} className="text-[15px] max-w-full" />
            {ap.hero ? (
              <Bouton variante="danger" onClick={() => maj('apparence.hero', '')}>
                Retirer
              </Bouton>
            ) : null}
          </div>
        </Champ>
        {ap.hero ? (
          <Texte label="Que voit-on sur la photo ?" value={ap.heroAlt} onChange={(v) => maj('apparence.heroAlt', v)} placeholder="ex. Cours de gym douce au gymnase" aide="Lu par les personnes malvoyantes." />
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 self-start">
        <p className="text-[15px] font-semibold text-slate-700">Aperçu</p>
        <ApercuAccueil d={d} />
        <ApercuCarte d={d} />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function EtapeFonctions({ d, maj }: PropsEtape) {
  const m = d.modules;
  return (
    <div className="space-y-4">
      <p className="text-[17px] text-slate-700">
        Le site présente toujours vos cours, horaires, tarifs et contacts. Choisissez ce qu’il fera <strong>en plus</strong>. Tout peut être ajouté plus tard.
      </p>
      <Case
        label="Réserver un essai gratuit en ligne"
        aide="Les visiteurs choisissent un créneau ; la demande arrive dans un tableau Google partagé par le bureau. Sinon : ils appellent ou écrivent."
        checked={m.essais}
        onChange={(v) => maj('modules.essais', v)}
      />
      <Case
        label="S’inscrire en ligne"
        aide="Formulaire d’adhésion complet ; les fiches arrivent dans un tableau Google. Sinon : inscription sur place."
        checked={m.adhesion}
        onChange={(v) => maj('modules', { ...m, adhesion: v, financement: v ? m.financement : false })}
      />
      <Case
        label="Espace bénévoles"
        aide="Une page protégée par mot de passe : essais à confirmer, encaissements, cartes d’adhérent, horaires du site."
        checked={m.bureau}
        onChange={(v) =>
          maj('modules', {
            ...m,
            bureau: v,
            mail: v ? m.mail : false,
            presences: v ? m.presences : false,
            alertes: v ? m.alertes : false,
            listeAttente: v ? m.listeAttente : false,
            wallet: v ? m.wallet : false,
            rapport: v ? m.rapport : false,
            attestations: v ? m.attestations : false,
          })
        }
      />
      {m.bureau ? (
        <Case
          label="Mail et agenda de l’association dans l’espace bénévoles"
          aide="Lire et répondre aux mails de l’asso, partager un agenda. Demande un compte Gmail pour l’association."
          checked={m.mail}
          onChange={(v) => maj('modules.mail', v)}
        />
      ) : null}
      <Case
        label="Quiz « Quel cours pour moi ? »"
        aide="Une page publique avec 6 questions (niveau, âge, objectif, disponibilités). Le site propose les cours qui conviennent, puis un essai ou l’inscription."
        checked={m.quiz}
        onChange={(v) => maj('modules.quiz', v)}
      />
      {m.bureau ? (
        <Case
          label="Pointage aux séances par QR"
          aide="Un code par cours et par jour. L’adhérent scanne et pointe. Le bureau voit les présences et les personnes absentes depuis plusieurs semaines."
          checked={m.presences}
          onChange={(v) => maj('modules.presences', v)}
        />
      ) : null}
      {m.bureau ? (
        <Case
          label="Alertes de dernière minute"
          aide="Annuler ou déplacer un cours : un bandeau s’affiche sur le site, un mail part aux personnes inscrites. Notification sur le téléphone si la personne l’a acceptée."
          checked={m.alertes}
          onChange={(v) => maj('modules.alertes', v)}
        />
      ) : null}
      {m.bureau ? (
        <Case
          label="Liste d’attente"
          aide="Quand un créneau d’essai ou un cours est complet, la personne est mise en file. Une place libérée lui est proposée (mail + WhatsApp), avec un délai pour accepter."
          checked={m.listeAttente}
          onChange={(v) => maj('modules.listeAttente', v)}
        />
      ) : null}
      {m.bureau && m.listeAttente ? (
        <div className="grid sm:grid-cols-2 gap-4 pl-1">
          <Texte
            label="Places par créneau / cours"
            inputMode="numeric"
            value={d.listeAttente.capaciteDefaut}
            onChange={(v) => maj('listeAttente.capaciteDefaut', Number(v.replace(/\D/g, '')) || 0)}
            aide="Quand ce nombre est atteint, les suivantes vont en liste d’attente."
          />
          <Texte
            label="Délai pour accepter une place (heures)"
            inputMode="numeric"
            value={d.listeAttente.delaiReponseHeures}
            onChange={(v) => maj('listeAttente.delaiReponseHeures', Number(v.replace(/\D/g, '')) || 0)}
          />
        </div>
      ) : null}
      {m.bureau ? (
        <Case
          label="Carte dans Apple Wallet et Google Wallet"
          aide="L’adhérent ajoute sa carte au téléphone. En démo : aperçu, sans certificat. En prod : clés dans les variables d’environnement (voir le README)."
          checked={m.wallet}
          onChange={(v) => maj('modules.wallet', v)}
        />
      ) : null}
      {m.adhesion ? (
        <Case
          label="Aides à la cotisation (Pass'Sport, ANCV, CE)"
          aide="Sur le formulaire d’adhésion : cases et montants, reste à payer. Les aides sont notées sur la fiche pour le bureau."
          checked={m.financement}
          onChange={(v) => maj('modules.financement', v)}
        />
      ) : null}
      {m.adhesion && m.financement ? (
        <div className="grid sm:grid-cols-3 gap-4 pl-1">
          <Texte
            label="Pass'Sport (€)"
            inputMode="numeric"
            value={d.financement.passSport}
            onChange={(v) => maj('financement.passSport', Number(v.replace(/\D/g, '')) || 0)}
            aide="0 = non proposé."
          />
          <Texte
            label="Plafond chèques ANCV (€)"
            inputMode="numeric"
            value={d.financement.ancvMax}
            onChange={(v) => maj('financement.ancvMax', Number(v.replace(/\D/g, '')) || 0)}
          />
          <Texte
            label="Aide comité d’entreprise (€)"
            inputMode="numeric"
            value={d.financement.comiteEntreprise}
            onChange={(v) => maj('financement.comiteEntreprise', Number(v.replace(/\D/g, '')) || 0)}
          />
        </div>
      ) : null}
      {m.bureau ? (
        <Case
          label="Rapport annuel (AG, subvention)"
          aide="Effectifs, essais devenus adhésions, présences si le module est allumé, âges et communes. PDF et CSV depuis le bureau."
          checked={m.rapport}
          onChange={(v) => maj('modules.rapport', v)}
        />
      ) : null}
      <Case
        label="Attestations PDF"
        aide="L’adhérent télécharge son attestation d’adhésion, un reçu fiscal (si l’asso est éligible) et une attestation pour le comité d’entreprise. Numéro + e-mail, ou un lien reçu par mail. Le bureau peut aussi les fabriquer."
        checked={m.attestations}
        onChange={(v) => maj('modules.attestations', v)}
      />
      {m.attestations ? (
        <div className="space-y-4 pl-1">
          <Case
            label="L’association peut délivrer un reçu fiscal"
            aide="Uniquement si vous êtes éligible (intérêt général, articles 200 et 238 bis du CGI). Sinon, ne cochez pas : le reçu n’apparaît pas."
            checked={d.attestations.recuFiscal}
            onChange={(v) => maj('attestations.recuFiscal', v)}
          />
          {d.attestations.recuFiscal ? (
            <Texte
              label="Objet social (reçu fiscal)"
              facultatif
              value={d.attestations.objet}
              onChange={(v) => maj('attestations.objet', v)}
              placeholder="ex. pratique sportive amateur, gym douce"
            />
          ) : null}
        </div>
      ) : null}
      <Encadre>Pas sûr ? Cochez seulement « essai gratuit » : c’est ce qui fait venir de nouveaux adhérents.</Encadre>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function EtapeAnimateurs({ d, maj, erreur }: PropsEtape) {
  const [msg, setMsg] = useState('');
  const nomsCours = d.cours.map((c) => c.nom).filter((n) => n.trim());
  async function photo(i: number, file?: File) {
    if (!file) return;
    setMsg('');
    try {
      maj(`coachs.${i}.photo`, await preparerPortrait(file));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Photo illisible.');
    }
  }
  return (
    <div className="space-y-6">
      <p className="text-[17px] text-slate-700">
        Les personnes qui animent les cours. Un prénom et quelques mots suffisent : les visiteurs aiment savoir qui les accueillera.
        Facultatif : sans animateur, le bloc n’apparaît pas.
      </p>
      {msg ? <Encadre ton="attention">{msg}</Encadre> : null}
      {d.coachs.map((c, i) => {
        const e = erreur(`coachs[${i}]`);
        return (
          <fieldset key={i} className={`rounded-2xl border bg-white p-4 space-y-4 ${e ? 'border-red-300' : 'border-slate-200'}`}>
            <legend className="px-2 font-semibold text-[16px]">Animateur {i + 1}</legend>
            <Texte label="Prénom" value={c.prenom} onChange={(v) => maj(`coachs.${i}.prenom`, v)} />
            {nomsCours.length ? (
              <Champ label="Cours qu’il ou elle anime">
                <div className="flex flex-wrap gap-2">
                  {nomsCours.map((n) => {
                    const on = (c.cours || []).includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        onClick={() => maj(`coachs.${i}.cours`, on ? c.cours.filter((x) => x !== n) : [...(c.cours || []), n])}
                        className={`min-h-[44px] rounded-full px-4 text-[15px] font-medium border ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'}`}
                      >
                        {on ? '✓ ' : ''}
                        {n}
                      </button>
                    );
                  })}
                </div>
              </Champ>
            ) : null}
            <ZoneTexte
              label="Quelques mots de présentation"
              facultatif
              rows={3}
              value={c.bio}
              onChange={(v) => maj(`coachs.${i}.bio`, v)}
              aide="Comment se passe son cours, ce qui rassure. Ex. « Elle adapte chaque exercice : personne ne force. »"
            />
            <Champ label="Photo" facultatif>
              <div className="flex flex-wrap items-center gap-3">
                {c.photo ? <img src={c.photo} alt="" className="w-16 h-20 object-cover rounded-lg border border-slate-200" /> : null}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(ev) => void photo(i, ev.target.files?.[0])}
                  className="text-[15px] max-w-full"
                />
                {c.photo ? (
                  <Bouton variante="danger" onClick={() => maj(`coachs.${i}`, { ...c, photo: '', accord: false })}>
                    Retirer
                  </Bouton>
                ) : null}
              </div>
            </Champ>
            {c.photo ? (
              <Case
                label={`${c.prenom || 'Cette personne'} est d’accord pour que sa photo soit sur le site`}
                aide="Obligatoire pour publier une photo. Sans accord, nous mettrons une illustration."
                checked={Boolean(c.accord)}
                onChange={(v) => maj(`coachs.${i}.accord`, v)}
              />
            ) : null}
            {e ? <p className="text-red-700 text-[14px] font-medium">{e}</p> : null}
            <Bouton variante="danger" onClick={() => maj('coachs', d.coachs.filter((_, j) => j !== i))}>
              Retirer cet animateur
            </Bouton>
          </fieldset>
        );
      })}
      <Bouton variante="secondaire" onClick={() => maj('coachs', [...d.coachs, { prenom: '', cours: [], bio: '', photo: '', accord: false }])}>
        + Ajouter un animateur
      </Bouton>
    </div>
  );
}

// ---------------------------------------------------------------------------

type QuestionModele = { question: string; reponse: string; populaire?: boolean };

export function EtapeFaq({ d, maj, erreur }: PropsEtape) {
  // Questions habituelles du modèle, remplies avec les réponses déjà données (tarif, ville…).
  function partirDesHabituelles() {
    const v = valeursTexte(configDepuisDossier(d, MODELE), d.cours.length);
    maj(
      'faq',
      (FAQ_MODELE as QuestionModele[]).map((f) => ({
        question: remplir(f.question, v),
        reponse: remplir(f.reponse, v),
        ...(f.populaire ? { populaire: true } : {}),
      })),
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-[17px] text-slate-700">Les questions que l’on vous pose le plus souvent. De bonnes réponses ici évitent beaucoup d’appels.</p>
      {!d.faq.length ? (
        <Encadre>
          <p>
            Partez de nos questions habituelles (certificat médical, inscription en cours d’année, cotisation…), déjà remplies avec vos réponses : il ne
            reste qu’à relire.
          </p>
          <Bouton className="mt-3" onClick={partirDesHabituelles}>
            Partir des questions habituelles
          </Bouton>
          <p className="mt-3 text-[14px]">Si vous laissez vide, nous les reprendrons telles quelles.</p>
        </Encadre>
      ) : null}
      {d.faq.map((f, i) => {
        const e = erreur(`faq[${i}]`);
        return (
          <div key={i} className={`rounded-2xl border bg-white p-4 space-y-3 ${e ? 'border-red-300' : 'border-slate-200'}`}>
            <Texte label={`Question ${i + 1}`} value={f.question} onChange={(v) => maj(`faq.${i}.question`, v)} />
            <ZoneTexte label="Réponse" rows={3} value={f.reponse} onChange={(v) => maj(`faq.${i}.reponse`, v)} />
            {e ? <p className="text-red-700 text-[14px] font-medium">{e}</p> : null}
            <Bouton variante="danger" onClick={() => maj('faq', d.faq.filter((_, j) => j !== i))}>
              Retirer cette question
            </Bouton>
          </div>
        );
      })}
      <Bouton variante="secondaire" onClick={() => maj('faq', [...d.faq, { question: '', reponse: '' }])}>
        + Ajouter une question
      </Bouton>
    </div>
  );
}
