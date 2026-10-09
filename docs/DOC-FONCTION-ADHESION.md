# Netlify Function → Google Sheet Adhérents

**Date :** 17 août 2026  
**MAJ :** 4 sept. 2026 — Sheet seul registre + mail bureau ; plus de CallMeBot / webhook Make

## Objectif

Automatiser l’ajout d’une ligne dans le Google Sheet **Adhérents AAAA-AAAA V1**  
à chaque soumission du formulaire `/inscription`.

Le mail bureau (fiche texte) est envoyé **après** l’écriture Sheet, par la
même fonction. Ce n’est pas un second registre : archiver le mail.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `netlify/functions/adhesion.mjs` | Function : Sheet puis mail bureau |
| `netlify/functions/_adhesion-mail.mjs` | Texte de la fiche + envoi mail |
| `src/pages/InscriptionPage.tsx` | Appelle `/api/adhesion` (plus de second POST navigateur) |
| `netlify.toml` | Redirect `/api/adhesion` → function |

## Variables d’environnement Netlify (obligatoires)

Dans **Site configuration → Environment variables** :

| Key | Valeur |
|-----|--------|
| `GOOGLE_SHEET_ID` | ID du classeur Adhérents (dans l’URL, entre `/d/` et `/edit`) |
| `GOOGLE_SHEET_NAME` | Nom de l’onglet, ex. `Saison 2026-2027` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Contenu **complet** du fichier JSON du compte de service Google |

### Comment coller le JSON

1. Ouvre le fichier `.json` téléchargé depuis Google Cloud
2. Sélectionne **tout** le contenu (Ctrl+A)
3. Colle-le dans la valeur de `GOOGLE_SERVICE_ACCOUNT_JSON`
4. Enregistre

## Compte de service Google

1. Google Cloud Console → activer **Google Sheets API**
2. Créer un **Service Account**
3. Télécharger la clé **JSON**
4. Partager le Google Sheet avec l’email du service account (`…@….iam.gserviceaccount.com`) en **Éditeur**

## Mapping des colonnes

| Colonne Sheet | Valeur |
|---------------|--------|
| NOM | `nom` |
| PRENOM | `prenom` |
| TEL | `telephone` |
| MAIL | `email` |
| DATE_NAISSANCE | `date_naissance` |
| ADRESSE | `adresse` |
| CP | `code_postal` |
| VILLE | `ville` |
| MODE | `mode_paiement` |
| STATUT | fixe `En attente` |
| MONTANT | fixe `140` |
| DETAIL | vide |
| DATE_PAIEMENT | vide |
| DROIT_IMAGE | `droit_image` |
| QS_SPORT | `qs_sport` |
| SOURCE | fixe `Formulaire` |

## Déploiement

```bash
npm install          # installe googleapis
npm run build
# puis déployer dist/ sur Netlify (ou git push)
```

Après déploiement, vérifier dans **Netlify → Functions** que `adhesion` apparaît.

## Test

1. Aller sur https://www.exemple-asso.fr/inscription
2. Remplir et envoyer une inscription test
3. Vérifier :
   - email reçu sur `contact@exemple-asso.fr`
   - nouvelle ligne dans le Sheet avec toutes les colonnes remplies
4. Logs de la function : Netlify → Functions → adhesion → Logs

## Dépannage

| Problème | Cause probable |
|----------|----------------|
| Ligne vide / pas de ligne | Variable d’env manquante ou Sheet non partagé avec le service account |
| Erreur 500 | JSON service account mal collé (pas une seule ligne valide) |
| Function introuvable | Rebuild + deploy nécessaire après ajout du fichier |
| Colonnes décalées | Vérifier l’ordre des en-têtes dans le Sheet (A→P) |

## Process bureau (inchangé)

1. Demande arrive → ligne `STATUT=En attente` `SOURCE=Formulaire`
2. Paiement reçu → passer à `À jour` + date + détail
3. la plateforme de paiement en ligne (1×/semaine rentrée) → ligne `MODE=la plateforme de paiement en ligne` `STATUT=À jour`
