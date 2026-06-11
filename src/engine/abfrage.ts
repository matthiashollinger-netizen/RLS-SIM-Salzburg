/**
 * Standardisierte Notrufabfrage (GAME_DATA §3, AMPDS-angelehnt):
 * question catalog, Hauptbeschwerde→Kategorie mapping and the ELS-Merkmalskette
 * (format per GAME_DATA §4 ELS-Maske example).
 */

export type FragePhase = 1 | 2 | 3

export interface Frage {
  id: string
  text: string
  phase: FragePhase
  /** info key revealed by this question (matches Scenario knowledge keys) */
  infoKey: string
}

export const FRAGEN: Frage[] = [
  { id: 'ort', text: 'Wo genau ist der Notfallort?', phase: 1, infoKey: 'ort' },
  { id: 'geschehen', text: 'Was genau ist passiert?', phase: 1, infoKey: 'geschehen' },
  { id: 'personen', text: 'Wie viele Personen sind betroffen?', phase: 1, infoKey: 'personen' },
  { id: 'rueckruf', text: 'Unter dieser Nummer erreichbar?', phase: 1, infoKey: 'rueckruf' },
  { id: 'bewusstsein', text: 'Ist die Person ansprechbar?', phase: 2, infoKey: 'bewusstsein' },
  { id: 'atmung', text: 'Atmet die Person normal?', phase: 2, infoKey: 'atmung' },
  { id: 'alter', text: 'Wie alt ist die Person ungefähr?', phase: 2, infoKey: 'alter' },
  { id: 'zugang', text: 'Ist die Person frei zugänglich?', phase: 2, infoKey: 'zugang' },
  { id: 'detail1', text: 'Spezifische Frage 1', phase: 3, infoKey: 'detail1' },
  { id: 'detail2', text: 'Spezifische Frage 2', phase: 3, infoKey: 'detail2' },
]

export const frageById = new Map(FRAGEN.map((f) => [f.id, f]))

/** Hauptbeschwerde buttons → category + default severity (GAME_DATA §4 Stichworte). */
export interface Hauptbeschwerde {
  id: string
  label: string
  categoryId: string
  severity: 'hoch' | 'normal'
  /** category-specific phase-3 questions (GAME_DATA §3 Phase 3) */
  detailFragen: [string, string]
}

