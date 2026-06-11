# 🚨 LEITSTELLEN-SIMULATOR SALZBURG — Spieldaten-Referenz

> **Status:** Sammelphase (Research v2, verifiziert)
> **Zweck:** Faktenbasis für CLAUDE.md Master-Prompt (Claude Code) + Design-Pass (Claude Design)
> **Stand:** Juni 2026 | Quellen am Ende des Dokuments
> **Hinweis:** Spiel ist "angelehnt an" die reale Landesleitstelle Salzburg — kein offizielles RK-Produkt.

---

## 1. SPIELKONZEPT

### Spielmodi
| Modus | Beschreibung |
|---|---|
| **Single Player — Vollbetrieb** | Spieler ist Calltaker UND Disponent |
| **Single Player — Calltaker** | Spieler nimmt Notrufe an, KI disponiert |
| **Single Player — Disponent** | KI nimmt Anrufe an (generiert Aufträge), Spieler disponiert |
| **Coop (2 Spieler)** | Spieler A = Calltaker, Spieler B = Disponent (wie real getrennt!) |

### Leitstellen-Wahl
- **Leitstelle NORD** (Salzburg Stadt): Stadt, Flachgau, Tennengau, Lammertal — urban, hohes Callvolumen
- **Leitstelle SÜD** (Zell am See): Pinzgau, Pongau, Gastein, Radstadt, Lungau — alpin, Wintersport, lange Anfahrten, Heli-lastig

### Kernloop (realer Ablauf)
```
Anruf kommt rein (Queue)
  → Calltaker nimmt an
  → Standardisierte Notrufabfrage (Frageschema)
  → System generiert Einsatzstichwort + Priorität
  → Auftrag wird angelegt → erscheint beim Disponenten
  → Disponent wählt Einsatzmittel (Ausrückordnung beachten!)
  → Alarmierung → Fahrzeug-Status-Verfolgung (Status 3→4→7→8→1/2)
  → ggf. Nachforderung (NA, weitere RTW, Heli, überregional)
  → Einsatzabschluss + Bewertung
```

### Überregionale Unterstützung (Feature!)
Bei NA-Engpass/Großlage kann angefordert werden:
- **Leitstelle Tirol** (vernetzt mit Salzburg, reales grenzüberschreitendes Projekt!)
- **ILS Traunstein (Bayern)** — reale Partnerin von Christophorus 6 bei grenznahen Einsätzen
- **Oberösterreich** (Flachgau-Grenze, A1-Korridor)
- **Steiermark/Kärnten** (Lungau/Obertauern-Bereich)
- Hubschrauber aus Nachbarregionen (z.B. C14 Niederöblarn/Stmk, C4 Reith/Tirol)

---


### Jahreszahlen 2024 (offiziell, Generalversammlung) → BALANCING-BASIS ⭐
- **>450.000 Anrufe/Jahr** in der Leitstelle ≈ **Ø 1.233/Tag** → *löst Quellen-Diskrepanz: News „~1.200/Tag" = Inbound gesamt; die Seitenwerte 1.400+950 zählen vmtl. Telefonate inkl. Outbound.*
- **~89.000 echte Notrufe/Jahr** ≈ **Ø 244/Tag** (Rest: KT-Anmeldungen 14844, Rückfragen, Verbindungen)
- **252.114 transportierte Patient:innen/Jahr** ≈ Ø 690/Tag (vs. 910 Dispositionen/Tag → Differenz = Fehleinsätze, Stornos, Mehrfachmittel)
- **First Responder:** 94 aktive, ~2.600 Einsätze/Jahr ≈ 7/Tag landesweit
- Flavor: 5.200 Ehrenamtliche, 1,2 Mio. Stunden, 33.500 Blutspenden

**Spiel-Balancing daraus (Standard-Schwierigkeit):** Nord ≈ 800 Anrufe/Tag (davon ~160 Notrufe), Süd ≈ 430 (davon ~85 Notrufe); Tagesganglinie skaliert (Peak ≈ 2× Schnitt vormittags).

## 2. DIE LANDESLEITSTELLE SALZBURG (Fakten, verifiziert)

| Fakt | Wert |
|---|---|
| Betreiber | Rotes Kreuz Salzburg, im Auftrag des Landes |
| Gegründet | 2013 (Zusammenlegung von 8 Bezirksleitstellen) |
| Standorte | **Nord:** Sterneckstraße 32, Salzburg Stadt · **Süd:** Zell am See (Krankenhausareal) |
| Notrufe | 144 (Rettung), 140 (Bergrettung/Alpin), Wasserrettung; KT-Nummer 14844 |
| Arbeitsplätze | 14 identisch im Regelbetrieb + 12 zuschaltbare Krisen-Callcenterplätze |
| Personal | ~30–40 hauptberufliche Mitarbeiter (alle Rettungs-/Notfallsanitäter), 24/7 |
| Prinzip | **Calltaker ≠ Disponent**: nächster freier Calltaker nimmt an (standortunabhängig), anderer Mitarbeiter alarmiert |
| Redundanz | Beide Standorte sehen ALLE Einsätze im Land — Übernahme bei Engpass möglich |
| Vernetzung | Grenzüberschreitendes Projekt mit Leitstelle Tirol + bayerischen Leitstellen |

**Lastdaten (für Einsatzgenerator-Balancing):**

| | NORD (Stadt) | SÜD (Zell am See) |
|---|---|---|
| Einwohner | 350.215 | 184.028 |
| Einsatzmittel | 95 Fzg., 1 NAH, 1 NEF (2 nachts) | 80 Fzg., 2 NAH (4 Winter), 2 NEF + 2 NAW |
| Dienststellen | 10 | 16 |
| Telefonate/Tag | 1.400 (58/h) | 950 (40/h) |
| Dispositionen/Tag | 600 | 310 |

Gesamt: ~1.200 Anrufe/Tag, davon 300–400 echte Notrufe. Rest: KT-Bestellungen, Rückfragen, Arztanforderungen → Spielelement "Anruf-Triage"!

---

## 3. STANDARDISIERTE NOTRUFABFRAGE (Calltaker-Gameplay)

