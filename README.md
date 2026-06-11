# RLS-SIM Salzburg

**Rettungsleitstellen-Simulator** — eine realitätsnahe Web-Simulation des Salzburger
Rettungsdienst-Leitstellenalltags (Calltaker & Disponent), angelehnt an reale Strukturen.

> **Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes.**

## Status

In Entwicklung (Meilensteine M0–M10, siehe `BUILD_REPORT.md`).

## Entwicklung

```bash
npm install
npm run dev        # Dev-Server
npm run lint       # ESLint
npm test           # Vitest Unit-Tests
npm run build      # Production-Build
npm run smoke      # Playwright-Smoke (baut + preview)
```

## Tech-Stack

React 18 · Vite · TypeScript (strict) · Zustand · MapLibre GL JS + OSM ·
@mlc-ai/web-llm · Web Speech API · PeerJS · IndexedDB (idb) · Vitest · Playwright

## Lizenzen / Attribution

Kartendaten © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende (ODbL).