export const HAUPTBESCHWERDEN: Hauptbeschwerde[] = [
  { id: 'reanimation', label: 'Leblos/keine Atmung', categoryId: 'STILL', severity: 'hoch', detailFragen: ['Sehen Sie die Person?', 'Trauen Sie sich Herzdruckmassage zu?'] },
  { id: 'brustschmerz', label: 'Brustschmerz', categoryId: 'INTERN', severity: 'hoch', detailFragen: ['Strahlt der Schmerz aus?', 'Ist die Person kaltschweißig?'] },
  { id: 'atemnot', label: 'Atemnot', categoryId: 'INTERN', severity: 'hoch', detailFragen: ['Kann die Person sprechen?', 'Bekannte Lungenerkrankung?'] },
  { id: 'bewusstlos', label: 'Bewusstlos/Kollaps', categoryId: 'INTERN', severity: 'hoch', detailFragen: ['Atmet die Person normal?', 'Zuckungen beobachtet?'] },
  { id: 'schlaganfall', label: 'Schlaganfall-Zeichen', categoryId: 'NEURO', severity: 'hoch', detailFragen: ['Hängt ein Mundwinkel? (FAST)', 'Seit wann bestehen die Zeichen?'] },
  { id: 'krampfanfall', label: 'Krampfanfall', categoryId: 'NEURO', severity: 'hoch', detailFragen: ['Krampft die Person noch?', 'Bekannte Epilepsie?'] },
  { id: 'sturz', label: 'Sturz/Verletzung', categoryId: 'TRAUMA', severity: 'normal', detailFragen: ['Aus welcher Höhe gestürzt?', 'Nimmt die Person Blutverdünner?'] },
  { id: 'verkehrsunfall', label: 'Verkehrsunfall', categoryId: 'VERKEHR', severity: 'hoch', detailFragen: ['Ist jemand eingeklemmt?', 'Wie viele Fahrzeuge sind beteiligt?'] },
  { id: 'blutung', label: 'Starke Blutung', categoryId: 'CHIR', severity: 'hoch', detailFragen: ['Spritzt die Blutung?', 'Lässt sie sich stillen?'] },
  { id: 'bauchschmerz', label: 'Bauchschmerz/Kolik', categoryId: 'CHIR', severity: 'normal', detailFragen: ['Wo genau sind die Schmerzen?', 'Erbrechen oder Blut im Stuhl?'] },
  { id: 'allergie', label: 'Allergische Reaktion', categoryId: 'ALLERGIE', severity: 'hoch', detailFragen: ['Schwillt Gesicht/Zunge an?', 'Bekannte Allergie/Notfallset?'] },
  { id: 'vergiftung', label: 'Vergiftung/Überdosis', categoryId: 'INTOX', severity: 'hoch', detailFragen: ['Was wurde eingenommen?', 'Wann wurde es eingenommen?'] },
  { id: 'geburt', label: 'Geburt/Schwangerschaft', categoryId: 'GYN', severity: 'hoch', detailFragen: ['Wehenabstand in Minuten?', 'Welche Schwangerschaftswoche?'] },
  { id: 'psychisch', label: 'Psychiatrischer Notfall', categoryId: 'PSYCH', severity: 'normal', detailFragen: ['Besteht Suizidgefahr?', 'Ist die Person aggressiv?'] },
  { id: 'gewalt', label: 'Gewalt/Stichverletzung', categoryId: 'GEWALT', severity: 'hoch', detailFragen: ['Ist der Täter noch vor Ort?', 'Wo ist die Verletzung?'] },
  { id: 'wasser', label: 'Wassernotfall', categoryId: 'WASSER', severity: 'hoch', detailFragen: ['Ist die Person noch im Wasser?', 'Wie lange unter Wasser?'] },
  { id: 'alpin', label: 'Alpinunfall', categoryId: 'ALPIN', severity: 'hoch', detailFragen: ['Ist der Ort zu Fuß erreichbar?', 'Wetter/Sicht vor Ort?'] },
  { id: 'brand', label: 'Brand mit Verletzten', categoryId: 'BRAND', severity: 'hoch', detailFragen: ['Sind noch Personen im Gebäude?', 'Rauchgase eingeatmet?'] },
  { id: 'strom', label: 'Stromunfall', categoryId: 'STROM', severity: 'hoch', detailFragen: ['Ist der Strom abgeschaltet?', 'War es Hochspannung?'] },
  { id: 'eingeklemmt', label: 'Eingeklemmt/Verschüttet', categoryId: 'VERSCHUETTUNG', severity: 'hoch', detailFragen: ['Wodurch eingeklemmt?', 'Ist die Person ansprechbar?'] },
  { id: 'eingeschlossen', label: 'Person eingeschlossen', categoryId: 'EINGESCHLOSSEN', severity: 'normal', detailFragen: ['Wo eingeschlossen (Lift/Wohnung)?', 'Medizinischer Notfall dabei?'] },
  { id: 'krank', label: 'Erkrankung allgemein', categoryId: 'KRANK', severity: 'normal', detailFragen: ['Seit wann geht es ihr/ihm schlecht?', 'Fieber oder Erbrechen?'] },
  { id: 'rufhilfe', label: 'Rufhilfe-Alarm', categoryId: 'RUFHILFE', severity: 'normal', detailFragen: ['Reagiert die Person auf Ansprache?', 'Ist ein Schlüssel hinterlegt?'] },
  { id: 'unklar', label: 'Unklare Lage', categoryId: 'SONST', severity: 'hoch', detailFragen: ['Was genau sehen Sie?', 'Bewegt sich die Person?'] },
]

