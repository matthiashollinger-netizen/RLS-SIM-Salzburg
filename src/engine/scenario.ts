import { balancing, categoryById, places } from '../data/index.ts'
import type { Place, Region } from '../data/schemas.ts'
import { HAUPTBESCHWERDEN, type Hauptbeschwerde } from './abfrage.ts'
import { pickWeighted, randBetween, type Rng } from './rng.ts'
import type { LatLon } from './geo.ts'

/**
 * Szenario-Generator Tier 1 (AI_CALLER_TECH §Tier 1): deterministic generator
 * producing the truth object + caller profile. The truth is the scoring
 * reference — an LLM (Tier 2) may only verbalize it, never invent facts.
 */

export type CallType =
  | 'notfall'
  | 'krankentransport'
  | 'rueckfrage'
  | 'irrlaeufer'
  | 'taschenwaehler'

export type AnruferRolle = 'selbst' | 'angehoeriger' | 'passant' | 'fachpersonal' | 'kind'
export type Emotion = 'ruhig' | 'aufgeregt' | 'panisch' | 'betrunken'

export interface ScenarioOrt extends LatLon {
  placeId: string
  stadtteil: string
  strasse: string
}

export interface ScenarioTruth {
  categoryId: string
  hauptbeschwerdeId: string
  severity: 'hoch' | 'normal'
  personen: number
  alter: number
  geschlecht: 'm' | 'w'
  ansprechbar: boolean
  atmet: boolean
  zugang: 'frei' | 'versperrt' | 'schwer'
  lageText: string
  detail1: string
  detail2: string
  ort: ScenarioOrt
}

export interface Scenario {
  id: string
  callType: CallType
  phone: 'handy' | 'festnetz'
  truth: ScenarioTruth
  anrufer: {
    rolle: AnruferRolle
    emotion: Emotion
    sprache: 'de' | 'en'
    kenntAdresse: boolean
    verschweigtBisGefragt: string[]
  }
  stoerungen: string[]
  /** AML point appears this many seconds after call start (handy only, GAME_DATA §3b) */
  amlAfterSec?: number
  amlRadiusM?: number
  /** Festnetz: registered address (usually = truth.ort) */
  anschlussAdresse?: ScenarioOrt
  /** KT booking target */
  ktZiel?: string
  ktKategorie?: string
  /** Second caller for an existing incident */
  duplicateOfAuftragId?: string
  /** Editor exercise call — resulting Auftrag is ÜBUNG (no scoring) */
  uebung?: boolean
  /** Story-arc hook id (M10) */
  storyArc?: string
}

