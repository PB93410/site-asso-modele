# Mode d’emploi — Espace bureau

**Saison en cours**  
**Adresse :** https://www.exemple-asso.fr/bureau  
**Où le relire une fois connecté :** **Autre** → **Aide** (bouton Imprimer).

**Boîte mail :** `docs/MODE-EMPLOI-MAIL.md`.

Tout se fait dans cet espace. Vous n’ouvrez pas Excel. WhatsApp s’ouvre tout seul quand vous appuyez sur un bouton vert.

---

## En une minute

| Situation | Où aller |
|-----------|----------|
| Quelqu’un veut essayer | QR, ou **Autre → Stand gymnase** (le jour du Forum : onglet **Stand**) |
| Ce qu’il reste à faire | Onglet **Accueil** |
| Retrouver une personne | Barre **Rechercher** (Accueil, À payer, Essais) |
| Rappeler une personne | Onglet **Essais** |
| Les la cotisation sont reçus | Onglet **À payer** → « J’ai reçu l’argent » |
| Tableaux / mail / agenda / horaires | Onglet **Autre** |
| QR de la séance, qui est venu | **Autre → Présences** (si la fonction est activée) |
| Annuler ou déplacer un cours | **Autre → Alertes cours** (si la fonction est activée) |

---

## Ouvrir l’espace

1. Ouvrez `/bureau` sur le téléphone ou l’ordinateur.
2. Tapez le mot de passe du bureau (le même pour tout le monde) → **Entrer**.
3. Gardez le téléphone chargé. Liste vide alors qu’il devrait y avoir du monde → **Actualiser** (en haut).

---

## Les onglets

- **Accueil** — ce qu’il reste à faire aujourd’hui.
- **Stand** — Forum : onglet du bas. Ensuite : **Autre → Stand gymnase**.
- **À payer** — inscriptions en ligne en attente des la cotisation. Recherche en haut.
- **Essais** — à confirmer, rappel la veille, puis après le cours.
- **Autre** — horaires, événements, aide, tableaux, mail.

---

## Au stand (forum des associations, portes ouvertes…)

1. **Idéal :** la personne scanne le QR (onglet Aide) et remplit l’essai toute seule. Elle voit tout de suite le créneau et la salle.
2. Sinon : **Stand** → prénom, **nom**, téléphone, cours → **Enregistrer**, puis le bouton WhatsApp.
3. Cochez « Adhésion payée au stand » **seulement** si l’argent est dans la caisse (chèque, espèces, ANCV ou autre moyen). Pas de paiement carte sur place. Complétez alors **les mêmes infos que le formulaire d’adhésion** (naissance, adresse, photos, QS-SPORT, accord). Une ligne est créée dans Adhérents, déjà à jour.
4. Les rappels suivants sont dans **Demande essai**.

QR : https://www.exemple-asso.fr/essai?source=forum

---

## Demandes d’essai — les trois listes

Chaque fiche : bouton vert WhatsApp (texte déjà écrit) et, si besoin, **Appeler**.

1. **À confirmer** → **Confirmer**. La personne passe dans Cours prévu.
2. **Cours prévu — rappel la veille** → **La veille**. Quand elle est venue → **Est venu(e)**.
3. **Après le cours** → **Après le cours** (adhésion). Ou **2e essai** / **3e essai** : elle revient dans Cours prévu.

Pour classer : **A adhéré**, **Ne veut plus**, **Plus tard**. La fiche sort des listes à traiter.

---

## Quand les la cotisation arrivent

1. Onglet **Adhésion**. Pour retrouver : barre **Rechercher**.
2. **J’ai reçu l’argent** → date → **n° de chèque** si chèque → **Oui, c’est payé**.
3. Coche trop tôt : cherchez la personne → **Annuler le paiement**.
4. la plateforme de paiement en ligne (carte) ou autre moyen : même geste, **une fois** le paiement vu. la plateforme de paiement en ligne **ne coche pas** le Sheet tout seul. Ne cochez pas avant d’avoir l’argent.
5. Relance douce : **Rappeler pour payer**.

