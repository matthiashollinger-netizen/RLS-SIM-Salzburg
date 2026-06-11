# 🎮 GAME MECHANICS — Leitstellen-Simulator Salzburg

> Mechanik-Sammlung aus Research (112/911 Operator, LstSim, reale NÖ/ÖRK-Abläufe) + eigene Konzepte.
> Status: Sammelphase. ✅ = gesetzt · 💡 = Vorschlag · ❓ = Entscheidung Matthias nötig

---

## 1. ANRUF-MECHANIKEN (Calltaker)

| Mechanik | Beschreibung | Status |
|---|---|---|
| **KI-Anrufer (Claude API)** | Jeder Anrufer hat Persönlichkeit, Emotion, Wissensstand. Panisch, betrunken, Kind, Tourist (Englisch!), Dialekt. Calltaker muss beruhigen + richtig fragen. USP gegenüber 112 Operator (dort Kritik: Anrufe zu repetitiv) | ✅ |
| **Anruf-Triage** | Nicht jeder 144-Anruf ist ein Notfall: KT-Bestellungen, Rückfragen, Irrläufer, Scherzanrufe, Taschenwähler. Spieler muss Spreu vom Weizen trennen — falsch abgewimmelt = Drama | ✅ |
| **Duplizitäts-Anrufe** | Großer Unfall = 5 Anrufer melden dasselbe. Erkennen + zum bestehenden Auftrag zuordnen statt Doppel-Disposition | ✅ |
| **Telefon-Erste-Hilfe** | Standardisierte EH-Anweisungen nach Abfrage. Bei REA: **Telefonreanimation als Rhythmus-Minigame** (Drücktakt 100–120/min halten bis RTW Status 3) | 💡 |
| **Eskalation durch Gesprächsführung** | Falsche/fehlende Fragen → falsches Stichwort → Fehldisposition. Anrufer auflegen lassen ohne Adresse = Worst Case | ✅ |
| **Sprachbarriere** | Touristen (Salzburg!): Englisch-Anrufe, gebrochenes Deutsch. Übersetzer-Feature als freischaltbares Upgrade? | 💡 |
| **AML-Ortung & Ortungskaskade** ⭐NEU | Handy-Notruf → nach 10–30 s automatischer Ortungspunkt + Radius auf Karte (real: AML aktiv für 144!). Fallbacks: Ortungs-SMS-Button, Festnetz-Adressdaten, Netzbetreiber-Abfrage. Macht "Wo sind Sie?"-Drama spielbar statt frustrierend | ✅ |
| **eCall / Hausnotruf / Rufhilfe** | Automatische Meldungen ohne Sprechkontakt → Stichwort UNKLAR, Erkundung disponieren. Rufhilfe-Geräte (RK-Produkt!) als Anrufquelle | 💡 |
| **140 Alpinnotruf & Wasserrettung** | Eigene Anrufschiene: Bergrettungs-Schnittstelle, Heli-Frage sofort | 💡 |

## 2. DISPOSITIONS-MECHANIKEN (Disponent)

