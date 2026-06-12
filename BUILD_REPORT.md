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

## M6 — KI-Anrufer (Tier 2+3) & TTS (2026-06-12)

**Was:**
- **Engine-Abstraktion** (`src/llm/`): OpenAI-kompatibles `CallerEngine`-Interface
  (Tauri-ready, ARCHITECTURE.md) mit vier Implementierungen:
  WebLLM-WebWorker (Llama-3.2-3B default, 1B-Option, Lade-Progress,
  Lazy-Chunk — lädt erst bei Nutzer-Opt-in), Tier-3-Endpoint (URL+Key,
  localStorage, /v1-Autovervollständigung, Verbindungs-Probe), deterministische
  Mock-Engine (CI ohne GPU) und Tier 1 als Default („Light-Modus ohne KI").
- **System-Prompt aus dem Szenario** nach AI_CALLER_TECH-Regeln: nur Wahrheits-Fakten,
  nichts erfinden, verschwiegene Infos nur auf konkrete Frage, kurz antworten,
  Rolle/Emotion/Sprache (engl. Touristen), Panik-Beruhigungs-Verhalten.
- **Gesprächs-Pipeline**: Frage-Buttons UND Freitext laufen durch denselben Pfad;
  Freitext-Klassifikator (Regex-Katalog) mappt getippte Fragen auf das Frageschema,
  damit Erfassung + Scoring identisch funktionieren; „Anrufer spricht…"-Indikator;
  Tier-1-Fallback antwortet skriptbasiert.
- **Settings-Dialog** (Taskbar ⚙): KI-Stufe, Modellwahl, Endpoint-Felder,
  Fortschrittsbalken, Fehleranzeige; Einstellungen persistiert (localStorage).
- **TTS**: Web-Speech-Toggle, bevorzugt de-AT-Stimme, liest Anrufer-Antworten.

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (110 Tests; neu: Prompt-Builder-Regeln,
Freitext-Klassifikator, Mock-Engine, Endpoint-Engine mit gemocktem fetch inkl.
Header/URL/Fehlerpfad) · `npm run build` ✓ · `npm run smoke` ✓ (14 E2E; neu:
Settings→Mock-WebLLM aktivieren→Freitext-Dialog; Light-Modus-Freitext über Klassifikator).

**Offene Punkte:** Echte WebLLM-Läufe sind nur manuell testbar (GPU/Download) —
in CI per Mock ersetzt. Tier-2-JSON-Live-Scoring (AI_CALLER_TECH „Mini-Check")
übernimmt der wahrheitsgetriebene Capture-Pfad.

## M7 — Funk bidirektional (2026-06-12)

**Was:**
- **Funkprotokoll-Engine** (`engine/funk.ts`) EXAKT nach GAME_DATA §10c:
  „[Gerufener] von [Rufer]" / „kommen" / „Verstanden", Kurzrufnamen ohne 5.-Präfix;
  Dialoge als Sprecher-Zeilen.
- **Statusgetriebener Funkfeed**: Eintreffmeldung (Status 3), Transportmeldung (Status 4),
  **NA-Nachforderung** bei kritischem Einsatz ohne NA-Mittel → Button „A4-Nachforderung
  anlegen" erzeugt den A4-Auftrag am selben Ort (GAME_DATA-Beispiel „Laufende CPR…"),
  **Polizei-Nachforderung** → Button alarmiert POL, **Sprechwunsch** bei Status 5 mit
  Quittieren-Mechanik (Inhalt erst nach Quittung).
- **Aktives Anfunken**: Fahrzeugwahl (auch via „Anfunken" im Ressourcenmonitor),
  Schnellphrasen „Status?", „Eintreffzeit?" (echte ETA aus der Sim), „Abbruch"
  (führt Einsatzabbruch wirklich aus; „Negativ, Patient an Bord" bei Status 4/5),
  „NA abkömmlich?"; Freitext-Funksprüche — Antwort via LLM (wenn aktiv, mit
  Besatzungs-Systemprompt) oder Template, immer protokollkonform.
- **Töne**: Funk-Quittungston je Spruch, Pager-Gong bei Alarmierung (Status 1).
- Funkfeld-Panel neu (Dialog-Feed + Compose), Status-Log bleibt im Protokoll.

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (123 Tests; neu: 12 Protokoll-/Trigger-/
Quick-Reply-Tests + 2 Integrationstests A4-Anlage & POL-Alarm) · `npm run build` ✓
(WebLLM-Chunks bleiben lazy, Entry 164 kB) · `npm run smoke` ✓ (17 E2E; neu:
protokollkonformer Status-Funkspruch ohne 5.-Präfix, Freitext-Template-Antwort,
Anfunken-Vorauswahl aus dem Ressourcenmonitor).

**Offene Punkte:** Stil-Bonus für Spieler-Funkdisziplin kommt mit dem Scoring (M8).

## M8 — Spielfluss & Scoring (2026-06-12)

**Was:**
- **Hauptmenü**: Leitstelle Nord/Süd, 8h-Schicht/Endlos, Rolle (Vollbetrieb /
  Calltaker mit KI-Disponent / Disponent mit KI-Calltaker), Schwierigkeit
  (entspannt/realistisch/albtraum — Anrufrate & Queue-Limit), Jahreszeit (Monat),
  Tag-/Nachtschicht-Beginn; Welt-Reset bei Schichtstart.
- **Zeitsteuerung**: Pause/1×/2×/4× + „Sprung zum nächsten Ereignis" (⏭).
- **KI-Partner**: KI-Calltaker verwandelt generierte Anrufe nach 30–90 s in
  Aufträge mit realistischen Unschärfen (falsches Stichwort, unklare Adresse,
  Duplikat-Zuordnung); KI-Disponent disponiert offene Aufträge konservativ nach
  AO (alle Slots, Partner-Vorschläge, Retry bei Mittelmangel).
- **Outcome-Engine**: Überleben = f(Kategorie-Schwere, Zeit-bis-Mittel,
  NA-Verfügbarkeit, T-CPR-Bonus, Zielklinik-Eignung), deterministisch je Auftrag;
  T-CPR-Flag kommt aus der EH-Anweisung bei REA-Anrufen.
- **Debriefing**: harte, konkrete Protokoll-Nachrichten („Hilfsfrist um X min
  überschritten", „Kein Notarzt am Einsatzort", „Patient verstorben…").
- **Schichtreport**: Hilfsfristquote (95-%-Ziel), Stichwortgenauigkeit (Wahrheit aus
  dem Szenario), Fehldispositionen, Outcomes, Anrufstatistik, Note 1–5 mit Klartext;
  problematische Einsätze gelistet; **Historie** der letzten Schichten in IndexedDB
  mit Token-gestyltem SVG-Balkendiagramm (Recharts-frei).
- **Welt aktiv**: Tagesganglinie × Wochentag × Saison × Schwierigkeit steuert die
  Anrufrate; stündliche Wetter-Drift (Heli-Sperre) mit Meldungen.
- Schichtende (8h) öffnet den Report automatisch; „Schicht beenden" jederzeit.

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (137 Tests; neu: 9 Outcome-Tests
über je 400 Seeds — Zeitzerfall, T-CPR-Differenz, NA-Effekt; 5 Scoring-Tests inkl.
Notengrenzen und ÜBUNG-Ausschluss) · `npm run build` ✓ · `npm run smoke` ✓ (21 E2E;
neu: Süd-Winterschicht-Start inkl. Heli-im-Dunkeln-Check, Zeitsprung,
Report-Dimensionen + Rückkehr ins Menü, KI-Disponent disponiert in Calltaker-Rolle).

**Gefunden & gefixt:** Ressourcen-Filter fand Helis nicht über den Anzeigenamen.

**Offene Punkte:** Story-Arcs/Achievements (M10); Coop-Team-Score nutzt den Report (M9).

## M9 — Coop, 2 Spieler (2026-06-12)

**Was:**
- **Host-authoritative Architektur** (ARCHITECTURE.md): Der Host simuliert alles;
  der Gast spiegelt per 1-Hz-Sync (Aufträge, Einheiten-Status+Positionen, Uhr,
  Anrufe, Funk, Protokoll) und sendet Aktionen über eine Whitelist
  (Store-Methoden-Override beim Gast — Panels bleiben unverändert).
- **Rollensplit**: Host wählt Calltaker oder Disponent, Gast bekommt die andere
  Rolle; Gast erzeugt keine eigenen Anrufe und tickt keine lokale Sim.
- **Drei Transporte**: PeerJS-Cloud-ID (lazy geladen), manueller WebRTC-
  Offer/Answer-Code (Copy-Paste, STUN, null Infrastruktur) und „Lokal (2 Fenster)"
  via BroadcastChannel (Raum-Code) — letzterer auch der deterministische CI-Pfad,
  weil die Sandbox WebRTC-UDP blockt (ANNAHMEN.md M9).
- **Team-Score**: Schichtreport entsteht auf dem Host und wird dem Gast als
  gemeinsames Ergebnis zugestellt.
- Verbindungs-UI im Taskbar-Dialog (👥) mit Statusanzeige.

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (137) · `npm run build` ✓ ·
`npm run smoke` ✓ (23 E2E; neu: zwei Seiten verbinden per Raum-Code →
Host-Auftrag erscheint beim Gast → Gast disponiert ein Mittel → Host-Status
wechselt auf „disponiert"; manueller WebRTC-Flow erzeugt Offer/Answer-Codes).

**Offene Punkte:** Echte P2P-Verbindung (Cloud/manuell) ist umgebungsabhängig
manuell zu testen; Gast-Marker ohne Interpolation (Phase 2).

## M10 — Editor, Story, Polish (2026-06-12)

**Was:**
- **Szenario-Editor** (`/#/editor`): Einsätze mit Zeitpunkt, Hauptbeschwerde,
  Ort/Straße (Orts-Index), Personenzahl, Emotion und eigenem Anrufer-Skript;
  Export/Import als validierte JSON-Datei (`*.rls-uebung.json`); „Als ÜBUNG
  starten" spielt die geskripteten Anrufe ab — Aufträge laufen als ÜBUNG ohne
  Scoring (GAME_DATA §4).
- **2 dezente Story-Arcs** (flag-basiert, mehrschichtig, IndexedDB): Brandserie
  Lehen (NORD) und der vermisste Wanderer (SÜD) mit Auflösungs-Meldungen.
- **Achievements** (6, lokal) mit Unlock-Toast und Liste in den Einstellungen.
- **Sound-Mixer** (Gesamt/Telefon/Funk/Gong) in den Einstellungen.
- **Onboarding-Tutorial**: geführte erste Schicht in 8 Schritten mit
  Auto-Advance (Anruf → Abfrage → Hauptbeschwerde → Auftrag → Disposition →
  Status/Funk → Report), Overlay oben mittig, jederzeit abbrechbar.
- **A11y-Pass**: durchgängige aria-Labels, `role="log"`/`aria-live` für Funk- und
  Gesprächs-Feeds, sichtbare Fokus-Ringe, Status & Marker tragen Ziffern/Formen
  zusätzlich zur Farbe (Farbfehlsicht), `lang="de-AT"`.
- **README** mit Screenshots (Hauptmenü, Cockpit, Editor) + Spielanleitung,
  Lizenz-/Markenhinweisen; Screenshot-Generator als gateter Playwright-Spec.
- **Finale Smoke-Suite**: Definition-of-Done-Test spielt die komplette
  Tutorial-Schicht End-to-End inkl. Funkprüfung, Schichtreport und
  Achievement-Toast; Editor-Übung-Flow + Datei-Export.

**Wie getestet:** `npm run lint` ✓ · `npm run validate-data` ✓ · `npm test` ✓
(141 Tests) · `npm run build` ✓ · `npm run smoke` ✓ (26 E2E).

**Gefunden & gefixt:** Tutorial-Overlay verdeckte den „Auftrag anlegen"-Button
(nach oben mittig verlegt).

---

# ABSCHLUSSBERICHT (M0–M10 komplett)

**Definition of Done erfüllt:** Eine Person ohne Vorwissen kann auf der
GitHub-Pages-URL Nord wählen → Tutorial-Schicht spielen → Anruf annehmen und
abfragen (Dialogbaum sofort, KI optional) → Auftrag erzeugen → disponieren
(AO + SoSi nach codes.json) → Status-Lauf & Funk verfolgen, Fahrzeuge anfunken →
Outcome + Debriefing sehen → Schichtreport mit Note erhalten. Layouts persistent.
Ohne Kosten, ohne Server, ohne Eingriff. (Automatisiert nachgewiesen durch den
Definition-of-Done-E2E-Test.)

**Stand:** 141 Unit-Tests, 26 E2E-Tests, Lint/Build/Datenvalidierung grün.
11 Meilenstein-Tags (m0–m10). CI: Lint → validate-data → Test → Build → Smoke →
Pages-Deploy.

**Bekannte Limits (Phase 1):**
- Fahrzeiten: Luftlinie × Umwegfaktor (kein Straßenrouting) — OSRM-Adapter-
  Interface vorbereitet (`engine/routing.ts`).
- WebLLM real nur mit WebGPU-Gerät nutzbar (CI nutzt Mock); Qualität kleiner
  Modelle schwankt — Wahrheit bleibt Tier-1-gesichert.
- Coop: P2P (Cloud/manueller Code) ist umgebungsabhängig (NAT); lokaler
  2-Fenster-Modus immer verfügbar. Gast-Marker ohne Interpolation.
- Viele Flotten-/Dienstzeit-Werte sind als `estimated` geflaggt (Insider-Korrektur
  willkommen, siehe research/OPEN_QUESTIONS.md).
- Sonderstatus-Ziffern 91–95 sind Spiel-Platzhalter (GAME_DATA §10b).

**Phase-2-Hinweise (ARCHITECTURE.md):**
- Tauri-Build (Win/macOS): KI ist bereits hinter OpenAI-kompatiblem Interface
  (Ollama-Sidecar andocken), Fenster-Engine abstrahiert, kein Browser-only-Hack
  im Kern.
- OSRM-Routing, Whisper-Push-to-Talk, echtes Multi-Monitor, F-Tasten-Belegung,
  Neural-TTS (transformers.js), Positions-Codes Süd, weitere Sonderlagen
  (MANV-Bereitstellungsraum-UI, Krisen-Callcenter).

**Deployment:** CI auf `main` grün (build-test + deploy). GitHub Pages wurde per
API aktiviert (`build_type: workflow`); das Repo wurde GitHub-seitig zu
`RLS-SIM-Salzburg` umbenannt — dank relativer Vite-`base` ohne Folgen.
**Live:** <https://matthiashollinger-netizen.github.io/RLS-SIM-Salzburg/>

**STOP** — alle Meilensteine M0–M10 abgeschlossen.

## Großer Rework nach User-Feedback (2026-06-12)

Feedback von Matthias (11 Punkte, „derzeit kaum spielbar") — alle adressiert:

1. **Karte übersichtlicher**: Layer-Steuerung auf der Karte (Einsatzfzg./KTW-Familie/
   Wachen/Kliniken/Heli-Basen — KTW-Clutter standardmäßig aus, im Einsatz befindliche
   Fahrzeuge immer sichtbar), Infrastruktur-Marker klein & dezent, Fahrzeug-Marker mit
   Statusfarbe+Ziffer+Typform und Rufnamen-Label ab Zoom 11, Einsatz-Glow.
2. **Standorte korrekt**: Einmaliges Nominatim-Geocoding (Buildzeit) — echte
   RK-Dienststellen-Gebäude und Klinik-Adressen statt Ortszentren (`scripts/geocode.ts`).
3. **Standardisiertes Abfrage-Schema**: Abfragemaske als geführtes 5-Schritte-Schema
   (Notfallort → Geschehen/Hauptbeschwerde → Personen&Rückruf → Vitalfragen →
   Detailfragen) mit Fortschritts-Häkchen und Hervorhebung des aktuellen Schritts.
4. **Selbst funken**: Eingehende Funkrufe verlangen „kommen" und „Verstanden" vom
   Spieler; Aktionen (A4/Polizei) erst nach Annahme des Rufs.
5. **Kein Funk-Spam**: Nur Erstmeldung des ersten Mittels, Nachforderungen und
   Sprechwünsche; Transport-/Folge-Status laufen still ins Protokoll.
6. **Ein Patient = ein Transport**: Transport-Allokation je Auftrag (Heli-Priorität);
   Heli fliegt, RTW unterstützt; Wechsel bei Abbruch; T-Badge im UI.
7. **Sortierung + Karten-Fokus**: Ressourcen-Tabelle nach Rufname/Typ/Status/Wache
   sortierbar; Doppelklick (Fahrzeuge & Einsätze) zentriert die Karte; neuer Auftrag
   fokussiert automatisch.
8. **ELS-Alarmierung**: Zweistufig zuteilen → ALARMIEREN (gesammelt, Pager-Gong),
   Zuteilungen entfernbar — KI-Disponent nutzt denselben Flow.
9. **Reaktiverer Anrufer**: Antwortbanken für alle 24 Beschwerden, Wiederholungs-
   Gedächtnis, In-Character-Unbekannt-Antworten, Freitext-Matching der Detailfragen,
   sichtbarer Skript/KI-Indikator mit Hinweis auf WebLLM-Aktivierung.
10. **Aufträge editierbar**: Inline-Editor (Kategorie, Schwere, Personen, Einsatzort-
    Korrektur mit Re-Routing der anfahrenden Mittel, Notizen); Code-Neuableitung
    respektiert manuelle Übersteuerung.
11. **Gesamt**: Tutorial an neuen Flow angepasst, Coop-Whitelist erweitert,
    alle Tests aktualisiert.

**Wie getestet:** `npm run lint` ✓ · `npm run validate-data` ✓ · `npm test` ✓
(158 Tests; neu: Transport-Allokation, 2-Stufen-Dispo-Integration gegen die echte Sim
inkl. Heli-transportiert/RTW-unterstützt, Auftrag-Edit/Re-Routing, interaktiver
Funk-Flow inkl. Funkdisziplin-Sperre, Anrufer-Wiederholungen/Unbekannt/Detail-Matching)
· `npm run build` ✓ · `npm run smoke` ✓ (26 E2E, DoD-Test bedient jetzt den
interaktiven Funk selbst).

---

## Rework 2 — zweites Spieler-Feedback (2026-06-12)

**Was:**
1. **Straßen-Routing**: OSM-Straßengraph (Buildzeit-Export, Land Salzburg) +
   A* im Browser — Bodenfahrzeuge folgen jetzt dem Straßenverlauf (Marker UND
   Fahrzeit), Restrouten werden als gestrichelte Linien auf der Karte gezeigt.
   Nur Hubschrauber fliegen Luftlinie. Fallback Luftlinie×1,35 bleibt.
2. **Relevanter Funk + Einsatzinfos**: Nur noch Erstmeldung/Nachforderung/
   Sprechwunsch rufen; zeitgestempelte Einsatzinfos im Auftrag frei ergänzbar.
3. **Freie Mittelwahl**: Suchfeld im Auftrag findet JEDES verfügbare Mittel
   (Rufname/Typ/Wache, ETA-Anzeige) — nicht nur die AO-Vorschläge.
4. **Umdisponieren**: Mittel aus laufendem Einsatz (vor Transport) per Klick zu
   anderem Auftrag; Quell-Auftrag erhält Info.
5. **NA abziehen**: „NA abkömmlich?"-Funkfrage → bei Freigabe Abzieh-Aktion.
6. **Kein NA verfügbar**: Info am Auftrag, RTW übernimmt inkl. Transport.
7. **A4 = Aufwertung**: nie bei A/MANV; B–E mit Wahrheits-Schwere hoch ohne NA
   → bestehender Auftrag wird A4 (kein Duplikat).
8. **Offizielles Abfrageschema**: eigenes Fenster (Ja/Nein-Fragen, Kernpunkte),
   separates Gesprächs-Fenster; Antworten werden MANUELL notiert; Auftrag bleibt
   voll editierbar inkl. Kategorie-Code (KRANK/STILL …) und Freitext.
9. **KI-Anrufer konsistent**: Lagevarianten binden Text+Details+Rolle+Alter —
   Widersprüche eliminiert.
10. **Partner auf der Karte + Lagefreigabe**: POL/FW/WR/BR-Marker am EO sobald
    alarmiert; bei Lagefreigabe-Kategorien Bereitstellungsraum-Mechanik:
    warten → Polizei-Funk „Lage gesichert" → Disponent gibt Anfahrt frei.
11. **Coop sichtbar**: Hauptmenü-Eintrag „Coop (2 Spieler)" startet Schicht und
    öffnet den Verbindungsdialog (PeerJS-Cloud / manueller Code / lokal);
    Guest-Whitelist um neue Dispo-Aktionen erweitert.

**Wie getestet:** `npm run lint` ✓ · `npm test` ✓ (165 Tests; neu: A*-Graph,
Straßen- vs. Luftlinien-Routing, Bereitstellungsraum-Hold/Release-Lifecycle,
A4-Aufwertungs-Semantik) · `npm run build` ✓ · `npm run smoke` ✓ (26 E2E,
DoD-Flow mit Gespräch/Schema-Split und manuellem Notieren).

**Offene Punkte:** Award-Polish (eigene Features) folgt als nächster Schritt.
