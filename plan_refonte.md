
### 2.1 `design/tokens.json`
```json
{
  "color": {
    "primary": "#HEX_FROM_SHAPE",
    "primaryForeground": "#HEX",
    "secondary": "#HEX",
    "secondaryForeground": "#HEX",
    "accent": "#HEX",
    "success": "#HEX",
    "warning": "#HEX",
    "error": "#HEX",
    "info": "#HEX",
    "bg": "#HEX",
    "card": "#HEX",
    "muted": "#HEX",
    "border": "#HEX",
    "ring": "#HEX",
    "neutral": {
      "50":  "#HEX",
      "100": "#HEX",
      "200": "#HEX",
      "300": "#HEX",
      "400": "#HEX",
      "500": "#HEX",
      "600": "#HEX",
      "700": "#HEX",
      "800": "#HEX",
      "900": "#HEX"
    }
  },
  "radius": { "sm": 6, "md": 10, "lg": 14, "xl": 20 },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 10px rgba(0,0,0,0.08)",
    "lg": "0 10px 24px rgba(0,0,0,0.12)"
  },
  "spacing": { "base": 8 },
  "font": {
    "familyHeading": "\"FONT_FROM_SHAPE\", system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    "familyBody": "\"FONT_FROM_SHAPE\", system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    "scale": { "h1": 40, "h2": 32, "h3": 24, "h4": 20, "body": 16, "small": 14 },
    "lineHeight": { "tight": 1.2, "normal": 1.5, "relaxed": 1.7 }
  }
}
```

### 2.2 `styles/theme-shape.css`
> **Un seul point d’entrée** pour skinner toute l’app. On applique la classe `theme-shape` au `<html>` (ou `<body>`).

```css
:root.theme-shape {
  /* Couleurs */
  --color-primary:            #HEX_FROM_SHAPE;
  --color-primary-foreground: #HEX;
  --color-secondary:          #HEX;
  --color-secondary-foreground:#HEX;
  --color-accent:             #HEX;
  --color-bg:                 #HEX;
  --color-card:               #HEX;
  --color-muted:              #HEX;
  --color-border:             #HEX;
  --color-ring:               #HEX;

  /* États */
  --color-success:            #HEX;
  --color-warning:            #HEX;
  --color-error:              #HEX;
  --color-info:               #HEX;

  /* Neutres */
  --color-neutral-50:  #HEX;
  --color-neutral-100: #HEX;
  --color-neutral-200: #HEX;
  --color-neutral-300: #HEX;
  --color-neutral-400: #HEX;
  --color-neutral-500: #HEX;
  --color-neutral-600: #HEX;
  --color-neutral-700: #HEX;
  --color-neutral-800: #HEX;
  --color-neutral-900: #HEX;

  /* Typos */
  --font-heading: "FONT_FROM_SHAPE", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  --font-body:    "FONT_FROM_SHAPE", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;

  /* Rythme */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.05);
  --shadow-md: 0 4px 10px rgba(0,0,0,.08);
  --shadow-lg: 0 10px 24px rgba(0,0,0,.12);
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
}

/* Typo & fond global */
.theme-shape, .theme-shape body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-neutral-900);
}
```

---

## 3) Intégration (2 options)

### Option A — **Sans framework** (CSS variables partout)
- [ ] Importer `theme-shape.css` globalement.
- [ ] Remplacer les couleurs/typos locales par les variables (`var(--color-primary)`…).
- Avantages : zéro dépendance ; migration incrémentale composant par composant.

### Option B — **Tailwind** (si l’app l’utilise déjà)
- Étendre la config pour _mapper_ **les variables CSS** vers Tailwind :
```js
// tailwind.config.js (extrait)
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--twc-primary) / <alpha-value>)",
        // … ou utiliser plugin CSS variables, voir note ci-dessous
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)"
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)"
      }
    }
  }
}
```
> **Note** : pour une meilleure compatibilité Tailwind + CSS vars, on peut déclarer des couleurs en `rgb(r g b)` via variables `--twc-primary: 17 94 163;` (cf. plugin `tailwindcss-variables`).

