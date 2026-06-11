# DESIGN_SYSTEM — RLS-SIM Salzburg (PROVISORISCH)

> PROVISORISCH — durch Claude-Design-Pass ersetzen.
> Abgeleitet strikt aus `research/DESIGN_BRIEF.md`. `design/tokens.css` ist GESETZ:
> Komponenten verwenden ausschließlich CSS-Variablen, keine hartcodierten Farben/Abstände.

## Grundsätze

1. **Leitstellen-Cockpit, kein Browsergame.** Dunkle, ruhige Flächen; Information vor
   Dekoration. Referenzstimmung: eurofunk eOCS / moderne ELS.
2. **Dark-first.** Light-Mode ist Phase 2.
3. **Status-Farbsystem ist heilig** (GAME_DATA §10):
   | Status | Farbe | Token |
   |---|---|---|
   | 00 / 7 | grün | `--status-00` / `--status-7` |
   | 1 / 2 | gelb | `--status-1` / `--status-2` |
   | 3 | rot | `--status-3` |
   | 4 / 5 | orange | `--status-4` / `--status-5` |
   | 6 | cyan | `--status-6` |
   | 88 / 08 / 09 / 10 | blau | `--status-88` / `--status-pos` |
   | 91–95 außer Betrieb | grau | `--status-oos` |
4. **Farbfehlsicht:** Farbe nie alleiniger Träger — Status zusätzlich als Ziffer/Icon/Form
   (z. B. Statusziffer im Marker, Formcodierung im Ressourcenmonitor).
5. **Dichte:** Monospace (`--font-mono`) für Rufnamen, Status, Zeiten; klare Zeilenhöhen
   (`--lh-dense`), Tabellen mit `--fs-xs`/`--fs-sm`.
6. **Branding:** Kein Rotkreuz-Logo, kein rotes Kreuz, eigener Signal-Ton `--signal-red`
   (≠ ÖRK-CI). Produktname „RLS-SIM Salzburg".

## Fenster (Window-Manager)

- Chrome minimal: Titelleiste (`--window-titlebar-h`), Titel links, Pin/Minimize/Close rechts.
- Snap-Raster `--window-snap-grid`, Mindestgröße `--window-min-w` × `--window-min-h`.
- Aktives Fenster: `--shadow-window-active` + stärkerer Rand.
- Z-Order via Window-Manager im Bereich `--z-windows`.

## Komponenten-Regeln

- **Buttons:** Flächen `--bg-panel-raised`, Hover `--bg-hover`, Primary `--accent`.
  Destruktiv/SoSi-relevant: `--danger`. Fokus sichtbar: 2px `--border-focus`.
- **Inputs:** `--bg-panel-inset`, Border `--border-subtle`, Fokus `--border-focus`.
- **Alarm-Moment** („Anruf kommt rein"): Puls mit `--sosi-pulse`, dezent — kein Panik-UI.
- **Karte:** dunkler Stil; Fahrzeug-Marker = Typ-Icon + Statusfarbe + Statusziffer;
  Rufnamen-Label ab Zoomstufe.
- **Audio:** Klingelton, Funk-Quittung, Pager-Gong — über Mixer regelbar, Standard dezent.

## Typografie

- UI: `--font-ui` (System-Stack, kein Webfont-Download in Phase 1).
- Daten: `--font-mono`.
- Größenleiter: `--fs-xs` bis `--fs-display`.