**Real:** Seit 24.05.2023 softwaregestützte standardisierte Abfrage (fixe Fragen + Antwortoptionen → automatisches Alarmstichwort an ELS → standardisierte Erste-Hilfe-Anweisungen an Anrufer). Basiert auf "international anerkannten Standards" (AMPDS-Prinzip, ~20 Ja/Nein-Fragen). Hersteller öffentlich nicht genannt.

### Abfrage-Flow im Spiel (AMPDS-angelehnt)

**Phase 1 — Einstiegsfragen (immer):**
1. „Rettungsleitstelle Salzburg, wo genau ist der Notfallort?" → Adresse/Gemeinde/markanter Punkt (Karten-Pin)
2. „Was genau ist passiert?" → Auswahl Beschwerdebild/Mechanismus
3. „Wie viele Personen sind betroffen?"
4. Rückrufnummer bestätigen

**Phase 2 — Schlüsselfragen (vital):**
5. „Ist die Person bei Bewusstsein/ansprechbar?"
6. „Atmet die Person normal?"
7. Alter (ca.) / Geschlecht

**Phase 3 — beschwerde­spezifische Fragen** (je nach Auswahl in Frage 2):
- Brustschmerz: Schmerzcharakter? Ausstrahlung? Kaltschweißig? Bekannte Herzerkrankung?
- Verkehrsunfall: Eingeklemmt? Fahrzeug-Anzahl? Auslaufende Flüssigkeiten? Geht/steht jemand?
- Sturz: Höhe? Schädel angeschlagen? Blutverdünner?
- Blutung: stark/spritzend? stillbar?
- Geburt: Wehenabstand? Presswehen? SSW?
- Schlaganfall: FAST-Check (Gesicht, Arm, Sprache, Zeit)
- usw. — pro Stichwort 2–4 Spezialfragen

**Phase 4 — Abschluss:**
- System zeigt generiertes Stichwort + Priorität → Calltaker bestätigt → **Auftrag wird angelegt**
- Erste-Hilfe-Anweisung wird "gegeben" (Telefonreanimation als Minigame-Option bei REA!)
- „Rettung ist unterwegs. Bleiben Sie erreichbar."

### Gameplay-Twist
Anrufer-KI (Claude API!) ist panisch/unklar/betrunken/spricht Dialekt → Spieler muss richtig nachfragen. Falsche/übersprungene Fragen → falsches Stichwort → Fehldisposition → Punkteabzug.

---


## 3a. ELSSA & DIASweb — die echten Systeme ⭐ (Insider + verifiziert)

- **ELSSA** = „Einsatzleitsystem Salzburg" (Hersteller BEKA Software): zentrales ELS, **georedundant** über beide Leitstellen-Standorte. Überwacht & steuert alle Einsatzkräfte.
- **DIASweb** = die angebundene standardisierte **Notrufabfrage-Software** (erzeugt die Merkmalskette → Stichwort). 1450-Beratung läuft über „LowCode".
- **Fahrzeug-Terminal (Insider):** Jedes Fahrzeug hat ein integriertes ELSSA-Terminal — darüber kommen ALLE Einsatzinfos rein und werden die **Status gedrückt**. → Spiel: Fahrzeug-Popup als MDT-Ansicht gestalten (Einsatzdaten + Statustasten-Optik). 
- **ELSSA mobil** (echte App, iOS): Einsatzaufträge in Echtzeit aufs Handy, Statusmeldungen, automatische Positionsübermittlung im Einsatz, Rückruf-Funktion — genutzt z.B. von Bereitschafts-/Notärzten. → Spiel-Inspiration für First-Responder-/NA-Alarmierung (FR laufen lt. Insider über App).
- **Alarmtext-Format (Insider):** `EINSATZCODE STADTTEIL STRASSE` — z.B. „A1 Lehen Ignaz-Harrer-Straße". Exakt so am Pager/Terminal und im Spiel anzeigen!
- ⚠️ Branding: „ELSSA" ist ein Produktname → im Spiel-UI neutral „ELS-Terminal/MDT" nennen; reales Vorbild nur hier in der Doku.

## 3b. ORTUNG VON NOTRUFEN (real verifiziert → Spielfeature!)

Vier reale Wege, im Spiel als Mechanik-Stufen:
1. **AML (Advanced Mobile Location):** In AT für **144, 140, 141, 122, 128 aktiv**. Smartphone aktiviert bei Notrufwahl automatisch GPS/WLAN und sendet Position (SMS/HTTPS) — auch wenn Ortung ausgeschaltet war. → **Spiel:** Bei Handy-Anrufen erscheint nach 10–30 s automatisch ein Ortungspunkt mit Genauigkeitsradius auf der Karte. Nicht immer (alte Handys, kein Empfang) — dann Stufe 2–4.
2. **SMS-Link-Ortung:** Calltaker schickt per Klick eine System-SMS mit Link; klickt der Anrufer, kommt die Position. → Spiel: Button „Ortungs-SMS senden", Anrufer-KI entscheidet ob er klickt (Panik!).
3. **Festnetz-Datenübermittlung:** Bei 144/140/141 liefern Betreiber (v.a. A1) automatisch Adressdaten zur Rufnummer. → Spiel: Festnetz-Anruf = Adresse erscheint vorausgefüllt (aber: Anrufer kann woanders sein als Anschluss!).
4. **Klassische Standort-/Stammdaten-Abfrage** beim Netzbetreiber: ungenauer Funkzellen-Schwerpunkt, dauert. → Spiel: letzte Eskalation, Minuten-Delay, großer Radius.

Quellen: eurofunk eAML-Blog, Notruf NÖ Ortungs-Doku.

## 4. EINSATZKATEGORIEN — OFFIZIELL ⭐⭐ (ersetzt Tirol-Annäherung!)

> Aus dem Original-PDF. Kategorie + Klasse = Stichwort. Spalte „Default-Klasse" = Spiel-AO-Vorschlag (Abfrage kann hoch-/runterstufen; Quelle der Defaults: Plausibilität + SoSi-Logik, nicht PDF).

