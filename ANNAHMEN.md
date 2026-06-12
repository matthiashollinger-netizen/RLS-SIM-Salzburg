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

## 2026-06-12 — M5

### Anrufrate (Spielbarkeit)
- Generator nutzt `emergenciesPerDay × 1,6` (statt aller 800 Anrufe/Tag) mit
  Tagesganglinie als Poisson-Prozess; Queue-Deckel 4 Anrufe (solo spielbar).
  Mix: 55 % Notfall, 25 % KT-Anmeldung, 10 % Rückfrage, 6 % Irrläufer,
  4 % Taschenwähler. Schwierigkeit skaliert das in M8.

### Ortungskaskade-Parameter
- AML bei 75 % der Handy-Anrufe, 10–30 s, Radius 40–400 m (GAME_DATA §3b nennt
  „nicht immer"; Quote geschätzt). Ortungs-SMS: Antwort nach ~30 s, Klick-Quote 85 %
  (panisch unberuhigt: 40 %), Ergebnis ±25 m. Netzbetreiber: 3 min, ±1500 m.

### Duplizitätsanrufe
- 18 % Wahrscheinlichkeit, wenn offene SoSi-Einsätze < 30 min alt existieren.
  UI zeigt offene Einsätze < 2 km um die ermittelte Position als Zuordnen-Buttons.

### Anrufer-Wissen & Störungen
- Passanten kennen die Adresse nur zu 45 %, andere zu 93 %. Verschwiegen bis
  gefragt: Detailinfos 50 %, Alter 35 %, Zugang 30 %. Falsche Hausnummer 18 %
  (korrigiert sich in derselben Antwort), Panik braucht Beruhigen-Button 30 %,
  legt früh auf 6 %, Englisch 8 %. Alles Tier-1-Schätzwerte, seedbar.

## 2026-06-12 — M6

### LLM-Pfad für Frage-Buttons
- Bei aktivem Tier 2/3 laufen AUCH die strukturierten Frage-Buttons durch das LLM
  (einheitliches Gesprächsgefühl); die strukturierte Antwort-Erfassung bleibt
  wahrheitsgetrieben aus Tier 1 (das LLM kann das Scoring nicht brechen —
  AI_CALLER_TECH-Regel „Wahrheit liegt in Tier 1").

### CI-Mock
- localStorage-Flag `rls-llm-mock=1` ersetzt WebLLM durch eine deterministische
  Mock-Engine (CI ohne GPU, CLAUDE.md M6). Wirkt nur, wenn explizit gesetzt.

### Tier-3-Probe
- Beim Verbinden eines Endpoints wird ein Mini-Request gesendet, damit Fehler
  (URL/Key) sofort sichtbar sind. `/v1` wird automatisch ergänzt, wenn es fehlt.

## 2026-06-12 — M7

### Funk-Auslöser (Spielmodell)
- NA-Nachforderung: RTW/KTW trifft bei `severity: hoch` ein und kein NA-Mittel
  (NEF/NAW/Heli) ist disponiert → Funkspruch mit A4-Aktion (GAME_DATA-§10c-Beispiel).
- Polizei-Nachforderung: Kategorie schlägt POL vor, aber nicht alarmiert.
- Sprechwunsch: deterministisch ca. jede dritte Einheit bei Status 5
  (GAME_DATA §12 nennt Sprechwünsche bei Status 5, Quote unbekannt).
- Eintreff-/Transportmeldung bei Status 3/4 (Template-Varianten, deterministisch).

### NA-abkömmlich
- Antwort derzeit rein informativ (deterministisch ~50 %); mechanische Freigabe
  des NA-Mittels folgt ggf. in Phase 2.

## 2026-06-12 — M8

### Outcome-Modell (alles tunebar, geschätzt)
- Basis-Überleben: STILL 45 % bei Sofortversorgung, sonstige `hoch` 93 %,
  `normal` 99,8 %. STILL-Zerfall 4,5 %/min (mit T-CPR 2 %/min + 12 % Bonus).
  Schwere Notfälle: −2 %/min jenseits 10 min; kein NA −10 %; NA > 20 min −5 %;
  falsches KH −5 % (hoch). Deterministisch je Auftrags-ID (seeded).

### Note (Schichtreport)
- Gewichtung: Hilfsfrist 40 % (normiert aufs 95-%-Ziel), Stichwort 30 %,
  Fehldispo 15 %, Überleben 15 %. Notengrenzen 92/80/65/50 %.

### KI-Partner
- KI-Calltaker: Abfragedauer 30–90 s; Unschärfen: 10 % falsches Stichwort,
  10 % Schwere unklar, 12 % Adresse ±~500 m („Anrufer aufgelegt"); Duplikate
  ordnet er selbst zu. KI-Disponent: disponiert nach 20 s konservativ alle
  AO-Slots mit den besten Kandidaten, alarmiert Partner-Vorschläge, retried
  wenn kein Mittel frei.

### Sprung-zu-Ereignis
- Vorspulen in 5-s-Schritten bis zum nächsten Protokoll-Ereignis oder Anruf,
  max. 15 Sim-Minuten pro Klick.

### Wetter-Drift
- Stündlich 15 % Umschlag gut↔schlecht mit Protokollmeldung; Heli-Sperre
  wirkt auf neue Dispositionen.

## 2026-06-12 — M9

### Dritter Coop-Transport „Lokal (2 Fenster)"
- Zusätzlich zu PeerJS-Cloud und manuellem WebRTC-Code gibt es einen
  BroadcastChannel-Transport für zwei Fenster im selben Browser (Zwei-Monitor-
  Selbstspiel, Demos). Grund: In der Build-Sandbox sind WebRTC-UDP-Verbindungen
  generell blockiert (ICE bleibt in „checking", obwohl SDP/Kandidaten korrekt
  ausgetauscht werden — per Debug-Test verifiziert). Der Playwright-Smoke
  verbindet daher zwei Seiten über den lokalen Transport und testet den
  manuellen WebRTC-Flow bis zum Offer/Answer-Code; echte P2P-Verbindungen
  sind umgebungsabhängig manuell zu verifizieren.

### Guest-Spiegelung
- Gast spiegelt Snapshots mit 1 Hz (Aufträge, Status+Position aller Einheiten,
  Anruf-Queue/-Gespräch, Funk, Protokoll-Auszug, Uhr). Fahrzeug-Marker beim Gast
  springen sekündlich (keine Interpolation) — Phase-2-Optimierung.
- Gast-Aktionen laufen über eine Whitelist (Store-Methoden) zum Host;
  Rückgabewerte sind optimistisch (UI liest den nächsten Sync).

## 2026-06-12 — M10

### Story-Arcs
- Genau 2 Arcs (CLAUDE-Vorgabe „dezent"): Brandserie Lehen (NORD, 3 Schichten)
  und vermisster Wanderer Hundstein (SÜD, 2 Schichten). Auslösefenster 30–90 min
  in die Schicht, max. 1 Arc-Anruf pro Schicht, Flags persistent in IndexedDB.

### Achievements
- 6 lokale Erfolge (Erste Schicht, Goldener Hörer, Telefon-Lebensretter,
  Eiserne Hilfsfrist, Nachtschwärmer, Note 1). Bewertung beim Schichtende.

### Tutorial
- 8 Schritte mit Auto-Advance auf Spielzustand; nutzt den deterministischen
  Demo-Anruf (Festnetz/Brustschmerz) und deaktiviert den Anrufgenerator.

### Editor-Übungen
- Dateiformat `*.rls-uebung.json` (Zod-validiert, version: 1). Übung startet als
  Endlos-Schicht „entspannt" mit deaktiviertem Anrufgenerator; nur geskriptete
  Anrufe; resultierende Aufträge sind ÜBUNG (kein Scoring).

### Screenshots
- `docs/screenshots/` wird von `e2e/screenshots.spec.ts` erzeugt (nur mit
  `SCREENSHOTS=1`, in CI übersprungen).

## 2026-06-12 — Großer Rework (User-Feedback)

### Koordinaten jetzt geocodiert
- Alle Wachen/Kliniken/Heli-Basen wurden einmalig zur Buildzeit über Nominatim
  geocodiert (`scripts/geocode.ts`, 1 req/s) — fast alle echten RK-Dienststellen-
  Gebäude wurden gefunden. LK St. Veit blieb Schätzung (Ortszentrum), Oberndorf
  über Straßen-Fallback. Keine Live-API zur Laufzeit (CLAUDE.md §2 erlaubt
  Nominatim-Export zur Buildzeit explizit).

### Transport-Priorität (ein Patient = ein Transportmittel)
- HELI > ITW > NAW > RTW > N-KTW > KTW > G-KTW > BTW. Bei Heli+RTW am selben
  Einsatz fliegt der Heli den Patienten, der RTW unterstützt (Alpin-Realität).
  Bei mehr Patienten als Transportmitteln transportieren alle verfügbaren.

### ELS-Alarmierungsflow
- Nach ELSSA-Vorbild zweistufig: Mittel ZUTEILEN (Vorschlagsliste) → gesammelt
  ALARMIEREN (Pager-Gong, Status 1). Zuteilungen sind vor der Alarmierung
  entfernbar; nicht mehr verfügbare Mittel fallen bei der Alarmierung heraus.

### Interaktiver Funk
- Eingehende Meldungen sind jetzt echte Rufe: Spieler antwortet „kommen",
  erst dann kommt die Meldung, Abschluss mit „Verstanden". Nur noch die
  Erstmeldung des ERSTEN Mittels, Nachforderungen und Sprechwünsche gehen über
  Funk; alle weiteren Statuswechsel laufen still über das MDT/Protokoll.

### Tier-1-Anrufer
- Antwortbanken für alle 24 Hauptbeschwerden (je 2 Varianten), Wiederholungs-
  Gedächtnis („Wie gesagt: …"), In-Character-Antworten auf unbekannte Fragen
  je Emotion/Rolle, Freitext matcht zusätzlich die kategoriespezifischen
  Detailfragen (Token-Overlap). Echte freie Dialoge weiterhin via WebLLM/Endpoint
  (Indikator „Skript/KI" im Abfrage-Header).

### Playwright-Smoke gegen Production-Preview
- **Entscheidung:** Smoke-Tests laufen gegen `vite build` + `vite preview` (Port 4173),
  nicht gegen den Dev-Server.
- **Begründung:** Testet die gleiche Artefakt-Konfiguration (relative Base), die auf Pages
  deployt wird.

## 2026-06-12 — Rework 2 (zweites Spieler-Feedback)

### Straßennetz & Routing
- **Frage:** Wie folgen Fahrzeuge der Straße ohne Laufzeit-Routingdienst?
- **Entscheidung:** Einmaliger Overpass-Export (Build-Zeit, `scripts/build-roads.mts`)
  der Straßenklassen motorway…unclassified im Land Salzburg → `public/roads-sbg.json`
  (2,8 MB, 58k Knoten). Im Browser A*-Suche mit Klassen-Geschwindigkeiten
  100/80/65/50 km/h, SoSi-Faktor aus balancing.json. Heli weiter Luftlinie.
- **Begründung:** CLAUDE.md verbietet Laufzeit-APIs; Buildzeit-OSM-Export ist
  explizit erlaubt. Fallback (Luftlinie × Umwegfaktor) bleibt aktiv, wenn die
  Datei nicht lädt (CI/offline).

### Bereitstellungsraum & Lagefreigabe
- **Frage:** Wie läuft ein Einsatz mit erforderlicher Polizei-Freigabe ab?
- **Entscheidung:** Kategorien mit `lagefreigabe:true` → alarmierte Mittel fahren
  einen Bereitstellungsraum ≈500 m nördlich des EO an (Status bleibt 2,
  „wartet auf Lagefreigabe"). Polizei wird automatisch mitalarmiert und meldet
  nach 240 s (SCHÄTZUNG) „Lage gesichert" über Funk; der Disponent gibt die
  Anfahrt frei (Funk-Aktion oder Button im Auftrag — auch vorzeitig auf eigenes
  Risiko möglich).
- **Begründung:** Reale Eigensicherungs-Doktrin; 4 min Sicherungszeit ist eine
  spielbare Schätzung.

### NA-Logik
- A4-Aufwertung nur bei B/C/D/E-Einsätzen, deren Wahrheits-Schwere „hoch" ist
  und kein NA-Mittel disponiert wurde — der BESTEHENDE Auftrag wird auf A4
  aufgewertet (kein neuer). „NA abkömmlich" deterministisch (~50 % nach Lage),
  Abzug über Funk-Aktion. „Kein NA verfügbar" wird als Einsatzinfo gesetzt —
  der RTW übernimmt Versorgung UND Transport.

### Anrufer-Konsistenz
- Szenario-Fakten (Lagetext, Detailantworten, Rolle, Alter, Geschlecht) sind
  jetzt in EINER Variante gebunden statt unabhängig gewürfelt — keine
  Widersprüche („Lift" vs. „Badezimmer", 7-jährige „Mutter") mehr möglich.
