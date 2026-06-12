// Changelog shown in the footer version popover (AppShell).
// UI strings are German (AT) per CLAUDE.md rule 7.

export interface ChangelogEntry {
  /** Short phase tag, e.g. "M0–M10" */
  readonly phase: string
  readonly titel: string
  readonly punkte: readonly string[]
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    phase: 'AAA-Pass',
    titel: 'Produktionsqualität',
    punkte: [
      'Titelbildschirm mit Funkraum-Atmosphäre, Lade- und Starterlebnis',
      'Sound-Design: UI-Töne, Alarmgong, Funkkreis-Ambiente',
      'Typografie gebündelt (Inter, JetBrains Mono), Versions- und Änderungsanzeige',
      'Performance-Politur: Kartenbibliothek als eigener Chunk, Vorladen im Menü',
    ],
  },
  {
    phase: 'Rework 2',
    titel: 'Straßenrouting & Lagefreigabe',
    punkte: [
      'Echtes Straßenrouting (OSM-Graph, A*) mit Routenanzeige auf der Karte',
      'Freie Mittelwahl, Umdisponieren und Auftrag-Detailansicht',
      'Funk-Feintuning: NA-Nachforderung, Lagemeldung, Lagefreigabe',
      'Getrennte Fenster für Gespräch und Abfrageschema, Coop-Menü',
    ],
  },
  {
    phase: 'Rework 1',
    titel: 'Spielbarkeit',
    punkte: [
      'Echte Koordinaten (Adress-Index) und Karten-Überarbeitung',
      'Zweistufige ELS-Alarmierung und Transportlogik',
      'Geführte Abfragemaske nach standardisiertem Schema',
      'Interaktiver Funk mit Schnellphrasen, weniger Funk-Spam',
    ],
  },
  {
    phase: 'M0–M10',
    titel: 'Grundspiel',
    punkte: [
      'Leitstellen-Kern: Anrufannahme, Disposition, Status-Lifecycle 00–7/88',
      'Karte (MapLibre), Fenster-Manager mit Layouts, Ressourcenmonitor',
      'KI-Anrufer (WebLLM) mit Dialogbaum-Fallback, TTS',
      'Spielfluss: Scoring, Schichtreport, Coop (2 Spieler), Editor, Tutorial',
    ],
  },
]
