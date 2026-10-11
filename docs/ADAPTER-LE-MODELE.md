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
| `adhesion.paiementUrl` | Vide = pas de paiement en ligne ; seuls les moyens « au bureau » sont proposés. |
| `saison.finCampagneEssai` | Après cette date, le bouton principal passe d’« Essai » à « Adhérer ». |
| `couleurs.primaire` | Contraste ≥ 4,5:1 avec le blanc (texte des boutons). Vérifiez sur webaim.org/resources/contrastchecker. |

Choisissez aussi les **fonctions** (`modules`) : commencez par tout mettre à `false` sauf ce que vous brancherez tout de suite. Le site vitrine marche sans rien.

Puis régénérez logo, favicons, image de partage et verso de carte :

```bash
npm run identite -- --force
```

Vous pouvez ensuite remplacer `public/assets/logo.svg` par votre vrai logo (et relancer la commande sans `--force` pour les PNG manquants).

---

## Étape 3 — Contenus

Tout est dans `src/data/` :

- **`siteData.ts`** : coachs (`COACHS`), membres du bureau (`BUREAU`), cours (`ACTIVITIES`), événements et planning par défaut.
  Le **nom d’un cours** doit être le même partout : `ACTIVITIES`, planning, pages de cours.
- **`activityPages.ts`** : texte long, bienfaits et FAQ de chaque cours (bloc `CONTENT`, clé = nom du cours). Un cours sans bloc a une page minimale.
- **`faqData.ts`** : questions fréquentes.
- **`blogData.ts`** : articles (HTML simple). Trois exemples génériques sont fournis.
- **`bureauMessages.ts`** : modèles de messages du bureau.

Les **photos** vont dans `public/assets/` :

- hero : 1344 × 768, en `.webp` de préférence (chemin dans `asso.config.js → heroImage`) ;
- cours : 900 × 675 ; si vous fournissez `act-pilates.webp`, ajoutez aussi `act-pilates-600.webp` pour le mobile ;
- coachs : 400 × 500 (et `-320.webp` pour le mobile).

Le **planning** et les **événements** affichés par défaut : `public/data/planning.csv` et `public/data/evenements.csv`. Une fois Google branché, le bureau les modifie depuis `/bureau`.

Enfin, relisez **les mentions légales et la page confidentialité** (`src/sections/LegalSection.tsx`) : elles décrivent l’hébergement Netlify, Google Sheets, WhatsApp et ntfy. Retirez ce que vous n’utilisez pas.

---

## Étape 4 — Mise en ligne sur Netlify (site public)

1. Sur Netlify : **Add new site → Import an existing project** → votre dépôt GitHub.
2. Les réglages sont lus dans `netlify.toml` (build `npm run build`, dossier `dist`, fonctions `netlify/functions`).
3. Branchez votre nom de domaine, puis mettez la même adresse dans `asso.config.js → siteUrl`.

À ce stade le site public est en ligne. Les formulaires `/essai` et `/inscription` répondent « échec » tant que Google n’est pas branché : le visiteur se voit proposer WhatsApp.

---

## Étape 5 — Google Sheets (essais, adhésions, planning)

Le bureau s’appuie sur trois classeurs Google, dans le Drive du compte de l’asso :

| Classeur | Onglet | Colonnes (dans cet ordre, ne pas renommer) |
|---|---|---|
| Essais | `Essais` | `DATE_DEMANDE NOM PRENOM TEL CRENEAU COURS STATUT N_ESSAI SOURCE NOTES` |
| Adhérents | ex. `Saison 2026-2027` | `NOM PRENOM TEL MAIL DATE_NAISSANCE ADRESSE CP VILLE MODE STATUT MONTANT DETAIL DATE_PAIEMENT DROIT_IMAGE QS_SPORT SOURCE NOTES DATE_DEMANDE` puis `NUMERO CARTE` |
| Contenu site | `PLANNING`, `EVENEMENTS` | créé automatiquement par `npm run sheets:site` |

1. **Google Cloud Console** → nouveau projet → activer **Google Sheets API**.
2. **Comptes de service** → créer → onglet Clés → **JSON**. Ce fichier est un secret : ne le mettez jamais dans le dépôt.
3. Partagez chaque classeur avec l’adresse du compte de service (`…@….iam.gserviceaccount.com`) en **Éditeur**.
4. Dans Netlify → **Environment variables**, ajoutez (voir [`.env.example`](../.env.example)) :
   - `GOOGLE_SERVICE_ACCOUNT_JSON` : tout le contenu du fichier JSON ;
   - `GOOGLE_SHEET_ID` / `GOOGLE_SHEET_NAME` : classeur et onglet Adhérents (l’ID est dans l’URL du Sheet, entre `/d/` et `/edit` ; onglet par défaut `Saison <saison.label>`) ;
   - `GOOGLE_SHEET_ESSAIS_ID` : classeur Essais ;
   - `BUREAU_PASSWORD`, `BUREAU_SECRET` (longue chaîne aléatoire).
5. En local, avec un `.env` rempli :
   ```bash
   npm run sheets:site
   ```
   Le script crée les onglets `PLANNING` et `EVENEMENTS` (dans un classeur dédié, ou dans le classeur Essais si le compte de service ne peut pas créer de fichier), les remplit avec `public/data/*.csv`, puis renseigne `GOOGLE_SITE_SHEET_ID` sur Netlify — ou affiche la valeur à saisir à la main. Pour les menus déroulants et couleurs :
   ```bash
   npm run sheets:format
   ```
6. Redéployez. Testez `/essai`, puis `/bureau`.

---

## Étape 6 — Gmail, Agenda, Contacts (facultatif)

Pour que le bureau lise la boîte mail et l’agenda de l’asso sans ouvrir Gmail, et que les inscriptions envoient une alerte par mail : suivez **[DOC-BUREAU-GOOGLE.md](DOC-BUREAU-GOOGLE.md)**.

---

## Chaque saison

- Mettre à jour `asso.config.js → saison` (libellé, reprise, fin de campagne d’essai) et le tarif si besoin.
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
