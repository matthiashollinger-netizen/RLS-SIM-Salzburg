# 🤖 AI_CALLER_TECH — KI-Anrufer ohne API-Kosten

> Anforderung (Matthias): Anrufe verschieden, realistisch, reagieren auf Rückfragen, KI-gestützt — **aber keine laufenden API-Kosten.**
> Lösung: 3-Stufen-Hybrid. Kern = **WebLLM** (lokales LLM im Browser, gratis).

---

## Die Lösung im Überblick

**WebLLM** (MLC AI, ~18k GitHub-Stars): führt echte LLMs (Llama 3.2, Phi 3.5, Qwen, Gemma) **komplett im Browser** aus — via WebGPU, ohne Server, ohne API-Key, ohne Kosten. OpenAI-kompatible API (gleicher Code wie für Cloud-APIs), Streaming, JSON-Mode. Modell wird einmalig geladen (~1.7–2.3 GB) und in IndexedDB gecacht → danach **offline** spielbar. Benchmarks: Phi-3.5-mini ~71 tok/s auf M3 Max — mehr als genug für Dialog-Tempo.

Browser-Support: Desktop >90% (Chrome/Edge/Safari mit WebGPU), Mobile ~70–75%. Fallback für alte Geräte: WASM (wllama) oder Tier 1.

## Architektur: 3 Stufen

### Tier 1 — Szenario-Engine (immer aktiv, 0 MB)
Deterministischer Generator erzeugt pro Anruf ein **Szenario-Objekt**:
```json
{
  "wahrheit": { "stichwort": "INTERN", "code": "A1", "lage": "65M, Brustschmerz, kaltschweißig", 
                 "ort": "Getreidegasse 12, Salzburg", "patient": {...} },
  "anrufer": { "typ": "Ehefrau", "emotion": "panisch", "sprache": "de-AT",
               "wissen": ["sieht Patient", "kennt Adresse"], 
               "verschweigt_bis_gefragt": ["Vorerkrankung KHK", "Medikamente"] },
  "stoerungen": ["nennt zuerst falsche Hausnummer"]
}
```
+ Dialogbaum mit Textbausteinen als **Fallback ohne LLM** (alte Geräte, Schnellspiel-Modus). Vorteil: testbar, balancierbar, Scoring-Wahrheit liegt hier — das LLM kann nichts "erfinden", was das Scoring bricht.

### Tier 2 — WebLLM-Anrufer (Standard) ⭐
Kleines lokales Modell **spielt** das Szenario:
- System-Prompt = Szenario-Objekt + Rollenregeln ("Du bist die panische Ehefrau. Antworte kurz, umgangssprachlich österreichisch. Gib Infos aus `verschweigt_bis_gefragt` NUR auf passende Frage preis. Erfinde keine neuen Fakten — bei Unbekanntem: 'Ich weiß es nicht!'")
- Reagiert frei auf jede Rückfrage des Spielers → echtes Gesprächsgefühl
- JSON-Mode parallel: nach jeder Spieler-Frage bewertet ein Mini-Check, welche Pflicht-Infos schon erfragt wurden (→ Live-Abfrage-Scoring)

**Modell-Empfehlung (Deutsch-tauglich, klein):**
| Modell | Größe (q4) | Eignung |
|---|---|---|
| Llama-3.2-3B-Instruct | ~1.9 GB | bester Allrounder, gutes Deutsch |
| Qwen2.5-3B-Instruct | ~2.0 GB | sehr gutes Deutsch, gute Rollentreue |
| Phi-3.5-mini | ~2.3 GB | schnell, Deutsch ok |
| Llama-3.2-1B | ~0.9 GB | Low-End-Geräte, einfachere Dialoge |

Code-Skizze:
```js
import { CreateMLCEngine } from "@mlc-ai/web-llm";
const engine = await CreateMLCEngine("Llama-3.2-3B-Instruct-q4f16_1-MLC",
  { initProgressCallback: p => ladebalken(p) }); // einmalig, dann Cache
const antwort = await engine.chat.completions.create({
  messages: [{ role: "system", content: szenarioPrompt }, ...gespraech],
  temperature: 0.8, max_tokens: 120
});
```

### Tier 3 — Eigener Endpoint (optional, Settings)
Da WebLLM die OpenAI-API spricht, ist ein **Endpoint-Feld in den Settings** trivial:
- **Ollama lokal** (Matthias = IT-Profi, self-hosted-Fan → Llama 3.1 8B daheim = Top-Qualität, 0 €)
- Beliebiger OpenAI-kompatibler Dienst (eigener Key, Free-Tiers)
- Claude API für die, die zahlen wollen
→ Ein URL/Key-Feld, gleicher Code. Default bleibt Tier 2.

## TTS (Sprachausgabe, auswählbar lt. Matthias)
- **Stufe 1 (gratis, sofort):** Web Speech API (`speechSynthesis`) — deutsche Systemstimmen, 0 Kosten, auf allen Plattformen
- **Stufe 2 (gratis, besser):** Browser-lokale Neural-TTS via transformers.js (z.B. Piper/Kokoro-Modelle im Browser) — natürlichere Stimmen, ~80–150 MB einmalig
- Spieler-Eingabe bleibt Text/Klick (STT optional später via Web Speech Recognition)

## Risiken & Gegenmaßnahmen
| Risiko | Maßnahme |
|---|---|
| Erstdownload ~2 GB schreckt ab | Klarer Lade-Screen mit Fortschritt + "Light-Modus ohne KI" (Tier 1) sofort spielbar |
| Kleines Modell halluziniert Fakten | Wahrheit liegt in Tier 1; LLM darf nur Szenario-Wissen verbalisieren; Regel "bei Unbekanntem: weiß nicht" |
| Dialekt-Qualität schwankt | Dialekt als Würze im Prompt, nicht als Pflicht; Anrufer-Mix (Touristen = Hochdeutsch/Englisch sowieso) |
| Mobile ohne WebGPU | Tier-1-Dialogbaum als vollwertiger Fallback |
| Antwortlatenz auf schwacher Hardware | 1B-Modell-Option + "tippt..."-Indikator (realistisch: Anrufer überlegt ja auch) |

## Fazit
**0 € laufende Kosten, volle Dialog-Freiheit, offline-fähig** — und dank OpenAI-kompatibler Schnittstelle jederzeit auf stärkere Modelle (Ollama/Cloud) upgradebar, ohne Code-Umbau. Passt perfekt zum GitHub-Pages-Deployment-Stil (wie Zugstatistik).
