# Site d’association — modèle

Modèle de site pour une **association à activité récurrente** (cours de gym, danse, yoga, chorale, club sportif…) : des séances chaque semaine, un essai gratuit, une adhésion annuelle.

Issu du site d’une association sportive en production, puis rendu générique.

## Ce que contient le modèle

**Site public**

- Accueil : hero, planning de la semaine (avec « aujourd’hui »), cours, comment ça se passe, coachs, l’association, blog, contact
- Une page par cours (`/cours-<activite>-<ville>`) avec planning et FAQ
- `/essai` : réservation d’un cours d’essai, le créneau s’affiche tout de suite
- `/inscription` : demande d’adhésion en 3 étapes, puis paiement en ligne (HelloAsso : adhésion validée toute seule) ou au bureau
- `/tarifs`, `/faq`, `/blog`, `/autour-de-<ville>`, mentions légales, confidentialité
- SEO : métas par page, JSON-LD (organisation, lieux, cours, FAQ, articles), sitemap, HTML pré-rendu pour les robots
- Thème clair / sombre, accessible (contrastes renforcés, cibles 44 px), sans police ni traceur tiers

**Espace `/bureau`** (bénévoles, protégé par mot de passe)

- Essais à confirmer, rappels WhatsApp la veille, relances après le cours
- Adhésions en attente, « J’ai reçu l’argent », numéros d’adhérent
- Cartes d’adhérent fabriquées à l’envoi à partir de la fiche (mail ou WhatsApp), journal des envois
- Édition du planning et des événements sans toucher au code
- Agenda du bureau, à suivre sur son téléphone (abonnement .ics)
- Boîte mail de l’asso lue dans le bureau, IMAP ou Gmail (facultatif), modèles de messages

**Technique** : React 19, Vite, Tailwind CSS, TypeScript · Netlify (hébergement + fonctions) · Google Sheets comme registre (essais, adhérents, planning).

## Démarrer

```bash
npm install
```

```bash
npm run demo
```

Tout le site **et l’espace bureau** tournent sur http://localhost:5173, sans aucun compte Google, avec des données fictives : essais, adhérents, mails, agenda, cartes. Mot de passe du bureau : `demo`. Rien n’est envoyé ni enregistré.

Ensuite, pour savoir ce qu’il reste à régler :

```bash
npm run verifier
```

Il dit en français simple ce qui manque (configuration, variables, envoi des mails, et si on les utilise : accès aux Google Sheets, colonnes, compte Gmail) et comment le corriger.

### Monter le site par étapes

Dans `asso.config.js → modules`, chaque fonction s’active séparément :

| Fonction | Ce qu’elle fait | Ce qu’elle demande |
|---|---|---|
| *(toujours)* | Site vitrine : cours, planning, tarifs, contact | Rien |
| `essais` | Formulaire d’essai gratuit → tableau Essais du bureau | Rien (données sur Netlify) ; pour l’alerte par mail : SMTP ou Brevo |
| `adhesion` | Inscription en ligne → tableau Adhérents du bureau | Rien (données sur Netlify) ; pour l’alerte par mail : SMTP ou Brevo |
| `bureau` | Espace `/bureau` des bénévoles, agenda (abonnement téléphone), export Excel, sauvegarde chaque lundi par mail | Mot de passe + secret |
| `mail` | Boîte mail de l’asso lue dans le bureau | IMAP de la boîte (mêmes identifiants que l’envoi), ou compte Gmail connecté |
| `presences` | Pointage par QR (un code par séance et par jour), stats au bureau, relance des absents | Bureau + secret déjà en place. **Désactivé par défaut.** |
| `quiz` | Page « Quel cours pour moi ? » (6 questions, recommandation, lien essai ou adhésion) | Rien. **Désactivé par défaut.** |
| `alertes` | Annulation / changement : bandeau sur le site, mail aux inscrits, notification sur le téléphone | Bureau. Envoi de mail (SMTP, Brevo ou Gmail). Notification : `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` (facultatif). **Désactivé par défaut.** |
| `listeAttente` | Capacité par cours / créneau ; file d’attente ; place proposée (mail + WhatsApp) avec un délai | Bureau + secret. Mail si le module `mail` / SMTP est branché. **Désactivé par défaut.** |
| `wallet` | Carte adhérent dans Apple Wallet (.pkpass) et Google Wallet | Bureau. En prod : certificats (voir ci-dessous). En démo : aperçu non signé, boutons visibles. **Désactivé par défaut.** |
| `financement` | Aides Pass'Sport, chèques ANCV, comité d’entreprise sur le formulaire d’adhésion ; reste à payer noté sur la fiche | Module `adhesion`. Montants dans `asso.config.js → financement`. **Désactivé par défaut.** |
| `rapport` | Rapport annuel (AG, subvention) : effectifs, conversion essais, présences si activées, âges, communes ; PDF et CSV | Bureau. **Désactivé par défaut.** |
| `espace` | Espace adhérent sans mot de passe (`/espace`) : code par e-mail, carte, reste à payer, attestations, présences, export des données, changement signalé au bureau | Envoi des mails, `BUREAU_SECRET`. **Activé dans l’exemple.** |
| `attestations` | PDF d’adhésion, reçu fiscal (si éligible), attestation CE ; accès n° + e-mail ou lien mail ; aussi depuis le bureau | Bureau pour la vue bénévoles. Reçu fiscal : `attestations.recuFiscal`. **Désactivé par défaut.** |

