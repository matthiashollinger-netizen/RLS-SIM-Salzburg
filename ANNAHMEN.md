# ANNAHMEN.md — Entscheidungsprotokoll

> CLAUDE.md Regel 1: Bei Unklarheit konservativste realistische Annahme treffen und hier
> protokollieren (Datum, Frage, Entscheidung, Begründung).

## 2026-06-11 — M0

### Vite `base` für GitHub Pages
- **Frage:** CLAUDE.md verlangt `base` entsprechend Repo-Name. Repo heißt `rls-sim-salzburg`.
- **Entscheidung:** `base: './'` (relativ) statt hartem `/rls-sim-salzburg/`.
- **Begründung:** Mit Hash-Router funktionieren relative Asset-Pfade auf GitHub Pages unter
  jedem Repo-Namen (auch nach Umbenennung) und lokal identisch. Erfüllt den Zweck der Regel
  (Pages-Deploy funktioniert) robuster als ein hartkodierter Pfad.

### Node-Toolchain
- **Frage:** Auf dem Build-Rechner war kein Node installiert.
- **Entscheidung:** Node 26 via Homebrew installiert; CI nutzt Node 22 (LTS).
- **Begründung:** Ohne Node kein Vite-Build; Homebrew war vorhanden.

### Webfonts
- **Frage:** DESIGN_BRIEF nennt Mono-/UI-Typografie, aber keine konkrete Schriftbeschaffung.
- **Entscheidung:** Phase 1 nutzt System-Font-Stacks (`--font-ui`, `--font-mono`), keine
  Webfont-Downloads.
- **Begründung:** Kein externer Traffic/Hoster, DSGVO-unkritisch, offline-fähig; Tokens
  erlauben späteren Austausch im Design-Pass.

## 2026-06-11 — M1

### Rufnamen-Anomalien (GAME_DATA §5) eindeutig aufgelöst
- **5.71-201 doppelt (RTW + ITW):** RTW behält 5.71-201 (8–20 Uhr), ITW bekommt
  **5.71-210** (24 h) — exakt die in GAME_DATA vorgeschlagene Bereinigung.
- **5.10-315 doppelt (Stadt-KTW-Liste + Saalbach):** der Saalbach-Eintrag ist der
  spezifischere → Saalbach. Stadt behält 5.10-313/316/318/319 (= weiterhin 17 aktive KTW).
- **5.10-306 doppelt (Schwarzach + Abtenau):** Schwarzach (Süd-Quelle ist fahrzeugscharf),
  Abtenau erhält ersatzweise **5.52-303** (füllt Lücke 301/302/304).
- **5.75-301 (Rauris-Kennung) bei Zell gelistet:** bleibt in Zell stationiert, Kennung
  historisch — GAME_DATA sagt das explizit.

### Geschätzte Funkcodes für belegte, aber uncodierte Fahrzeuge
- **NAW Gastein = 5.10-110, NAW Radstadt = 5.10-111** (NAW als Notarztmittel in den
  landesweiten 1XX-Kreis eingeordnet; reale Codes unbekannt → `estimated: true`).
