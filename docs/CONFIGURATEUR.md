# Questionnaire en ligne et installation (référent)

Le bénévole décrit son association dans un **questionnaire en ligne**, sans compte ni installation.
Le référent reçoit un **dossier** (un fichier `.json`, images comprises) et l’installe en une commande.

```
Bénévole : questionnaire (20 min)  →  dossier reçu par mail  →  Référent : npm run installer  →  démo  →  mise en ligne
```

---

## 1. Mettre le questionnaire en ligne (une seule fois)

Le questionnaire est un petit site à part, dans ce même dépôt (`configurateur/`).

1. Netlify → **Add new site → Import an existing project** → ce dépôt.
2. **Base directory** : `configurateur`. Le reste vient de `configurateur/netlify.toml`.
3. Après le premier déploiement : **Forms** → activer **Form detection**, puis redéployer.
4. **Forms → Form notifications** : ajouter un e-mail sur le formulaire `dossier-association`.
5. Facultatif : un nom de domaine (ex. `configurer.votre-domaine.fr`).

En local, pour essayer : `npm run configurateur` (http://localhost:5180). L’envoi y est simulé ; le bouton « Télécharger le dossier » marche.

Vérifiez dans votre offre Netlify les quotas des formulaires (nombre d’envois par mois, taille des fichiers). Un dossier pèse de quelques dizaines de Ko à environ 1 Mo avec une photo.

### Ce que fait le questionnaire

- **Retrouve l’association** dans le répertoire officiel (API « Recherche d’entreprises ») : nom, RNA, SIRET, siège, année. Les associations sans SIRET n’y sont pas : on remplit à la main.
- **Recherche les adresses** des salles (Base Adresse Nationale / Géoplateforme), avec la position GPS.
- **Tire la couleur du logo** et l’assombrit si elle n’est pas lisible en blanc (WCAG 4,5:1).
- **Recadre la photo** au format du site (1344 × 768, WebP), dans le navigateur.
- **Montre un aperçu** de l’accueil et de la carte d’adhérent.
- **Garde un brouillon** dans le navigateur : on peut reprendre le lendemain sur le même appareil.

Rien n’est envoyé avant le bouton « Envoyer », sauf les recherches (nom ou numéro d’association, adresses) aux API publiques.

---

## 2. Installer un dossier

Une copie neuve du modèle par association (GitHub : **Use this template**), puis :

```bash
npm install
```

```bash
npm run installer -- chemin/vers/dossier-sst-2026-10-11.json --essai
```

`--essai` montre ce qui sera écrit, sans rien toucher. Puis pour de bon :

```bash
npm run installer -- chemin/vers/dossier-sst-2026-10-11.json
```

L’installation :

- écrit `asso.config.js` (avec ses commentaires), `public/data/planning.csv`, le logo et la photo (`public/assets/logo-asso.*`, `hero-asso.*`) ;
- assombrit la couleur si besoin et calcule les couleurs de survol ;
- lance `npm run identite` (favicons, image de partage, verso de carte **à partir du logo de l’association**) ;
- lance `npm run verifier` ;
- écrit `tmp/installation-<sigle>.md` : contact, cours à rédiger, remarques, liste « à faire ». Ce fichier n’est jamais commité (il contient le contact du bénévole).

Un projet déjà configuré pour une autre association est protégé : ajoutez `--force` pour le remplacer.

Pour essayer sans dossier réel : `scripts/dossier-exemple.json` (association fictive).

---

## 3. Ensuite

1. `npm run demo` : montrer le site à l’association (bureau : mot de passe `demo`).
2. Rédiger les pages de cours, coachs et FAQ dans `src/data/` à partir de `tmp/installation-<sigle>.md`.
3. Brancher Google pour les fonctions demandées (`docs/DOC-GOOGLE-SHEETS.md`, `docs/DOC-BUREAU-GOOGLE.md`).
4. `npm run verifier` jusqu’à zéro « ✖ », puis mise en ligne (`README.md`).

---

## Format du dossier

`src/lib/dossier.js` (+ `dossier.d.ts`) : forme, valeurs par défaut, contrôles (`erreursDossier`), conversion en configuration (`configDepuisDossier`). Le champ `version` permet d’importer d’anciens dossiers. Un champ ajouté à `asso.config.js` doit l’être aussi dans `scripts/_config-gabarit.mjs` (un test le vérifie) et, s’il doit être demandé à l’association, dans le dossier et le questionnaire.
