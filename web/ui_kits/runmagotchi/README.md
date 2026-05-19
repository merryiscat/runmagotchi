# Runmagotchi UI Kit

Interactive recreation of the Runmagotchi PWA's core screens at wireframe fidelity. This kit faithfully reproduces what exists in `runmagotchi/docs/screens/*.html` — it does **not** invent new visuals (the product hasn't committed to any yet).

## What's in here

- **`index.html`** — clickable click-thru prototype. Walks the user through:
  - **O1** — landing video → fade → social login
  - **O2** — pick one of three eggs (color-only differentiation)
  - **M1** — main dashboard, two states (egg / hatched character)
  - **U1** — upload screenshot → parse → confirm flow (3 states inline)
  - **E1 mode A** — hatching: crack-1 → crack-2 → crack-3 → baby + name modal
  - **P1** — profile with stats and titles
- Component JSX files used by the index, each kept small and reusable.

## Fidelity notes

- Layout, spacing, typography, and color usage match `wireframe.css` exactly.
- Animations: only the two specified in the source (O1 fade 0.8 s, E1 mode A crack-stage swap up to ~7 s) are implemented. No springs or bounces.
- Character / egg art uses the source's two-diagonal placeholder. The `color_palette` selection in O2 is applied at runtime to the egg illustration **only** (UI chrome stays grayscale).
- All copy is verbatim Korean from the wireframe sources.
- No emoji, no exclamation marks, no honorifics.

## How to run

Open `index.html` in a browser. No build step. React + Babel are loaded from CDN.

## Components

| File | Purpose |
|---|---|
| `theme.css` | Imports `colors_and_type.css` + ports the wireframe primitives the screens depend on |
| `App.jsx` | Top-level router + state (eggColor, name, hatchedAt, etc.) |
| `screens.jsx` | O1, O2, M1, U1, E1, P1 — full screens |
| `chrome.jsx` | Frame, GNB, Topbar, Page wrapper |
| `controls.jsx` | Button, SocialButton, Input, Select, Toggle, Field |
| `stage.jsx` | Stage + Character + Egg illustrations (color-tintable) |
| `panels.jsx` | StatsRow, RunRow, ExpTrack, EggCard, Dropzone, ErrorState, Popup |