Les données sont rangées sur Netlify, avec le site : aucun compte Google n’est nécessaire. Google Sheets reste possible ([docs/DOC-DONNEES.md](docs/DOC-DONNEES.md)).

Une fonction à `false` disparaît proprement : `/essai` et `/inscription` proposent alors d’appeler, d’écrire ou de venir sur place. On peut publier le jour même et brancher le reste plus tard.

## Installer pour une association (référent)

L’association remplit un **questionnaire en ligne** (`configurateur/`, sans compte ni installation) : type d’association (préréglages), import Excel/CSV du planning, nom retrouvé dans le répertoire officiel, salles avec recherche d’adresse, horaires, couleur tirée du logo, aperçu de la carte. Vous recevez un dossier, puis :

```bash
npm run installer -- dossier-sigle.json
```

Tout est expliqué dans **[docs/CONFIGURATEUR.md](docs/CONFIGURATEUR.md)**.

## Adapter à votre association

Tout ce qui est propre à l’association est dans **un seul fichier : [`asso.config.js`](asso.config.js)** — nom, ville, salles, contacts, fédération, tarif, nombre d’essais, paiement en ligne, saison, couleurs.

1. Remplissez `asso.config.js`.
2. Générez logo, favicons et image de partage à vos couleurs :
   ```bash
   npm run identite -- --force
   ```
3. Remplacez les contenus de `contenu/` (JSON) : cours et textes de leurs pages (`cours.json`), animateurs (`coachs.json`), FAQ (`faq.json`), planning et événements par défaut. Les articles restent dans `src/data/blogData.ts`.
4. Mettez vos photos dans `public/assets/` (hero, cours, coachs) et le planning dans `public/data/planning.csv`.