---

## Horaires et événements du site

Choisissez, puis **Enregistrer**. Une confirmation s’affiche. Le site public se met à jour tout seul (quelques minutes). Pas besoin du référent. En cas de doute, n’enregistrez pas.

---

## Bip sur le téléphone (une fois)

1. Installez l’appli **ntfy**.
2. Connectez-vous au bureau, onglet Aide → **Ouvrir le canal d’alerte**.

Le bip indique un prénom, un cours et une date — **pas** le numéro. Sans l’appli, rien ne sonne : regardez **Demande essai** de temps en temps.

---

## Présences (QR), si la fonction est activée

1. **Autre → Présences**. Choisissez le jour.
2. **QR** sur le cours du moment. Les adhérents scannent, tapent leur numéro ou leur e-mail, **Je suis là**.
3. Un second passage le même jour est refusé.
4. Plus bas : totaux par cours, et les personnes sans nouvelles depuis 3 semaines. Cochez, **Envoyer un mot** (mail, si l’envoi est branché).

## Alertes de dernière minute, si la fonction est activée

1. **Autre → Alertes cours**. Date, cours, type (annulé / modifié), un court message.
2. **Publier** : un bandeau apparaît sur le site. Un mail part aux personnes inscrites sur `/alertes`.
3. **Retirer** enlève le bandeau.

Les adhérents s’inscrivent eux-mêmes (e-mail + case à cocher). Ils se retirent par le lien du mail.

## Liste d’attente, si la fonction est activée

1. Quand un essai ou un cours est complet, la personne est mise en file (elle le voit après l’envoi).
2. **Autre → Liste d’attente**. Vous voyez qui attend, pour quel cours, et son rang.
3. Une place se libère (essai annulé / absent, ou adhésion en arrêt) : la première personne est prévenue toute seule (mail si l’envoi est branché). Le bouton **Prévenir** ouvre aussi WhatsApp, comme les relances.
4. Elle a un délai (souvent 48 h) pour cliquer « J’accepte la place ». Ensuite, confirmez le créneau comme d’habitude.

## Carte Wallet, si la fonction est activée

Dans **Cartes**, pour un adhérent à jour : boutons **Apple Wallet** et **Google Wallet**. En démo, la carte n’est pas vraiment signée : c’est un aperçu. En prod, le référent pose les certificats (README).

## Aides (Pass'Sport, ANCV, CE), si la fonction est activée

Sur le formulaire d’inscription, la personne indique ses aides. Le **reste à payer** arrive sur la fiche (colonne montant + notes). Vérifiez les justificatifs au bureau.

## Rapport annuel, si la fonction est activée

**Autre → Rapport annuel**. Effectifs, essais devenus adhésions, présences (si le pointage est allumé), âges et communes. **Aucun nom.** Téléchargez le PDF ou le CSV pour l’AG ou la mairie.

## Attestations, si la fonction est activée

1. L’adhérent va sur **/attestations** : numéro + e-mail, ou **Recevoir un lien par mail**.
2. **Autre → Attestations** : pour chaque personne à jour, téléchargez le PDF (adhésion, reçu fiscal si l’asso est éligible, comité d’entreprise) ou envoyez le lien.
3. Le reçu fiscal n’apparaît **que** si le référent a coché l’éligibilité (intérêt général). Sinon, seulement adhésion + CE.

Rien n’est enregistré : le PDF est fabriqué au moment du clic.

---

## Si ça coince

- Liste vide → **Actualiser**.
- « Le registre Google ne répond pas » → Internet, puis **Actualiser**.
- « Session terminée » → **Quitter**, puis le mot de passe.
- WhatsApp ne s’ouvre pas → numéro manquant. **Appeler** à la place.
- Le reste → Internet, Actualiser, sinon le référent.
