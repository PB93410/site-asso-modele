# Adapter le modèle à votre association

Compter une demi-journée pour le site public, une journée de plus pour brancher l’espace bureau sur Google.
Le site public fonctionne seul : l’espace bureau et les formulaires peuvent attendre (`asso.config.js → modules`).

Deux commandes vous guident tout du long :

- `npm run demo` : le site et le bureau complets, avec des données fictives, sans compte Google (mot de passe du bureau : `demo`). Pour montrer l’outil au bureau de l’association avant de décider quoi brancher.
- `npm run verifier` : la liste de ce qui manque, en français simple, avec la correction. À relancer après chaque étape.

---

## Étape 1 — Créer votre copie

Sur GitHub : **Use this template → Create a new repository** (privé si vous préférez).
Puis, en local :

```bash
git clone https://github.com/<vous>/<votre-site>.git
```

```bash
npm install
```

```bash
npm run demo
```

---

## Étape 2 — `asso.config.js`

Ouvrez [`asso.config.js`](../asso.config.js) à la racine et remplissez chaque champ. Les commentaires disent à quoi sert chacun. Points d’attention :

| Champ | À savoir |
|---|---|
| `nomCourt` | Affiché dans le header. Court : 3 à 12 caractères. |
| `sigle` | Préfixe des numéros d’adhérent (`ASE-2627-001`) et des sujets de mail (`[ASE] Adhésion — …`). Lettres seulement. |
| `lieux[].nom` | Doit être **identique** à la colonne `location` du planning. |
| `whatsapp` | Format international sans `+` (`336…`). Vide = pas de liens WhatsApp. |
| `federation.nom` | Vide si vous n’êtes pas affiliés : badge et mentions disparaissent. |
| `adhesion.essais` | `0` = pas d’essai gratuit : le bouton principal devient « Adhérer ». |
| `adhesion.paiementUrl` | Vide = pas de paiement en ligne ; seuls les moyens « au bureau » sont proposés. Avec HelloAsso branché, l’adhésion est validée toute seule au paiement : [DOC-PAIEMENT.md](DOC-PAIEMENT.md). |
| `adhesion.iban` | Facultatif : IBAN affiché pour payer par virement, avec la référence de la demande. |
| `saison.finCampagneEssai` | Après cette date, le bouton principal passe d’« Essai » à « Adhérer ». |
| `saison.pauses`, `saison.fin` | Vacances sans cours et fin de saison : l’accueil annonce « Pas de cours pendant les vacances de la Toussaint, reprise lundi 2 novembre » au lieu d’un cours qui n’a pas lieu. `du` = premier jour sans cours, `reprise` = jour où les cours reprennent. Les jours fériés sont calculés tout seuls ; `saison.feriesAvecCours` liste ceux où l’on fait cours quand même. |
| `couleurs.primaire` | Contraste ≥ 4,5:1 avec le blanc (texte des boutons). Vérifiez sur webaim.org/resources/contrastchecker. |

Choisissez aussi les **fonctions** (`modules`) : commencez par tout mettre à `false` sauf ce que vous brancherez tout de suite. Le site vitrine marche sans rien.

Puis régénérez logo, favicons, image de partage et verso de carte :

```bash
npm run identite -- --force
```

Vous pouvez ensuite remplacer `public/assets/logo.svg` par votre vrai logo (et relancer la commande sans `--force` pour les PNG manquants).

---

## Étape 3 — Contenus

Le plus simple : faites remplir le **questionnaire en ligne** à l’association, puis `npm run installer` (voir [CONFIGURATEUR.md](CONFIGURATEUR.md)). À la main, tout est dans `contenu/` (JSON) :

- **`cours.json`** : chaque cours (nom, niveau, résumé, animateur, bienfaits, image) et le texte de sa page (accroche, texte, bienfaits détaillés, FAQ du cours).
  Le **nom d’un cours** doit être le même partout : `cours.json`, planning. `npm run verifier` le contrôle.
- **`coachs.json`** : animateurs. Vide = le bloc disparaît du site.
- **`faq.json`** : questions fréquentes. Les textes peuvent contenir `{tarif}`, `{ville}`… (voir CONFIGURATEUR.md).
- **`planning.json`**, **`evenements.json`** : planning et événements par défaut.

Restent dans `src/data/` : les articles (`blogData.ts`, HTML simple), les membres du bureau (`siteData.ts → BUREAU`) et les modèles de messages (`bureauMessages.ts`).

Les **photos** vont dans `public/assets/` :

- hero : 1344 × 768, en `.webp` de préférence (chemin dans `asso.config.js → heroImage`) ;
- cours : 900 × 675 ; si vous fournissez `act-pilates.webp`, ajoutez aussi `act-pilates-600.webp` pour le mobile ;
- coachs : 400 × 500 (et `-320.webp` pour le mobile).

Le **planning** et les **événements** affichés sur la page d’accueil : `public/data/planning.csv` et `public/data/evenements.csv` (même contenu que `contenu/`, écrit par l’installation). Une fois Google branché, le bureau les modifie depuis `/bureau`.

Enfin, relisez **les mentions légales et la page confidentialité** (`src/sections/LegalSection.tsx`) : elles décrivent l’hébergement Netlify, Google Sheets, WhatsApp et ntfy. Retirez ce que vous n’utilisez pas.

---

## Étape 4 — Mise en ligne sur Netlify (site public)

1. Sur Netlify : **Add new site → Import an existing project** → votre dépôt GitHub.
2. Les réglages sont lus dans `netlify.toml` (build `npm run build`, dossier `dist`, fonctions `netlify/functions`).
3. Branchez votre nom de domaine, puis mettez la même adresse dans `asso.config.js → siteUrl`.

À ce stade le site public est en ligne.

---

