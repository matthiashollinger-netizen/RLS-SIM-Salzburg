# 🏗️ ARCHITECTURE — Plattform, Hosting & Verteilung

> FINAL entschieden mit Matthias (Review 11.06.2026): **Fan-Projekt, gratis, öffentlich.** Verkauf/Steam verworfen — das Rotkreuz-Schutzgesetz macht eine Vermarktung mit RK-Bezug praktisch unmöglich, und ohne RK-Bezug verlöre das Spiel seinen Kern.

## Roadmap ✅

**Phase 1 — Web (jetzt):** Alles rein, stabil machen. Architektur von Tag 1 **Tauri-ready**: KI hinter OpenAI-kompatibler Schnittstelle (WebLLM ↔ Ollama ↔ beliebige API austauschbar), Fenster-Engine Multi-Window-fähig gedacht, kein Browser-only-Hack im Kern.

**Phase 2 — Desktop (wenn Web stabil):** Tauri-Build **Windows + macOS** als **Gratis-Download** (GitHub Releases, wie Nexus). Mehrwerte: Ollama-Sidecar (7–8B-Modelle = bessere Anrufer), Whisper-Push-to-Talk (sprechen statt tippen), echtes Multi-Monitor, F-Tasten, Audio-Pipeline.

## Hosting & Workflow ✅ (gewohnt!)
- **Öffentliches GitHub-Repo** + **GitHub Pages** — exakt der Zugstatistik-Workflow: push → live.
- Releases der Desktop-Builds später über GitHub Releases (Tauri-Updater).
- Coop: WebRTC P2P via PeerJS-Cloud-Signaling (gratis); Fallback ohne jede Infrastruktur: manueller Verbindungscode (Copy-Paste Offer/Answer).
- Saves: IndexedDB + Export/Import als Datei (kein Backend, keine Kosten, volle Datenhoheit).

## ⚠️ Marken-Leitplanke (gilt auch für Gratis-Projekte!)
„Rotes Kreuz" (Name, Logo, rotes Kreuz auf weißem Grund) ist **gesetzlich geschützt** (Rotkreuzgesetz/Genfer Abkommen) — auch nichtkommerzielle Nutzung durch Dritte ist nicht frei. Daher:
- Reale Strukturen, Orte, Rufnamen, Abläufe: ✅ bleiben (Fakten sind frei)
- **Kein RK-Logo, kein rotes Kreuz-Symbol, kein „Rotes Kreuz" im Titel.** Branding: **„RLS-SIM Salzburg"** + eigenes Emblem.
- Disclaimer: „Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes."
- Bonus: hält die Tür offen, falls man dem Landesverband je eine offizielle Übungs-Version anbieten will. 😉

## Lizenzen Stack (alles sauber)
OSM ODbL (Attribution) · MapLibre BSD · WebLLM Apache 2.0 · Llama 3.2 Community License · PeerJS MIT · Tauri MIT.

## Tech-Stack Phase 1 (fix)
| Layer | Wahl |
|---|---|
| Frontend | React + Vite + TypeScript |
| Karte | MapLibre GL JS + OSM (dunkler Style) |
| KI | 3-Tier: Szenario-Engine / WebLLM / optionaler Endpoint — s. AI_CALLER_TECH.md |
| Coop | WebRTC P2P (PeerJS), Host-authoritativ |
| State/Saves | Zustand-Store, IndexedDB, Datei-Export |
| Audio | Web Audio API + Web Speech TTS |
| Deploy | öffentliches GitHub-Repo → GitHub Pages |
| Phase 2 | Tauri 2.x, Ollama-Sidecar, whisper.cpp, GitHub Releases |
