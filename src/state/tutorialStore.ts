import { create } from 'zustand'
import { useCallStore } from './callStore.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { simulateDemoCall } from './debugActions.ts'

/** Onboarding tutorial (M10): guided first shift, auto-advancing on play state. */

export interface TutorialStep {
  id: string
  text: string
  /** auto-advance when true; undefined = manual "Weiter" */
  done?: () => boolean
  /** side effect when the step becomes active */
  onEnter?: () => void
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'willkommen',
    text: 'Willkommen in der Leitstelle! Du bist heute Calltaker UND Disponent. Links: Anrufe & Abfrage. Mitte: Lagekarte. Rechts: Einsatzliste & Ressourcen. Klicke „Weiter".',
  },
  {
    id: 'anruf',
    text: 'Es klingelt! Nimm den Anruf in der Anruf-Queue mit „Annehmen" an.',
    onEnter: () => simulateDemoCall(),
    done: () => useCallStore.getState().active !== null,
  },
  {
    id: 'abfrage',
    text: 'Führe die Notrufabfrage: Frage mindestens, WAS passiert ist und ob die Person ansprechbar ist (Frage-Buttons in der Abfrage).',
    done: () => {
      const call = useCallStore.getState().active
      if (!call) return true
      const asked = call.callerState.asked
      return asked.includes('geschehen') && asked.includes('bewusstsein')
    },
  },
  {
    id: 'beschwerde',
    text: 'Wähle jetzt die Hauptbeschwerde (hier: Brustschmerz) — daraus entsteht das Einsatzstichwort.',
    done: () => !!useCallStore.getState().active?.answers.hauptbeschwerdeId,
  },
  {
    id: 'auftrag',
    text: 'Die Adresse ist über die Festnetz-Daten schon da. Klicke „Auftrag anlegen" — der Einsatz wandert in die Einsatzliste.',
    done: () => Object.keys(useDispatchStore.getState().auftraege).length > 0,
  },
  {
    id: 'dispo',
    text: 'Jetzt disponieren: Wähle den Einsatz in der Einsatzliste und alarmiere die vorgeschlagenen Mittel (NA-Mittel + RTW) per Klick auf die Kandidaten.',
    done: () => {
      const a = Object.values(useDispatchStore.getState().auftraege)[0]
      return !!a && Object.keys(a.assigned).length >= 1
    },
  },
  {
    id: 'beobachten',
    text: 'Beobachte Karte und Funkfeld: Das Fahrzeug läuft Status 1 → 2 → 3 (Eintreffen). Tipp: Stelle oben 4× Geschwindigkeit ein. Du kannst es auch direkt anfunken („Eintreffzeit?").',
    done: () => {
      const a = Object.values(useDispatchStore.getState().auftraege)[0]
      return !!a && a.firstArrivalSec !== undefined
    },
  },
  {
    id: 'fertig',
    text: 'Eintreffen gemeldet — stark! So läuft jede Schicht: Anruf → Abfrage → Auftrag → Disposition → Funk → Outcome. Beende die Schicht oben rechts für deinen ersten Schichtreport. Viel Erfolg!',
  },
]

interface TutorialState {
  active: boolean
  stepIndex: number
  start: () => void
  next: () => void
  stop: () => void
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  active: false,
  stepIndex: 0,
  start: () => {
    set({ active: true, stepIndex: 0 })
  },
  next: () => {
    const i = get().stepIndex + 1
    if (i >= TUTORIAL_STEPS.length) {
      set({ active: false, stepIndex: 0 })
      return
    }
    set({ stepIndex: i })
    TUTORIAL_STEPS[i]?.onEnter?.()
  },
  stop: () => set({ active: false, stepIndex: 0 }),
}))
