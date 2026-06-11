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

### Playwright-Smoke gegen Production-Preview
- **Entscheidung:** Smoke-Tests laufen gegen `vite build` + `vite preview` (Port 4173),
  nicht gegen den Dev-Server.
- **Begründung:** Testet die gleiche Artefakt-Konfiguration (relative Base), die auf Pages
  deployt wird.
