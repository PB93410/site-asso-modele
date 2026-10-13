# Changement de saison

Lancer quand personne n'utilise le bureau. Supprimer la sauvegarde tmp/archives/ après un mois (elle contient des données personnelles).

Pour le référent, quand la saison AAAA-AAAA se termine. Rien ici ne s’exécute tout seul.

## 1. Nouvel onglet Adhérents

Avec l’espace adhérent (`modules.espace`), l’onglet **Saison AAAA+1-AAAA+1** existe peut-être déjà : la première réinscription de juin le crée, avec les bonnes colonnes, et y range les réinscrits (voir 5). Vérifiez seulement les en-têtes.

Sinon, dans le tableur Adhérents, créez l’onglet **Saison AAAA+1-AAAA+1**.

Recopiez les en-têtes, dans le même ordre, de A à T :

`NOM` `PRENOM` `TEL` `MAIL` `DATE_NAISSANCE` `ADRESSE` `CP` `VILLE` `MODE` `STATUT` `MONTANT` `DETAIL` `DATE_PAIEMENT` `DROIT_IMAGE` `QS_SPORT` `SOURCE` `NOTES` `DATE_DEMANDE` `NUMERO` `CARTE`

Ne renommez pas ces colonnes. Ne supprimez pas l’onglet de la saison qui s’achève.

L’onglet Essais reste **Essais**.

## 2. Netlify

Dans les variables d’environnement du site :

- `GOOGLE_SHEET_NAME` = `Saison AAAA+1-AAAA+1`
- `ADHERENT_PREFIX` = `ASE-2728-`

Le bureau lira le nouvel onglet. Les numéros de carte partiront de `ASE-2728-001`.

## 3. Le site

Dans `src/data/CONFIG.ts`, mettez à jour `SEASON_LABEL` et `SEASON_PREFIX`. `SAISON` suit `SEASON_LABEL`.

Chaque saison a son verso de carte. Copiez le nouveau `VERSO-commun.png` vers `public/assets/carte-verso-….png` (la saison dans le nom : `/assets` est en cache un an) et mettez à jour `CARTE_VERSO_URL`. `netlify.toml` embarque déjà tous les `carte-verso-*.png`.

Puis déployez le site, quand vous le décidez.

## 4. Archivage des lignes

Le script lit les feuilles. Sans `--apply`, il ne modifie rien : il affiche un nombre de lignes et un échantillon (prénom et initiale du nom, pas le téléphone).

```bash
node scripts/archive-saison.mjs --avant 2026-09-01
```

Ajoutez `--forum` pour compter aussi toutes les lignes de l’onglet « Forum » (nom modifiable par la variable `GOOGLE_FORUM_TAB`).

Quand le compte-rendu vous convient :

```bash
node scripts/archive-saison.mjs --avant 2026-09-01 --apply
```

Le script écrit d’abord une copie CSV dans `tmp/archives/` (dossier ignoré par git). Il relit ensuite l’onglet : si le téléphone, le prénom ou la date d’une ligne a changé, il ne supprime rien dans cet onglet. Sinon il retire les lignes en partant du bas. La ligne d’en-tête reste.

Il retire :

- les essais dont la date (créneau daté, sinon date de demande) est avant `--avant`, sauf si la personne est déjà adhérente **À jour** (même téléphone et même prénom) ;
- les demandes **En attente** de plus de 12 mois ;
- l’onglet Forum, seulement avec `--forum`.

Il lui faut les variables déjà utilisées par le bureau (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_ESSAIS_ID`). Ne collez pas la clé dans le chat.

## 5. Réinscription

Une personne qui revient a une **nouvelle ligne** dans le nouvel onglet, et un **nouveau numéro**. L’ancien numéro n’est pas réutilisé.

Avec l’espace adhérent, du **1er juin au 30 septembre**, l’adhérent à jour se réinscrit lui-même depuis `/espace` (le bouton du hero y mène en juin) : sa fiche est reprise, il corrige ses coordonnées, choisit ses cours, dit comment il paiera et répond aux questions de la saison (photos, questionnaire santé). La ligne part dans l’onglet de la saison suivante, statut **En attente**, source **Réinscription**, avec une référence de paiement et l’ancien numéro dans les notes. Rien n’est encaissé en juin. La liste est dans **Bureau → Autre → Réinscriptions**.

Après le changement de saison (étapes 1 à 3), ces lignes sont dans l’onglet courant : le bureau confirme les paiements à la rentrée dans **À payer**, comme pour une première inscription, et le numéro de la nouvelle saison est donné à ce moment-là. Pensez à changer de saison avant le 30 septembre : passé cette date, la réinscription se referme. Pour l'ouvrir plus tôt (le soir de l'assemblée générale, par exemple) ou la fermer, variable Netlify `REINSCRIPTION` = `ouverte` ou `fermee` ; retirez-la ensuite. Les adhérents déjà à jour ne sont pas effacés par ce script : leur conservation est la saison plus 3 ans, comme le registre.

## 6. Rectos de carte

Rien à fabriquer. Le recto est dessiné au moment de l’envoi (onglet **Cartes** du bureau), à partir de la fiche : nom, prénom, numéro et saison. Pour corriger une carte, corrigez la fiche dans le Sheet puis renvoyez-la.

Journal des envois (date, numéro, canal, destinataire masqué) : `node scripts/journal-cartes.mjs`.
