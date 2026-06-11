# BUILD_REPORT.md — Logbuch

> Pflicht-Logbuch je Meilenstein: Was gebaut, wie getestet, offene Punkte.

<!-- Einträge werden je Meilenstein ergänzt (M0 … M10). -->

## M0 — Setup (2026-06-11)

**Was:**
- Vite 6 + React 18 + TypeScript strict (project references, `noUncheckedIndexedAccess`)
- ESLint 9 (flat config, typescript-eslint, react-hooks) + Prettier
- Vitest (jsdom) + Playwright (Chromium, Smoke gegen Production-Preview)
- GitHub-Actions-CI: lint → test → build → smoke → Pages-Deploy (main)
- `.gitignore` zuerst erweitert (secrets/, *.key, .env*, Artefakte)
- App-Shell: Hash-Router, Titel „RLS-SIM Salzburg", Untertitel, Footer-Disclaimer,
  OSM-Attribution
- `design/tokens.css` PROVISORISCH aus DESIGN_BRIEF abgeleitet + `design/DESIGN_SYSTEM.md`
- Erste Utils (`formatGameTime`, `shortCallSign` nach GAME_DATA §10c) mit Unit-Tests

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (7 Tests) · `npm run build` ✓ ·
`npm run smoke` ✓ (1 E2E: Titel + Disclaimer sichtbar, Production-Preview).

**Offene Punkte:** CI-Lauf auf GitHub erst nach Push auf main prüfbar; Pages-Source muss
im Repo auf „GitHub Actions" stehen.