---

## 4) Bibliothèque de composants (UI kit minimal)
À implémenter dans `src/components/ui/` (ou équivalent). **Pas de changement d’API props** si possible.

### Boutons
```css
.btn { 
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-neutral-50);
  color: var(--color-neutral-900);
  box-shadow: var(--shadow-sm);
  transition: background .2s ease, box-shadow .2s ease, transform .02s;
}
.btn:hover { background: var(--color-neutral-100); }
.btn:active { transform: translateY(1px); }
.btn:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }

.btn--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  border-color: transparent;
}
.btn--primary:hover { filter: brightness(0.96); }
.btn--danger  { background: var(--color-error); color: white; border-color: transparent; }
```

### Champs de formulaire
```css
.input, .select, .textarea {
  width: 100%; padding: 10px 12px; border-radius: var(--radius-md);
  border: 1px solid var(--color-border); background: white;
}
.input:focus, .select:focus, .textarea:focus {
  outline: 2px solid var(--color-ring); outline-offset: 2px;
  border-color: var(--color-ring);
}
.help { color: var(--color-neutral-500); font-size: 12px; }
.error { color: var(--color-error); font-size: 12px; }
```

### Badges de **statut SAV**
```css
.badge { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:12px; }
.badge--nouveau   { background: var(--color-info);    color: white; }
.badge--encours   { background: var(--color-primary); color: var(--color-primary-foreground); }
.badge--attente   { background: var(--color-warning); color: black; }
.badge--resolu    { background: var(--color-success); color: white; }
.badge--clos      { background: var(--color-neutral-300); color: var(--color-neutral-900); }
```

### Table (liste tickets)
```css
.table { width:100%; border-collapse: separate; border-spacing: 0; }
.table thead th { text-align:left; font-weight:600; padding:12px; color: var(--color-neutral-600); }
.table tbody td { padding:12px; border-top:1px solid var(--color-neutral-100); }
.table tbody tr:hover { background: var(--color-neutral-50); }
.table--compact tbody td { padding:8px; }
.table__actions { display:flex; gap:8px; justify-content:flex-end; }
```

### Modale
```css
.modal__backdrop { position:fixed; inset:0; background: rgba(0,0,0,.32); }
.modal { position:fixed; inset:0; display:grid; place-items:center; padding:20px; }
.modal__card { width:min(720px, 92vw); background:white; border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); overflow:hidden; }
.modal__header { padding:16px 20px; border-bottom:1px solid var(--color-neutral-100); }
.modal__body   { padding:20px; }
.modal__footer { padding:16px 20px; border-top:1px solid var(--color-neutral-100); display:flex; gap:12px; justify-content:flex-end; }
```

---

## 5) Templates d’écrans
- **Dashboard** : KPIs (cartes), “à traiter”, derniers tickets, raccourcis.
- **Liste tickets** : table + filtres persistants + recherche + colonnes configurables.
- **Vue ticket** : chronologie, pièces jointes, commentaires, actions rapides (assigner, changer statut, SLA).
- **Formulaires** : création/édition (sections claires, validations inline, aide contextuelle).
- **Paramètres** : rôles, catégories, SLA, modèles de réponse.

> **Densité** : prévoir 2 modes via une classe sur `<html>` (ex. `density-compact` / `density-comfy`).

```css
.density-compact { --space-1: 6px; --space-2: 12px; }
.density-compact .btn { padding:8px 10px; }
.density-compact .table--compact tbody td { padding:6px; }
```

---

## 6) Règles d’interaction
- **Transitions** : 200–250ms pour menus, modales, tooltips.
- **Focus** : toujours visible (`outline` + `outline-offset`).
- **États système** :
  - Loading inline (spinner dans le bouton) + skeletons pour listes.
  - Erreurs avec message clair + action de résolution (retry, retour).