### Kategorien für Klassen A, B, C, MANV
| Kategorie | Beschreibung (offiziell) | Default-Klasse (Spiel) |
|---|---|---|
| STILL | Atem-/Kreislaufstillstand | A1 |
| ALLERGIE | Allergische Reaktionen | A1/B1 |
| ALPIN | Notfälle im alpinen Gelände | A2 (+Heli/Bergrettung) |
| BEREIT | Bereitstellung | B3 |
| BRAND | Brandeinsätze | A1/B1 + FW |
| CHIR | Allgemeinchirurgische Notfälle | B1 |
| COVID | COVID-19-Notarzteinsatz | A1 |
| EINGESCHLOSSEN | Person eingeschlossen (Lift/Whg/Sonst.) | B1 + FW |
| EINSTURZ | Einsturz Gebäude/Gerüst | A1 + FW (MANV-Prüfung) |
| EXPLOSION | Explosionen aller Art | A1 + FW/Pol (MANV-Prüfung) |
| GEFAHRGUT | Unfälle mit Gefahrgut | A1 + FW (Lagefreigabe) |
| GEWALT | Körperverletzungen | B1/A1 + Pol (Lagefreigabe) |
| GYN | Gynäkologische Notfälle | A1/B1 |
| HÖHLE_GRUBE | Unfälle Höhle/Grube | A2 + Bergrettung |
| INTERN | Internistische Notfälle | A1/B1 |
| INTOX | Intoxikationen | A1/B1 |
| KRANK | Sonstige Erkrankungen | B3 |
| NEURO | Neurologische Notfälle | A1/B1 |
| POLIZEI | Polizeiliche Einsätze | B1 + Pol (Bereitstellung) |
| PSYCH | Psychiatrische Notfälle | B1 (+Pol) |
| RUFHILFE | Rufhilfeeinsätze | B1/B3 (unklar→B1) |
| SONST | Sonstige Notarzteinsätze | A1 |
| STROM | Stromunfälle | A1 + FW |
| TRAUMA | Unfallchirurgische Notfälle | B1 (schwer: A1) |
| VERKEHR | Unfälle Straßenverkehr | B1/A1 + FW/Pol |
| VERKEHR_LUFT | Unfälle Luftverkehr | A1 + FW/Pol (MANV-Prüfung) |
| VERKEHR_SCHIENE | Unfälle Schienenverkehr | A1 + FW/Pol (MANV-Prüfung) |
| VERSCHÜTTUNG | Gebäude/Person/Fzg verschüttet | A1 + FW |
| WASSER | Wassernotfälle | A1 + WR |

### Kategorien für Klassen D, E (geplante Transporte & Sonstiges)
AMB (ambulante Behandlung) · AMBULANZ (Ambulanzeinsatz) · STAT (stationäre Aufnahme) · HEIM (Heimtransport) · DIALYSE (Hin+Rück) · PRIO (terminlich priorisiert) · FERN (Fernfahrten) · EINWEISUNG (durch Arzt) · SCHWER (Pat. >130 kg → G-KTW!) · Behindertentransport · Tageszentrum/Schüler · INFEKTION (<IRG III) · HITT (Hochinfektion ≥IRG III → Blockzeit!) · BLUT_ORGAN · MEDIKAMENTE · GERÄTE · INSTRUMENTE · ARZT/PERSONAL · CDK/LKH SALK intern · KIT_RK / KIT_VERTRAG · SUCHAKTION (vermisste Person) · KOORDINATEN · ALARMSYSTEM (autom. Notruf!) · RUFHILFE-Fälle · SPRENGELARZT / VISITENARZT / VERSTÄNDIGUNG (RLS→KH) · TELEMEDIZIN / RÜCKRUF / E5-1450 · DIENST (Dienstfahrt) · PAUSE (Pause RD!) · BEREITSTELLUNG (Raum für RD) · DOKUMENTATION · INFORMATION · STÖRUNG (RLS) · SONDERLEISTUNG · ÜBERGABE_RD · ÜBUNG · TEST · ABFRAGE (via ECN)

> 🎮 Spiel-Gold in D/E: **PAUSE** (Crew-Pausen als echte Kategorie!), **ALARMSYSTEM** (Auto-Notruf ohne Sprecher → Erkundung), **SUCHAKTION**, **HITT** (Blockzeit), **SCHWER** (G-KTW-Pflicht), **ÜBUNG** (Editor-Szenarien laufen als ÜBUNG!).

---|---|---|
| A1 | NA-Einsatz | 🚨 |
| A2 | NA-Einsatz Alpin | 🚨 |
| A3 | NA-Anforderung durch Fachpersonal | 🚨 |
| A4 | NA-Nachforderung durch Einsatzmittel vor Ort | 🚨 |

**B — Rettungseinsätze**
| Code | Bedeutung | SoSi |
|---|---|---|
| B1 | RTW | 🚨 |
| B2 | RTW Anforderung d. Fachpersonal | 🚨 |
| B3 | RTW | — |
| B4 | RTW Anforderung d. Fachpersonal | — |

**C — Interhospitaltransporte**
| Code | Bedeutung | SoSi |
|---|---|---|
| C1 | IHT mit NEF | 🚨 |
| C2 | IHT mit NAH (Hubschrauber) | 🚨 |
| C3 | IHT mit Arzt KH | 🚨 |
| C4 | IHT ohne Arzt | 🚨 |
| C5 | IHT mit Arzt KH | — |
| C6 | IHT ohne Arzt | — |

**D — Krankentransporte** (alle ohne SoSi)
D1 Liegend · D2 Tragsessel · D3 Rollstuhl · D4 E-Rollstuhl · D5 Gehend · D6 Rollstuhl hoch

**E — Sonstige Einsätze** (ohne SoSi)
E1 KIT-Einsätze · E2 Blut-/Proben-/Organtransporte · E3 Arztvisiten · E4 Sonstige · E5 Gesundheitsberatung 1450 · E6 Aufgaben Leitstelle

**MANV — Massenanfall an Verletzten** (alle 🚨) — *offizielle Stufen!*
| Stufe | Personen |
|---|---|
| MANV1 | 6–10 |
| MANV2 | 11–29 |
| MANV3 | 30–49 |
| MANV4 | ab 50 |

**ELS-Maske (aus Original-Screenshot):** Feld „Einsatzgrund" = `[Klasse▾] [Ziffer▾] [Kategorie▾]` + automatisch generierte Merkmalskette aus der Abfrage, z.B.: *„medizinischer Notruf, Fremdanrufer Erwachsener, 1 Person betroffen/in Gefahr, Erwachsener (ab 13 J.), Person spricht, Anaphylaxie/allergische Reaktion, Dyspnoe, Person frei zugänglich"* → exakt so im Spiel-UI nachbauen!


