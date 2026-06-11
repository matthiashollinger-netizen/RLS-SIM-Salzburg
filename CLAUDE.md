# CLAUDE.md — Leitstellen-Simulator Salzburg
## Master-Auftrag für Claude Code (Modell: Fable) — VOLLAUTONOM

Du baust einen realitätsnahen **Leitstellen-Simulator des Salzburger Rettungsdienstes** als Web-App. Der Mensch (Matthias) greift NICHT ein: **keine Rückfragen, keine Wartezeiten.** Du arbeitest alle Meilensteine M0–M10 in Reihenfolge ab, testest selbst, committest selbst und dokumentierst selbst.

---

## 0. EISERNE REGELN

1. **Autonomie:** Bei Unklarheit triffst du die konservativste realistische Annahme und protokollierst sie in `ANNAHMEN.md` (Datum, Frage, Entscheidung, Begründung). Niemals blockieren, niemals fragen.
2. **Quellen-Hierarchie (absteigend verbindlich):**
   a) `research/GAME_DATA.md` — Abschnitte mit ⭐/„offiziell/Insider" sind FAKTEN (Einsatzcodes A–E+MANV, Statuscodes 00–7/88/08/09/10, Kategorien, Funkrufnamen, Flotten „belegt")
   b) übrige research/-Dokumente (MECHANICS, AI_CALLER_TECH, ARCHITECTURE, DESIGN_BRIEF)
   c) als „SCHÄTZUNG/Platzhalter/Hypothese" markierte Werte → übernehmen, aber in Daten-JSONs mit `"estimated": true` flaggen
   d) eigene Annahmen → ANNAHMEN.md