## Étape 5 — Les données du bureau (essais, adhésions, planning)

**Par défaut, rien à créer** : les données sont rangées sur Netlify, avec le site (Netlify Blobs). Dans Netlify → **Environment variables**, mettez seulement `BUREAU_PASSWORD` et `BUREAU_SECRET` (voir [`.env.example`](../.env.example)), redéployez, puis testez `/essai` et `/bureau`.

Le bureau est l’interface : listes, recherche, fiches. **Bureau → Autre → Télécharger tout (Excel)** donne tout dans un fichier. Chaque lundi, une sauvegarde Excel part à la boîte de l’asso (si l’envoi des mails est réglé, étape 6). Détails, restauration : [DOC-DONNEES.md](DOC-DONNEES.md).

### Variante : Google Sheets

Si l’association tient à ses tableaux Google (plusieurs personnes qui travaillent dedans chaque jour), le bureau s’appuie sur trois classeurs Google, dans le Drive du compte de l’asso :

| Classeur | Onglet | Colonnes (dans cet ordre, ne pas renommer) |
|---|---|---|
| Essais | `Essais` | `DATE_DEMANDE NOM PRENOM TEL CRENEAU COURS STATUT N_ESSAI SOURCE NOTES` |
| Adhérents | ex. `Saison 2026-2027` | `NOM PRENOM TEL MAIL DATE_NAISSANCE ADRESSE CP VILLE MODE STATUT MONTANT DETAIL DATE_PAIEMENT DROIT_IMAGE QS_SPORT SOURCE NOTES DATE_DEMANDE` puis `NUMERO CARTE` |
| Contenu site | `PLANNING`, `EVENEMENTS` | créé automatiquement par `npm run sheets:site` |

Une commande crée les trois classeurs, les partage et les met en forme : `npm run sheets:creer`. Avant, deux réglages Google (une fois par association, 15 minutes), de préférence **connecté avec le compte Google de l’association** :

1. **Google Cloud Console** → nouveau projet → **API et services → Bibliothèque** : activez **Google Sheets API** et **Google Drive API**.
2. **Compte de service** (le site s’en sert pour lire et écrire les classeurs) : **IAM → Comptes de service → Créer**, puis onglet **Clés → Ajouter une clé → JSON**. Collez tout le contenu du fichier, sur une ligne, dans `.env` : `GOOGLE_SERVICE_ACCOUNT_JSON={...}`. Ce fichier est un secret : jamais dans le dépôt.
3. **Client OAuth** (pour que la commande crée les classeurs dans le Drive de l’asso) :
   - **Écran de consentement OAuth** : type *Externe*, mode *Test*, ajoutez le compte Google de l’asso aux **utilisateurs test** ;
   - **Identifiants → Créer → ID client OAuth → Application de bureau** ;
   - dans `.env` : `GOOGLE_SETUP_CLIENT_ID=…` et `GOOGLE_SETUP_CLIENT_SECRET=…`.
4. Puis :
   ```bash
   npm run sheets:creer -- --essai
   ```
   montre ce qui sera créé (selon `asso.config.js → modules`). Pour de bon :
   ```bash
   npm run sheets:creer
   ```
   Une page Google s’ouvre : choisissez le compte de l’asso. L’autorisation demandée est minimale (l’outil ne voit que les fichiers qu’il crée). La commande crée les classeurs avec les bonnes colonnes, remplit horaires et événements, les partage avec le compte de service, écrit leurs IDs dans `.env`, applique couleurs et menus (`sheets:format`) et lance `verifier`.
5. Dans Netlify → **Environment variables** : `GOOGLE_SERVICE_ACCOUNT_JSON`, les IDs affichés à la fin, `BUREAU_PASSWORD` et `BUREAU_SECRET` (voir [`.env.example`](../.env.example)).
6. Redéployez. Testez `/essai`, puis `/bureau`. Partagez les classeurs avec les membres du bureau qui en ont besoin.

**Classeurs déjà existants ?** Partagez-les avec l’adresse du compte de service (`…@….iam.gserviceaccount.com`) en **Éditeur**, mettez leurs IDs dans `.env` (entre `/d/` et `/edit` dans l’adresse), puis `npm run sheets:site` et `npm run sheets:format`.

---

## Étape 6 — Envoi des mails, puis Gmail, Agenda, Contacts (facultatif)

Alertes « nouvel essai » et « nouvelle adhésion », cartes d’adhérent par mail : le site envoie avec la boîte mail de l’asso (SMTP) ou Brevo, sans Google. Voir **[DOC-MAIL.md](DOC-MAIL.md)**.

Paiement de l’adhésion par carte : avec HelloAsso branché (gratuit), l’adhésion passe « À jour » toute seule au paiement, sans pointage. Voir **[DOC-PAIEMENT.md](DOC-PAIEMENT.md)**.


Pour que le bureau lise la boîte mail et l’agenda de l’asso sans ouvrir Gmail : suivez **[DOC-BUREAU-GOOGLE.md](DOC-BUREAU-GOOGLE.md)**.

---

## Chaque saison

- Mettre à jour `asso.config.js → saison` (libellé, reprise, fin de campagne d’essai, vacances, fin des cours) et le tarif si besoin.
- Relancer `npm run identite -- --force` (le verso de carte porte la saison).
- Suivre [CHANGEMENT-SAISON.md](CHANGEMENT-SAISON.md) pour les Sheets.

---

## Vérifier avant de publier

```bash
npm run verifier
```

Zéro « ✖ » avant de publier. Les « ⚠ » sont à lire (valeurs d’exemple restantes, photo d’exemple, mentions légales).

```bash
npx tsc -b
```

```bash
npm test
```

```bash
npm run build
```

Puis regardez le header, le hero et `/essai` sur mobile.
