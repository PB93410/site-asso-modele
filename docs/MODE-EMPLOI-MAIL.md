# Boîte mail du bureau — contact@exemple-asso.fr

**Saison en cours**  
**Ouvrir :** https://mail.google.com/ (compte `contact@exemple-asso.fr`)  
**Depuis /bureau :** bouton **Boîte mail** (après connexion).

La boîte sert aux **institutions** (la plateforme de paiement en ligne, mairie, fédé) et aux copies d’inscription.  
Les **personnes** se gèrent surtout dans **/bureau** et sur **WhatsApp ((numéro de l’asso))**.  
La vérité « qui a payé / qui essaie » = les **tableaux**, pas la liste des mails.

---

## 1. Cinq minutes par jour (une personne)

1. Ouvrir Gmail **asso** (pas la boîte perso).
2. Regarder uniquement les **non lus** avec une étoile, ou le libellé **À traiter**.
3. Pour chaque mail : faire l’action du tableau ci-dessous, puis **Archiver** (touche `E`). Ne pas laisser 80 mails « non lus ».
4. Si ce n’est pas pour vous (mairie, fédé, RGPD) : étoile + WhatsApp au président / référent. Ne pas ignorer.

Idéal : **un responsable mail** au bureau, les autres regardent WhatsApp et `/bureau`.

---

## 2. Qu’est-ce qui arrive — et que faire

| Ça ressemble à… | C’est | Action |
|-----------------|-------|--------|
| la plateforme de paiement en ligne, paiement, adhésion, facture | Paiement **carte** | `/bureau` → **À payer** → retrouver la personne → **J’ai reçu l’argent**. Archiver le mail. |
| `[ESSAI] Prénom Nom · créneau` | Copie formulaire `/essai` | **Ne pas traiter dans Gmail.** Ouvrir `/bureau` → **Essais**. Archiver (filtre recommandé ci-dessous). |
| `[ASE] Adhésion — Prénom NOM` | Alerte fiche `/inscription` (Gmail API) | Ligne **déjà** dans Adhérents — seul registre. Vérifier `/bureau` → À payer. **Ne pas** recréer une ligne. Archiver. |
| `[ASE] N nouvelles demandes` (relevé) | Digests Sheet (essais / mixte) | Filtre **Essais** ou **Adhésions** selon le contenu. Traiter dans `/bureau`. |
| Ancien « Nouvelle Adhesion : » / Netlify Forms vide | Obsolète | Ignorer / archiver. Les notifs Netlify Forms inscription sont désactivées. |
| Quelqu’un veut un essai / un horaire | Message d’une personne | Répondre : formulaire https://www.exemple-asso.fr/essai ou WhatsApp 07. Noter dans `/bureau` si besoin. |
| « J’ai payé, je n’ai pas de reçu » | Preuve la plateforme de paiement en ligne | la plateforme de paiement en ligne envoie l’e-mail de reçu. Renvoyer depuis la plateforme de paiement en ligne, ou expliquer de regarder les spams. |
| Mairie, fédération, assurance | Courrier officiel | Président / référent. Ne pas classer comme spam. |
| Effacer mes données, RGPD | Droit des personnes | Président. Ne pas supprimer le Sheet tout seul. |
| Google, « alerte de sécurité », mot de passe | Compte Gmail | Référent. Ne cliquer un lien que si l’adresse est bien `@google.com`. |
| Gagné un iPhone, facture DHL, héritage | Spam / piège | **Spam**, ne pas ouvrir les pièces, ne pas répondre. |

Les **essais** du site envoient une **copie mail** avec le sujet `[ESSAI] …`. Le dossier se traite dans **Bureau → Essais** (+ bip ntfy). Ce mail n’est pas le registre.

Les essais se traitent dans Bureau → Essais. Dans Gmail : filtre sujet commence par `[ESSAI]` → libellé Essais + ignorer la boîte de réception.

---

## 3. Réponses courtes (à copier)

**Essai**

```
Bonjour,
Pour un essai gratuit : https://www.exemple-asso.fr/essai
Ou WhatsApp : (numéro de l’asso)
l’association
```

**Paiement carte / reçu**

```
Bonjour,
Le paiement carte se fait sur la plateforme de paiement en ligne. La confirmation (et le reçu) part par e-mail la plateforme de paiement en ligne — pensez aux indésirables.
Le bureau valide ensuite dans nos listes.
WhatsApp : (numéro de l’asso)
l’association
```

**Chèque / espèces / ANCV**

```
Bonjour,
Vous pouvez régler la cotisation au bureau (chèque, espèces ou ANCV). Formulaire : https://www.exemple-asso.fr/inscription
WhatsApp : (numéro de l’asso)
l’association
```

Toujours depuis **contact@exemple-asso.fr**, pas depuis une adresse perso.

---

## 4. Ranger Gmail (une fois)

Dans Gmail → ⚙️ Paramètres → **Tous les paramètres** → **Filtres et adresses bloquées** → **Créer un filtre**.

Créer 4 libellés d’abord (à gauche : Plus → Créer un libellé) : `la plateforme de paiement en ligne` · `Inscriptions-site` · `Essais` · `A-traiter`.

| Filtre | Libellé | Case à cocher |
|--------|---------|----------------|
| La plateforme de paiement en ligne (champ « De ») | Paiement en ligne | Étoiler + libellé « Paiement en ligne » (ou ignorer si vous préférez) |
| Objet contient `[ASE] Adhésion` | Inscriptions-site / Adhésions | Libellé + **Ne pas marquer comme spam** (filtre Mail bureau) |
| Objet contient `[ESSAI]` | Essais | Libellé + **Ignorer la boîte de réception** |
| (rien, manuel) | A-traiter | Vous mettez l’étoile à la main |

Ancien filtre `netlify.com` / « Nouvelle Adhesion » : obsolète (plus de Netlify Forms inscription).

Recommandation simple : **ne pas** tout archiver automatiquement au début. Libellé + étoile suffisent. Au bout d’une semaine, vous verrez le rythme.

Sur le téléphone : appli **Gmail** → ajouter le compte `contact@exemple-asso.fr` (en plus du perso). Notifications **uniquement** pour ce compte si vous êtes de permanence.

---

## 5. À ne pas faire

- Traiter la boîte comme le registre (le Sheet / `/bureau` font foi).
- Répondre depuis une adresse perso.
- Cliquer un lien « votre compte va être fermé » sans regarder l’expéditeur.
- Supprimer des mails la plateforme de paiement en ligne ou mairie : **archiver**.
- Promettre un paiement ou une licence par mail sans passer par la plateforme de paiement en ligne ou le bureau.

---

## 6. Mot de passe

Compte partagé du bureau. Ne pas le coller dans WhatsApp du club. Double authentification : codes de secours chez le référent.