### Stichwortkategorien (Notfall)

| Stichwort | Beispiele | Code (SBG-Schema) |
|---|---|---|
| REA | Kreislauf-/Atemstillstand, Exitus fraglich | A1 |
| INTERN | Bewusstlosigkeit, Brustschmerz, Atemnot, Herzrhythmus | A1 |
| NEURO | Apoplex, Krampfanfall, Kopfschmerz | A1/B1 |
| TRAUMA | Verletzungen, Verbrennung, Tierbiss, Auge | B1/B3 (schwer: A1) |
| VERKEHR | VU alle Mechanismen (auch Bahn/Wasser/Luft) | A1 + ggf. FW/Pol |
| CHIR | Bauchschmerz, Kolik, GI-/HNO-Blutung | B1/B3 |
| PSYCH | Suizidversuch/-drohung, Psychose | B1 + Polizei |
| INTOX | Vergiftung, Überdosis, Inhalation | A1 |
| ALLERG | Anaphylaxie, Tierstich | A1/B1 |
| KRANK | red. AZ, Fieber, Durchfall | B3 |
| GYN | Geburt, Schwangerschaft, Blutung | A1/B1 |
| WASSER | Ertrinken, Tauchunfall, Eisunfall | A1 + WR |
| TMR | Einklemmung, Verschüttung | A1 + FW |
| STROM | Stromunfall, Blitzschlag | A1 + FW |
| GEWALT | Stich-/Schussverletzung, Überfall | A1 + Polizei (Lagefreigabe!) |
| POLIZEI | Amok, Bombe, Geisel | Sonderlage, Bereitstellungsraum |
| UNKLAR | eCall, Kommunikation unmöglich | B1 zur Erkundung |
| HILFE | Med. Hilfeleistung, Tragehilfe | B3/SOZIAL |
| ANFORD | Anforderung durch Kräfte vor Ort, Hausnotruf | **B2** (Fachanforderung!) / A1 bei NA-Anford. |

### Stichworte Krankentransport/Sonstiges
VERLEG (Interhospital), EINWEIS, AMB (Ambulanztermin), HEIM, STAT, DF (Dienstfahrt), FD (Flächendeckung!), SOZIAL, AD (Ambulanzdienst), KIT (Krisenintervention), MATPERS, PROBEN, ÜBUNG, SUCHE.

> ⚠️ Code-Spalte auf **Salzburger Schema** gemappt (A1/B1/B2/B3, s. Einsatzcodes-Kapitel). Tirol-AO-Reste entfernt (Review 11.06.).

**„FD — Flächendecken"** = wichtige Spielmechanik: Disponent verschiebt freie Fahrzeuge strategisch, um Versorgungslöcher zu schließen (z.B. wenn Saalfelden-RTW im Einsatz → Zell-RTW Richtung Norden vorziehen).

---

## 5. FUNKRUFNAMEN-SYSTEMATIK (entschlüsselt & belegt)

**Format:** `5.BD-TNN`
- `5` = Bundesland Salzburg (AT-Schema: 1=Bgld, 2=W, 3=NÖ, 4=OÖ, 5=S, 6=St, 7=K, 8=T, 9=V)
- `BD` = Bezirks-/Trägerkennung (2-stellig)
- `T` = Fahrzeugtyp (1. Ziffer der Endnummer)
- `NN` = laufende Nummer

### Typenkreise (belegt aus Stadt- & Süd-Flotte)
| Endnummer | Typ |
|---|---|
| 1XX | **NEF** (landesweit über 5.10 nummeriert!) |
| 2XX | RTW |
| 3XX | KTW / N-KTW |
| 4XX | G-KTW |
| 5XX | BTW |
| 6XX | MTW |
| 7XX | EL / PKW / ÄND / Sonder |

### Bezirks-/Trägerkennungen (belegt + abgeleitet)
**Systematik entdeckt:** Die 3-stelligen Dienststellen-Codes entsprechen den Funkkennungen ohne führende 0 (DSt 071 → Funk 5.71, DSt 042 → 5.42, DSt 052 → 5.52).

| Kennung | Zuordnung | Status |
|---|---|---|
| 5.10 | Landesverband / landesweite Mittel (alle NEF, einzelne KTW/BTW) | belegt |
| 5.20 | Bezirksstelle Salzburg Stadt | belegt |
| 5.4X | **Flachgau**: 5.42 = Mattsee, 5.45 = Hof | **belegt** |
| 5.41/43/44/46? | Lamprechtshausen / Straßwalchen / Seekirchen / Strobl (Reihenfolge?) | Hypothese → Insider |
| 5.5X | **Tennengau/Lammertal**: 5.52 = Abtenau (Lammertal) | **belegt** |
| 5.51/53? | Hallein / Golling | Hypothese → Insider |
| 5.61 | BSt St. Johann/Pg (061) | belegt |
| 5.62 | DSt Schwarzach (062) | belegt |
| 5.63 | BSt Gastein (063) | belegt (Struktur) |
| 5.64 | DSt Werfen (064) | belegt (Struktur) |
| 5.65 | DSt Bischofshofen (065) | belegt |
| 5.68 | BSt Radstadt (068) | belegt (Struktur) |
| 5.71–5.77 | Pinzgau: Zell/Saalfelden/Mittersill/St.Martin/Rauris/Saalbach/Wald | belegt |
| 5.80 | Reservefahrzeuge | belegt (Stadt) |
| 5.91–5.93 | Lungau: Tamsweg/St.Michael/Mauterndorf | belegt (Struktur) |
| 5.3X | unbelegt/unklar — historisch? | offen |

> **Quellen-Anomalien (quellentreu übernommen, im Spiel bereinigen):** ① 5.71-201 in LstSim-Daten doppelt (als RTW *und* ITW) → Spiel: ITW erhält eigene Nr. (z.B. 5.71-210). ② KTW 5.75-301 (Rauris-Kennung) bei BSt Zell gelistet → vermutl. stationiert in Zell, Kennung historisch. ③ KTW 5.10-306 doppelt (Schwarzach + Lammertal) → Fahrzeug-Wanderung/Zeitversatz der Quellen; Spiel vergibt eindeutig.

