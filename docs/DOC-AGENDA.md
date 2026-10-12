# Agenda du bureau (référent)

Un seul agenda pour le bureau : réunions, portes ouvertes, assemblée générale, forum. On l'ouvre dans **/bureau → Autre → Agenda**, on y ajoute, modifie ou supprime les dates.

## Par défaut : sur Netlify, rien à brancher

L'agenda est rangé avec les données du site (Netlify Blobs), comme les essais et les adhérents ([DOC-DONNEES.md](DOC-DONNEES.md)). Pas de compte Google à connecter.

## Sur les téléphones : l'abonnement

En bas de la page Agenda, **« Voir cet agenda sur mon téléphone »** :

- **iPhone, iPad, Mac** : bouton « Ajouter à mon agenda », puis « S'abonner ».
- **Android / Google Agenda** : sur un ordinateur, Google Agenda → « Autres agendas » → « + » → « À partir de l'URL », coller le lien (bouton « Copier le lien »). L'agenda apparaît ensuite sur le téléphone Android.
- **Outlook** : « Ajouter un calendrier » → « S'abonner à partir du web ».
- **Thunderbird** : Nouvel agenda → Sur le réseau → coller le lien.

L'agenda abonné est **en lecture seule** et se met à jour tout seul (Apple : environ toutes les heures ; Google Agenda : parfois plusieurs heures). On ajoute et on modifie les dates dans le bureau.

Le lien est secret (une longue clé). Il donne à voir l'agenda du bureau, rien d'autre : pas d'adhérents, pas d'essais. Ne le publiez pas.

- Par défaut, la clé est tirée de `BUREAU_SECRET` : changer le secret du bureau change le lien (et déconnecte tout le monde).
- Pour changer seulement le lien : `AGENDA_ICS_CLE` = une nouvelle chaîne au hasard, puis redéployez. Les anciens abonnements cessent de se mettre à jour : il faut se réabonner.

## Variante : Google Agenda

Si le compte Google de l'asso est connecté (`GOOGLE_REFRESH_TOKEN`, [DOC-BUREAU-GOOGLE.md](DOC-BUREAU-GOOGLE.md)), l'agenda du bureau est celui de Google, comme avant ; l'abonnement .ics marche aussi. Pour choisir explicitement : `AGENDA=netlify` ou `AGENDA=google`.

Passer de Google Agenda à Netlify : les dates à venir sont à ressaisir dans le bureau (en général une poignée), puis `AGENDA=netlify`.

Code : `netlify/functions/_agenda.mjs` (agenda sur Blobs, même API que Google Agenda ; format .ics), `bureau-agenda.mjs`, `agenda-ics.mjs`.
