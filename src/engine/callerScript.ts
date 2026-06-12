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

/** In-character reply to a question the caller cannot answer (Rework #9). */
export function unknownReply(s: Scenario, state: CallerState): string {
  if (s.anrufer.emotion === 'panisch' && !state.calmed)
    return 'ICH WEISS ES NICHT! Bitte, kommen Sie einfach schnell!'
  if (s.anrufer.emotion === 'betrunken')
    return 'Pfff… keine Ahnung, ehrlich gesagt. Is das wichtig?'
  if (s.anrufer.rolle === 'passant')
    return 'Das kann ich Ihnen nicht sagen, ich kenn die Person ja gar nicht.'
  if (s.anrufer.rolle === 'kind') return 'Ich weiß nicht… soll ich die Mama fragen?'
  return 'Das weiß ich leider nicht.'
}

/** Repeated questions annoy the caller — and get a shortened repeat (Rework #9). */
const REPEATABLE = new Set([
  'ort',
  'personen',
  'alter',
  'bewusstsein',
  'atmung',
  'zugang',
  'detail1',
  'detail2',
  'geschehen',
])

/** Answer to a question id from the Abfragemaske. */
export function answerFor(s: Scenario, frageId: string, state: CallerState): string {
  const isRepeat = REPEATABLE.has(frageId) && state.asked.includes(frageId)
  state.asked.push(frageId)
  const t = s.truth
  const pre = panicPrefix(s, state)

  if (s.callType === 'taschenwaehler') return '(weiter nur Rascheln…)'
  if (s.callType === 'irrlaeufer')
    return 'Apotheke! Ach so, da bin ich falsch? Entschuldigung… (legt auf)'
  if (s.callType === 'rueckfrage')
    return 'Vor zehn Minuten hab ich angerufen, Huber mein Name. Es geht um meine Mutter.'

  if (isRepeat) {
    const kern = coreAnswer(s, frageId, state)
    if (s.anrufer.emotion === 'panisch' && !state.calmed)
      return `Das hab ich doch schon gesagt!! ${kern}`
    if (s.anrufer.emotion === 'betrunken') return `Hab ich das nicht eh schon…? Also: ${kern}`
    return `Wie gesagt: ${kern}`
  }

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
  return unknownReply(s, state)
}

/** Short factual core for repeated questions. */
function coreAnswer(s: Scenario, frageId: string, state: CallerState): string {
  const t = s.truth
  switch (frageId) {
    case 'ort':
      return s.anrufer.kenntAdresse
        ? `${t.ort.strasse}, ${t.ort.stadtteil}.`
        : `Irgendwo in ${t.ort.stadtteil}, genauer weiß ich es nicht!`
    case 'geschehen':
      return t.lageText
    case 'personen':
      return t.personen === 1 ? 'Eine Person.' : `${t.personen} Personen.`
    case 'alter':
      return `ungefähr ${t.alter}.`
    case 'bewusstsein':
      return t.ansprechbar ? 'Ansprechbar ist er/sie.' : 'Keine Reaktion!'
    case 'atmung':
      return t.atmet ? 'Atmen tut er/sie.' : 'Da kommt keine Atmung!'
    case 'zugang':
      return t.zugang === 'frei'
        ? 'Die Tür ist offen.'
        : t.zugang === 'versperrt'
          ? 'Es ist zugesperrt!'
          : 'Schwer hinzukommen.'
    case 'detail1':
      return t.detail1
    case 'detail2':
      return t.detail2
    default:
      return unknownReply(s, state)
  }
}

/** Will the caller tap the Ortungs-SMS link? (GAME_DATA §3b SMS-Link-Ortung) */
export function acceptsOrtungsSms(s: Scenario, state: CallerState, roll: number): boolean {
  if (s.callType !== 'notfall' && s.callType !== 'krankentransport') return false
  if (s.anrufer.emotion === 'panisch' && !state.calmed) return roll < 0.4
  return roll < 0.85
}
