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

## M1 — Datenbasis (2026-06-11)

**Was:**
- 8 Daten-JSONs unter `src/data/` mit Zod-Schemas (`schemas.ts`) + zentralem Loader:
  - `codes.json`: 30 Einsatzcodes A1–E6 + MANV1–4 inkl. SoSi (offizielles PDF, §4)
  - `categories.json`: 71 Kategorien (29 Notfall + 42 D/E) mit defaultCode/altCode,
    Partnern (FW/POL/WR/BR), MANV-Check, Lagefreigabe, Heli-Präferenz, G-KTW-Pflicht,
    Blockzeiten (HITT)
  - `status.json`: 00–7, 88, 08/09/10 + Platzhalter 91–95 (`estimated`), Farb-Tokens
  - `stations.json`: 10 DSt Nord (+Stützpunkt Oberndorf) + 16 DSt Süd + 2 Leitstellen,
    Koordinaten manuell (estimated), Staffing-Modell
  - `vehicles.json`: 156 Fahrzeuge (komplette belegte Flotte + §12b-Schätzflotten),
    Dienstzeiten inkl. Hof-Regel, Winterfenster, Reserve (5.80), NEF-101-Spezialregel
  - `hospitals.json`: 12 Kliniken inkl. Fähigkeiten + Positionscodes 08/09/10 + BKH
    St. Johann i.T. (überregional)
  - `helicopters.json`: 5 Helis, alle daylightOnly, Saisonmonate
  - `balancing.json`: Anrufraten (Nord 800/160, Süd 430/85), Tagesganglinie, Wochentags-/
    Saisonfaktoren, Routing-Parameter (1.35/60/35/+30 %/Heli 220+3 min), Ausrückzeiten,
    Generator-Gewichte
- `npm run validate-data` (tsx): Schema-Parse + Kreuzvalidierung (eindeutige Funkrufnamen,
  Referenzen Station/Code/KH) — in CI integriert
- Datenbrowser-Route `/#/debug/data` mit Tabellenansicht + Live-Kreuzvalidierung

**Wie getestet:** `npm run validate-data` ✓ (156 Fahrzeuge, 0 Probleme) · `npm run lint` ✓ ·
`npm test` ✓ (24 Tests: Parsen, Pflichtfelder, Funknamen-Eindeutigkeit, Typenkreis,
SoSi-Flags, MANV-Schwellen, Hof-Regel, Anomalie-Fixes) · `npm run build` ✓ ·
`npm run smoke` ✓ (2 E2E inkl. Datenbrowser).

**Offene Punkte:** Echte Sonderstatus-Ziffern, NAW-Funkcodes, Flachgau-Kennungen-Reihenfolge
bleiben Insider-offen (alle als estimated geflaggt). Ein Test fand die Quellen-Anomalie
5.10-108 (EL im 1XX-Kreis) — quellentreu übernommen.

## M2 — Karte & Fenster-Manager (2026-06-11)

**Was:**
- **Fenster-Engine** (`src/windows/`): Zustand-Store (UI-frei, getestet) mit Drag,
  Resize (Min-Größen), Snap-Raster 8 px, Minimieren, Schließen/Öffnen, Z-Order/Fokus;
  `WindowFrame` mit minimalem Chrome nach DESIGN_SYSTEM (Pointer-Capture-Drag).
- **Layout-Persistenz**: Autosave (debounced) in IndexedDB (`idb`, Store `layouts`) +
  benannte Presets (speichern/laden) über Taskbar-UI.
- **Lagekarte**: MapLibre GL, dunkler Vektorstil (OpenFreeMap, ohne Key) mit
  Raster-Fallback (Carto dark) bei Stil-Ladefehler; DOM-Marker mit Token-Farben für
  27 Wachen, 12 Kliniken, 5 Heli-Basen inkl. Popups; ResizeObserver für Fenster-Resize.
- 5 Spielfenster: Lagekarte, Einsatzliste (Stub), Ressourcen (Flotte aus Daten),
  Funkfeld (Stub), Protokoll (Stub) auf neuer Route `/#/spiel`.
- GamePage + DataBrowser lazy geladen (MapLibre raus aus dem Initial-Bundle).

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (31 Tests, davon 7 Fenster-Store:
Snap, Fokus/Z-Order, Min-Größen, Layout-Roundtrip, Minimize/Reopen) · `npm run build` ✓ ·
`npm run smoke` ✓ (5 E2E: Fenster verschieben → Reload → Position erhalten;
Minimieren/Schließen/Reopen via Taskbar; Preset speichern).

**Offene Punkte:** Kartenstil-Feinschliff (eigener Dispatch-Stil) für den Design-Pass;
Fahrzeug-Marker folgen in M3.