3. **Secrets:** Im Projektordner kann `secrets/` mit einem API-Key liegen. **NIEMALS committen.** Allererste Aktion in M0: `.gitignore` mit `secrets/`, `*.key`, `.env*`, `node_modules/`, `dist/`. Vor JEDEM Push: `git status` prüfen, dass nichts Geheimes staged ist.
4. **Branding:** KEIN Rotkreuz-Logo, kein rotes Kreuz-Symbol, nicht „Rotes Kreuz" im Produktnamen. Produktname: **„RLS-SIM Salzburg"** (Untertitel: „Rettungsleitstellen-Simulator") — falls Matthias einen anderen Namen wählt, gilt der Name in DIESER Zeile. Footer-Disclaimer: „Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes." (Details: ARCHITECTURE.md)
5. **Scope:** NUR Phase 1 (Web). Kein Tauri, kein Backend-Server, keine Bezahl-APIs. Architektur aber Tauri-ready halten (KI hinter OpenAI-kompatiblem Interface, Fenster-Engine abstrahiert).
6. **Design-Compliance:** `design/tokens.css` + `design/DESIGN_SYSTEM.md` sind GESETZ. Keine hartcodierten Farben/Abstände in Komponenten — nur CSS-Variablen. Existiert `design/` noch nicht oder unvollständig: leite ein provisorisches Token-Set strikt aus `research/DESIGN_BRIEF.md` ab, lege es als `design/tokens.css` mit Kommentar `/* PROVISORISCH — durch Claude-Design-Pass ersetzen */` an und baue dagegen.
7. **Sprache:** UI-Texte Deutsch (AT). Code, Kommentare, Commits Englisch.

## 1. TECH-STACK (fix, nicht verhandelbar)
React 18 + Vite + TypeScript (strict) · Zustand (State) · MapLibre GL JS + OSM (dunkler Style, Raster-Fallback) · @mlc-ai/web-llm · Web Speech API (TTS) · PeerJS (Coop) · IndexedDB via `idb` · Vitest (Unit) + Playwright (Smoke, headless) · ESLint+Prettier · GitHub Actions: Lint+Test+Build → Deploy auf GitHub Pages (`vite.config` base entsprechend Repo-Name; Hash-Router verwenden!).

## 2. DATENEBENE (M1) — JSON unter `src/data/`
Extrahiere ALLES aus GAME_DATA.md in typisierte JSONs + Zod-Schemas:
- `codes.json` — Einsatzklassen A1–A4, B1–B4, C1–C6, D1–D6, E1–E6, MANV1–4 mit `{code, label, sosi: boolean, class: "A".."E"|"MANV"}`
- `categories.json` — alle Kategorien (STILL…WASSER + D/E-Liste) mit `defaultClass`, `partner: ["FW","POL","WR","BR"]`, `manvCheck`, `beschreibung`
- `status.json` — 00,1,2,3,4,5,6,7,88,08,09,10 (+ Platzhalter 91–95 `estimated:true`) mit Farb-Token-Referenz
- `stations.json` — alle Dienststellen Nord+Süd: id, name, dstCode, funk (5.XX), lat/lon (recherchiere Adress-Koordinaten via OSM-Daten/Nominatim-Export zur Buildzeit oder hinterlege manuell aus Adressen in GAME_DATA; KEINE Live-API zur Laufzeit), `estimated`-Flag
- `vehicles.json` — komplette Flotte (belegt + geschätzt) mit funkrufname, typ (NEF/NAW/RTW/ITW/KTW/GKTW/BTW/MTW/EL), homeStation, dienstzeiten `[{days,from,to}]`, besonderheiten (z.B. Hof nur Nacht+WE!)
- `hospitals.json` — Kliniken mit Fähigkeiten (stroke, trauma, paed, psych, cardiac, schockraum), lat/lon, Status-Positionscode (LKH=08, UKH=09, CDK=10)
- `helicopters.json` — C6, Martin 1, Martin 10 (Winter), Alpin Heli 6, Martin 6 (Saison) mit daylightOnly:true, Saison, Basis
- `balancing.json` — Anrufraten/Tagesganglinie aus GAME_DATA „Jahreszahlen 2024" (Nord ~800/Tag, 160 Notrufe; Süd ~430/85), Wochentag-/Saisonfaktoren
- Validierung: `npm run validate-data` (Zod) muss grün sein; Duplikat-Funkrufnamen = Fehler (Anomalien aus GAME_DATA bereinigt übernehmen: ITW → 5.71-210 etc.)

## 3. ROUTING & FAHRZEIT (deterministisch!)
Kein externer Routing-Dienst zur Laufzeit. Fahrzeit = Haversine-Distanz × Umwegfaktor 1.35 / v(typ, sosi, gelände): Basis 60 km/h Land, 35 Stadt-Polygon, +30 % mit SoSi, Heli 220 km/h Luftlinie + 3 min Start. Faktoren in `balancing.json` tunebar. (ANNAHMEN.md-Eintrag inklusive.) Fahrzeug-Marker interpolieren entlang Geraden mit leichtem Jitter — Phase 1 ausreichend; OSRM-Adapter-Interface vorbereiten, nicht implementieren.

## 4. MEILENSTEINE — je: bauen → `npm run lint && npm test && npm run smoke` grün → `BUILD_REPORT.md`-Eintrag (Was, Wie getestet, offene Punkte) → Commit `feat(mX): …` → weiter

- **M0 Setup:** Vite+React+TS strict, ESLint/Prettier, Vitest, Playwright, CI-Workflow (build→Pages-Deploy), `.gitignore` ZUERST, App-Shell mit tokens.css, Titel/Disclaimer. Smoke: Seite lädt, Titel sichtbar.
- **M1 Datenbasis:** alle JSONs + Schemas + validate-data. Unit: jede Datei parst, Pflichtfelder, Funknamen-Eindeutigkeit. Mini-Datenbrowser-Route `/debug/data`.
- **M2 Karte & Fenster-Manager:** MapLibre dark; Marker Wachen/KH/Heli; **Fenster-Engine**: drag, resize, snap, minimize, z-order, Layout speichern/laden (mehrere Presets, IndexedDB). Fenster: Karte, Einsatzliste, Ressourcenmonitor, Funkfeld, Protokoll (Inhalte dürfen Stub sein). Smoke: Fenster verschieben+speichern+reload.
- **M3 Fahrzeug-Engine:** Status-Lifecycle exakt 00→1→2→3→4→5→6→7→00 + 88→08/09/10; Dienstzeiten (Fahrzeuge erscheinen/verschwinden, Hof-Regel!); Sonderstatus 91–95 (Fahrzeugcheck bei Schichtstart-Zufall, Blockzeiten); Bewegung auf Karte; Ressourcenmonitor live mit Status-Farben/Formen (Farbfehlsicht: Icons!). Unit: Lifecycle-Übergänge, Dienstzeit-Logik.
- **M4 Einsatz-Kern (Disponent):** (Alarmtext-Anzeige im Format `CODE STADTTEIL STRASSE`, GAME_DATA §3a) Auftrag = Klasse+Ziffer+Kategorie+Ort+Merkmalskette; AO-Engine: Vorschlag aus categories.defaultClass (+SoSi aus codes.json, Partner-Buttons FW/Pol/WR/BR, MANV-Prüfung ab 6 Personen → MANV1–4); manuelles Übersteuern; nächstes-geeignetes-Mittel-Suche (Typ+Status+Fahrzeit); KH-Zuweisung nach Fähigkeit („nächstes ≠ richtiges"); Hilfsfrist-Timer 15 min sichtbar; Heli-Regeln (Tageslicht/Saison/Wetter-Flag). Unit: AO-Mapping je Kategorie, MANV-Schwellen, KH-Matching.
- **M5 Calltaker & Szenario-Engine (Tier 1):** Anruf-Queue mit Klingelton; Abfragemaske, die die ELS-Merkmalskette erzeugt (Buttons/Hotkeys: Anruferrolle, Personenzahl, Alter, spricht?, Hauptbeschwerde→Kategorie, Bewusstsein/Atmung, Zugang, Adresse mit Fuzzy-Suche über Orts-Index); **Ortungskaskade** (AML-Punkt nach 10–30 s bei Handy-Szenarien mit Radius, Ortungs-SMS-Button, Festnetz=Adresse vorausgefüllt); Szenario-Generator (gewichtete Kategorien nach balancing, Wahrheit+verschweigt_bis_gefragt+Anrufertyp+Emotion+Störungen); Dialogbaum-Fallback (ohne LLM voll spielbar); Übergabe Calltaker→Dispo-Queue. Duplizitätsanrufe (zweiter Anrufer zu offenem Einsatz im Radius → Zuordnen-UI). Unit: Generator-Verteilung, Merkmalskette→Kategorie-Mapping.
- **M6 KI-Anrufer (Tier 2+3) & TTS:** WebLLM-Integration per WebWorker (Llama-3.2-3B-Instruct-q4f16_1 default, 1B-Option); Lade-UI mit Fortschritt + „Light-Modus ohne KI" sofort spielbar; System-Prompt aus Szenario (Regeln aus AI_CALLER_TECH.md: nichts erfinden, verschwiegene Infos nur auf passende Frage); Settings: Modellwahl, Tier-3-Endpoint (URL+Key, OpenAI-kompatibel, localStorage); TTS-Toggle (Web Speech, de-AT-Stimme wenn vorhanden). Smoke: Mock-Engine-Dialog (CI ohne GPU: WebLLM mocken!).
- **M7 Funk bidirektional:** (Protokoll EXAKT nach GAME_DATA §10c: „X von Y"/„kommen"/„Verstanden", Kurzrufnamen ohne 5.-Präfix!) Funkfeed (Fahrzeuge melden statusgetrieben: Eintreffen, Nachforderung NA→A4!, Polizei, Lagemeldung — Tier-1-Templates, mit LLM aufgehübscht); **aktives Anfunken**: Fahrzeug anklicken → Schnellphrasen („Status?", „Eintreffzeit?", „Abbruch, neuer Auftrag", „NA abkömmlich?") + Freitext, Antwort KI/Template mit korrektem Rufnamen-Protokoll; Sprechwunsch-Mechanik; Funk-Quittungstöne.
- **M8 Spielfluss & Scoring:** Hauptmenü (Nord/Süd, Schicht 8h/Endlos, Schwierigkeit, Solo-Rolle[n]/KI-Partner-Konfig); Zeitsteuerung Pause/1×/2×/4×/Sprung-zu-Ereignis; KI-Partner (KI-Calltaker erzeugt Aufträge mit Unschärfen / KI-Disponent disponiert per AO konservativ); Outcome-Engine (Überleben f(Kategorie-Schwere, Zeit-bis-Mittel, T-CPR-Bonus)); Debriefing-Nachrichten bei Fehlern (hart, konkret: „NA-Nachforderung 8 min zu spät"); Schichtreport (Hilfsfristquote, Stichwortgenauigkeit, Fehldispo, Outcomes) + Historie/Diagramme (IndexedDB, Recharts-frei: einfache SVG-Charts mit Tokens); Wetter/Saison/Tagesgang aktiv.
- **M9 Coop (2 Spieler):** PeerJS, Host-authoritativ; Rollensplit Calltaker/Disponent; Verbindungs-UI: PeerJS-Cloud-ID ODER manueller Code (Offer/Answer Copy-Paste-Fallback); Sync: Aufträge, Status, Uhr; Team-Score. Smoke: zwei Browser-Kontexte verbinden (Playwright).
- **M10 Editor, Story, Polish:** Szenario-Editor (Einsätze platzieren, Kategorie/Klasse/Anrufer-Skript, Speichern/Laden/Teilen als JSON-Datei, läuft als ÜBUNG); 2 dezente Story-Arcs (mehrschichtig, Flag-basiert); Achievements (lokal); Sound-Mixer; Onboarding-Tutorial (geführte erste Schicht); A11y-Pass (Fokus, Kontrast, Icons neben Farben); README mit Screenshots; finale Smoke-Suite über alle Kernflüsse.

## 5. QUALITÄT & ARBEITSWEISE
- TS strict, keine `any` ohne Kommentar; Domänenlogik (Status, AO, Outcome, Generator) UI-frei in `src/engine/` mit Unit-Tests; Komponenten dumm halten.
- Jede Engine-Regel referenziert Quelle im Kommentar (`// GAME_DATA §10`).
- Performance: 120+ Fahrzeuge + Karte flüssig (Marker-Layer, kein React-Rerender pro Tick; Spieluhr via rAF/Worker).
- Commits klein & konventionell; nach jedem Meilenstein zusätzlich Tag `m0`…`m10`.
- `BUILD_REPORT.md` ist Pflicht-Logbuch; `ANNAHMEN.md` ebenso.
- Wenn CI/Pages-Deploy fehlschlägt: selbst debuggen bis grün, bevor nächster Meilenstein.

## 6. DEFINITION OF DONE (gesamt)
Eine Person ohne Vorwissen kann auf der GitHub-Pages-URL: Nord wählen → Tutorial-Schicht spielen → Anruf annehmen, abfragen (KI oder Dialogbaum), Auftrag erzeugen → disponieren (AO+SoSi korrekt nach codes.json) → Status-Lauf & Funk verfolgen, Fahrzeug anfunken → Outcome+Debriefing sehen → Schichtreport mit Note erhalten. Layouts persistent. Alles ohne Kosten, ohne Server, ohne Eingriff. — Dann: Abschlussbericht in BUILD_REPORT.md (inkl. bekannte Limits + Phase-2-Hinweise) und STOP.
