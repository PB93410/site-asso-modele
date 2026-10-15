# Les données du bureau (référent)

Essais, adhérents (avec les numéros de carte), horaires et événements modifiés depuis /bureau.

## Par défaut : sur Netlify, rien à créer

Les données sont rangées **avec le site, sur Netlify** (Netlify Blobs). Pas de compte Google, pas de classeur à créer ni à partager, pas de clé à copier : il suffit de `BUREAU_PASSWORD` et `BUREAU_SECRET`.

- **Le bureau est l'interface** : essais, à payer, cartes, fiches, recherche, horaires, événements.
- **Bureau → Autre → Télécharger tout (Excel)** : un fichier .xlsx avec un onglet par tableau (adhérents de la saison, essais, horaires, événements). Les cellules sont en texte : les 0 des téléphones restent, aucune formule n'est calculée.
- **Sauvegarde chaque lundi** (6 h UTC) : le même fichier part à la boîte de l'asso, si l'envoi des mails est réglé ([DOC-MAIL.md](DOC-MAIL.md)). Gardez ces mails. Pour la couper : `SAUVEGARDE_MAIL=non`.
- **Deux bénévoles en même temps** : chaque écriture vérifie que personne n'a écrit entre-temps, sinon elle relit et recommence. Rien ne s'écrase.
- Au premier lancement, les horaires et événements partent de `public/data/*.csv`.
- **Nouvelle saison** : changez `asso.config.js → saison`. Le tableau des adhérents repart vide sous le nouveau nom ; l'ancienne saison reste (export Excel avant le changement si vous voulez la garder à portée de main).

Données personnelles : elles sont chez Netlify, comme le site lui-même (et comme elles l'étaient chez Google). Le fichier Excel et les mails de sauvegarde en contiennent aussi : ils restent dans la boîte du bureau.

## Outils du référent : `npm run donnees`

À lancer depuis le dossier du site, avec dans `.env` (jamais sur Netlify, jamais dans le dépôt) :

- `NETLIFY_SITE_ID` : Netlify → Site configuration → Site details → **Site ID** ;
- `NETLIFY_AUTH_TOKEN` : Netlify → User settings → Applications → **Personal access tokens** → New access token.

| Commande | Ce qu'elle fait |
|---|---|
| `npm run donnees -- exporter` | copie Excel des données en ligne, dans `tmp/` (jamais commité) |
| `npm run donnees -- restaurer sauvegarde.xlsx` | remet une sauvegarde (pièce jointe du lundi, ou export). Accepte un fichier réenregistré par Excel ou LibreOffice. |
| `npm run donnees -- importer-google` | reprend les Google Sheets actuels (passage de Google à Netlify) |

`--essai` montre ce qui serait fait. Des données déjà en ligne ne sont jamais remplacées sans `--force` : faites d'abord `exporter`.

Les onglets sont reconnus par leur nom : « Saison … » (adhérents), « Essais », « Horaires », « Événements ». Les autres sont ignorés.

## Variante : Google Sheets

Pour une association qui veut travailler dans ses tableaux Google (filtres, couleurs, plusieurs personnes dedans chaque jour) : compte de service, puis `npm run sheets:creer` ([ADAPTER-LE-MODELE.md](ADAPTER-LE-MODELE.md), étape 5, « Variante »). Dès que `GOOGLE_SERVICE_ACCOUNT_JSON` est présente, le site utilise Google Sheets. Pour choisir explicitement : `STOCKAGE=google` ou `STOCKAGE=netlify`.

**Protéger les numéros d'adhérent.** Dans un tableau Google, un tri qui n'emporte pas la colonne NUMERO (S) donne les numéros à d'autres personnes, alors que leurs cartes sont déjà parties. Deux garde-fous :

- **Protection des onglets** (une fois, par le référent) : `node scripts/protect-site-tabs.mjs`. PLANNING, EVENEMENTS et l'onglet des adhérents de la saison ne sont plus modifiables (donc plus triables) que par le compte de l'asso et le site. Les bénévoles lisent, travaillent dans `/bureau`, et trient avec **Données → Créer une vue filtrée**. À relancer au changement de saison (nouvel onglet).
- **Contrôle du matin** (`controle-numeros.mjs`, chaque jour à 5 h UTC, automatique) : chaque numéro doit rester sur la fiche de la personne qui l'a reçu. Le site garde pour cela un registre (store Netlify « numeros ») avec seulement une **empreinte** de chaque personne (téléphone et prénom brouillés par `BUREAU_SECRET`, rien de lisible). Le premier soir, il apprend les numéros existants ; ensuite, au moindre décalage, un mail part à la boîte de l'asso (numéros et lignes, aucun nom). Une **fiche corrigée** (téléphone ou prénom changé, l'autre restant identique, et la personne d'origine absente des autres fiches) n'est pas un décalage : le registre suit la correction et un mail à part la signale une seule fois (« Fiche(s) corrigée(s) »), avec le conseil de renvoyer la carte si elle était déjà partie. Le registre garde pour cela une empreinte du téléphone et une du prénom, séparées ; sans elles (registre d'avant cette version), un changement est traité comme un décalage. Changer `BUREAU_SECRET` le fait réapprendre, sans fausse alerte. Rien ne tourne avec le stockage Netlify : personne ne peut trier.

### Passer de Google Sheets à Netlify

1. `.env` : la clé du compte de service et les ID des classeurs (comme aujourd'hui), plus `NETLIFY_SITE_ID` et `NETLIFY_AUTH_TOKEN`.
2. `npm run donnees -- importer-google --essai`, puis sans `--essai`.
3. Netlify → Environment variables : `STOCKAGE=netlify`, puis redéployez. Les tableaux Google restent intacts : gardez-les en lecture seule comme archive.

`npm run verifier` dit où sont les données et ce qui manque.

Code : `netlify/functions/_stockage.mjs` (classeur sur Blobs, même API que Google Sheets), `_tableur.mjs`, `_xlsx.mjs`, `_export.mjs`, `sauvegarde-hebdo.mjs`, `scripts/donnees.mjs`.
