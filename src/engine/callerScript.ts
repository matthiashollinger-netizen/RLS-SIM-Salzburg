import type { Scenario } from './scenario.ts'

/**
 * Tier-1 caller engine (AI_CALLER_TECH §Tier 1): deterministic, scripted
 * answers per question — the game is fully playable without any LLM.
 * Rules mirror the Tier-2 prompt rules: never invent facts, reveal
 * `verschweigtBisGefragt` info only on the matching question.
 */

export interface CallerState {
  /** panic reduced by 'beruhigen' actions */
  calmed: boolean
  /** wrong house number already corrected? */
  hausnummerKorrigiert: boolean
  /** questions already asked (ids) */
  asked: string[]
}

export function initialCallerState(): CallerState {
  return { calmed: false, hausnummerKorrigiert: false, asked: [] }
}

function panicPrefix(s: Scenario, state: CallerState): string {
  if (s.anrufer.emotion === 'panisch' && !state.calmed) return 'Oh Gott, oh Gott… '
  if (s.anrufer.emotion === 'betrunken') return 'Heast… also… '
  return ''
}

export function greeting(s: Scenario): string {
  switch (s.callType) {
    case 'taschenwaehler':
      return '(Rascheln… gedämpfte Stimmen… keine Antwort)'
    case 'irrlaeufer':
      return 'Ja hallo, ich wollte fragen, wann die Apotheke am Hauptbahnhof aufsperrt?'
    case 'rueckfrage':
      return 'Grüß Gott, ich hab vorhin angerufen — wann kommt denn jetzt die Rettung?'
    case 'krankentransport':
      return `Guten Tag, ich möchte einen Krankentransport anmelden. ${s.ktKategorie === 'DIALYSE' ? 'Für die Dialyse, wie jede Woche.' : 'Für eine Fahrt ins Krankenhaus.'}`
    case 'notfall': {
      if (s.anrufer.sprache === 'en')
        return `Hello?! Do you speak English? We need help! ${s.truth.lageText}`
      const prefix =
        s.anrufer.emotion === 'panisch'
          ? 'Schnell, Sie müssen kommen!! '
          : s.anrufer.emotion === 'aufgeregt'
            ? 'Hallo?! Wir brauchen die Rettung! '
            : 'Grüß Gott. '
      return prefix + s.truth.lageText
    }
  }
}

/** Answer to a question id from the Abfragemaske. */
export function answerFor(s: Scenario, frageId: string, state: CallerState): string {
  state.asked.push(frageId)
  const t = s.truth
  const pre = panicPrefix(s, state)

  if (s.callType === 'taschenwaehler') return '(weiter nur Rascheln…)'
  if (s.callType === 'irrlaeufer')
    return 'Apotheke! Ach so, da bin ich falsch? Entschuldigung… (legt auf)'
  if (s.callType === 'rueckfrage')
    return 'Vor zehn Minuten hab ich angerufen, Huber mein Name. Es geht um meine Mutter.'

  switch (frageId) {
    case 'ort': {
      if (!s.anrufer.kenntAdresse) {
        return pre + 'Ich… ich weiß es nicht genau, ich bin hier nur vorbeigekommen! Irgendwo in ' + t.ort.stadtteil + ', glaub ich!'
      }
      if (s.stoerungen.includes('falsche_hausnummer') && !state.hausnummerKorrigiert) {
        state.hausnummerKorrigiert = true
        return pre + `${t.ort.strasse} 12, in ${t.ort.stadtteil}… nein warten Sie, 21! Hausnummer 21!`
      }
      return pre + `${t.ort.strasse}, in ${t.ort.stadtteil}.`
    }
    case 'geschehen':
      return pre + t.lageText
    case 'personen':
      if (s.anrufer.emotion === 'panisch' && !state.calmed && t.personen > 1)
        return pre + 'Viele! Mehrere! Ich weiß nicht genau!'
      return t.personen === 1 ? 'Nur eine Person.' : `${t.personen} Personen, glaube ich.`
    case 'rueckruf':
      return 'Ja, unter der Nummer bin ich erreichbar.'
    case 'bewusstsein':
      return t.ansprechbar
        ? 'Ja, reden kann er/sie schon, aber es geht ganz schlecht.'
        : pre + 'Nein! Keine Reaktion, ich hab schon gerüttelt!'
    case 'atmung':
      return t.atmet
        ? 'Ja, atmen tut er/sie.'
        : pre + 'Nein!! Ich glaub nicht… da kommt nichts!'
    case 'alter':
      if (s.anrufer.verschweigtBisGefragt.includes('alter') === false && state.asked.filter((a) => a === 'alter').length > 1)
        return `Wie gesagt, ungefähr ${t.alter}.`
      return `So ungefähr ${t.alter} Jahre.`
    case 'zugang':
      switch (t.zugang) {
        case 'frei':
          return 'Ja, die Tür ist offen, Sie kommen gut dazu.'
        case 'versperrt':
          return 'Die Wohnungstür ist zugesperrt! Ich komm nicht rein!'
        case 'schwer':
          return 'Es ist schwer zu erreichen, ein steiler Weg hinunter.'
      }
      break
    case 'detail1':
      return t.detail1
    case 'detail2':
      return t.detail2
    case 'beruhigen': {
      state.calmed = true
      return s.anrufer.emotion === 'panisch'
        ? '(atmet durch) Okay… okay. Ich versuch ruhig zu bleiben.'
        : 'Ja, passt. Was brauchen Sie noch?'
    }
    case 'eh_anweisung':
      return s.truth.atmet
        ? 'Gut, ich bleib bei ihr/ihm und passe auf die Atmung auf.'
        : 'Okay! Ich drücke — sagen Sie mir den Takt an!'
    case 'sms_hinweis':
      return s.anrufer.emotion === 'panisch' && !state.calmed
        ? 'Eine SMS?! Ich kann jetzt nicht aufs Handy schauen!!'
        : 'Okay, ich schau aufs Handy und drück auf den Link.'
  }
  return 'Ich weiß es nicht!'
}

/** Will the caller tap the Ortungs-SMS link? (GAME_DATA §3b SMS-Link-Ortung) */
export function acceptsOrtungsSms(s: Scenario, state: CallerState, roll: number): boolean {
  if (s.callType !== 'notfall' && s.callType !== 'krankentransport') return false
  if (s.anrufer.emotion === 'panisch' && !state.calmed) return roll < 0.4
  return roll < 0.85
}
