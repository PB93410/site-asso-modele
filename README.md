# Site d’association — modèle

Modèle de site pour une **association à activité récurrente** (cours de gym, danse, yoga, chorale, club sportif…) : des séances chaque semaine, un essai gratuit, une adhésion annuelle.

Issu du site d’une association sportive en production, puis rendu générique.

## Ce que contient le modèle

**Site public**

- Accueil : hero, planning de la semaine (avec « aujourd’hui »), cours, comment ça se passe, coachs, l’association, blog, contact
- Une page par cours (`/cours-<activite>-<ville>`) avec planning et FAQ
- `/essai` : réservation d’un cours d’essai, le créneau s’affiche tout de suite
- `/inscription` : demande d’adhésion en 3 étapes (rien n’est prélevé ; paiement en ligne facultatif ou au bureau)
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

Les données sont rangées sur Netlify, avec le site : aucun compte Google n’est nécessaire. Google Sheets reste possible ([docs/DOC-DONNEES.md](docs/DOC-DONNEES.md)).

Une fonction à `false` disparaît proprement : `/essai` et `/inscription` proposent alors d’appeler, d’écrire ou de venir sur place. On peut publier le jour même et brancher le reste plus tard.

## Installer pour une association (référent)

L’association remplit un **questionnaire en ligne** (`configurateur/`, sans compte ni installation) : nom retrouvé dans le répertoire officiel, salles avec recherche d’adresse, horaires, couleur tirée du logo, aperçu de la carte. Vous recevez un dossier, puis :

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
- [docs/DOC-BUREAU-GOOGLE.md](docs/DOC-BUREAU-GOOGLE.md) — brancher Gmail / Agenda / Contacts
- [docs/DOC-GOOGLE-SHEETS.md](docs/DOC-GOOGLE-SHEETS.md) — planning et événements dans un Google Sheet
- [docs/DOC-FONCTION-ADHESION.md](docs/DOC-FONCTION-ADHESION.md) — formulaire d’inscription → Sheet Adhérents
- [docs/MODE-EMPLOI-BUREAU.md](docs/MODE-EMPLOI-BUREAU.md) — mode d’emploi des bénévoles
- [docs/MODE-EMPLOI-MAIL.md](docs/MODE-EMPLOI-MAIL.md) — tri de la boîte mail
- [docs/CHANGEMENT-SAISON.md](docs/CHANGEMENT-SAISON.md) — passer d’une saison à l’autre

## Données personnelles

Le dépôt ne contient **aucune donnée d’adhérent**. Les inscriptions et essais vont dans vos Google Sheets, jamais dans le code. `.gitignore` bloque les `.csv`/`.xlsx` hors `public/data/`, les clés et les cartes générées. Adaptez la page Confidentialité (`src/sections/LegalSection.tsx`) à vos traitements réels.

## Licence

Code sous licence [MIT](LICENSE) © 2026 PB Consulting : libre d’utiliser, modifier et redistribuer, en gardant la mention de copyright. Fourni tel quel, sans garantie. Les polices de `public/fonts/` restent sous leur licence propre ([OFL](public/fonts/OFL.txt)). Les textes, photos et logos que vous ajoutez pour votre association vous appartiennent.
