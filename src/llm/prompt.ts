import type { Scenario } from '../engine/scenario.ts'

/**
 * System prompt from the scenario (AI_CALLER_TECH §Tier 2): the LLM only
 * verbalizes Tier-1 truth — it must not invent facts; withheld information is
 * revealed only when specifically asked.
 */

const ROLLE_TEXT: Record<Scenario['anrufer']['rolle'], string> = {
  selbst: 'Du bist selbst die betroffene Person.',
  angehoeriger: 'Du bist Angehörige/r der betroffenen Person und vor Ort.',
  passant: 'Du bist zufällig vorbeigekommen und kennst die Person nicht.',
  fachpersonal: 'Du bist medizinisches Fachpersonal (z. B. Ordination/Pflegeheim).',
  kind: 'Du bist ein Kind (ca. 9 Jahre alt) und rufst für einen Elternteil an.',
}

const EMOTION_TEXT: Record<Scenario['anrufer']['emotion'], string> = {
  ruhig: 'Du bist gefasst und antwortest klar.',
  aufgeregt: 'Du bist aufgeregt, redest schnell, aber kooperierst.',
  panisch:
    'Du bist panisch: kurze, gehetzte Sätze, manchmal unzusammenhängend. Erst wenn der Calltaker dich beruhigt, antwortest du klarer.',
  betrunken: 'Du bist deutlich alkoholisiert: weitschweifig, nuschelnd, leicht abschweifend.',
}

const VERSCHWEIGT_LABEL: Record<string, string> = {
  detail1: 'Detail 1 (siehe Fakten)',
  detail2: 'Detail 2 (siehe Fakten)',
  alter: 'das Alter der Person',
  zugang: 'die Zugänglichkeit',
}

export function buildSystemPrompt(s: Scenario): string {
  const t = s.truth
  const verschweigt = s.anrufer.verschweigtBisGefragt
    .map((k) => VERSCHWEIGT_LABEL[k] ?? k)
    .join(', ')

  const sprache =
    s.anrufer.sprache === 'en'
      ? 'Du sprichst NUR Englisch (Tourist). Du verstehst einfaches Deutsch kaum.'
      : 'Du sprichst umgangssprachliches österreichisches Deutsch (leichte Färbung, keine Karikatur).'

  return [
    'Du spielst einen ANRUFER beim Notruf 144 (Rettungsleitstelle Salzburg) in einer Simulation.',
    ROLLE_TEXT[s.anrufer.rolle],
    EMOTION_TEXT[s.anrufer.emotion],
    sprache,
    '',
    'FAKTEN — du kennst NUR diese. Erfinde NIEMALS neue Fakten (keine Namen, Hausnummern, Diagnosen):',
    `- Ort: ${t.ort.strasse}, ${t.ort.stadtteil}${s.anrufer.kenntAdresse ? '' : ' (du kennst die genaue Adresse NICHT, nur ungefähr die Gegend)'}`,
    `- Lage: ${t.lageText}`,
    `- Betroffene Personen: ${t.personen}`,
    `- Patient: ca. ${t.alter} Jahre, ${t.geschlecht === 'm' ? 'männlich' : 'weiblich'}`,
    `- Ansprechbar: ${t.ansprechbar ? 'ja' : 'NEIN'} · Atmung: ${t.atmet ? 'ja' : 'KEINE normale Atmung'}`,
    `- Zugang: ${t.zugang === 'frei' ? 'frei zugänglich' : t.zugang === 'versperrt' ? 'Tür versperrt' : 'schwer zugänglich'}`,
    `- Detail 1 (nur auf konkrete Frage): ${t.detail1}`,
    `- Detail 2 (nur auf konkrete Frage): ${t.detail2}`,
    '',
    verschweigt
      ? `Diese Informationen gibst du NUR preis, wenn konkret danach gefragt wird: ${verschweigt}.`
      : '',
    'Bei allem, was nicht in den Fakten steht: "Ich weiß es nicht!" (oder sinngemäß).',
    'Antworte KURZ: 1–2 Sätze, wie am Telefon. Keine Regieanweisungen, keine Aufzählungen.',
    'Du bleibst durchgehend in der Rolle des Anrufers.',
  ]
    .filter(Boolean)
    .join('\n')
}