export const hauptbeschwerdeById = new Map(HAUPTBESCHWERDEN.map((h) => [h.id, h]))

/** Krankentransport-Anmeldung categories (Anruf-Triage, GAME_DATA §4 D/E). */
export const KT_KATEGORIEN = ['HEIM', 'DIALYSE', 'AMB', 'STAT', 'EINWEISUNG'] as const

export interface AbfrageAnswers {
  rolle?: 'selbst' | 'angehoeriger' | 'passant' | 'fachpersonal' | 'kind'
  hauptbeschwerdeId?: string
  categoryId?: string
  severity?: 'hoch' | 'normal'
  personen?: number
  alter?: number
  ansprechbar?: boolean
  atmet?: boolean
  zugang?: 'frei' | 'versperrt' | 'schwer'
  adresse?: { stadtteil: string; strasse: string; lat: number; lon: number; quelle: string }
  rueckrufOk?: boolean
}

const ROLLE_TEXT: Record<NonNullable<AbfrageAnswers['rolle']>, string> = {
  selbst: 'Anrufer selbst betroffen',
  angehoeriger: 'Fremdanrufer Angehörige/r',
  passant: 'Fremdanrufer Passant',
  fachpersonal: 'Anforderung durch Fachpersonal',
  kind: 'Anrufer Kind',
}

/**
 * Build the ELS-Merkmalskette — style per GAME_DATA §4 example:
 * „medizinischer Notruf, Fremdanrufer Erwachsener, 1 Person betroffen/in Gefahr,
 *  Erwachsener (ab 13 J.), Person spricht, Anaphylaxie…, Person frei zugänglich"
 */
export function buildMerkmalskette(answers: AbfrageAnswers, kt = false): string[] {
  const teile: string[] = [kt ? 'Krankentransport-Anmeldung' : 'medizinischer Notruf']
  if (answers.rolle) teile.push(ROLLE_TEXT[answers.rolle])
  if (answers.personen !== undefined)
    teile.push(`${answers.personen} Person${answers.personen === 1 ? '' : 'en'} betroffen/in Gefahr`)
  if (answers.alter !== undefined)
    teile.push(answers.alter < 13 ? `Kind (${answers.alter} J.)` : `Erwachsener (ab 13 J.)`)
  if (answers.ansprechbar !== undefined)
    teile.push(answers.ansprechbar ? 'Person spricht' : 'Person nicht ansprechbar')
  if (answers.atmet !== undefined)
    teile.push(answers.atmet ? 'Atmung vorhanden' : 'keine normale Atmung!')
  const hb = answers.hauptbeschwerdeId
    ? hauptbeschwerdeById.get(answers.hauptbeschwerdeId)
    : undefined
  if (hb) teile.push(hb.label)
  if (answers.zugang)
    teile.push(
      answers.zugang === 'frei'
        ? 'Person frei zugänglich'
        : answers.zugang === 'versperrt'
          ? 'Zugang versperrt'
          : 'Person schwer zugänglich',
    )
  return teile
}

/**
 * Category from interview: Hauptbeschwerde choice, upgraded by vital answers
 * (keine Atmung → STILL, GAME_DATA §3 Schlüsselfragen).
 */
export function categoryFromAnswers(answers: AbfrageAnswers): {
  categoryId: string
  severity: 'hoch' | 'normal'
} {
  if (answers.atmet === false) return { categoryId: 'STILL', severity: 'hoch' }
  const hb = answers.hauptbeschwerdeId
    ? hauptbeschwerdeById.get(answers.hauptbeschwerdeId)
    : undefined
  if (!hb) return { categoryId: 'SONST', severity: 'hoch' }
  const severity = answers.ansprechbar === false ? 'hoch' : hb.severity
  return { categoryId: hb.categoryId, severity }
}