const LAGE_TEXTE: Record<string, string[]> = {
  reanimation: [
    'Mein Mann ist umgefallen und rührt sich nicht mehr! Er schnauft so komisch!',
    'Da liegt einer am Boden, ganz blau im Gesicht, der atmet nicht!',
  ],
  brustschmerz: [
    'Mein Vater hat so einen Druck auf der Brust, ihm ist schlecht.',
    'Ich hab solche Schmerzen in der Brust, es zieht in den Arm.',
  ],
  atemnot: [
    'Meine Frau bekommt keine Luft mehr, sie ringt richtig!',
    'Der Nachbar sitzt am Fenster und schnappt nach Luft.',
  ],
  bewusstlos: [
    'Meine Mutter ist einfach zusammengesackt, jetzt ist sie wieder halbwegs da.',
    'Da ist jemand umgekippt im Geschäft, sie reagiert kaum.',
  ],
  schlaganfall: [
    'Mein Mann redet auf einmal so komisch und der Mundwinkel hängt.',
    'Die Oma kann den Arm nicht mehr heben und lallt.',
  ],
  krampfanfall: [
    'Mein Sohn krampft am ganzen Körper, bitte schnell!',
    'Da liegt wer am Gehsteig und zuckt ganz arg.',
  ],
  sturz: [
    'Die Nachbarin ist von der Leiter gefallen, das Bein steht ganz schief.',
    'Mein Vater ist gestürzt und jetzt blutet er am Kopf.',
  ],
  verkehrsunfall: [
    'Da ist ein Auto gegen einen Baum, die Windschutzscheibe ist kaputt!',
    'Zwei Autos sind zusammengekracht, eines liegt im Graben!',
  ],
  blutung: [
    'Er hat sich mit der Kreissäge geschnitten, das blutet wie verrückt!',
    'Meine Frau hat starkes Nasenbluten, es hört nicht auf, sie nimmt Marcoumar.',
  ],
  bauchschmerz: [
    'Ich hab seit Stunden so schlimme Bauchschmerzen, rechts unten.',
    'Meinem Mann ist speiübel und der Bauch ist ganz hart.',
  ],
  allergie: [
    'Mein Sohn ist von einer Wespe gestochen worden, das Gesicht schwillt an!',
    'Sie hat Nüsse gegessen und kriegt Ausschlag am ganzen Körper, die Zunge kribbelt.',
  ],
  vergiftung: [
    'Meine Tochter hat Tabletten geschluckt, ich weiß nicht wie viele!',
    'Mein Freund hat irgendwas genommen, er ist ganz weggetreten.',
  ],
  geburt: [
    'Meine Frau bekommt das Baby! Die Wehen kommen ganz schnell!',
    'Die Fruchtblase ist geplatzt, wir schaffen es nicht mehr ins Krankenhaus!',
  ],
  psychisch: [
    'Mein Bruder redet davon, sich was anzutun. Ich komm nicht zu ihm rein.',
    'Eine Frau steht da ganz aufgelöst und schreit, sie will springen.',
  ],
  gewalt: [
    'Da war eine Schlägerei vorm Lokal, einer liegt am Boden und blutet!',
    'Mein Nachbar wurde mit einem Messer verletzt! Der Typ ist weggerannt… glaub ich.',
  ],
  wasser: [
    'Im See treibt jemand, er bewegt sich nicht!',
    'Ein Kind ist in den Bach gefallen, sie haben es rausgezogen, es hustet ganz arg.',
  ],
  alpin: [
    'Mein Mann ist beim Wandern abgestürzt, ich sehe ihn unten am Schotterfeld!',
    'Auf der Piste liegt einer, der ist gegen den Lift gefahren, das Bein ist hin.',
  ],
  brand: [
    'Bei den Nachbarn brennts in der Küche, die Frau hat Rauch eingeatmet!',
    'Im Keller hat es gebrannt, mein Mann hat gelöscht und jetzt hustet er Ruß.',
  ],
  strom: [
    'Mein Kollege hat an der Leitung gearbeitet und einen Schlag bekommen!',
    'Er hängt am Weidezaun-Gerät fest gewesen, jetzt ist ihm ganz schwindlig.',
  ],
  eingeklemmt: [
    'Auf der Baustelle ist eine Platte umgefallen, der Hubert ist drunter!',
    'Der Traktor ist umgekippt, mein Vater ist eingeklemmt!',
  ],
  eingeschlossen: [
    'Die Oma ist im Bad eingesperrt und antwortet nicht mehr richtig.',
    'Der Lift steckt fest, da drin ist ein Herzpatient!',
  ],
  krank: [
    'Meiner Mutter geht es seit Tagen schlecht, heute kommt sie gar nicht mehr auf.',
    'Mein Mann hat hohes Fieber und ist ganz verwirrt.',
  ],
  rufhilfe: [
    'Hier Rufhilfe-Zentrale, Alarm von Teilnehmerin Huber, keine Sprechverbindung.',
    'Rufhilfe-Alarm, Teilnehmer reagiert nicht auf Rückruf.',
  ],
  unklar: [
    'Da liegt wer im Park, ich trau mich nicht hin.',
    'Bei den Nachbarn schreit wer um Hilfe, ich weiß nicht was los ist.',
  ],
}

const DETAIL_ANTWORTEN: Record<string, [string[], string[]]> = {
  reanimation: [
    ['Ja, er liegt direkt vor mir.', 'Ich seh ihn von hier.'],
    ['Ich… ich glaub schon, sagen Sie mir was ich tun soll!', 'Ich trau mich nicht!'],
  ],
  brustschmerz: [
    ['Ja, in den linken Arm.', 'Bis in den Kiefer hinauf.'],
    ['Ja, ganz nass und grau im Gesicht.', 'Nein, aber er zittert.'],
  ],
  verkehrsunfall: [
    ['Ich glaub der Fahrer ist eingeklemmt, die Tür geht nicht auf!', 'Nein, alle sind draußen.'],
    ['Zwei.', 'Nur eines, aber es liegt am Dach.'],
  ],
  geburt: [
    ['Alle zwei Minuten!', 'So alle zehn Minuten.'],
    ['38. Woche.', 'Die 36. glaub ich.'],
  ],
}