---

## 7) Implémentation pas-à-pas (sécurisée)
1. **Branche** `feat/theme-shape` + **feature flag** (classe CSS `theme-shape` sur `<html>` ou variable `THEME_SHAPE=true`).
2. **Ajouter** `tokens.json` + `theme-shape.css` + charger les **polices**.
3. **Mapper** les composants critiques **dans cet ordre** :
   - [ ] Table (liste de tickets)
   - [ ] Boutons + champs de formulaires
   - [ ] Badges de statut
   - [ ] Modales / Side panels
   - [ ] Cartes KPI du dashboard
4. **Ne pas changer** les noms de classes utilisés par les tests E2E sans migration coordonnée.
5. **QA visuelle** : pages clés, responsive, dark/clair si applicable, lecteurs d’écran.
6. **Bascule** : activer `theme-shape` en préprod → prod après validation.

---

## 8) Accessibilité & performance
- Contrastes **AA** (vérifier après choix des hex).
- Cibles tactiles **≥ 44px** (boutons, checkboxes custom).
- Ordre de tabulation logique ; focus piégé dans les modales.
- Polices : `preconnect` + `font-display: swap` ; **purge CSS** ; sprites d’icônes.

---

## 9) Délivrables
- `design/tokens.json` (couleurs, typo, rayons, ombres, spacing).
- `styles/theme-shape.css` (variables CSS).
- `src/components/ui/*` (implémentations minimalistes des composants).
- **Guide d’intégration** (ce fichier) + captures (avant/après).

---

## 10) Checklists finales

### A. Parité fonctionnelle (rien ne casse)
- [ ] Aucun appel API modifié
- [ ] DOM stable pour les sélecteurs/tests
- [ ] Tous les flux SAV passent (créer, commenter, assigner, changer statut, fermer)

### B. Parité visuelle (aligné Shape)
- [ ] Polices identiques au site de référence
- [ ] Couleurs et états conformes
- [ ] Boutons/liens/hover/focus identiques

### C. Accessibilité
- [ ] Contraste AA
- [ ] Focus visible partout
- [ ] Navigation clavier complète

---

## 11) Annexes

### 11.1 Exemple de **mapping statut SAV → couleur**
| Statut             | Token couleur          |
|--------------------|------------------------|
| Nouveau            | `--color-info`         |
| En cours           | `--color-primary`      |
| En attente client  | `--color-warning`      |
| Résolu             | `--color-success`      |
| Clos               | `--color-neutral-300`  |

### 11.2 Snippet HTML minimal (pour test rapide)
```html
<html class="theme-shape">
  <head>
    <link rel="stylesheet" href="/styles/theme-shape.css" />
  </head>
  <body>
    <div class="card" style="padding:var(--space-3); border:1px solid var(--color-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-md)">
      <h2 style="font-family:var(--font-heading);">Tickets à traiter</h2>
      <span class="badge badge--encours">En cours</span>
      <button class="btn btn--primary">Créer un ticket</button>
      <table class="table table--compact" style="margin-top:var(--space-3)">
        <thead><tr><th>ID</th><th>Client</th><th>Statut</th></tr></thead>
        <tbody>
          <tr><td>#1520</td><td>Acme</td><td><span class="badge badge--attente">En attente</span></td></tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
```

---

## 12) Prochaines étapes (pour démarrer)
1. Récupérer **polices** et **hex** exacts de `shape-conseil.fr` → remplir `tokens.json` et `theme-shape.css`.
2. Brancher `theme-shape.css` globalement + activer la classe `theme-shape` derrière un flag.
3. Migrer **Table** puis **Formulaires** puis **Badges** (ordre ci-dessus), avec QA à chaque étape.
4. Me soumettre une **préprod** pour validation visuelle finale.
```