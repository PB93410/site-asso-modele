# Guide Google Sheets — Planning & Événements

Ce guide explique comment mettre à jour le **planning** et les **événements** du site via un Google Sheet.

> **Important (août 2026)**  
> - Seuls le **planning** et les **événements** sont pilotés par le Sheet.  
> - Les **coachs**  sont gérés dans le code (`siteData.ts`) pour protéger les photos et les biographies.  
> - Après toute modification du Sheet → demander un **rebuild** au référent technique (`npm run build`).

---

## Principe

1. Vous modifiez un tableau Google Sheets (comme Excel en ligne).
2. Le Sheet est publié en CSV.
3. Au moment du build du site, les CSV sont téléchargés et intégrés.
4. Le site affiche les nouvelles données.

---

## Structure actuelle du Sheet

Le Sheet contient **3 onglets** (même si les coachs ne sont plus utilisés en production) :

| Onglet        | Utilisé ? | Colonnes exactes |
|---------------|-----------|------------------|
| **COACHS**    | Non (secours uniquement) | `name,specialties,bio,image` |
| **EVENEMENTS**| Oui       | `date,month,year,title,description,time,location,highlight,image,type` |
| **PLANNING**  | Oui       | `day,time,course,location,note` |

---

## 1. Onglet PLANNING

### Colonnes (ligne 1 – ne jamais modifier)

```
day,time,course,location,note
```

### Exemple de contenu actuel (saison AAAA-AAAA)

| day      | time            | course                     | location            | note |
|----------|-----------------|---------------------------|---------------------|------|
| Lundi    | 13h30 – 14h30   | Gym Douce                 | Salle des fêtes       |      |
| Lundi    | 20h00 – 21h30   | Renforcement Musculaire   | Gymnase municipal   |      |
| Mercredi | 20h45 – 21h45   | Cardio & Gym              | Gymnase municipal   |      |
| Jeudi    | 15h30 – 16h30   | Stretching                | Salle des fêtes       |      |
| Jeudi    | 19h30 – 20h30   | Zumba                     | Gymnase municipal   |      |
| Samedi   | 10h00 – 11h00   | Pilates                   | Salle des fêtes       |      |

### Règles

- `day` : Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche
- `time` : format `13h30 – 14h30` (avec le tiret long ou le tiret simple)
- `course` : nom exact du cours (doit correspondre aux noms affichés sur le site)
- `location` : Salle des fêtes ou Gymnase municipal
- `note` : laisser vide la plupart du temps

**Pour ajouter un créneau** : ajoutez une nouvelle ligne.  
**Pour supprimer** : effacez la ligne entière.

---

## 2. Onglet EVENEMENTS

### Colonnes (ligne 1 – ne jamais modifier)

```
date,month,year,title,description,time,location,highlight,image,type
```

### Exemple de contenu actuel

| date | month | year | title                     | description                                      | time          | location                      | highlight | image | type          |
|------|-------|------|---------------------------|--------------------------------------------------|---------------|-------------------------------|-----------|-------|---------------|
| 15   | NOV   | 2026 | Séance portes ouvertes    | Venez avec un ami…                               | 10h00         | Gymnase municipal             | true      |       | sportif       |
| 12   | DÉC   | 2026 | Zumba Party de Noël       | Venez célébrer les fêtes…                        | 19h30 – 21h00 | Gymnase municipal             | true      |       | festif        |

### Règles des colonnes

| Colonne      | Description                                      | Exemple                  |
|--------------|--------------------------------------------------|--------------------------|
| `date`       | Jour (ou plage)                                  | `6` ou `4-5`             |
| `month`      | Mois en majuscules (3-4 lettres)                 | `SEPT`, `DÉC`, `MARS`    |
| `year`       | Année                                            | `2026`                   |
| `title`      | Titre de l’événement                             | `Séance portes ouvertes` |
| `description`| Texte court (1-2 phrases)                        |                          |
| `time`       | Horaire                                          | `10h00 – 18h00`          |
| `location`   | Lieu                                             | `Gymnase municipal`      |
| `highlight`  | `true` pour mettre en avant, sinon laisser vide  | `true`                   |
| `image`      | Chemin de l’image (optionnel)                    | `/assets/event-xxx.webp` |
| `type`       | Type d’événement (badge coloré)                  | voir ci-dessous          |

### Valeurs acceptées pour `type`

- `administratif` (Forum, inscriptions…)
- `festif` (Party, fête…)
- `sportif` (stage, compétition…)
- `caritatif` (Téléthon…)
- `sortie` (sortie, voyage…)

Si la colonne `type` est vide, le site tente de deviner à partir du titre.

---

## 3. Publier le Sheet (une seule fois)

1. Dans Google Sheets → **Fichier → Partager → Publier sur le web**
2. Pour chaque onglet utile (`PLANNING` et `EVENEMENTS`) :
   - Sélectionnez l’onglet
   - Format : **Valeurs séparées par des virgules (.csv)**
   - Cliquez **Publier**
3. Notez les URLs de publication (elles ressemblent à) :
   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=XXXX&single=true&output=csv
   ```

Le référent technique a déjà enregistré ces URLs dans le script de build (`scripts/fetch-sheets.mjs`).  
Si vous changez de Sheet, il faudra lui donner les nouvelles URLs.

---

## 4. Après modification → rebuild obligatoire

Le site **ne se met pas à jour tout seul** en temps réel.

Après chaque modification importante du Sheet :

1. Enregistrez le Sheet
2. Demandez au référent technique de lancer :
   ```bash
   npm run build
   ```
3. Puis de redéployer le dossier `dist/` sur Netlify (ou de laisser Netlify rebuild depuis le dépôt)

---

## 5. Alternative sans Google Sheets

Si le Sheet n’est pas pratique, modifiez directement les fichiers de secours :

- Planning → `src/data/siteData.ts` (section `SCHEDULE`)
- Événements → `src/data/siteData.ts` (section `EVENTS`)

Puis rebuild + déploiement.

Les CSV locaux se trouvent aussi dans `public/data/` (`planning.csv` et `evenements.csv`).

---

## 6. Points d’attention

- **Ne jamais** renommer ou déplacer les colonnes (ligne 1).
- **Ne jamais** supprimer la ligne d’en-tête.
- Les accents et apostrophes sont autorisés.
- Pour les événements passés : supprimez simplement la ligne (ou laissez-la, le site les affichera quand même).
- Après un changement de planning, pensez aussi à vérifier les créneaux dans les pages d’activité SEO (`activityPages.ts`) — c’est le rôle du référent technique.

---

## Besoin d’aide ?

Contactez le référent technique ou le bureau :

- Email : **contact@exemple-asso.fr**
- WhatsApp : **(numéro de l’asso)**
- Page bénévoles : [www.exemple-asso.fr/benevoles](https://www.exemple-asso.fr/benevoles)

---

*Dernière mise à jour : août 2026*