| Mechanik | Beschreibung | Status |
|---|---|---|
| **Ausrückordnung (AO)** | A1–D7-Logik: System schlägt Mittel vor, Spieler kann übersteuern (Über-/Unterdisposition wird bewertet) | ✅ |
| **Status-Lifecycle** | 00→1→2→3→4→5→6→7→00 je Auftrag, live im Funkfeld (echtes Salzburg-Schema) | ✅ |
| **Vorhaltepositionen** | Status 88 → 08/09/10 (LKH/UKH/CDK): Fahrzeuge strategisch positionieren statt Wache. Flächendeckung als Kernmechanik | ✅ |
| **Quittierung & Ausrückzeit** | Nach Alarmierung vergeht realistische Ausrückzeit (hauptamtlich ~1 min, ehrenamtlich nachts länger — Pager!). NÖ-Vorbild: Alarm quittieren vor Status 2 | ✅ |
| **Abgestufte Bereitschaft** | Hauptamtlich sofort vs. ehrenamtliche DSt mit Vorlaufzeit (NÖ: "Bereitschaft = max 10 min Vorlauf"). Hof: nachts/WE besetzt, sonst Stadt! | ✅ |
| **Dienstzeiten** | Fahrzeuge gehen real außer Dienst (KTW 6–18 etc.) → Abend = dünne Decke, Nacht-NEF Nr. 2 kommt dazu | ✅ |
| **Zielklinik-Wahl** | Nächstes KH ≠ richtiges KH (Stroke→CDK, Trauma→UKH, Psych nicht ins Tauernklinikum...). Schockraum-Anmeldung | ✅ |
| **Übergabezeit am Zielort** | Status 5: KH-Übergabe dauert (NÖ: ~10 min, bei vollem KH länger). Notaufnahme-Stau als Stress-Faktor | 💡 |
| **Heli-Logik** | Nur sunrise–sunset, Wetter-Limits (Nebel/Sturm = Heli no-go), Windenrettung alpin, Saison (Martin 6/10 nur Winter) | ✅ |
| **Schlechtwetter-NEF 101** ⭐ | Heli C6 wetterbedingt down → Boden-NEF 5.10-101 am Flughafen wird aktiv (Insider!). Nachts: 101 = 2. NEF am LKH mit KH-Personal → **verlängerte Ausrückzeit** als fühlbare Mechanik | ✅ |
| **Funkprotokoll-Disziplin** ⭐ | Funk strikt nach GAME_DATA §10c („X von Y" / „kommen" / „Verstanden", Kurzrufnamen). KI protokollkonform; Spieler-Stilbonus | ✅ |
| **Überregionale Anforderung** | Telefonat Leitstelle→Leitstelle (Tirol/Traunstein/OÖ/Stmk): NA-Engpass, Grenz-Einsätze, MANV. Kostet Zeit + "Gefallen"-Währung? | ✅/💡 |
| **Desinfektion/Blockzeiten** | Nach Infekttransport (D5–D7) Fahrzeug X Min blockiert. Nach REA: Crew-Pause (Belastung!) | 💡 |
| **First Responder** | In abgelegenen Gebieten parallel alarmierbar — verkürzt Zeit bis EH, ersetzt aber kein Rettungsmittel | ✅ |
| **Sonderstatus** | Dienstfahrt, Fahrzeugcheck, Lenkerwechsel, außer Betrieb, DSt unbesetzt — Fahrzeuge fallen temporär aus (siehe GAME_DATA §10b) | ✅ |

## 3. ZEIT, WELT & EREIGNISSE

| Mechanik | Beschreibung | Status |
|---|---|---|
| **Tagesganglinie** | Anrufaufkommen realistisch: Morgen-Peak (KT zu Ambulanzen!), Mittag, Abend-Notfälle, ruhige Nacht mit Einzel-Dramen | ✅ |
| **Wochenrhythmus** | Mo = KT-Flut, Fr/Sa-Nacht = Alkohol/Gewalt, So = Sport/Berg | 💡 |
| **Jahreszeiten** | **Winter:** Ski-Unfälle (Saalbach, Obertauern, Gastein, Flachau), Lawinen, Glätte-Serien, +2 Heli. **Sommer:** Berg/Wander, Badeunfälle (Wallersee, Wolfgangsee, Zeller See), Gewitterfronten | ✅ |
| **Wetter-System** | Vor Schicht einsehbar (112-Operator-Vorbild): Schneefall = mehr VU + Heli-Ausfall; Hitze = Kreislauf-Welle | ✅ |
| **Events Salzburg** | Festspiele/Jedermann (Altstadt voll), Ski-Weltcup Flachau Nachtslalom, Zauchensee, Rupertikirtag, Stier-Heimspiele, Christkindlmarkt, A10-Reiseverkehr (Stau-Karambolagen Tauerntunnel!) | 💡 |
| **Story-Arcs** | Mehrtägige Mini-Narrative (112-Operator-Vorbild "Crossbow-Killer"): z.B. Brandserie, vermisster Wanderer über 2 Schichten, Grippewelle | 💡 |
| **MANV/Großlage** | Busunglück, Tauerntunnel, Lawine aufs Skigebiet, Hochwasser Salzach: Erste-Welle-Logik, Bereitstellungsraum, Nachbar-Leitstelle, Krisen-Callcenter (+12 Plätze!) zuschalten | ✅ |

## 4. PROGRESSION & KARRIERE (Loop!)

| Mechanik | Beschreibung | Status |
|---|---|---|
| **Karriereleiter** | Calltaker-Azubi → Calltaker → Disponent → Schichtführer → Leitstellenleiter. Neue Rechte pro Stufe (erst nur Anrufe, dann disponieren, dann Heli/überregional, dann MANV-Führung) | 💡 |
| **Gebiets-Freischaltung** | Start: Stadt Salzburg only → Flachgau → Tennengau/Lammertal = Leitstelle Nord komplett. Süd als eigene "Kampagne" (oder ab Start wählbar?) ❓ | 💡 |
| **Schicht-Abschluss** | Statistik-Screen: Hilfsfristquote, Stichwort-Genauigkeit, Fehldispositionen, Anrufer-Zufriedenheit → Notenspiegel + XP + ggf. Budget | ✅ |
| **Skill-/Upgrade-System** | Freischaltbar: schnellere Abfragemasken, Auto-Vorschlag verbessert, Übersetzer, zusätzliches Personal, neue Fahrzeuge? ❓ (Wie viel "Tycoon" darf es sein vs. realistische Fixflotte?) | ❓ |
| **Achievements** | "Goldener Hörer" (perfekte Abfrage-Woche), "Nachtschwärmer", "Telefon-Lebensretter" (T-CPR erfolgreich), "Eiserne Flächendeckung" | 💡 |
| **Schwierigkeitsgrade** | Entspannt (Pausen-Taste, Hinweise) / Realistisch / Albtraum (Silvester, Personalausfall) | 💡 |
| **Endlos vs. Schicht** | 8h-Schicht gerafft (z.B. 1h Echtzeit) vs. Endlosmodus ❓ Zeitraffung-Faktor? | ❓ |

## 5. COOP-MECHANIKEN (2 Spieler)

| Mechanik | Beschreibung | Status |
|---|---|---|
| **Rollentrennung** | A=Calltaker, B=Disponent. Auftrag wandert digital rüber — aber: mündliche Zusatzinfos (Voice!) machen den Unterschied ("der Anrufer klang komisch, schick wen Schnelles") | ✅ |
| **Geteilter Stress** | Anruf-Queue voll → Calltaker ertrinkt; viele offene Einsätze → Disponent ertrinkt. Gegenseitig aushelfen (Rollen-Switch-Button) 💡 | 💡 |
| **Gemeinsames Scoring** | Team-Note; Fehler des einen kostet beide → Kommunikation erzwingen | ✅ |
| **Technik** | WebRTC P2P via PeerJS (Public-Cloud-Signaling; Fallback: manueller Code-Austausch = 0 Infra). Voice extern (Discord) in Phase 1 | ✅ |

## 6. KI-PARTNER (Solo-Modus)

| Mechanik | Beschreibung | Status |
|---|---|---|
| **KI-Calltaker** | Generiert fertige Aufträge in realistischem Takt (mit gelegentlichen Unschärfen — wie real: "Adresse unklar, Anrufer aufgelegt") | ✅ |
| **KI-Disponent** | Disponiert nach AO solide, aber konservativ — Spieler als Calltaker sieht die Konsequenzen seiner Stichwort-Qualität | ✅ |
| **KI-Qualität einstellbar** | Anfänger-KI (macht Fehler, Spieler korrigiert) vs. Profi-KI ❓ | 💡 |

## 7. UI/UX-FEATURES (vom User gesetzt)

- ✅ **Frei verschiebbare, größenveränderbare Fenster** (Fenster-Manager wie echtes ELS)
- ✅ **Layout-Speicherung** (pro Spieler/Rolle; mehrere Presets z.B. "Calltaker-Layout", "Dispo-Layout")
- 💡 Multi-Monitor-Gefühl auf einem Screen: Workspace-Tabs/virtuelle Monitore
- 💡 Dark Dispatch Theme, RK-Akzent (#E2001A vorhanden aus Zugstatistik-Tokens!)
- 💡 Sound: Telefonklingeln (Queue-Druck!), Funk-Quittungstöne, Pager-Gong bei Alarmierung
- 💡 Tastatur-Shortcuts wie echte Disponenten (F-Tasten für Status, Nummernblock)

---

## ❓ ENTSCHEIDUNGSFRAGEN AN MATTHIAS

**Spielgefühl & Scope**
1. **Zeitmodell:** 8h-Schicht gerafft auf wie viel Echtzeit? (30 min / 60 min / frei einstellbar?) Oder Endlosmodus mit Speichern jederzeit?
2. **Tycoon-Anteil:** Soll man Fahrzeuge/Personal KAUFEN können (112-Operator-Style, starker Loop) — oder bleibt die Flotte realistisch fix und Progression läuft nur über Karriere/Gebiete/Skills?
3. **Fail-State:** Kann man "verlieren" (Patient stirbt durch klare Spielerfehler → Konsequenz?) oder nur schlechtere Noten? Wie hart darf's sein?
4. **Süd ab Start wählbar** oder erst nach Nord-Kampagne freispielen?

**Realismus**
5. **Audio-Anrufe:** Anrufer nur als Text-Chat, oder mit Sprachausgabe (TTS)? (Text = schneller spielbar, Voice = immersiver aber langsamer)
6. **Funkverkehr:** Nur Status-Klicks, oder auch Text-/Audio-Funksprüche von Fahrzeugen ("brauchen Polizei nach")? 
7. **Echte Ortsnamen + echte Straßen** (OSM) überall, oder Adressen leicht fiktionalisiert?
8. **Patienten-Outcome anzeigen?** (z.B. "Patient überlebte dank schneller T-CPR") — motivierend oder zu heavy?

**Features**
9. **Story-Arcs** über mehrere Schichten — ja/nein?
10. **Editor/Sandbox** (eigene Einsätze bauen, z.B. für RK-interne Übungszwecke 😏)?
11. **Statistik-Tiefe:** Reicht Schicht-Screen, oder volle Historie/Diagramme (à la Zugstatistik)?
12. Was aus deinem RK-Alltag MUSS unbedingt rein, was ich nicht auf dem Radar habe?

---

## ✅ ENTSCHEIDUNGEN MATTHIAS (11.06.2026) — GESETZT

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Zeitmodell | **Frei einstellbar**: Echtzeit-Faktor wählbar + **Vorspulen** möglich. **Endlos ODER Schicht** im Menü wählbar |
| 2 | Tycoon | **NEIN** — realistische Fixflotte, alles von Anfang verfügbar. Progression über Karriere/Skill, nicht Kaufen |
| 3 | Fail-State | **Darf hart sein.** Patient kann sterben. **Rückmeldungen** von Mannschaft/Polizei/KH wenn was schiefging ("Patient war 12 min ohne Mittel...") |
| 4 | Nord/Süd | **Beide frei wählbar ab Start** |
| 5 | Audio | **Beides auswählbar**: Text-Chat ODER TTS-Sprachausgabe (s. AI_CALLER_TECH §TTS) |
| 6 | Funk | **JA, unbedingt**: Fahrzeuge senden Funksprüche (Nachforderungen, Lagemeldungen, Sprechwünsche) — nicht nur Status-Klicks |
| 7 | Karte | **Alles echt**: OSM, echte Straßen, echte Ortsnamen |
| 8 | Outcome | **JA anzeigen** — Realismus hoch ("Patient überlebte dank T-CPR" / "verstorben") |
| 9 | Story-Arcs | Freie Hand → **JA, dezent** (1 optionaler Arc pro Woche-Zyklus) |
| 10 | Editor/Sandbox | **JA** — eigene Einsätze/Übungsszenarien bauen (RK-Übungs-Use-Case!) |
| 11 | Statistik | Freie Hand → **Volle Historie + Diagramme** (Zugstatistik-DNA, geringer Mehraufwand) |
| 12 | KI-Anrufer | **KEINE laufenden API-Kosten** → WebLLM-Architektur, s. AI_CALLER_TECH.md ⭐ |

### Daraus abgeleitete neue Mechaniken
- **Funk-Feed (Fahrzeug→Leitstelle):** Fahrzeuge melden via Tier-2-KI kurze Funksprüche ("5.71-202 an Leitstelle: brauchen Polizei nach, Patient aggressiv") → Disponent muss reagieren (Polizei = externer Partner-Button)
- **Aktives Anfunken (Leitstelle→Fahrzeug) ✅ NEU:** Disponent kann jedes Fahrzeug ansprechen (Klick auf Fahrzeug → Funk-Button oder Freitext/Schnellphrasen: "Status?", "Eintreffzeit?", "Einsatzabbruch, neuer Auftrag", "NA-Abkömmlichkeit?"). Die Mannschaft antwortet KI-gestützt (WebLLM, kennt eigenen Status/Position/Einsatz aus Szenario-State). Korrekte Funkdisziplin (Rufname zuerst) gibt Stil-Punkte 😄
- **Debriefing-System:** Nach kritischen Einsätzen Rückmeldung der Mannschaft/des NA als Nachricht im Protokoll — bei Fehlern deutlich ("NA-Nachforderung kam 8 min zu spät"), bei Top-Leistung Lob
- **Zeit-Steuerung-UI:** Pause / 1× / 2× / 4× / Vorspulen-bis-nächstes-Ereignis