---

## 6. FAHRZEUGFLOTTE — LEITSTELLE SÜD (vollständig, Quelle LstSim/real abgeleitet)

### Rettungsbezirk PINZGAU

**BSt Zell am See (071)** — NEF Pinzgau + ITW-Standort
| Rufname | Typ | Dienstzeit | Anmerkung |
|---|---|---|---|
| 5.10-107 | NEF | 24h (7-19/19-7) | NEF Pinzgau |
| 5.71-201 | RTW/ITW | 8–20 | auch Intensivtransporter 24h |
| 5.71-202 | RTW | 24h | |
| 5.10-302 | KTW | 6:30–18:30 | VW T6.1 4motion, Dlouhy |
| 5.71-301 | KTW | 8–17:30 / 19–7 | |
| 5.71-303 | KTW | 12–22 | |
| 5.75-301 | KTW | 9–19 | |
| 5.10-504 | BTW | 9–19 | rollstuhlgeeignet |
| 5.71-601 | MTW | 6–16 | |
| 5.71-701 | PKW | 8–18 | EL Pinzgau / Sachtransport |

**OSt Saalfelden (072)**
| Rufname | Typ | Dienstzeit |
|---|---|---|
| 5.72-201 | RTW | 24h |
| 5.10-308 | KTW | 6–18 |
| 5.72-301 | KTW | 7–17 / 19–7 |
| 5.72-302 | KTW | 9–19 |

**OSt Mittersill (073)** — NEF Oberpinzgau
| Rufname | Typ | Dienstzeit |
|---|---|---|
| 5.10-105 | NEF | 24h |
| 5.73-201 | RTW | 24h |
| 5.10-304 | KTW | 7–18 |
| 5.73-301 | KTW | 7–17 / 19–7 |

**OSt St. Martin b. Lofer (074)**
| Rufname | Typ | Dienstzeit |
|---|---|---|
| 5.74-201 | RTW | 24h |
| 5.74-301 | KTW | 7–18 |
| 5.74-302 | KTW | 8–19 |

**OSt Rauris (075)**
| Rufname | Typ | Dienstzeit |
|---|---|---|
| 5.10-307 | KTW | 7–17 |
| 5.71-302 | KTW | — |
| 5.75-302 | KTW | 9–19 / 19–7 |

**OSt Saalbach (076)**
| Rufname | Typ | Dienstzeit |
|---|---|---|
| 5.10-315 | KTW | — |
| 5.76-301 | KTW | 7–19 |
| 5.76-302 | N-KTW | 24h |

**OSt Wald im Pinzgau (077)**
| Rufname | Typ | Dienstzeit |
|---|---|---|
| 5.77-301 | N-KTW | 24h |
| 5.77-302 | N-KTW | 7–18 |

### Rettungsbezirk PONGAU

**BSt St. Johann/Pg (061)** — Versorgungsgebiet inkl. Großarl, Hüttschlag, Wagrain, Kleinarl
| Rufname | Typ | Dienstzeit | Anmerkung |
|---|---|---|---|
| 5.61-201 | RTW | Mo–Fr 10–20 | MB Sprinter 2020, Dlouhy |
| 5.61-202 | RTW | 24h-Muster | MB Sprinter |
| 5.61-301 | KTW | Mo–Fr 6–16, Winter-WE 24h | |
| 5.61-302 | KTW | Mo–Fr 7–18 | |
| 5.61-303 | KTW | — | VW T5 |
| 5.10-305 | KTW | — | VW T6 |
| 5.10-506 | BTW | 6:30–17:30 | VW Crafter, rollstuhlgeeignet |

**DSt Schwarzach (062)** — NEF Salzachpongau, am Kard.-Schwarzenberg-Klinikum
| Rufname | Typ | Dienstzeit | Anmerkung |
|---|---|---|---|
| 5.10-104 | NEF | 24h | Jeep Grand Cherokee |
| 5.62-201 | RTW | — | MB Sprinter |
| 5.10-306 | KTW | — | VW T5 |

**DSt Werfen (064)** — Fahrzeugdaten offen → Insider
**DSt Bischofshofen (065)**
| Rufname | Typ | Dienstzeit |
|---|---|---|
| 5.65-201 | RTW | ~24h-Muster |
| 5.65-301 | KTW | — |
| 5.65-302 | KTW | — |

### Rettungsbezirk GASTEIN
**BSt Gastein / Bad Hofgastein (063)** — real: NAW Gasteinertal! Fahrzeugliste offen → Insider

### Rettungsbezirk RADSTADT
**BSt Radstadt (068)** — real: NAW Ennspongau! Versorgungsgebiet: Untertauern, Obertauern, Radstadt, Altenmarkt, Eben, Flachau, St. Martin/Tg, Forstau, Filzmoos, Hüttau. Fahrzeugliste offen → Insider

### Rettungsbezirk LUNGAU
**BSt Tamsweg (091), DSt St. Michael (092), DSt Mauterndorf (093)** — Fahrzeuglisten offen → Insider

> ⚠️ Die 2 NAW der Leitstelle Süd (lt. offizieller RK-Statistik) sind höchstwahrscheinlich Gastein + Radstadt. Mit Insider-Wissen verifizieren!

---

## 7. FAHRZEUGFLOTTE — LEITSTELLE NORD

### BSt Salzburg Stadt (Dr.-Karl-Renner-Straße 7) — belegt
Personal real: 500 Ehrenamtliche, 46 Hauptamtliche, 85 Zivildiener.

| Bereich | Rufnamen | Anzahl |
|---|---|---|
| RTW | 5.20-201 … 5.20-207 | 7 |
| RTW Reserve | 5.80-202, 5.80-203 | 2 |
| KTW | 5.20-301 … 5.20-327 (+ 5.10-313/315/316/318/319) | ~17 aktiv |
| G-KTW | 5.20-401, 5.20-402 | 2 |
| BTW | 5.20-501 … 5.20-516, 5.10-507 | 16 |
| MTW | 5.20-601, -603, -604, -605 | 4 |
| EL | 5.20-701, 5.10-108 | 2 |
| ÄND | 5.20-702, 5.20-703 | 2 |
| Sonstiges | 3 Großraum-RTW, 2 San-Motorräder, Kat-Lager Viehausen (2 LKW, Pinzgauer, Anhänger) | |