function pickLage(rng: Rng, hb: Hauptbeschwerde): string {
  const texts = LAGE_TEXTE[hb.id] ?? ['Es ist etwas passiert, bitte kommen Sie schnell!']
  return texts[Math.floor(rng() * texts.length)]!
}

function pickDetails(rng: Rng, hb: Hauptbeschwerde): [string, string] {
  const d = DETAIL_ANTWORTEN[hb.id]
  if (!d) return ['Ich weiß es nicht genau.', 'Schwer zu sagen.']
  return [
    d[0][Math.floor(rng() * d[0].length)]!,
    d[1][Math.floor(rng() * d[1].length)]!,
  ]
}

function pickPlaceOrt(rng: Rng, region: Region): ScenarioOrt {
  const candidates = places.filter((p) => p.region === region)
  const place: Place = candidates[Math.floor(rng() * candidates.length)]!
  const strasse = place.strassen[Math.floor(rng() * place.strassen.length)]!
  return {
    placeId: place.id,
    stadtteil: place.name,
    strasse,
    lat: place.lat + (rng() - 0.5) * 0.01,
    lon: place.lon + (rng() - 0.5) * 0.014,
  }
}

let scenarioCounter = 1

export interface GenerateOpts {
  region: Region
  /** open emergency incidents eligible for duplicate calls */
  openIncidents?: { id: string; ort: LatLon & { stadtteil: string; strasse: string } }[]
  /** force a call type (tutorial/editor) */
  forceType?: CallType
  forceHauptbeschwerde?: string
}