Le guide pas à pas, avec la mise en ligne et le branchement de Google : **[docs/ADAPTER-LE-MODELE.md](docs/ADAPTER-LE-MODELE.md)**.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run demo` | Site et bureau en local avec des données fictives, sans Google |
| `npm run verifier` | Ce qui manque pour publier, et comment le corriger |
| `npm run verifier:donnees` | Aucun vrai numéro ni vrai e-mail dans le code (aussi à chaque envoi sur GitHub) |
| `npm run installer -- dossier.json` | Installe le dossier envoyé par une association |
| `npm run sheets:creer` | Crée, partage et met en forme les Google Sheets du site |
| `npm run configurateur` | Questionnaire en ligne, en local |
| `npm run dev` | Site en local (formulaires et bureau : avec `netlify dev`) |
| `npm run build` | Build complet (pré-rendu Puppeteer + validation JSON-LD) — **le seul pour la prod** |
| `npm run build:fast` | Build sans pré-rendu — essais locaux et previews uniquement |
| `npm test` | Tests (Vitest) |
| `npm run identite` | Logo, favicons, image de partage depuis la config |
| `npm run deploy:prod` | Mise en ligne Netlify du dossier `dist` déjà construit |

**Mise en ligne manuelle** : `npm run build` puis `npm run deploy:prod`. Jamais `build:fast` pour la prod : sans pré-rendu, les robots (Google, aperçus de liens) reçoivent une page presque vide.
Si le site est relié à GitHub, Netlify lance lui-même `npm run build` à chaque push (voir `netlify.toml`).

## Documentation

- [docs/CONFIGURATEUR.md](docs/CONFIGURATEUR.md) — questionnaire en ligne et `npm run installer`
- [docs/ADAPTER-LE-MODELE.md](docs/ADAPTER-LE-MODELE.md) — reprendre le modèle pour son asso
- [docs/DOC-DONNEES.md](docs/DOC-DONNEES.md) — où sont les données, export Excel, sauvegarde, restauration, Google Sheets
- [docs/DOC-AGENDA.md](docs/DOC-AGENDA.md) — agenda du bureau, abonnement sur les téléphones
- [docs/DOC-MAIL.md](docs/DOC-MAIL.md) — envoi des mails (alertes, cartes) : boîte de l’asso en SMTP, Brevo ou Gmail
- [docs/DOC-PAIEMENT.md](docs/DOC-PAIEMENT.md) — paiement de l’adhésion en ligne : HelloAsso validé tout seul, référence de virement
- [docs/DOC-BUREAU-GOOGLE.md](docs/DOC-BUREAU-GOOGLE.md) — brancher Gmail / Agenda / Contacts
- [docs/DOC-GOOGLE-SHEETS.md](docs/DOC-GOOGLE-SHEETS.md) — planning et événements dans un Google Sheet
- [docs/DOC-FONCTION-ADHESION.md](docs/DOC-FONCTION-ADHESION.md) — formulaire d’inscription → Sheet Adhérents
- [docs/MODE-EMPLOI-BUREAU.md](docs/MODE-EMPLOI-BUREAU.md) — mode d’emploi des bénévoles
- [docs/MODE-EMPLOI-MAIL.md](docs/MODE-EMPLOI-MAIL.md) — tri de la boîte mail
- [docs/CHANGEMENT-SAISON.md](docs/CHANGEMENT-SAISON.md) — passer d’une saison à l’autre

## Données personnelles

Le dépôt ne contient **aucune donnée d’adhérent**. Les inscriptions et essais vont dans le stockage du bureau (Netlify ou Google Sheets), jamais dans le code. `.gitignore` bloque les `.csv`/`.xlsx` hors `public/data/`, les clés et les cartes générées. Adaptez la page Confidentialité (`src/sections/LegalSection.tsx`) à vos traitements réels.

### Fonctions facultatives (RGPD)

Elles sont **éteintes** tant que vous ne les cochez pas (`asso.config.js` → `modules`, ou le questionnaire). En démo (`npm run demo`), tout reste fictif : aucun mail ni notification ne part vraiment.

**Présences (`modules.presences`)**  
L’adhérent scanne le QR du jour et indique son **numéro ou son e-mail**. On enregistre : date, cours, horaire, numéro, prénom, nom, e-mail, heure. Pas de téléphone, pas d’adresse, pas de géolocalisation. Un seul pointage par personne, par séance et par jour. Conservation : **jusqu’à la fin de la saison**, puis suppression (export Excel avant si besoin). Base : organisation des cours (intérêt légitime / adhésion). Les fiches « test » sont ignorées.

**Quiz (`modules.quiz`)**  
Les réponses ne quittent pas le navigateur. Rien n’est stocké.

**Alertes (`modules.alertes`)**  
Inscription sur `/alertes` : **e-mail + case à cocher**. Lien de retrait dans chaque mail et sur `/alertes/desabo`. Notification sur le téléphone seulement si la personne l’accepte (et si des clés VAPID sont posées). Conservation : **jusqu’au retrait**, ou **2 ans** sans envoi. Base : consentement. Le quiz et le bandeau public n’affichent aucun nom.

**Liste d’attente (`modules.listeAttente`)**  
Si le créneau ou le cours est complet : prénom, nom, téléphone, e-mail, cours, rang. Une place libre : mail (si l’envoi est branché) + lien WhatsApp comme les relances, et un **lien personnel limité dans le temps** (`/liste-attente/place`). Conservation : jusqu’à acceptation, expiration, ou fin de saison. Les lignes « test » ne comptent pas dans la capacité.

**Wallet (`modules.wallet`)**  
Le bureau fabrique une carte à partir de la fiche (nom, numéro, prochain cours ; alerte de dernière minute si `alertes` est allumé). En démo : fichier `.pkpass` **non signé** et boutons visibles. En prod, variables d’environnement (ne jamais les commiter) :

- Apple : `APPLE_PASS_TYPE_ID`, `APPLE_PASS_TEAM_ID`, `APPLE_PASS_CERT` (PEM du certificat Pass Type ID), `APPLE_PASS_KEY` (clé privée PEM), éventuellement `APPLE_PASS_WWDR` (certificat intermédiaire Apple).
- Google : `GOOGLE_WALLET_SA_JSON` (compte de service Wallet), `GOOGLE_WALLET_ISSUER_ID`.

Sans ces clés, les boutons restent visibles et l’aperçu n’est pas signé.

**Aides (`modules.financement`)**  
Sur `/inscription` : cases Pass'Sport / ANCV / comité d’entreprise, montants plafonnés dans `asso.config.js → financement`. Le **reste à payer** est écrit dans `MONTANT` et les aides dans `NOTES` / `DETAIL` de la fiche. Aucun paiement n’est prélevé ici.

**Rapport (`modules.rapport`)**  
Totaux sans noms (adhérents à jour, conversion essai → adhésion, pointages si `presences`, tranches d’âge, communes). PDF et CSV depuis `/bureau/rapport`. Les lignes « test » sont exclues.

**Attestations (`modules.attestations`)**  
L’adhérent à jour saisit son **numéro + e-mail** sur `/attestations`, ou reçoit un **lien personnel** (7 jours) par mail. Documents : attestation d’adhésion, attestation comité d’entreprise (montant et saison), **reçu fiscal** seulement si `attestations.recuFiscal` est à `true` (éligibilité intérêt général — à cocher dans le questionnaire). Le PDF est fabriqué à la demande, **aucune copie n’est gardée**. Le bureau peut aussi les télécharger ou envoyer le lien. Mentions type Cerfa 11580 sur le reçu (organisme, objet, bénéficiaire, montant, articles 200 / 238 bis).

**Espace adhérent (`modules.espace`)**  
Sans mot de passe : sur `/espace`, l’adhérent tape l’e-mail de sa fiche et reçoit un **code à 6 chiffres** (15 minutes, 5 essais) et un lien qui porte ce code. L’appareil reste ensuite connecté **90 jours** (cookie signé avec `BUREAU_SECRET`, HttpOnly, limité à `/api/espace`). Il y retrouve sa fiche, sa **carte** (et Wallet si `wallet`), le **reste à payer** (bouton HelloAsso si branché, IBAN et référence sinon), ses **attestations** (si `attestations`), ses **présences** (si `presences`), **télécharge ses données** et **signale un changement** (mail au bureau : la fiche n’est jamais modifiée par l’adhérent). Une famille qui partage un e-mail voit toutes ses fiches. **Mes cours** : l’adhérent coche ses cours (gardés dans Netlify Blobs, pas dans la fiche ; par défaut ceux de l’inscription) et voit ses prochaines séances, vacances et jours fériés compris ; **« Ajouter à mon agenda »** abonne le téléphone à ses cours (lien `.ics` signé, sans e-mail dedans, mis à jour tout seul). **Photos** : il change sa réponse au droit à l’image ; la colonne DROIT_IMAGE de sa fiche est mise à jour et le bureau reçoit un mail. Sans e-mail sur la fiche ou sans envoi de mails : bouton **« Lien d’accès à son espace »** dans Bureau → Cartes (72 h, une fois), à envoyer par SMS ou WhatsApp. Demande l’envoi des mails (docs/DOC-MAIL.md). Changer `BUREAU_SECRET` déconnecte tout le monde.

**Réinscription en un clic** (avec `espace`) : du 1er juin au 30 septembre, l’adhérent à jour garde sa place pour la saison suivante depuis son espace (fiche reprise, cours, mode de paiement prévu, photos, questionnaire santé). Il paie à la rentrée. Les lignes vont dans l’onglet `Saison AAAA-AAAA` suivant (créé tout seul, statut « En attente », source « Réinscription ») ; liste dans **Bureau → Autre → Réinscriptions**. Voir [docs/CHANGEMENT-SAISON.md](docs/CHANGEMENT-SAISON.md).

Mode d’emploi bénévoles : [docs/MODE-EMPLOI-BUREAU.md](docs/MODE-EMPLOI-BUREAU.md).

## Licence

Code sous licence [MIT](LICENSE) © 2026 PB Consulting : libre d’utiliser, modifier et redistribuer, en gardant la mention de copyright. Fourni tel quel, sans garantie. Les polices de `public/fonts/` restent sous leur licence propre ([OFL](public/fonts/OFL.txt)). Les textes, photos et logos que vous ajoutez pour votre association vous appartiennent.
