# 📋 PROJECT_PLAN — Dein Ablauf (Matthias)

## Die Antwort auf deine Frage: **Claude Design ZUERST, dann Claude Code.**

**Warum:** Wenn Code zuerst läuft, baut er funktionierende, aber generisch aussehende UI — und Design müsste danach durch hunderte Komponenten refactoren (teuer, fehleranfällig). Läuft **Design zuerst**, entstehen `design/tokens.css` + `DESIGN_SYSTEM.md` + 3 HTML-Mockups als *verbindliche Vorgabe* — Claude Code baut dann von der ersten Komponente an im richtigen Look (CLAUDE.md Regel 6 erzwingt das). Eine Design-Session vorweg spart dir einen kompletten Redesign-Durchlauf hinten.

Falls du es doch umgekehrt startest: kein Drama — CLAUDE.md hat einen Fallback (Code leitet provisorische Tokens aus dem DESIGN_BRIEF ab, klar als PROVISORISCH markiert). Aber empfohlen ist Design first.

---

## Ablauf Schritt für Schritt

**1. Repo & Ordner (du, 10 min)**
- Öffentliches GitHub-Repo erstellen (z.B. `rls-sim-salzburg`)
- Diesen Projektordner als Inhalt verwenden: `CLAUDE.md`, `PROJECT_PLAN.md`, `DESIGN_PROMPT.md`, `research/` (alle 7 Dokumente)
- API-Key: lege ihn als `secrets/anthropic.key` ab. **Wichtig:** Der Ordner `secrets/` wird von Claude Code in M0 sofort per `.gitignore` ausgeschlossen — committe vorher selbst nichts! (Sicherheitsnetz: CLAUDE.md Regel 3)

**2. Design-Pass (Claude Design, 1 Session)** — zwei Wege, da Claude Design keine losen Ordner nimmt:
- **Weg A (empfohlen): Repo verlinken.** Erst Schritt 1 abschließen und pushen — Claude Design kann Code-Repositories direkt als Kontext einbinden („Import → Repository"). Dann nur noch `DESIGN_PROMPT.md`-Inhalt als Prompt geben.
- **Weg B (ohne Repo, sofort): `DESIGN_SESSION_PAKET.docx` hochladen** — die eine Datei enthält Auftrag + alle Design-Fakten self-contained (DOCX ist offiziell unterstütztes Upload-Format; .md-Variante liegt bei, zur Not Inhalt als Text einfügen).
- Ergebnis (Export/Copy aus Claude Design) legst DU in `design/` ab und pushst: tokens.css, DESIGN_SYSTEM.md, mockups/ (3 HTML-Screens)
- Kurz drüberschauen: Gefällt dir die Richtung? Wenn nein → eine Feedback-Runde mit Design, bevor Code startet. Wenn ja → weiter.

**3. Code-Lauf (Claude Code + Fable, vollautonom)**
- Im Projektordner starten. Prompt genügt:
  > „Lies CLAUDE.md und arbeite alle Meilensteine M0–M10 vollständig autonom ab. Keine Rückfragen."
- Fable arbeitet M0–M10 ab, testet selbst, committet, deployt auf GitHub Pages, führt `BUILD_REPORT.md` + `ANNAHMEN.md`.
- Du machst: nichts. ☕ (Optional zwischendurch BUILD_REPORT lesen.)

**4. Dein Review (nach Abschluss)**
- Pages-URL öffnen, Tutorial-Schicht spielen
- `ANNAHMEN.md` lesen — dort stehen alle autonomen Entscheidungen; korrigiere per Folge-Prompt was nicht passt
- `REVIEW_LOG`/offene Insider-Punkte: Sonderstatus-Ziffern, Flachgau-Reihenfolge etc. kannst du jederzeit nachliefern → kleiner Daten-Update-Prompt

**5. Design-Feinschliff (Claude Design, Runde 2)**
- Screenshots der echten App an Design → Kritik & Token-Verfeinerung → Code-Prompt „wende Design-Update an" (nur tokens/Komponenten-Styles, Logik bleibt)

**6. Später: Phase 2 (Tauri Desktop)** — eigener Auftrag, wenn Web stabil. Nicht jetzt.

## Rollenbild
| Wer | Macht |
|---|---|
| **Claude Design** | tokens.css, DESIGN_SYSTEM.md, Mockups, Review-Runden — das komplette Visuelle |
| **Claude Code (Fable)** | M0–M10: Engine, UI gegen Tokens, Tests, CI, Deploy — autonom |
| **Du** | Repo+Key bereitstellen, 2× Geschmacks-Check (nach Design-Pass & am Ende), Insider-Daten nachliefern, spielen 🎮 |
