# Envoi des mails (référent)

Le site envoie quatre sortes de mails :

- l'**alerte « nouvel essai »** à la boîte de l'asso (`[ESSAI] Marie Dupont · Gym douce …`) ;
- l'**alerte « nouvelle adhésion »** à la boîte de l'asso (`[ASE] Adhésion — Marie Dupont`) ;
- la **carte d'adhérent**, à l'adhérent, depuis /bureau ;
- la **sauvegarde du lundi** (fichier Excel des données), à la boîte de l'asso, quand les données sont sur Netlify ([DOC-DONNEES.md](DOC-DONNEES.md)).

Pas besoin de Google : le site envoie avec **la boîte mail que l'asso a déjà** (SMTP), ou avec **Brevo**. L'envoi par Gmail (compte Google connecté) reste possible.

L'adresse de l'asso (l'expéditeur, et la boîte qui reçoit les alertes) est `asso.config.js → email`. Pour en utiliser une autre : variable `MAIL_ASSO`.

Sans réglage, le site marche quand même : les essais et les adhésions s'enregistrent, mais aucune alerte ne part, et le bouton « carte par mail » répond que l'envoi n'est pas configuré. `npm run verifier` le signale.

---

## Solution 1 — La boîte mail de l'asso (SMTP), recommandée

Gratuit, sans nouveau compte. Variables Netlify (et `.env` pour essayer en local) :

| Variable | Valeur |
|---|---|
| `SMTP_HOST` | serveur d'envoi du fournisseur (tableau ci-dessous) |
| `SMTP_PORT` | `465` (par défaut) ou `587` |
| `SMTP_USER` | l'adresse complète de la boîte (par défaut : l'adresse de l'asso) |
| `SMTP_PASS` | le mot de passe de la boîte, ou un « mot de passe d'application » |

| Fournisseur | `SMTP_HOST` | `SMTP_PORT` | Remarque |
|---|---|---|---|
| OVH (MX Plan) | `ssl0.ovh.net` | 465 | |
| Gandi | `mail.gandi.net` | 465 | |
| Infomaniak | `mail.infomaniak.com` | 465 | |
| Orange | `smtp.orange.fr` | 465 | |
| Free | `smtp.free.fr` | 465 | activer l'envoi SMTP dans l'espace abonné si refusé |
| Gmail | `smtp.gmail.com` | 465 | validation en deux étapes, puis **mot de passe d'application** (Compte Google → Sécurité) |

Vérifiez les réglages exacts dans l'aide de votre fournisseur : ils changent parfois. Les fournisseurs limitent le nombre d'envois par jour (souvent quelques centaines) : largement assez pour une asso, qui envoie les cartes une par une.

Conseil : une boîte dédiée au site (`site@votre-asso.fr`) évite de confier le mot de passe de la boîte principale.

## Solution 2 — Brevo

Service d'envoi français (données en Europe), offre gratuite d'environ 300 mails par jour.

1. Créez un compte gratuit sur brevo.com, au nom de l'asso.
2. **Expéditeurs** : ajoutez l'adresse de l'asso et validez-la (code reçu par mail). Mieux : **authentifiez le domaine** (enregistrements DNS donnés par Brevo) pour que les mails n'arrivent pas en indésirables.
3. **SMTP & API → Clés API** : créez une clé.
4. Netlify : `BREVO_API_KEY` = la clé.

Une adresse `@gmail.com`, `@orange.fr`… ne peut pas servir d'expéditeur chez Brevo (les mails seraient refusés comme usurpés) : il faut une adresse sur le domaine de l'asso. Sinon, prenez la solution 1.

## Solution 3 — Gmail par le compte Google connecté

Ce que fait déjà le module `mail` (lecture de la boîte et de l'agenda dans /bureau) : [DOC-BUREAU-GOOGLE.md](DOC-BUREAU-GOOGLE.md). Si `GOOGLE_REFRESH_TOKEN` est présent et qu'aucune autre solution n'est réglée, les mails partent par Gmail, comme avant.

---

## Laquelle est utilisée ?

La première réglée, dans cet ordre : SMTP (`SMTP_HOST`), Brevo (`BREVO_API_KEY`), Gmail (`GOOGLE_REFRESH_TOKEN`). Pour forcer : `MAIL_ENVOI=smtp`, `brevo`, `gmail`, ou `aucun` pour ne rien envoyer.

`npm run verifier` dit laquelle est utilisée, et teste la connexion (sans envoyer de mail) : identifiants SMTP acceptés, clé Brevo valide.

En mode démo, rien n'est envoyé.

## En cas d'erreur

Le bureau voit un message clair : identifiant ou mot de passe refusé, serveur qui ne répond pas, expéditeur refusé, quota atteint. Les erreurs sont aussi dans les journaux des fonctions Netlify (jamais le mot de passe ni le contenu du mail).

Code : `netlify/functions/_envoi.mjs` (`envoyerMail`).
