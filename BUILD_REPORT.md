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

## M3 — Fahrzeug-Engine (2026-06-12)

**Was:**
- `src/engine/` (UI-frei): `geo` (Haversine, Point-in-Polygon, Lerp), `routing`
  (deterministisches Fahrzeitmodell nach CLAUDE.md §3, OSRM-Interface vorbereitet),
  `time` (Sim-Uhr, Saison, Tageslicht-Tabelle Salzburg, Nachtfenster), `duty`
  (Dienstzeiten inkl. Übernacht-Fenster, Saison, Hof-Regel), `status` (exaktes
  Salzburg-Schema 00→1→…→7→00, 88→08/09/10, 91–95, Übergangsvalidierung),
  `rng` (seedbar), `vehicleSim` (kompletter Lebenszyklus: Spawn/Despawn nach Dienst,
  Ausrückzeiten nach Staffing + NEF-101-Regel, Bewegung mit Interpolation,
  Fahrzeugcheck 92 bei Schichtstart, Sonderstatus mit Blockzeit, Reserve-Aktivierung,
  Vorhaltepositionen, Einsatzabbruch).
- Spieluhr (Zustand-Store) + globaler Loop (250 ms-Ticks, Geschwindigkeit 0/1/2/4×),
  Uhr + Tempo-Steuerung in der Taskbar.
- Karte: Fahrzeug-Marker rAF-getrieben außerhalb von React (Statusfarbe + Statusziffer +
  Typ-Form, Jitter gegen Stapelung), Popup mit Aktionen (Position senden, Probealarm).
- Ressourcenmonitor live: Filter (Text/Region/außer Dienst), Auswahl mit Aktionsleiste,
  Status-Badges (Farbe + Ziffer + Form je Status-Art — farbfehlsichttauglich).
- Funkfeld/Protokoll zeigen Status-/System-Feed (Event-Log-Store, Vorstufe M7).
- Debug-„Probealarm" (ÜBUNG) zum Durchspielen des Lifecycles vor M4.

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (58 Tests: 27 neue Engine-Tests für
Lifecycle-Übergänge, Dienstzeit-Logik inkl. Hof/Übernacht/Saison/Split-Schichten,
Routing inkl. SoSi-Faktor/Stadt-Polygon/Heli, kompletter Sim-Durchlauf 00→…→00,
3→6, Positionen, 92, 94+Reserve, Abbruch, Dienstende-Verhalten) · `npm run build` ✓ ·
`npm run smoke` ✓ (8 E2E: Uhr läuft/pausiert, Live-Monitor + Probealarm + Feed,
Hof-Fahrzeug tagsüber nicht gelistet).

**Gefixte Flakes:** Layout-Restore-Test wartet jetzt deterministisch auf den
IndexedDB-Write; Probealarm-Test pinnt Zeile per Rufname (Live-Locator-Falle).

**Offene Punkte:** Heli-Einheiten fliegen erst mit M4-Dispo; Funkfeld bekommt in M7
echte Funksprüche.

## M4 — Einsatz-Kern / Disponent (2026-06-12)

**Was:**
- **Sim-Refactor auf `SimUnit`**: Bodenflotte + 5 Hubschrauber laufen in derselben
  Engine; Heli-Dienst = Saison + sunrise–sunset (GAME_DATA §8), Wetter-Flag (Taskbar ☀/⛈)
  blockt neue Heli-Dispositionen.
- **AO-Engine** (`engine/ao.ts`): Code-Ableitung aus Kategorie (+Severity, akuitätsbasiert),
  MANV-Prüfung ab 6 Personen mit offiziellen Schwellen, SoSi aus codes.json,
  Partner-Vorschläge (FW/POL/WR/BR), Lagefreigabe-Hinweis, Heli-Empfehlung,
  Mittelzusammensetzung je Code inkl. MANV-Skalierung und G-KTW-Pflicht (SCHWER).
- **Mittelsuche** (`engine/dispatchSearch.ts`): nächstes geeignetes Mittel nach
  Typ+Status+Fahrzeit (Ausrückzeit + Routing), N-KTW-Sonderlogik, Heli-Wetter-Filter.
