# Design system (modèle association)

Référence des couleurs Tailwind et règles de contraste. Les teintes d’action viennent de `asso.config.js` → `couleurs`.

## Couleurs nommées (tailwind.config.js)

| Token | Usage |
| --- | --- |
| `orange-primary` / `orange-hover` | Boutons d’action pleins (depuis la config asso) |
| `orange-ink` (#A34608) | Liens et petits textes orange sur fond clair |
| `orange-on-dark` (#EA580C) | Accent orange sur fond sombre |
| `orange-clair` (#FDBA74) | Grands titres sur photo / fond très sombre (hero) |
| `brand-cream`, `brand-black`, `brand-gray` | Fonds et textes courants |
| `brand-olive` | Liens secondaires, planning (depuis la config asso) |

`orange-clair` est réservé aux titres sur image sombre : contraste ≥ 4,5:1 sur `#111110`.

## Boutons

- Un seul bouton **plein** orange par zone d’action principale ; les actions secondaires passent en **contour** (bordure olive ou lien souligné).
- Cibles tactiles : 44 px minimum (`index.css` + `min-h-[44px]` sur les CTA importants).

## Bureau

Écran de connexion : fond crème, bouton « Entrer » orange en pilule (`rounded-full`), 48 px de haut.