NEF Stadt: 1 tags / 2 nachts (Rufnamen vermutlich 5.10-10X → Insider-Frage). NAH: Christophorus 6.

### BSt Flachgau (6 Dienststellen) — Teilweise belegt
**DSt Mattsee (042):** RTW 5.42-201, RTW 5.42-202, BTW 5.20-502 (Stadt-Leihe). ~90 Mitglieder. Gebiet: Mattsee, Schleedorf, Obertrum, Seeham, Berndorf (+ Aushilfe Seekirchen, Perwang, Palting). Pager-Alarmierung, Arzt/NA zuziehbar.
**DSt Hof (045):** KTW 5.45-301. ~61 Mitglieder. **Nur nachts + Wochenende besetzt — tagsüber Mo–Fr versorgt die Stadt das Hofer Gebiet!** (→ Spielmechanik Zeitsteuerung). Gebiet: Hof, Thalgau, Koppl, Ebenau, Faistenau, Plainfeld, Hintersee, Fuschl + A1 bis Mondsee/Eugendorf.
**Lamprechtshausen (+ Stützpunkt Oberndorf, 2 Fzg.), Straßwalchen (24h freiwillig besetzt!), Seekirchen-Eugendorf, Strobl:** Rufnamen/Flotte offen → Insider/Research.
Versorgungsgebiete belegt: Straßwalchen→Köstendorf/Neumarkt/Henndorf · Seekirchen→Seekirchen/Eugendorf.

### BSt Tennengau / Lammertal — Teilweise belegt
**BSt Lammertal, Abtenau (052):** KTW 5.52-301, 5.52-302, 5.52-304, KTW 5.10-306*, PKW 5.52-701, KatS-Anhänger, San-Anhänger. ~93 Mitglieder. Gebiet: Abtenau, Annaberg-Lungötz, Rußbach, Teile St. Martin/Tg + Scheffau.
**Hallein (051?):** Gebiet Adnet, Bad Vigaun, Hallein/Bad Dürrnberg, Krispl/Gaißau, Oberalm, Puch/St. Jakob — Flotte offen → Insider (RTW + NEF Tennengau vermutet).
**Golling (053?):** Gebiet Golling, Kuchl, Scheffau, St. Koloman — Flotte offen.

*Hinweis: 5.10-306 doppelt gelistet (auch Schwarzach in der Süd-Quelle) — Fahrzeuge wandern/Quellen-Zeitversatz; im Spiel eindeutig vergeben.

---

## 8. FLUGRETTUNG (offiziell verifiziert, RK Salzburg)

5 Hubschrauber, 4 Stützpunkte, 4 Vertragspartner. Disposition durch Landesleitstelle. 22 RK-Flugretter, 75 Notärzte. **Alle nur sunrise–sunset!** (Nachtflug = nicht verfügbar → Spielmechanik)

| Rufname | Standort | Maschine | Betrieb | Saison |
|---|---|---|---|---|
| **Christophorus 6** | Flughafen Salzburg | H135/EC135 | ÖAMTC | ganzjährig |
| **Martin 1** | St. Johann/Pg (Heli Austria FRZ) | EC135 T3H | Heli Austria/Knaus | 10 Monate |
| **Martin 10** | St. Johann/Pg | MD 902 | Knaus, KH Schwarzach | nur Winter |
| **Alpin Heli 6** | Flugplatz Zell am See (LOWZ) | EC135 T3 | Schider + ÖAMTC | ganzjährig |
| **Martin 6** | Hinterglemm | EC135 T3 | Heli Austria (Fa. Wolf) | saisonal |

Einsatzstatistik 2023: 4.677 Flugeinsätze, ~41% Sport-/Freizeitunfälle. C6: 800–1.700/Jahr, ⅔ internistisch, 80% im Bundesland.
Grenzlogik: C6 fliegt auch Bayern (Koordination ILS Traunstein).

---

## 9. KRANKENHÄUSER (Transportziele mit Versorgungsstufen)

| Stufe | Haus | Ort | Besonderheit |
|---|---|---|---|
| ZENTRAL | Uniklinikum Campus LKH | Salzburg | Maximalversorger, Kinderzentrum, Dachlandeplatz |
| ZENTRAL | Uniklinikum Campus CDK | Salzburg | Neurologie, Psychiatrie, Stroke |
| SONDER | UKH AUVA Salzburg | Salzburg | Unfall/Trauma, Dachlandeplatz |
| SCHWERPUNKT | Kardinal Schwarzenberg Klinikum | Schwarzach/Pg | Süd-Anker, Heli-Stützpunkt-Nähe |
| STANDARD | LK Hallein | Hallein | SALK |
| STANDARD | Tauernklinikum Zell am See | Zell am See | 293 Betten |
| STANDARD | Tauernklinikum Mittersill | Mittersill | Erstversorgung, Weiterverlegung üblich |
| STANDARD | LK St. Veit/Pg | St. Veit | SALK |
| STANDARD | LK Tamsweg | Tamsweg | 84 Betten, CT, SALK |
| STANDARD | KH Oberndorf | Oberndorf | Nordflachgau |
| PRIVAT/Sonder | KH Barmherzige Brüder | Salzburg | |

**Zielklinik-Spiellogik (real belegt für Pinzgau):** Psychiatrie, Pädiatrie, Kieferchirurgie → NICHT Tauernklinikum, sondern Schwarzach / LKH Salzburg / BKH St. Johann i. Tirol (!überregional). Stroke → CDK/Schwarzach. Polytrauma → UKH/LKH. Herzkatheter → LKH/Schwarzach.
→ Kernmechanik: **„Nächstes KH ≠ richtiges KH"** — falsche Zielklinik = Sekundärverlegung = Strafe.

---

## 10. STATUSMELDUNGEN — ECHTES SALZBURG-SCHEMA ⭐ (Insider-Quelle, primär!)

> ✅ Gilt **landesweit** (Nord+Süd, Insider bestätigt). Statusabgabe über das ELSSA-Fahrzeugterminal (§3a).
> ⚠️ WICHTIG: Salzburg nutzt NICHT das Tirol/DE-FMS-Schema! Quelle: Matthias (RK Salzburg, Zugskommandant). Auftrags­bezogene Sequenz + Positions-Codes.

