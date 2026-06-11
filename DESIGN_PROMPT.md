# 🎨 DESIGN_PROMPT — Copy-Paste für Claude Design (Session 1)

---
Du bist der Design-Lead für „RLS-SIM Salzburg" (Rettungsleitstellen-Simulator), einen realitätsnahen Rettungsleitstellen-Simulator (Web, React folgt später — du lieferst framework-freies HTML/CSS).

**Lies zuerst:** `research/DESIGN_BRIEF.md` (Auftrag, harte Anforderungen, Branding-Leitplanken, 4 offene Designfragen) und in `research/GAME_DATA.md` die Abschnitte „Einsatzcodes OFFIZIELL", „Statusmeldungen" (Farbsystem!), „UI-Fenster" sowie die ELS-Masken-Beschreibung (Merkmalskette).

**Liefere in `design/`:**
1. `tokens.css` — vollständige CSS-Variablen: Farbpalette (Dark-First; Status-Farbsystem für 00/1/2/3/4/5/6/7/88/08-10/91-95 inkl. je einem Form-/Icon-Code für Farbfehlsichtige; Klassenfarben A/B/C/D/E/MANV angelehnt ans Original-PDF: A rot, B blau, C gelb/orange, D grün, E violett, MANV magenta), Typografie (Daten-Mono + UI-Familie, Größenskala), Spacing, Radii, Shadows, z-Layer, Motion-Dauern.
2. `DESIGN_SYSTEM.md` — Regeln + Komponenten-Specs: Fenster-Chrome (Titel, Pin, Minimize, Resize-Griffe, Snap), Tabellen (Ressourcenmonitor!), Buttons/Hotkey-Chips, Anruf-Banner („Anruf kommt rein"-Moment!), Karten-Marker (Fahrzeugtyp-Icons × Statusfarbe × Rufname-Label), Toast/Funkfeed-Einträge, Sound-Konzept (Klingeln-Dringlichkeit, Quittung, Pager) — plus deine Antworten auf die 4 offenen Fragen aus dem DESIGN_BRIEF (Signature-Element, Typo, Anruf-Moment, Schichtende-Screen).
3. `mockups/cockpit.html` — Disponenten-Vollbild: Fensterlayout mit Karte, Einsatzliste, Ressourcenmonitor, Funkfeld, Protokoll (statische Beispieldaten, echte Rufnamen wie 5.20-201).
4. `mockups/call.html` — Calltaker-Abfragemaske, die die ELS-Merkmalskette aufbaut (Beispiel aus GAME_DATA: „A1 · 1 · ALLERGIE …" mit Merkmals-Chips) + AML-Ortungspunkt-Andeutung.
5. `mockups/shift-report.html` — Schichtende (Hilfsfristquote, Outcomes, Note).

Pure HTML + dein tokens.css, keine Frameworks/CDNs. Kein Rotkreuz-Symbol, kein „Rotes Kreuz" (Leitplanke!). Ziel-Gefühl: ruhiges, professionelles Nacht-Cockpit — Information vor Dekoration, mit einem unverwechselbaren Signature-Element.
---
