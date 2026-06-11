# 🎨 DESIGN_BRIEF — Claude Design als fester Projekt-Bestandteil

> Claude Design übernimmt das **komplette visuelle Design** (User-Vorgabe). Dieses Brief ist die Arbeitsgrundlage für jeden Design-Pass und wird in CLAUDE.md referenziert.

## Workflow (gesetzt)
1. **Design-Pass VOR Feature-Code:** Token-System + Layout-Konzept entsteht zuerst (Claude Design), Claude Code implementiert dagegen.
2. **Eigene Design-Datei im Repo:** `/design/tokens.css` + `/design/DESIGN_SYSTEM.md` — single source of truth. Kein Feature definiert eigene Farben/Abstände.
3. **Iterations-Schleife:** Nach jedem größeren Feature ein Review-Pass (Screenshot → Kritik → Verfeinerung), wie beim Zugstatistik-Redesign geplant.

## Brief: Worum geht's
Ein **Leitstellen-Cockpit**: professionelles Dispatch-Arbeitsplatz-Gefühl, kein verspieltes Game-UI. Referenz-Stimmung: eurofunk eOCS / moderne ELS — dunkle, ruhige Flächen, Information vor Dekoration, Status-Farben tragen Bedeutung. Der Spieler soll sich nach 5 Minuten wie ein Disponent fühlen, nicht wie in einem Browsergame.

## Harte Anforderungen
- **Fenster-Manager:** frei verschieb-/skalierbare Panels, Snap-Raster, speicherbare Layout-Presets (pro Rolle). Fenster-Chrome minimal (Titelleiste, Pin, Close).
- **Dark-First:** Leitstellen arbeiten dunkel. Light-Mode optional später.
- **Status-Farbsystem ist heilig:** 00/7 grün · 1/2 gelb · 3 rot · 4/5 orange · 6 cyan · 88/Position blau · außer Betrieb grau. Farben müssen auf einen Blick über die ganze Karte/Liste lesbar sein (auch Farbfehlsichtigkeit: zusätzlich Form/Icon-Codierung!).
- **Dichte:** Disponenten-UI verträgt hohe Informationsdichte — aber strukturiert (Monospace-Tabellen für Rufnamen/Status, klare Zeilenhöhen).
- **Audio-Design gehört dazu:** Klingelton-Dringlichkeit, Funk-Quittungs-Klick, Pager-Gong — dezent, nicht nervig (Lautstärke-Mixer!).
- **Karte:** dunkler MapLibre-Style, Fahrzeug-Marker = Typ-Icon + Statusfarbe + Rufname-Label bei Zoom.

## Branding-Leitplanke (aus ARCHITECTURE.md)
- **KEIN Rotkreuz-Logo/Symbol** — gesetzlich geschützt, gilt auch für Gratis-/Fan-Projekte! Eigenes Emblem entwickeln (z.B. stilisierter Leitstellen-Stern/Funkwellen + Salzburg-Silhouette).
- Akzentfarbe: darf im Signal-Rot-Bereich liegen (Rettungs-Assoziation), aber als eigener Ton — nicht ÖRK-CI 1:1 kopieren. Token --rk-red #E2001A aus Zugstatistik als Ausgangspunkt → fürs Spiel eigenen Signal-Ton ableiten (z.B. wärmeres Notruf-Rot + Amber für Dringlichkeit).
- ✅ Name gesetzt: **„RLS-SIM Salzburg — Rettungsleitstellen-Simulator"** (RLS = echtes internes Kürzel aus dem offiziellen Einsatzcode-PDF).

## Offene Design-Fragen (für ersten Design-Pass)
1. Signature-Element: Was macht dieses Spiel visuell unverwechselbar? (Kandidat: die Status-Lichterkette der ganzen Flotte als „Herzschlag" der Leitstelle im Header?)
2. Typografie: technische Mono für Daten + welche Display-/UI-Familie?
3. Wie sieht der „Anruf kommt rein"-Moment aus? (Der wichtigste Mikro-Moment des Spiels — darf Puls haben, ohne Panik-UI zu sein)
4. Schicht-Ende-Screen: nüchterner Report oder zelebrierter Moment?