| Status | Bedeutung | Farbe (Vorschlag) |
|---|---|---|
| **00** | in Dienststelle (einsatzbereit) | grün |
| **1** | Auftrag angenommen | gelb |
| **2** | unterwegs zum Einsatzort (EO) | gelb |
| **3** | eingetroffen am EO | rot |
| **4** | Abfahrt zum Zielort (ZO, Patient an Bord) | orange |
| **5** | eingetroffen am ZO | orange |
| **6** | Auftrag abgeschlossen | cyan |
| **7** | unterwegs zur Dienststelle | grün |
| **88** | Anfahrt zur (Vorhalte-)Position | blau |
| **08** | Position LKH (Landeskrankenhaus) | blau |
| **09** | Position UKH (Unfallkrankenhaus) | blau |
| **10** | Position CDK (Christian-Doppler-Klinik) | blau |
| … | weitere Codes existieren | → Insider/Research offen |

**Status-Lifecycle pro Auftrag:** 00 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 00 (oder 88 → 08/09/10)

**Spielmechanik Positions-Codes:** Stadt-Fahrzeuge warten nicht in der Wache, sondern an Vorhaltepositionen bei den Kliniken (LKH/UKH/CDK) → kürzere Anfahrtswege. Disponent schickt freie Fahrzeuge aktiv auf Position (88) = Flächendeckung als Statusmechanik! Fahrzeug auf Position 08/09/10 gilt als einsatzbereit mit Standort am jeweiligen KH.

**Offen (weiterer Research/Insider):** exakte Codes der Sonderstatus, Positions-Codes Süd, Anzeige im Fahrzeug-MDT.

### 10b. Sonderstatus (PLATZHALTER-Codes — Existenz bestätigt, Ziffern unbekannt)
Vom Insider bestätigt existieren: Dienstfahrt, Fahrzeugcheck, außer Betrieb, Lenkerwechsel, Dienststelle unbesetzt. Öffentliche Quellen geben die Salzburger Ziffern nicht her (NÖ-Analogie: dort sind Dienstfahrt/Bereitschaft eigene TETRA-Status). **Spielcodes bis zur Korrektur:**

| Code (Spiel) | Bedeutung | Effekt im Spiel |
|---|---|---|
| 91 | Dienstfahrt | nicht disponierbar, Position sichtbar |
| 92 | Fahrzeugcheck | 10–20 min blockiert (Schichtbeginn!) |
| 93 | Lenkerwechsel | 5 min blockiert |
| 94 | außer Betrieb (Defekt/Werkstatt) | bis Behebung weg, Reserve (5.80) aktivierbar |
| 95 | Dienststelle unbesetzt | ganze DSt offline (ehrenamtliche Lücken!) |

## 10c. FUNKPROTOKOLL SALZBURG ⭐⭐ (Insider — verbindlich fürs Spiel!)

**Rufschema:** `[GERUFENER] von [RUFER]` — Antwort des Gerufenen: **„kommen"** (oder „sprechbereit").
**Im Sprechfunk KURZFORM ohne Bundesland-Präfix:** „20-322", nicht „5.20-322"! (Anzeige/ELS führt die Langform, gesprochen wird kurz.)

**Beispieldialog (Original-Insider):**
> RTW: „Leitstelle von 20-322" · LST: „kommen" · RTW: „Laufende CPR, benötigen NEF und RTW" · LST: „Verstanden"
> (→ Disponent legt A4-Nachforderung an!)

**Leitstelle ruft Fahrzeug:** „20-322 von Leitstelle" → Fahrzeug: „kommen".
Quittung stets **„Verstanden"**. 

**Spielregeln daraus:** Funk-Feed & Anfunken nutzen exakt dieses Schema; KI-Mannschaft antwortet protokollkonform; Schnellphrasen vorformatiert; Stil-Bonus für korrekte Spieler-Funkdisziplin.

## 10d. Flavor & Eigenheiten ⭐ (Insider)
- **„Jumbo"** = Spitzname der Stadt-G-KTW **20-401 & 20-402** (je 2 Tragsessel + 2 Tragen) → Kategorie SCHWER/D4-Fälle, im Spiel mit Spitzname im Tooltip 😄
- **KIT (E1):** Anforderung **durch Mannschaft vor Ort oder Polizei**, Anfahrt **ohne Sondersignal** (passt zu E-Klasse ohne 🚨)
- **Bergrettung (140):** Schnittstelle Leitstelle ↔ Bergrettung läuft **via Funk**
- **Überregional** (Tirol/Bayern/OÖ): telefonisch Leitstelle-zu-Leitstelle ✅ bestätigt
- **First Responder:** Alarmierung per **App** (Gebiete unbekannt → Schätzung: dünn versorgte Landgemeinden)


---

## 11. HILFSFRIST & SCORING

- **ÖRK-Rahmenvorschrift:** Notfallort an öffentlicher Straße in **95% der Fälle ≤ 15 min** (Meldungseingang → Eintreffen Rettungsmittel)
- Disporegel (Tirol-Vorbild, SBG-Pendant offen): NA zusätzlich alarmieren, wenn RTW-Eintreffzeit > 6 min bei NA-Indikation
- In Salzburg keine gesetzliche Frist → 15 min als Spielstandard

**Score-Dimensionen:**
1. Abfragequalität (richtige Fragen, richtiges Stichwort)
2. Hilfsfrist-Quote (≤15 min, 95%-Ziel)
3. Mittelwahl (AO eingehalten? Über-/Unterdisposition?)
4. Zielklinik korrekt
5. Flächendeckung (keine Versorgungslöcher)
6. Anrufer-Zufriedenheit (Ton, EH-Anleitung)

---

## 12. UI-FENSTER (realer Leitstellen-Arbeitsplatz)

Reale ELS (z.B. eurofunk eOCS — Hersteller sitzt in St. Johann/Pg!) vereinen alle Module in einer Oberfläche. Spielfenster:

