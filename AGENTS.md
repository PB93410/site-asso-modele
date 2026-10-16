# Agent — site d’association (modèle)

## Où sont les choses
- Identité de l’asso (nom, ville, lieux, contacts, tarif, essais, saison, couleurs) : `asso.config.js` uniquement. Ne jamais réécrire ces valeurs en dur ailleurs.
- Valeurs dérivées partagées site / fonctions / scripts : `asso.derive.js`. Côté React : `src/data/asso.ts`.
- Contenus éditoriaux : `src/data/` (siteData, activityPages, faqData, blogData).
- Routes indexables : `src/lib/seoRoutes.ts` (sitemap et pré-rendu en dépendent).

## Parcours
- Bouton principal = /essai (header, hero, étape 1) tant que `saison.finCampagneEssai` n’est pas passée.
- Le paiement en ligne n’est jamais le premier clic : formulaire d’abord.
- WhatsApp = secours, pas la collecte d’essais.

## Données
- Colonnes des Sheets Essais / Adhérents : ne pas les renommer ni les réordonner (`netlify/functions/_bureau-lib.mjs`).
- Lignes de test (prénom ou nom « test ») exclues des compteurs.
- NUMERO : un numéro attribué est définitif, ne jamais le réécrire ni renuméroter.
- Cartes : le recto est fabriqué à l’envoi depuis la fiche (`_carte-recto.mjs`). Pas de coffre d’images, pas de PNG nominatif sur disque.
- Aucune donnée personnelle dans le dépôt.
- Mode démo (`npm run demo`, `netlify/functions/_demo.mjs`) : tout appel Google passe par `getSheets()`, `gmailApi()` ou `calendarApi()`, jamais `google.*` directement, sinon la démo casse. Les données du bureau passent par `getSheets()` même hors Google : stockage Netlify Blobs (`_stockage.mjs`, même API que Sheets), faux classeur en démo ; toute fonction qui y touche appelle `brancherStockage(event)` en tête. Les fonctions sont en v2 (`export default versV2(handler)`, `_v2.mjs`) : en v1 (export nommé `handler`), Netlify Blobs refuse la lecture forte et le bureau ne voit plus ses données. Un test le vérifie (`tests/fonctionsV2.test.ts`). La boîte du bureau passe par `_boite.mjs` en IMAP (Gmail API sinon, dans `bureau-mail.mjs`). L’agenda passe par `agendaApi()` (`_agenda.mjs` : Netlify, Google ou démo), jamais `calendarApi()` directement. Tout mail envoyé par le site passe par `envoyerMail()` (`_envoi.mjs` : SMTP, Brevo ou Gmail), jamais `gmail.users.messages.send` directement (sauf la réponse depuis la boîte Gmail, module `mail`).
- Fonctions activables (`asso.config.js → modules`) : une nouvelle page ou fonction liée à un module vérifie `MODULES` (client) ou `moduleOff()` (serveur). `presences`, `quiz`, `alertes`, `listeAttente`, `wallet`, `financement`, `rapport`, `attestations`, `parrainage`, `sondageEssai`, `clubEnChiffres` et `checklists` sont éteintes par défaut.
- `npm run verifier` doit rester juste : un nouveau réglage obligatoire y est ajouté (`scripts/_verifier.mjs`).
- Cours, animateurs, FAQ, planning et événements par défaut : `contenu/*.json` (pas dans le code). `src/data/` les met en forme ; textes à trous via `src/lib/gabarit.js`.
- Un champ ajouté à `asso.config.js` l’est aussi dans `scripts/_config-gabarit.mjs` (test d’identité) et, si l’association doit le fournir, dans `src/lib/dossier.js` et le questionnaire (`configurateur/`).
- Les bénévoles ne sont pas techniques : ce qui les concerne se fait dans le navigateur (questionnaire, /bureau), jamais en ligne de commande.

## Textes
- Ton associatif, pas startup. Public senior-friendly : phrases courtes, contrastes forts, cibles 44 px.

## Travail
- Diff minimal. `npm test` et `npx tsc -b` doivent passer.
- Vérifier header + hero + /essai avant de déclarer terminé.
- Deploy prod : `npm run build` (prerender) puis `npm run deploy:prod`. Jamais `build:fast` pour la prod.
- Événements : masqués automatiquement le lendemain de leur date (`isPastEvent`), ne pas les retirer à la main.