- **KH-Matching** (`engine/hospitalMatch.ts`): Ranking nach Fahrzeit mit
  Eignungs-Markierung + fehlenden Fähigkeiten („nächstes ≠ richtiges").
- **Auftrag-Modell + Dispatch-Store**: Klasse+Ziffer+Kategorie+Ort+Merkmalskette,
  Alarmtext exakt `CODE STADTTEIL STRASSE` (GAME_DATA §3a), Hilfsfrist-Deadline,
  Code-Übersteuern, Fahrzeug-Zuteilung→Sim-Dispatch (Transport ans gewählte/automatische
  KH, NA/EL ohne Transport), KH-Wechsel aktualisiert laufende Aufträge,
  Einsatzabbruch, Statusereignisse → Auftragszustand (offen→disponiert→laufend→abgeschlossen).
- **Orts-Index** `places.json` (~65 Orte, reale Straßennamen, estimated) für
  Alarmtexte und die spätere Adresssuche (M5).
- **Einsatzliste-UI**: Liste mit Hilfsfrist-Countdown (rot bei Überschreitung,
  ✓/✗ nach Eintreffen), Code-Chips mit SoSi-Optik, Detail mit AO-Slots + Top-Kandidaten
  (ETA in min, Alarmieren-Button), Partner-Toggles, Zielklinik-Auswahl mit ⚠-Warnung,
  MANV-Flag, ÜBUNG-Chip; Debug-Generator „Neuer Einsatz (Test)".

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (82 Tests; neu: 13 AO inkl. aller
offizieller MANV-Schwellen, 5 KH-Matching inkl. Psych-Zell-Falle, 6 Mittelsuche inkl.
Heli Tag/Nacht/Saison/Wetter) · `npm run build` ✓ · `npm run smoke` ✓ (10 E2E; neu:
Einsatz erzeugen→AO→disponieren→KH-Liste; Code-Override ändert SoSi/Hilfsfrist-Timer).

**Offene Punkte:** Scoring der Über-/Unterdisposition und Sekundärtransporte folgt in M8;
echte Aufträge kommen ab M5 aus der Notrufabfrage.

## M5 — Calltaker & Szenario-Engine Tier 1 (2026-06-12)

**Was:**
- **Szenario-Generator** (`engine/scenario.ts`): gewichtete Kategorien aus balancing,
  Anruf-Mix (Notfall/KT/Rückfrage/Irrläufer/Taschenwähler), Wahrheit-Objekt
  (Kategorie, Personen, Vitalstatus, Lagetext, Ort aus Orts-Index),
  Anruferprofil (Rolle/Emotion/Sprache/kennt Adresse/verschweigt-bis-gefragt),
  Störungen (falsche Hausnummer, Panik, legt auf), AML-Setup, Duplizitätsanrufe
  zu offenen Einsätzen — komplett seedbar.
- **Tier-1-Anrufer** (`engine/callerScript.ts`): Dialogbaum-Fallback, ohne LLM voll
  spielbar; Antworten nur aus der Wahrheit, verschwiegene Infos nur auf passende Frage,
  Panik-Mechanik (Beruhigen), SMS-Klick-Verhalten.
- **Abfragemaske** (`engine/abfrage.ts` + AbfragePanel): standardisiertes Frageschema
  (Phase 1/2 + 2 kategorie­spezifische Detailfragen je Hauptbeschwerde, 24 Beschwerden),
  Anruferrolle-Buttons, KT-Triage (HEIM/DIALYSE/AMB/STAT/EINWEISUNG), Transcript,
  Merkmalskette live im offiziellen ELS-Stil, Stichwort-Vorschau, Auftrag-Übergabe an
  die Dispo (keine-Atmung→STILL-Override).
- **Ortungskaskade**: AML-Punkt nach 10–30 s mit Genauigkeitsradius auf der Karte
  (GeoJSON-Kreis), Ortungs-SMS-Button (Anrufer entscheidet), Netzbetreiber-Abfrage
  (3 min, grob), Festnetz-Anschlussadresse vorausgefüllt; „Ortung übernehmen".
- **Adress-Fuzzy-Suche** über den Orts-Index (umlaut-normalisiert, Token-Matching).
- **Anruf-Queue** mit synthetischem Klingelton (WebAudio, kein Asset), Wartezeit,
  Annehmen; Anrufgenerator im Game-Loop (Poisson, Tagesganglinie, Queue-Deckel).
- **Duplikat-UI**: offene Einsätze < 2 km werden im Gespräch angezeigt → Zuordnen.
- Karte: Einsatzort-Marker (pulsierend, klick→Auswahl) + AML-Kreis.

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (102 Tests; neu: 6 Generator-Verteilung
über 2000 Szenarien, 14 Abfrage/Skript/Fuzzy inkl. STILL-Override, Hausnummer-Störung,
Panik-Mechanik) · `npm run build` ✓ · `npm run smoke` ✓ (12 E2E; neu: kompletter
Calltaker-Flow Anruf→Abfrage→Hauptbeschwerde→Auftrag→Einsatzliste; Fuzzy-Adresse).

**Offene Punkte:** Telefonreanimations-Minigame (M8-Outcome-Bonus als T-CPR-Flag),
englischsprachige Anrufer nutzen aktuell nur den Begrüßungstext (Tier 2 in M6).