export function generateScenario(rng: Rng, opts: GenerateOpts): Scenario {
  const id = `S-${scenarioCounter++}`

  // call type mix (Anruf-Triage, GAME_MECHANICS §1) — gameplay-tuned shares
  const callType: CallType =
    opts.forceType ??
    pickWeighted(rng, [
      { value: 'notfall' as const, weight: 55 },
      { value: 'krankentransport' as const, weight: 25 },
      { value: 'rueckfrage' as const, weight: 10 },
      { value: 'irrlaeufer' as const, weight: 6 },
      { value: 'taschenwaehler' as const, weight: 4 },
    ])

  // duplicate caller for an existing incident (GAME_MECHANICS §1)
  const duplicates = opts.openIncidents ?? []
  const isDuplicate = callType === 'notfall' && duplicates.length > 0 && rng() < 0.18
  const dupTarget = isDuplicate
    ? duplicates[Math.floor(rng() * duplicates.length)]
    : undefined

  // weighted emergency category (balancing.json)
  const weights = Object.entries(balancing.categoryWeights)
    .map(([cid, w]) => ({ cid, weight: w[opts.region] ?? w.base }))
    .filter((w) => w.weight > 0 && categoryById.get(w.cid)?.group === 'emergency')
  const beschwerdenForCat = (cid: string) => HAUPTBESCHWERDEN.filter((h) => h.categoryId === cid)
  let hb: Hauptbeschwerde
  if (opts.forceHauptbeschwerde) {
    hb = HAUPTBESCHWERDEN.find((h) => h.id === opts.forceHauptbeschwerde)!
  } else {
    let categoryId = pickWeighted(
      rng,
      weights.map((w) => ({ value: w.cid, weight: w.weight })),
    )
    if (beschwerdenForCat(categoryId).length === 0) categoryId = 'INTERN'
    const options = beschwerdenForCat(categoryId)
    hb = options[Math.floor(rng() * options.length)]!
  }

  const personen =
    hb.categoryId === 'VERKEHR' && rng() < 0.12
      ? 6 + Math.floor(rng() * 8)
      : rng() < 0.06
        ? 2
        : 1

  const atmet = hb.id === 'reanimation' ? false : true
  const ansprechbar = hb.id === 'reanimation' || hb.id === 'bewusstlos' ? false : rng() > 0.12

  const ort = dupTarget
    ? {
        placeId: 'dup',
        stadtteil: dupTarget.ort.stadtteil,
        strasse: dupTarget.ort.strasse,
        lat: dupTarget.ort.lat + (rng() - 0.5) * 0.002,
        lon: dupTarget.ort.lon + (rng() - 0.5) * 0.002,
      }
    : pickPlaceOrt(rng, opts.region)

  const [detail1, detail2] = pickDetails(rng, hb)

  const truth: ScenarioTruth = {
    categoryId: hb.categoryId,
    hauptbeschwerdeId: hb.id,
    severity: hb.severity,
    personen,
    alter: 5 + Math.floor(rng() * 85),
    geschlecht: rng() < 0.5 ? 'm' : 'w',
    ansprechbar,
    atmet,
    zugang: rng() < 0.8 ? 'frei' : rng() < 0.5 ? 'versperrt' : 'schwer',
    lageText: pickLage(rng, hb),
    detail1,
    detail2,
    ort,
  }

  // caller profile
  const rolle: AnruferRolle =
    hb.id === 'reanimation' || !ansprechbar
      ? pickWeighted(rng, [
          { value: 'angehoeriger' as const, weight: 60 },
          { value: 'passant' as const, weight: 35 },
          { value: 'kind' as const, weight: 5 },
        ])
      : pickWeighted(rng, [
          { value: 'selbst' as const, weight: 20 },
          { value: 'angehoeriger' as const, weight: 45 },
          { value: 'passant' as const, weight: 25 },
          { value: 'fachpersonal' as const, weight: 7 },
          { value: 'kind' as const, weight: 3 },
        ])
  const emotion: Emotion =
    truth.severity === 'hoch'
      ? pickWeighted(rng, [
          { value: 'panisch' as const, weight: 35 },
          { value: 'aufgeregt' as const, weight: 45 },
          { value: 'ruhig' as const, weight: 15 },
          { value: 'betrunken' as const, weight: 5 },
        ])
      : pickWeighted(rng, [
          { value: 'ruhig' as const, weight: 50 },
          { value: 'aufgeregt' as const, weight: 38 },
          { value: 'betrunken' as const, weight: 12 },
        ])

  const phone: Scenario['phone'] = rng() < 0.78 ? 'handy' : 'festnetz'
  const kenntAdresse = rolle === 'passant' ? rng() < 0.45 : rng() < 0.93

  const verschweigt: string[] = []
  if (rng() < 0.5) verschweigt.push('detail1')
  if (rng() < 0.5) verschweigt.push('detail2')
  if (rng() < 0.35) verschweigt.push('alter')
  if (rng() < 0.3) verschweigt.push('zugang')

  const stoerungen: string[] = []
  if (kenntAdresse && rng() < 0.18) stoerungen.push('falsche_hausnummer')
  if (emotion === 'panisch' && rng() < 0.3) stoerungen.push('braucht_beruhigung')
  if (rng() < 0.06) stoerungen.push('legt_frueh_auf')

  const sprache: 'de' | 'en' = rng() < 0.08 ? 'en' : 'de'

  const hasAml = phone === 'handy' && rng() < 0.75
  const scenario: Scenario = {
    id,
    callType: isDuplicate ? 'notfall' : callType,
    phone,
    truth,
    anrufer: {
      rolle,
      emotion,
      sprache,
      kenntAdresse,
      verschweigtBisGefragt: verschweigt,
    },
    stoerungen,
    duplicateOfAuftragId: dupTarget?.id,
  }
  if (hasAml) {
    scenario.amlAfterSec = Math.round(randBetween(rng, 10, 30))
    scenario.amlRadiusM = Math.round(randBetween(rng, 40, 400))
  }
  if (phone === 'festnetz') {
    scenario.anschlussAdresse = { ...truth.ort }
  }
  if (callType === 'krankentransport') {
    scenario.ktKategorie = ['HEIM', 'DIALYSE', 'AMB', 'STAT'][Math.floor(rng() * 4)]!
    scenario.ktZiel = ['LKH', 'KSK Schwarzach', 'TK Zell', 'LK Hallein'][Math.floor(rng() * 4)]!
    scenario.truth.severity = 'normal'
  }
  return scenario
}
