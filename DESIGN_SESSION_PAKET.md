# DESIGN-SESSION-PAKET — RLS-SIM Salzburg
## Alles in einer Datei: Auftrag + Fakten (ersetzt den research-Ordner für diese Session)

Du bist der Design-Lead für **„RLS-SIM Salzburg"** (Rettungsleitstellen-Simulator), einen realitätsnahen Web-Simulator des Salzburger Rettungsdienst-Leitstands. Du lieferst framework-freies HTML/CSS — React kommt später und baut exakt gegen deine Tokens.

## ZIEL-GEFÜHL
Professionelles Dispatch-Cockpit bei Nacht — ruhige dunkle Flächen, Information vor Dekoration, Status-Farben tragen Bedeutung. Referenz-Stimmung: moderne Einsatzleitsysteme (eurofunk-Klasse). Der Spieler soll sich nach 5 Minuten wie ein Disponent fühlen, nicht wie in einem Browsergame. Kein verspieltes Game-UI.

## DELIVERABLES (Ordner `design/`)
1. **tokens.css** — vollständige CSS-Variablen: Farbpalette (Dark-First), Status-Farbsystem (unten), Einsatzklassen-Farben (unten), Typografie (Daten-Monospace + UI-Familie, Größenskala), Spacing, Radii, Shadows, z-Layer, Motion-Dauern.
2. **DESIGN_SYSTEM.md** — Regeln + Komponenten-Specs: Fenster-Chrome (Titelleiste, Pin, Minimize, Resize-Griffe, Snap-Raster), Daten-Tabellen (Ressourcenmonitor), Buttons & Hotkey-Chips, „Anruf-kommt-rein"-Banner (wichtigster Mikro-Moment — darf Puls haben, ohne Panik-UI), Karten-Marker (Fahrzeugtyp-Icon × Statusfarbe × Rufname-Label), Funkfeed-Einträge, Toast, Sound-Konzept (Klingel-Dringlichkeit, Funk-Quittung, Pager-Gong, Lautstärke-Mixer). Plus deine Antworten auf die 4 offenen Fragen (unten).
3. **mockups/cockpit.html** — Disponenten-Vollbild: frei wirkende Fenster mit Karte, Einsatzliste, Ressourcenmonitor, Funkfeld, Protokoll (statische Beispieldaten, echte Rufnamen s.u.).
4. **mockups/call.html** — Calltaker-Abfragemaske, die die ELS-Merkmalskette aufbaut (Beispiel unten) + angedeuteter AML-Ortungspunkt mit Unsicherheitsradius auf Mini-Karte.
5. **mockups/shift-report.html** — Schichtende (Hilfsfristquote, Patient-Outcomes, Note).

Pure HTML + dein tokens.css. Keine Frameworks, keine CDNs.

## HARTE ANFORDERUNGEN
- **Fenster-Manager:** alle Panels frei verschieb-/skalierbar, Snap, speicherbare Layout-Presets pro Rolle — Fenster-Chrome minimal.
- **Dark-First** (Leitstellen arbeiten dunkel). Hohe Informationsdichte erlaubt, aber strukturiert: Monospace für Rufnamen/Status/Zeiten, klare Zeilenhöhen.
- **Status-Farbsystem ist heilig** und muss über ganze Karte/Listen auf einen Blick lesbar sein — zusätzlich Form-/Icon-Codierung für Farbfehlsichtige (Farbe nie alleiniger Träger!).
- **Karte:** dunkler Kartenstil; Marker = Typ-Icon + Statusfarbe + Rufname-Label ab Zoomstufe.

## FAKTEN FÜRS DESIGN (verbindlich, aus Original-Quellen)

### Status-Farbsystem (echtes Salzburger Schema)
| Status | Bedeutung | Farbe |
|---|---|---|
| 00 | in Dienststelle | grün |
| 1 | Auftrag angenommen | gelb |
| 2 | unterwegs Einsatzort | gelb |
| 3 | eingetroffen Einsatzort | rot |
| 4 | Abfahrt Zielort (Patient an Bord) | orange |
| 5 | eingetroffen Zielort | orange |
| 6 | abgeschlossen | cyan |
| 7 | unterwegs Dienststelle | grün |
| 88 | Anfahrt Vorhalteposition | blau |
| 08 / 09 / 10 | Position LKH / UKH / CDK | blau |
| 91–95 | Sonderstatus (Dienstfahrt, Check, Lenkerwechsel, außer Betrieb, unbesetzt) | grau |

### Einsatzklassen-Farben (ans offizielle Leitstellen-PDF angelehnt!)
A Notarzt = **Rot** · B Rettung = **Blau** · C Interhospital = **Gelb/Orange** · D Krankentransport = **Grün** · E Sonstige = **Violett** · MANV = **Magenta/Pink**. 🚨-Codes (mit Sondersignal): A1–A4, B1, B2, C1–C4, MANV1–4 — visuell unterscheidbar von Nicht-SoSi (B3, B4, C5, C6, D, E).

### ELS-Abfragemaske (Original-Format, nachbauen!)
Feld „Einsatzgrund": `[Klasse ▾] [Ziffer ▾] [Kategorie ▾]` → darunter automatisch wachsende **Merkmalskette**, Beispiel:
„A1 · 1 · ALLERGIE — medizinischer Notruf, Fremdanrufer Erwachsener, 1 Person betroffen/in Gefahr, Erwachsener (ab 13 J.), Person spricht, Anaphylaxie/allergische Reaktion, Dyspnoe, Person frei zugänglich"

### Alarmtext-Format (Pager/Terminal): `CODE STADTTEIL STRASSE` → „A1 Lehen Ignaz-Harrer-Straße"

### Funkfeed-Beispiele (echtes Protokoll, Kurzrufnamen ohne „5."-Präfix!)
> „Leitstelle von 20-322" — „kommen" — „Laufende CPR, benötigen NEF und RTW" — „Verstanden"
Beispiel-Rufnamen für Mockups: 20-201, 20-322, 10-106 (NEF), 71-201, 20-401 „Jumbo" (G-KTW).

### UI-Fenster (9 Stück): Anruf-Queue · Abfragemaske · Einsatzliste · Lagekarte · Ressourcenmonitor · Funkfeld · Protokoll · KH-Kapazitäten · Sonderlagen

## BRANDING-LEITPLANKEN (rechtlich!)
**KEIN Rotkreuz-Logo, kein rotes Kreuz-Symbol, kein „Rotes Kreuz" im Namen** — gesetzlich geschützt, gilt auch für Gratis-Projekte. Eigenes Emblem entwickeln (z.B. stilisierter Leitstellen-Stern/Funkwellen + Bergsilhouette). Akzent darf im Signal-Rot-Bereich liegen (Ausgangspunkt #E2001A → eigenen Ton ableiten, z.B. wärmer + Amber für Dringlichkeit), aber kein CI-Klon. Footer: „Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes."

## 4 OFFENE DESIGNFRAGEN (beantworte sie im DESIGN_SYSTEM.md)
1. **Signature-Element:** Was macht das Spiel visuell unverwechselbar? (Kandidat: Status-Lichterkette der Gesamtflotte als „Herzschlag" im Header?)
2. **Typografie:** Welche Mono- + UI-Familie (frei verfügbar/self-hostbar)?
3. **Der „Anruf kommt rein"-Moment:** Wie sieht/klingt er aus?
4. **Schichtende-Screen:** nüchterner Report oder zelebrierter Moment?