- **NEF Tennengau = 5.10-103** (GAME_DATA §12b nennt „103?" selbst als Schätzung).
- **NEF/Notfalldienst Lungau = 5.10-102** (freie 1XX-Nummer, Schätzung).

### Typenkreis-Ausnahme 5.10-108
- GAME_DATA §7 listet 5.10-108 als EL-Fahrzeug der Stadt, obwohl 1XX laut Typenkreis
  NEF ist. Quellentreu als EL übernommen, Ausnahme im Test dokumentiert.

### Nicht übernommene Stadt-Sonderfahrzeuge
- 3 Großraum-RTW, 2 San-Motorräder, Kat-Lager Viehausen (GAME_DATA §7 „Sonstiges"):
  Typen liegen außerhalb des CLAUDE.md-Typ-Enums (NEF/NAW/RTW/ITW/KTW/GKTW/BTW/MTW/EL)
  → Phase 2. N-KTW als `KTW` mit Flag `notfallKtw` modelliert.

### Dienstzeiten ohne Quellenangabe
- Wo GAME_DATA „—" oder nichts angibt, wurden konservative Fenster nach Mustern ähnlicher
  Fahrzeuge gesetzt (KTW tagsüber werktags, RTW der Bezirks-/Ortsstellen 24 h bzw.
  Tagdienst). Alle betroffenen Fahrzeuge tragen `estimated: true`.

### Koordinaten
- Alle Wachen-/KH-/Heli-Koordinaten manuell aus Orts-/Adressangaben in GAME_DATA
  abgeleitet (keine Live-API zur Laufzeit, CLAUDE.md §2). Genauigkeit Ortszentrum,
  `estimated: true` überall gesetzt.

### Heli-Saisonmonate
- Martin 1 „10 Monate": Pausenmonate Mai+November angenommen. Martin 10 „nur Winter":
  Dez–März. Martin 6 „saisonal": Dez–April. Alle `estimated: true`.

### Kategorien-Defaults
- Offizielle Spalte „Default-Klasse" mit Doppelwerten (z. B. „A1/B1") als
  `defaultCode` (konservativ = höhere Dringlichkeit) + `altCode` modelliert.
- D/E-Kategorien: Zuordnung zu D/E-Ziffern (Transportart bzw. E-Typ) nach Plausibilität;
  Blockzeiten INFEKTION 30 min / HITT 120 min geschätzt (`estimated: true`).

## 2026-06-12 — M3

### Dienstende-Verhalten
- Fahrzeuge auf Vorhalteposition (88/08/09/10) gehen bei Dienstende direkt außer Dienst
  (ohne sichtbare Heimfahrt). Fahrzeuge im Einsatz (Status 1–7) beenden den Auftrag und
  fahren ein, bevor sie außer Dienst gehen. Vereinfachung für Phase 1.

### Ausrückzeiten (GAME_MECHANICS §2 „abgestufte Bereitschaft")
- hauptamtlich 60 s · gemischt tags 90 s / nachts 240 s · ehrenamtlich tags 240 s /
  nachts 420 s (Pager) · NEF 5.10-101 nachts 600 s (KH-Personal, GAME_DATA §12b).
- Folgeauftrag aus Status 6/7/88/Position: 15 s (Besatzung sitzt im Fahrzeug).
- Nacht = 20:00–06:00. Alle Werte in balancing.json tunebar, estimated.

### Fahrzeugcheck (Status 92)
- Wahrscheinlichkeit 35 % bei Schichtbeginn, Dauer 10–20 min (GAME_DATA §10b nennt
  Existenz, keine Quote) — geschätzt, seedbarer Zufall.

### Status-Übergänge über das Kernschema hinaus
- 3→6 (kein Transport), 6/7/Position→1 (Folgeauftrag), 00→88, Sonderstatus nur aus
  einsatzbereiten Zuständen. Einsatzabbruch (Disponent) nur in Status 1–3, danach ist
  der Patient an Bord.

## 2026-06-12 — M4

### AO-Mittelzusammensetzung je Code (Spielmodell, geschätzt)
- A1/A3: 1 NA-Mittel (NEF/NAW/Heli) + 1 RTW · A2: Heli zuerst · A4: nur NA-Mittel
  (RTW ist vor Ort). B: 1 RTW (N-KTW zulässig). C1: NEF+RTW · C2: Heli · C3/C5:
  RTW/ITW · C4/C6: KTW. D nach Transportart (SCHWER→G-KTW). E1–E4: EL/MTW,
  E5/E6 ohne Fahrzeug. MANV1–4: 1/2/3/4 NA + 3/6/10/15 RTW + 1/1/2/2 EL.
  Das offizielle PDF enthält keine AO — Zusammensetzung ist Spiel-Balancing.

### Severity-Logik bei Code-Paaren
- Offizielle Tabelle listet Paare in beiden Richtungen („A1/B1" vs. „B1, schwer: A1").
  `severity: 'hoch'` wählt immer den akuteren Code des Paars (konservativ),
  'normal' den niedrigeren. Default: hoch.

### Hilfsfrist-Anwendung
- 15-min-Timer für Klasse A, B mit SoSi (B1/B2) und MANV. B3/B4, C–E ohne Timer
  (GAME_DATA §11 bezieht die Frist auf Notfälle).

### Orts-Index (places.json)
- ~65 Stadtteile/Gemeinden mit je 2–5 realen Straßennamen, Koordinaten Ortszentrum,
  alle estimated. Dient Alarmtext (`CODE STADTTEIL STRASSE`) und ab M5 der
  Adress-Fuzzy-Suche. Einsatzkoordinate = Ortszentrum ± ~500 m Streuung.

### Heli-Verfügbarkeit in der Mittelsuche
- Saison+Tageslicht steuern „im Dienst" (Sim), Wetter-Flag filtert nur NEUE
  Dispositionen (bereits fliegende Helis bleiben im Einsatz).

### Playwright-Smoke gegen Production-Preview
- **Entscheidung:** Smoke-Tests laufen gegen `vite build` + `vite preview` (Port 4173),
  nicht gegen den Dev-Server.
- **Begründung:** Testet die gleiche Artefakt-Konfiguration (relative Base), die auf Pages
  deployt wird.
