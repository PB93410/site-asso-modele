# Paiement de l’adhésion en ligne

Pour le **référent**. Les bénévoles n’ont rien à régler : ils voient seulement les adhésions passer « À jour » toutes seules.

## Le principe

Le **tableau Adhérents du bureau reste le registre**. La plateforme de paiement encaisse, rien de plus, et doit pouvoir changer sans tout refaire.

Chaque demande d’adhésion reçoit une **référence** (ex. `ASE-K7M4QP`) :

- elle est écrite dans la colonne DETAIL de la fiche ;
- elle est affichée à l’adhérent à la fin du formulaire ;
- elle figure dans le mail d’alerte du bureau.

C’est elle qui relie un paiement à une personne, en ligne comme par virement.

## Trois façons de faire

| Réglage | Ce qui se passe | Pointage |
|---|---|---|
| **HelloAsso branché** (recommandé) | Le site crée le paiement et relit chaque paiement auprès de HelloAsso. L’adhésion passe « À jour » toute seule, et le bureau reçoit un mail « Paiement reçu ». | Aucun |
| **Simple lien** (`adhesion.paiementUrl`, sans identifiants HelloAsso) | Le formulaire affiche un bouton vers la page de paiement de la plateforme. | À la main : le site ne sait pas qui a payé |
| **Aucun** (`paiementUrl` vide) | Paiement au bureau uniquement (chèque, espèces, virement…). | Au bureau |

`npm run verifier` dit quel mode est actif. En mode « simple lien », il prévient que le pointage reste manuel.

> **Pourquoi pas Yapla, ou une autre plateforme en simple lien ?** Si la plateforme ne fournit pas, dans sa version gratuite, le détail de chaque paiement (qui, combien, quand), personne ne peut pointer de façon fiable. Le relevé bancaire non plus quand les versements sont groupés. HelloAsso fournit ce détail gratuitement, avec une API.

## Brancher HelloAsso

HelloAsso est gratuit pour l’association. Le payeur se voit proposer un pourboire facultatif, qu’il peut mettre à 0.

1. **Compte HelloAsso de l’association**, avec les vérifications d’identité faites : sans elles, HelloAsso ne verse pas l’argent.
2. Dans l’espace HelloAsso de l’asso, ouvrez **Mon compte → Intégrations et API** :
   - notez le **Client ID** et le **Client Secret** ;
   - dans **URL de callback** (notifications), mettez `https://<votre-site>/api/paiement-notification`.
3. **Le nom court de l’asso chez HelloAsso** : c’est la partie de l’adresse de votre page HelloAsso juste après `/associations/`. Dans `https://www.helloasso.com/associations/club-de-gym-de-villexemple`, c’est `club-de-gym-de-villexemple`.
4. Dans Netlify → Site configuration → Environment variables, ajoutez :

   | Variable | Valeur |
   |---|---|
   | `HELLOASSO_CLIENT_ID` | le Client ID |
   | `HELLOASSO_CLIENT_SECRET` | le Client Secret |
   | `HELLOASSO_ORGANISATION` | le nom court de l’étape 3 |

5. Redéployez, puis lancez `npm run verifier` en local avec les mêmes variables dans `.env`. Il doit afficher : « HelloAsso : identifiants acceptés, association … ».

Le montant encaissé est celui de la fiche (colonne MONTANT) : le tarif de `asso.config.js → adhesion.tarif`, ou le **reste à payer** si le module aides (`financement`) a déduit un Pass'Sport, des chèques ANCV ou une aide de comité d’entreprise. C’est ce même montant qui est vérifié au retour, et repris sur les attestations. Le libellé du paiement est « Adhésion 2026-2027 — Prénom Nom ».

Avec le module **liste d’attente**, une personne inscrite sur un cours complet n’a pas de bouton de paiement : elle paiera quand une place lui sera confirmée (le bureau lui renvoie alors le lien de paiement). Si les aides couvrent toute la cotisation, il n’y a rien à payer en ligne.

### Essayer sans argent réel

HelloAsso a un environnement de test, séparé du vrai (sur helloasso-sandbox.com) :

- créez-y un compte d’association de test ;
- prenez ses identifiants, et ajoutez la variable `HELLOASSO_SANDBOX=1` ;
- payez avec les cartes de test indiquées par HelloAsso.

`npm run verifier` rappelle que le mode test est actif. Pour passer en réel : retirez `HELLOASSO_SANDBOX` et mettez les identifiants du vrai compte.

## Le parcours

1. L’adhérent remplit `/inscription` et choisit **Carte en ligne**.
2. À la fin, il voit **Payer 140 € maintenant**. Le bouton ouvre `/api/paiement?ref=…`, qui crée un paiement HelloAsso tout neuf, pré-rempli avec son nom et son mail.
3. Il paie sur la page HelloAsso, puis HelloAsso le renvoie sur le site.
4. Le site **relit le paiement auprès de HelloAsso**, sans jamais se fier à ce que dit le navigateur. S’il est autorisé, au bon montant et pour cette référence :
   - la fiche passe **À jour** ;
   - le mode devient « Carte (HelloAsso) » ;
   - DETAIL indique `HelloAsso commande 12345 · Réf. ASE-K7M4QP` ;
   - le bureau reçoit **« [ASE] Paiement reçu — Prénom Nom »**.

Le paiement peut être confirmé par trois chemins. Le premier qui arrive valide la fiche, les suivants ne font rien :

- le **retour du payeur** sur le site ;
- la **notification** de HelloAsso (`/api/paiement-notification`) ;
- le **rattrapage**, toutes les heures : il relit les paiements ouverts depuis moins de 7 jours. Il couvre le cas où le payeur a fermé l’onglet et où la notification n’est pas branchée.

**Payer plus tard, relancer :** le lien `https://<votre-site>/api/paiement?ref=ASE-K7M4QP` marche à tout moment tant que la fiche est « En attente ». Le mail d’alerte du bureau le donne : on peut le renvoyer par WhatsApp.

## Virement

Le formulaire affiche la référence et demande de la mettre dans le libellé du virement. Avec `adhesion.iban` rempli dans `asso.config.js`, il affiche aussi l’IBAN.

Le trésorier retrouve la référence sur le relevé, puis passe la fiche à jour dans le bureau (« J’ai reçu l’argent »). Quand le bureau ajoute un détail, la référence reste dans DETAIL.

## Si quelque chose cloche

| Ce qu’on voit | Cause probable |
|---|---|
| Mail « Paiement reçu — demande … introuvable » | La fiche a été supprimée, ou sa référence effacée de DETAIL. Retrouvez le payeur dans l’espace HelloAsso, puis passez sa fiche à jour à la main. |
| Le payeur revient sur « paiement en cours de confirmation » | HelloAsso n’a pas encore confirmé. La notification ou le rattrapage horaire valideront la fiche. |
| « La page de paiement n’a pas pu s’ouvrir » | Identifiants ou nom court faux : lancez `npm run verifier`. Les journaux Netlify de la fonction `paiement` donnent le détail. |
| Fiche validée à la main **et** payée en ligne | Rien de grave : la fiche n’est validée qu’une fois. Pour un double paiement, remboursez depuis l’espace HelloAsso. |

## Pour forcer un mode

`PAIEMENT=helloasso`, `PAIEMENT=lien` ou `PAIEMENT=aucun`. Par défaut :

- HelloAsso si `HELLOASSO_CLIENT_ID` est présent ;
- sinon le lien, si `adhesion.paiementUrl` est rempli ;
- sinon aucun.

En démo (`npm run demo`), le paiement HelloAsso est simulé et toujours accepté.
