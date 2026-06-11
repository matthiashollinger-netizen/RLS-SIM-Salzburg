# 🔍 REVIEW_LOG — QA-Pass 11.06.2026

> Kompletter Doppel-/Dreifach-Check aller Projektdokumente + Nachrecherche. Alle Funde sofort gefixt.

## ❌ Gefundene Fehler → ✅ gefixt

| # | Fund | Fix |
|---|---|---|
| 1 | **Stichwort-Tabelle (§4) nutzte noch Tirol-AO-Codes** (A2/A3; B2 = „ohne SoSi") — direkter Widerspruch zum bestätigten Salzburger Schema (dort B2 = Fachanforderung!) | Komplette Spalte auf SBG-Schema gemappt: A2/A3→A1 bzw. A1/B1, B2→B3; ANFORD explizit → B2. Fußnote ergänzt |
| 2 | **Telefonzahlen-Widerspruch:** News „~1.200 Anrufe/Tag" vs. Standortseiten „1.400 + 950" | Aufgelöst via Jahresbilanz 2024: 450.000 Anrufe/Jahr ≈ 1.233/Tag Inbound (News korrekt); Seitenwerte vmtl. inkl. Outbound. Als Quellen-Note + Balancing-Block dokumentiert |
| 3 | **Rufnamen-Anomalien aus LstSim-Quelle unkommentiert übernommen:** 5.71-201 doppelt (RTW *und* ITW); 5.75-301 (Rauris-Kennung) bei Zell gelistet; 5.10-306 doppelt (Schwarzach + Lammertal) | Anomalien-Box unter Kennungs-Tabelle; Spiel-Regel: eindeutige Vergabe (ITW → 5.71-210) |
| 4 | ARCHITECTURE.md enthielt verworfene Steam-/Cloudflare-/Privat-Repo-Strategie | Komplett neu geschrieben: öffentliches Repo + GitHub Pages (Zugstatistik-Workflow), Tauri-Phase-2 als Gratis-Download, Marken-Leitplanke bleibt |
| 5 | DESIGN_BRIEF begründete Branding-Verbot mit „Steam-Ziel" | Begründung korrigiert: Rotkreuzgesetz gilt auch für Gratis-Projekte |
| 6 | Coop-Technik-Zeile noch offen (❓) | Entschieden: PeerJS-Cloud + manueller Code-Fallback (0 Infrastruktur), Voice extern Phase 1 |

## ➕ Neu recherchiert & eingearbeitet

| Was | Wohin |
|---|---|
| **AML-Ortung** real für 144/140/141 aktiv (eurofunk/NÖ-Doku): Auto-GPS bei Notruf, SMS-Link-Ortung, Festnetz-Adressdaten, Netzbetreiber-Abfrage | GAME_DATA §3b (4-stufige Ortungskaskade) + GAME_MECHANICS als ✅-Feature — macht „Wo sind Sie?" spielbar |
| **Jahresbilanz 2024** (offiziell): 450k Anrufe, 89k Notrufe, 252.114 Patiententransporte, 94 First Responder mit 2.600 Einsätzen | GAME_DATA Balancing-Block mit konkreten Spiel-Zahlen (Nord ≈ 800 Anrufe/Tag, davon 160 Notrufe; Süd ≈ 430/85) |
| Flachgau-/Tennengau-Kennungen 5.42/5.45/5.52 (bos-fahrzeuge-Wachen-DB) | bereits in v2 eingearbeitet, Hypothesen 5.41/43/44/46 + 5.51/53 dokumentiert |
| Sonderstatus-Realität (NÖ TETRA: Dienstfahrt/Bereitschaft als eigene Status) | GAME_DATA §10b Platzhalter 91–95 |

## ✔️ Geprüft, kein Fehler
- Statuscodes 00–7/88/08/09/10 (Insider) konsistent in DATA + MECHANICS
- Funkrufnamen-Systematik 5.BD-TNN & Typenkreise 1XX–7XX in sich schlüssig, DSt-Code-Ableitung (042→5.42) durch 3 Belege gestützt
- Flugrettung (5 Helis, 4 Standorte, sunrise–sunset, Saisonregeln) gegen ÖAMTC/Heli-Austria-Angaben konsistent
- KH-Liste & „nächstes ≠ richtiges KH"-Logik plausibel (Pinzgau-Sonderwege dokumentiert)
- AI_CALLER 3-Tier: Lizenz- & Technik-Claims (WebLLM Apache 2.0, OpenAI-API-Kompatibilität, Modellgrößen) stichprobengeprüft
- Hilfsfrist 15 min/95 % als ÖRK-Empfehlung korrekt eingeordnet (kein Gesetz in Sbg)

## 📌 Verbleibende offene Punkte (bewusst offen)
1. Einsatzcodes C/D/E + evtl. A2ff → **kommt von Matthias**
2. Echte Ziffern der Sonderstatus (aktuell Spiel-Platzhalter 91–95)
3. Flachgau-Reihenfolge 5.41/43/44/46, Tennengau 5.51/53 → Insider/Zufallsfund
4. NAW Gastein/Radstadt: noch NAW oder schon NEF? (Quellen Stand ~2020)
5. Positions-Codes Süd (Pendant zu 08/09/10?)

## 📥 Update 2 — Offizielles Einsatzcode-PDF eingetroffen
Matthias lieferte das Original „Einsatzstichworte Landesleitstelle Salzburg V2 (12.05.2023)": Klassen A1–A4/B1–B4/C1–C6/D1–D6/E1–E6/MANV1–4 **inkl. Sondersignal-Markierung** + komplette Kategorienlisten (29 Notfall- + ~40 D/E-Kategorien) + ELS-Maskenformat. → Tirol-Stichwortkatalog vollständig ersetzt; MANV-Schwellen offiziell; frühere Extrapolation korrigiert (A2 = Alpin!, B3/B4-Logik = ohne SoSi via Symbol). GAME_DATA §4 + Einsatzcode-Kapitel neu geschrieben.

## 📥 Update 3 — Großes Insider-Paket + ELSSA-Recherche
Eingearbeitet: NEF-Stadt-Setup ⭐ (5.10-106 fix LKH; 5.10-101 Flughafen/C6 als Schlechtwetter-NEF, nachts 2. NEF LKH mit KH-Personal & verlängerter Ausrückzeit — frühere 106-Hallein-Schätzung korrigiert → 103?), NAW Gastein+Radstadt bestätigt, Status-Schema landesweit, Alarmtext `CODE STADTTEIL STRASSE`, KIT via Mannschaft/Polizei ohne SoSi, Bergrettung via Funk, FR per App, **Funkprotokoll §10c** („X von Y"/„kommen"/„Verstanden", Kurzrufnamen!), Flavor „Jumbo" (20-401/402). Recherche-Verifikation: ELS heißt **ELSSA** (BEKA Software, georedundant), Abfrage **DIASweb**, ELSSA-mobil-App — §3a neu; Branding-Regel: im Spiel neutral „ELS/MDT".