| # | Fenster | Inhalt | Rolle |
|---|---|---|---|
| 1 | **Anruf-Queue/Telefonie** | wartende Anrufe (144/14844/140), Wartezeit, Annahme-Button | Calltaker |
| 2 | **Abfragemaske** | Frageschema Schritt für Schritt, Antwort-Buttons, Stichwort-Vorschau | Calltaker |
| 3 | **Einsatzliste** | offene/laufende Aufträge: Nr., Stichwort, AO, Ort, Status, zugeteilte Mittel | beide |
| 4 | **Lagekarte (GIS)** | MapLibre/OSM: Fahrzeuge live (statusfarbig), Einsatzorte, Wachen, KH, Heli | Disponent |
| 5 | **Ressourcenübersicht** | alle Fahrzeuge nach DSt, Status, Dienstzeit, Typ — Alarmieren per Drag/Klick | Disponent |
| 6 | **Funkfeld/Status** | eingehende Statuswechsel, Sprechwünsche (Status 5), Quittieren | Disponent |
| 7 | **Einsatzprotokoll** | Zeitstempel-Log je Einsatz (auto) | beide |
| 8 | **KH-Kapazitäten** | Zielkliniken + Fachabteilungen (vereinfacht: Schockraum frei j/n) | Disponent |
| 9 | **Sonderlagen-Panel** | MANV-Stufen, Nachbarleitstellen-Anforderung, Heli-Verfügbarkeit (Tageslicht!) | Disponent |

Layout-Referenz: dunkles Multi-Monitor-Dispatch-Design, 14 identische Plätze als visuelles Vorbild (Foto Leitstelle Nord auf RK-Seite).

**✅ GESETZT (User):** Alle Fenster sind **frei verschiebbar, in der Größe anpassbar, ein-/ausblendbar** — Fenster-Manager wie im echten ELS. **Layouts speicherbar** (mehrere Presets, z.B. Calltaker-/Disponenten-Layout, persistiert pro Spieler).

---

## 12b. GESCHÄTZTE FLOTTEN (fehlende Dienststellen)

> Methode (User-Vorgabe): Schätzung im Verhältnis Einwohner/Gebiet zu belegten Dienststellen ähnlicher Größe (Referenzen: Saalfelden ~17k EW = 1 RTW + 3 KTW · Mittersill-Gebiet = NEF+RTW+2 KTW · Mattsee-Gebiet ~12k = 2 RTW). **Alle Werte = SCHÄTZUNG, Korrektur durch Insider willkommen.**

### Leitstelle NORD — geschätzt
| DSt (Kennung) | Gebiet ca. | Geschätzte Flotte |
|---|---|---|
| Lamprechtshausen (5.41?) | ~20k inkl. Stützpunkt Oberndorf | 2 RTW (1×24h), 2 KTW · Oberndorf: 1 RTW, 1 KTW |
| Straßwalchen (5.43?) | ~21k, 24h freiwillig besetzt (belegt!) | 1 RTW 24h, 1 RTW tags, 2 KTW |
| Seekirchen-Eugendorf (5.44?) | ~18k + A1-Abschnitt | 1 RTW 24h, 2 KTW, 1 BTW |
| Strobl (5.46?) | ~6k + Wolfgangsee-Tourismus | 1 RTW 24h, 1 KTW |
| Hallein (5.51?) | ~40k Tennengau-Kern | **NEF Tennengau (5.10-103?, Schätzung — 106 ist Stadt/LKH!)**, 2 RTW 24h, 4 KTW, 1 BTW, 1 EL |
| Golling (5.53?) | ~12k + A10-Abschnitt Lueg | 1 RTW 24h, 2 KTW |
| **NEF Stadt** ⭐Insider | — | **5.10-106 = dauerhaft LKH** (Haupt-NEF). **5.10-101 = Flughafen, bei C6 stationiert**: tagsüber Boden-NEF bei Heli-Schlechtwetter; **nachts 2. NEF am LKH, Besetzung durch KH-Personal → verlängerte Ausrückzeit!** |

### Leitstelle SÜD — geschätzt (Lücken)
| DSt (Kennung) | Gebiet ca. | Geschätzte Flotte |
|---|---|---|
| Gastein / Bad Hofgastein (5.63) | ~22k + Kur-/Skitourismus | **NAW Gasteinertal 24h** (real belegt als NAW!), 1 RTW, 3 KTW |
| Radstadt (5.68) | ~20k + Obertauern/Ski amadé | **NAW Ennspongau 24h**, 1 RTW (Winter +1), 3 KTW |
| Werfen (5.64) | ~8k + A10 | 1 RTW tags, 1 KTW |
| Tamsweg (5.91) | Lungau-Zentrum ~10k, Bezirksfunktion | NEF/Notfalldienst Lungau, 1 RTW 24h, 3 KTW |
| St. Michael (5.92) | ~7k + A10 Tauerntunnel-Süd! | 1 RTW 24h, 1 KTW |
| Mauterndorf (5.93) | ~5k + Obertauern-Süd | 1 N-KTW 24h, 1 KTW |

NAW-Hinweis: NAW transportiert selbst (Arzt an Bord) — in AT seit 2013 großteils durch NEF ersetzt, Gastein/Radstadt **bestätigt beide NAW (Insider 2026)** — Funkcodes unbekannt, Schätzung bleibt.

---

## 13. QUELLEN

- roteskreuz.at/salzburg: /leitstelle-salzburg, /flugrettung, /bezirksstellen, /fahrzeuge, /salzburg-stadt, News 24.05.2023 (Notrufabfrage), News Flugrettungsbilanz 2023
- Wikipedia: Landesleitstelle Salzburg, Christophorus 6, Funkrufname (AT-Schema)
- LstSim-Wiki: Leitstelle Tirol (Stichworte/AO/NOAS+), RLSt Salzburg Süd + /Fahrzeuge, Status
- bos-fahrzeuge.info: ÖRK BSt Salzburg-Stadt (Flotte), Einzelfahrzeuge Zell am See
- salzburg.gv.at: Gesundheitsplan (KH-Stufen); SALK; helirescue.at; ÖGAN (Hilfsfrist); ÖRK Rahmenvorschrift RD 2014
- Leitstelle Tirol Newsletter 05 (Statusmeldungen)

> Disclaimer fürs Spiel: Fan-Projekt, angelehnt an reale Strukturen; Stichworte/Details teils rekonstruiert; keine offiziellen RK-Daten.
