import { balancing, categoryById, places } from '../data/index.ts'
import type { Place, Region } from '../data/schemas.ts'
import { HAUPTBESCHWERDEN, type Hauptbeschwerde } from './abfrage.ts'
import { pickWeighted, randBetween, type Rng } from './rng.ts'
import { applyCategoryFactors } from './sonderlage.ts'
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

/**
 * Lage-Varianten (Rework 2, Anrufer-Konsistenz): Lagetext und die beiden
 * Detail-Antworten gehören FEST zusammen — keine Widersprüche mehr
 * (z. B. „Lift" im Eröffnungssatz, „Badezimmer" auf Nachfrage). Optionale
 * Constraints erzwingen plausible Rolle/Alter/Geschlecht.
 */
interface LageVariante {
  text: string
  detail1: string
  detail2: string
  rolle?: AnruferRolle
  alter?: [number, number]
  geschlecht?: 'm' | 'w'
}

const LAGEN: Record<string, LageVariante[]> = {
  reanimation: [
    {
      text: 'Mein Mann ist umgefallen und rührt sich nicht mehr! Er schnauft so komisch!',
      detail1: 'Ja, er liegt direkt vor mir.',
      detail2: 'Ich… ich glaub schon, sagen Sie mir was ich tun soll!',
      rolle: 'angehoeriger',
      alter: [50, 88],
      geschlecht: 'm',
    },
    {
      text: 'Da liegt einer am Boden, ganz blau im Gesicht, der atmet nicht!',
      detail1: 'Ich seh ihn von hier, er liegt am Gehsteig.',
      detail2: 'Ich trau mich, wenn Sie mir sagen wie!',
      rolle: 'passant',
      alter: [40, 85],
      geschlecht: 'm',
    },
  ],
  brustschmerz: [
    {
      text: 'Mein Vater hat so einen Druck auf der Brust, ihm ist schlecht.',
      detail1: 'Ja, in den linken Arm.',
      detail2: 'Ja, ganz nass und grau im Gesicht.',
      rolle: 'angehoeriger',
      alter: [55, 90],
      geschlecht: 'm',
    },
    {
      text: 'Ich hab solche Schmerzen in der Brust, es zieht in den Arm.',
      detail1: 'In den linken Arm, bis in den Kiefer.',
      detail2: 'Schauen kann ich nicht, aber mir rinnt der Schweiß runter.',
      rolle: 'selbst',
      alter: [45, 80],
    },
    {
      text: 'Hier Seniorenheim — ein Bewohner klagt über starken Druck auf der Brust.',
      detail1: 'Ja, in den linken Arm und in den Rücken.',
      detail2: 'Ja, kaltschweißig und ganz blass.',
      rolle: 'fachpersonal',
      alter: [70, 95],
      geschlecht: 'm',
    },
  ],
  atemnot: [
    {
      text: 'Meine Frau bekommt keine Luft mehr, sie ringt richtig!',
      detail1: 'Kaum — nur einzelne Wörter.',
      detail2: 'Ja, COPD seit Jahren.',
      rolle: 'angehoeriger',
      alter: [55, 88],
      geschlecht: 'w',
    },
    {
      text: 'Der Nachbar sitzt am Fenster und schnappt nach Luft.',
      detail1: 'Nein, er ringt nur nach Luft!',
      detail2: 'Das weiß ich nicht, ich bin nur der Nachbar.',
      rolle: 'passant',
      alter: [50, 85],
      geschlecht: 'm',
    },
    {
      text: 'Mein Bub hat einen Asthmaanfall, der Spray hilft heut gar nicht!',
      detail1: 'Nur einzelne Wörter, er pfeift richtig beim Atmen!',
      detail2: 'Ja, Asthma — aber so schlimm war es noch nie!',
      rolle: 'angehoeriger',
      alter: [6, 16],
      geschlecht: 'm',
    },
  ],
  bewusstlos: [
    {
      text: 'Meine Mutter ist einfach zusammengesackt, jetzt ist sie wieder halbwegs da.',
      detail1: 'Jetzt atmet sie wieder normal, glaub ich.',
      detail2: 'Nein, keine Zuckungen.',
      rolle: 'angehoeriger',
      alter: [55, 92],
      geschlecht: 'w',
    },
    {
      text: 'Da ist jemand umgekippt im Geschäft, sie reagiert kaum.',
      detail1: 'Ja, atmet — aber ganz flach.',
      detail2: 'Ja, kurz gezuckt hat es.',
      rolle: 'passant',
      alter: [30, 80],
      geschlecht: 'w',
    },
    {
      text: 'Hier Hauskrankenpflege — eine Klientin ist nicht erweckbar, sie atmet aber.',
      detail1: 'Ja, sie atmet ruhig und regelmäßig.',
      detail2: 'Nein, keine Zuckungen beobachtet.',
      rolle: 'fachpersonal',
      alter: [70, 96],
      geschlecht: 'w',
    },
  ],
  schlaganfall: [
    {
      text: 'Mein Mann redet auf einmal so komisch und der Mundwinkel hängt.',
      detail1: 'Ja! Der rechte Mundwinkel hängt ganz runter.',
      detail2: 'Vor circa einer halben Stunde hat es angefangen.',
      rolle: 'angehoeriger',
      alter: [55, 90],
      geschlecht: 'm',
    },
    {
      text: 'Die Oma kann den Arm nicht mehr heben und lallt.',
      detail1: 'Ich glaub schon… ja, das Gesicht ist schief.',
      detail2: 'Seit heute Früh schon.',
      rolle: 'angehoeriger',
      alter: [70, 95],
      geschlecht: 'w',
    },
    {
      text: 'Meinem Mann ist beim Frühstück die Tasse aus der Hand gefallen, die ganze rechte Seite gehorcht ihm nicht.',
      detail1: 'Ja, der Mundwinkel hängt und er lallt.',
      detail2: 'Vor zehn Minuten, ganz plötzlich.',
      rolle: 'angehoeriger',
      alter: [55, 90],
      geschlecht: 'm',
    },
  ],
  krampfanfall: [
    {
      text: 'Mein Sohn krampft am ganzen Körper, bitte schnell!',
      detail1: 'Ja! Es hört nicht auf!',
      detail2: 'Ja, Epilepsie seit der Kindheit.',
      rolle: 'angehoeriger',
      alter: [6, 25],
      geschlecht: 'm',
    },
    {
      text: 'Da liegt wer am Gehsteig und zuckt ganz arg.',
      detail1: 'Nein, jetzt liegt er still da und schnauft.',
      detail2: 'Das weiß ich nicht, ich kenn den Mann nicht.',
      rolle: 'passant',
      alter: [20, 70],
      geschlecht: 'm',
    },
    {
      text: 'Im Schwimmbad hat ein Mädchen gekrampft, jetzt ist sie ganz weggetreten.',
      detail1: 'Nein, der Krampf ist vorbei, aber sie schläft fast ein.',
      detail2: 'Die Mutter sagt nein, das hatte sie noch nie.',
      rolle: 'passant',
      alter: [5, 15],
      geschlecht: 'w',
    },
  ],
  sturz: [
    {
      text: 'Die Nachbarin ist von der Leiter gefallen, das Bein steht ganz schief.',
      detail1: 'Von der Leiter, circa drei Meter.',
      detail2: 'Nein, keine Blutverdünner, soweit ich weiß.',
      rolle: 'passant',
      alter: [40, 80],
      geschlecht: 'w',
    },
    {
      text: 'Mein Vater ist gestürzt und jetzt blutet er am Kopf.',
      detail1: 'Nur über die Teppichkante, aber er kommt nicht mehr hoch.',
      detail2: 'Ja, Marcoumar!',
      rolle: 'angehoeriger',
      alter: [70, 95],
      geschlecht: 'm',
    },
    {
      text: 'Meine Mutter ist in der Nacht aus dem Bett gefallen und liegt seit Stunden am Boden.',
      detail1: 'Nur aus dem Bett, aber sie kommt allein nicht mehr auf.',
      detail2: 'Ja, sie nimmt einen Blutverdünner, Eliquis heißt der.',
      rolle: 'angehoeriger',
      alter: [75, 95],
      geschlecht: 'w',
    },
    {
      text: 'Am Gehsteig ist eine Frau auf dem Eis ausgerutscht, der Arm steht ganz komisch ab.',
      detail1: 'Aus dem Stand, direkt auf den Arm gefallen.',
      detail2: 'Das weiß ich nicht, ich kenne die Frau nicht.',
      rolle: 'passant',
      alter: [40, 85],
      geschlecht: 'w',
    },
  ],
  verkehrsunfall: [
    {
      text: 'Da ist ein Auto gegen einen Baum, die Windschutzscheibe ist kaputt!',
      detail1: 'Ich glaub der Fahrer ist eingeklemmt, die Tür geht nicht auf!',
      detail2: 'Nur eines, gegen den Baum.',
      rolle: 'passant',
      alter: [18, 75],
    },
    {
      text: 'Zwei Autos sind zusammengekracht, eines liegt im Graben!',
      detail1: 'Nein, alle sind draußen, aber einer liegt im Gras.',
      detail2: 'Zwei.',
      rolle: 'passant',
      alter: [18, 75],
    },
    {
      text: 'Ein Motorradfahrer ist in der Kurve gestürzt, er liegt neben der Leitschiene!',
      detail1: 'Nein, eingeklemmt ist er nicht, aber er hält das Bein und schreit.',
      detail2: 'Nur das Motorrad, sonst niemand.',
      rolle: 'passant',
      alter: [18, 60],
      geschlecht: 'm',
    },
    {
      text: 'Ein Auto hat einen Radfahrer erwischt, der liegt auf der Straße!',
      detail1: 'Nein, er liegt frei auf der Fahrbahn.',
      detail2: 'Ein Auto und das Fahrrad.',
      rolle: 'passant',
      alter: [20, 75],
      geschlecht: 'm',
    },
  ],
  blutung: [
    {
      text: 'Er hat sich mit der Kreissäge geschnitten, das blutet wie verrückt!',
      detail1: 'Ja, es spritzt richtig!',
      detail2: 'Wir drücken mit einem Tuch drauf, es wird kaum weniger!',
      rolle: 'angehoeriger',
      alter: [25, 70],
      geschlecht: 'm',
    },
    {
      text: 'Meine Frau hat starkes Nasenbluten, es hört nicht auf, sie nimmt Marcoumar.',
      detail1: 'Es rinnt stark, aber spritzen tut nichts.',
      detail2: 'Es geht durch jedes Taschentuch durch!',
      rolle: 'angehoeriger',
      alter: [60, 90],
      geschlecht: 'w',
    },
  ],
  bauchschmerz: [
    {
      text: 'Ich hab seit Stunden so schlimme Bauchschmerzen, rechts unten.',
      detail1: 'Rechts unten, ganz stark beim Drücken.',
      detail2: 'Nein, nichts dergleichen.',
      rolle: 'selbst',
      alter: [16, 60],
    },
    {
      text: 'Meinem Mann ist speiübel und der Bauch ist ganz hart.',
      detail1: 'So um den Nabel herum, wellenartig.',
      detail2: 'Erbrochen ja, Blut nein.',
      rolle: 'angehoeriger',
      alter: [40, 85],
      geschlecht: 'm',
    },
    {
      text: 'Die Oma hat furchtbare Bauchkrämpfe und krümmt sich zusammen.',
      detail1: 'Im ganzen Bauch, sie kann gar nicht sagen wo genau.',
      detail2: 'Erbrochen ja — und ganz dunkel hat es ausgeschaut.',
      rolle: 'angehoeriger',
      alter: [70, 95],
      geschlecht: 'w',
    },
  ],
  allergie: [
    {
      text: 'Mein Sohn ist von einer Wespe gestochen worden, das Gesicht schwillt an!',
      detail1: 'Ja! Die Lippen und die Zunge schwellen an!',
      detail2: 'Ja, gegen Wespen — aber das Notfallset ist abgelaufen!',
      rolle: 'angehoeriger',
      alter: [5, 16],
      geschlecht: 'm',
    },
    {
      text: 'Sie hat Nüsse gegessen und kriegt Ausschlag am ganzen Körper, die Zunge kribbelt.',
      detail1: 'Nein, nur der Ausschlag am Körper — aber die Zunge kribbelt.',
      detail2: 'Nein, das ist das erste Mal.',
      rolle: 'angehoeriger',
      alter: [16, 50],
      geschlecht: 'w',
    },
  ],
  vergiftung: [
    {
      text: 'Meine Tochter hat Tabletten geschluckt, ich weiß nicht wie viele!',
      detail1: 'Schlaftabletten von der Oma — die Schachtel ist leer!',
      detail2: 'Vor circa einer Stunde, glaub ich.',
      rolle: 'angehoeriger',
      alter: [14, 25],
      geschlecht: 'w',
    },
    {
      text: 'Mein Freund hat irgendwas genommen, er ist ganz weggetreten.',
      detail1: 'Irgendwas Gemischtes, mit Alkohol.',
      detail2: 'Ich weiß es nicht, ich bin grad erst gekommen.',
      rolle: 'angehoeriger',
      alter: [18, 40],
      geschlecht: 'm',
    },
    {
      text: 'Vor dem Lokal liegt ein junger Mann, seine Freunde sagen, er hat was eingeworfen.',
      detail1: 'Die Freunde reden von Tabletten — und getrunken hat er auch ordentlich.',
      detail2: 'Vor ein paar Stunden, so genau weiß das keiner.',
      rolle: 'passant',
      alter: [16, 30],
      geschlecht: 'm',
    },
  ],
  geburt: [
    {
      text: 'Meine Frau bekommt das Baby! Die Wehen kommen ganz schnell!',
      detail1: 'Alle zwei Minuten!',
      detail2: '38. Woche.',
      rolle: 'angehoeriger',
      alter: [20, 42],
      geschlecht: 'w',
    },
    {
      text: 'Die Fruchtblase ist geplatzt, wir schaffen es nicht mehr ins Krankenhaus!',
      detail1: 'So alle drei, vier Minuten.',
      detail2: 'Die 36. glaub ich.',
      rolle: 'angehoeriger',
      alter: [20, 42],
      geschlecht: 'w',
    },
  ],
  psychisch: [
    {
      text: 'Mein Bruder redet davon, sich was anzutun. Ich komm nicht zu ihm rein.',
      detail1: 'Er hat es ganz konkret angekündigt, ja!',
      detail2: 'Nein, aggressiv nicht. Nur verzweifelt.',
      rolle: 'angehoeriger',
      alter: [20, 60],
      geschlecht: 'm',
    },
    {
      text: 'Eine Frau steht da ganz aufgelöst und schreit, sie will springen.',
      detail1: 'Sie sagt es immer wieder, ja!',
      detail2: 'Aggressiv nicht, aber völlig außer sich.',
      rolle: 'passant',
      alter: [20, 65],
      geschlecht: 'w',
    },
    {
      text: 'Meine Tochter hat sich im Zimmer eingesperrt und schreit, sie will nicht mehr leben.',
      detail1: 'Ja, sie hat es mehrmals ganz deutlich gesagt.',
      detail2: 'Aggressiv nicht, aber sie macht die Tür nicht auf.',
      rolle: 'angehoeriger',
      alter: [14, 30],
      geschlecht: 'w',
    },
  ],
  gewalt: [
    {
      text: 'Da war eine Schlägerei vorm Lokal, einer liegt am Boden und blutet!',
      detail1: 'Ich glaub die sind weg… ich seh niemanden mehr.',
      detail2: 'Am Kopf, eine große Platzwunde.',
      rolle: 'passant',
      alter: [18, 45],
      geschlecht: 'm',
    },
    {
      text: 'Mein Nachbar wurde mit einem Messer verletzt! Der Typ ist weggerannt… glaub ich.',
      detail1: 'ER KÖNNTE NOCH DA SEIN, ich hab Angst!',
      detail2: 'Am Bauch — da ist viel Blut!',
      rolle: 'passant',
      alter: [25, 65],
      geschlecht: 'm',
    },
  ],
  wasser: [
    {
      text: 'Im See treibt jemand, er bewegt sich nicht!',
      detail1: 'JA, ich seh ihn noch treiben!',
      detail2: 'Keine Ahnung — wir haben ihn erst jetzt gesehen.',
      rolle: 'passant',
      alter: [15, 70],
      geschlecht: 'm',
    },
    {
      text: 'Ein Kind ist in den Bach gefallen, sie haben es rausgezogen, es hustet ganz arg.',
      detail1: 'Nein, es ist schon draußen!',
      detail2: 'Vielleicht eine Minute, ging ganz schnell.',
      rolle: 'passant',
      alter: [4, 12],
    },
  ],
  alpin: [
    {
      text: 'Mein Mann ist beim Wandern abgestürzt, ich sehe ihn unten am Schotterfeld!',
      detail1: 'Nein, das ist steiles Schottergelände, da kommt keiner zu Fuß hin.',
      detail2: 'Sonnig, gute Sicht.',
      rolle: 'angehoeriger',
      alter: [30, 70],
      geschlecht: 'm',
    },
    {
      text: 'Auf der Piste liegt einer, der ist gegen den Lift gefahren, das Bein ist hin.',
      detail1: 'Ja, mit dem Skidoo kommt man hin, die Pistenrettung ist verständigt.',
      detail2: 'Leicht bewölkt, gute Sicht.',
      rolle: 'passant',
      alter: [16, 60],
      geschlecht: 'm',
    },
  ],
  brand: [
    {
      text: 'Bei den Nachbarn brennts in der Küche, die Frau hat Rauch eingeatmet!',
      detail1: 'Ich weiß nicht — vielleicht ist noch wer drin!',
      detail2: 'Ja, sie hustet ganz stark.',
      rolle: 'passant',
      alter: [30, 80],
      geschlecht: 'w',
    },
    {
      text: 'Im Keller hat es gebrannt, mein Mann hat gelöscht und jetzt hustet er Ruß.',
      detail1: 'Nein, alle sind draußen!',
      detail2: 'Ja, er hustet schwarzen Auswurf.',
      rolle: 'angehoeriger',
      alter: [35, 75],
      geschlecht: 'm',
    },
  ],
  strom: [
    {
      text: 'Mein Kollege hat an der Leitung gearbeitet und einen Schlag bekommen!',
      detail1: 'Ja, der FI-Schalter ist gefallen.',
      detail2: 'Normale Steckdose, 230 Volt.',
      rolle: 'passant',
      alter: [20, 60],
      geschlecht: 'm',
    },
    {
      text: 'Er ist am Weidezaun-Gerät hängen geblieben, jetzt ist ihm ganz schwindlig.',
      detail1: 'Ja, wir haben alles abgesteckt.',
      detail2: 'Nur der Weidezaun, keine Hochspannung.',
      rolle: 'angehoeriger',
      alter: [25, 70],
      geschlecht: 'm',
    },
  ],
  eingeklemmt: [
    {
      text: 'Auf der Baustelle ist eine Platte umgefallen, der Hubert ist drunter!',
      detail1: 'Eine Betonplatte liegt auf seinem Bein.',
      detail2: 'Ja, er redet noch mit uns.',
      rolle: 'passant',
      alter: [25, 60],
      geschlecht: 'm',
    },
    {
      text: 'Der Traktor ist umgekippt, mein Vater ist eingeklemmt!',
      detail1: 'Der Traktor liegt auf ihm drauf!',
      detail2: 'Er antwortet nicht mehr!',
      rolle: 'angehoeriger',
      alter: [45, 80],
      geschlecht: 'm',
    },
  ],
  eingeschlossen: [
    {
      text: 'Die Oma ist im Bad eingesperrt und antwortet nicht mehr richtig.',
      detail1: 'Im Badezimmer, erster Stock.',
      detail2: 'Nur eingesperrt — aber sie ist 92 und antwortet kaum noch.',
      rolle: 'angehoeriger',
      alter: [85, 96],
      geschlecht: 'w',
    },
    {
      text: 'Der Lift steckt fest, da drin ist ein Herzpatient!',
      detail1: 'Im Lift, zwischen zwei Stockwerken.',
      detail2: 'Ja, er hat ein Herzleiden und bekommt Panik!',
      rolle: 'passant',
      alter: [55, 85],
      geschlecht: 'm',
    },
  ],
  krank: [
    {
      text: 'Meiner Mutter geht es seit Tagen schlecht, heute kommt sie gar nicht mehr auf.',
      detail1: 'Seit drei Tagen wird es immer schlimmer.',
      detail2: 'Kein Fieber, aber sie ist ganz schwach.',
      rolle: 'angehoeriger',
      alter: [60, 95],
      geschlecht: 'w',
    },
    {
      text: 'Mein Mann hat hohes Fieber und ist ganz verwirrt.',
      detail1: 'Seit heute Morgen.',
      detail2: '39,5 Fieber, und erbrochen hat er auch.',
      rolle: 'angehoeriger',
      alter: [50, 90],
      geschlecht: 'm',
    },
    {
      text: 'Hier Pflegeheim — eine Bewohnerin hat seit gestern Durchfall und ist jetzt ganz apathisch.',
      detail1: 'Seit gestern Abend, es wird stündlich schlechter.',
      detail2: '38,2 Fieber, erbrochen hat sie zweimal.',
      rolle: 'fachpersonal',
      alter: [75, 98],
      geschlecht: 'w',
    },
    {
      text: 'Ich hab seit Tagen eine Grippe und beim Husten bekomm ich kaum noch Luft.',
      detail1: 'Seit vier, fünf Tagen — heute ist es richtig schlimm.',
      detail2: 'Fieber hab ich, 38,9 hab ich gemessen.',
      rolle: 'selbst',
      alter: [30, 75],
    },
  ],
  rufhilfe: [
    {
      text: 'Hier Rufhilfe-Zentrale, Alarm von Teilnehmerin Huber, keine Sprechverbindung.',
      detail1: 'Keine Reaktion auf die Gegensprechanlage.',
      detail2: 'Ja, ein Schlüsselsafe ist hinterlegt, den Code haben wir.',
      rolle: 'fachpersonal',
      alter: [75, 96],
      geschlecht: 'w',
    },
    {
      text: 'Rufhilfe-Alarm, Teilnehmer reagiert nicht auf Rückruf.',
      detail1: 'Sie hat kurz gestöhnt, mehr kam nicht.',
      detail2: 'Nein, kein Schlüssel deponiert.',
      rolle: 'fachpersonal',
      alter: [75, 96],
    },
  ],
  unklar: [
    {
      text: 'Da liegt wer im Park, ich trau mich nicht hin.',
      detail1: 'Eine Person liegt am Boden und bewegt sich nicht.',
      detail2: 'Nein… Moment… doch, der Arm hat sich gerade bewegt!',
      rolle: 'passant',
      alter: [25, 75],
    },
    {
      text: 'Bei den Nachbarn schreit wer um Hilfe, ich weiß nicht was los ist.',
      detail1: 'Ich höre nur Schreie aus der Wohnung.',
      detail2: 'Ich trau mich nicht näher hin.',
      rolle: 'passant',
      alter: [20, 90],
    },
  ],
}

const FALLBACK_VARIANTE: LageVariante = {
  text: 'Es ist etwas passiert, bitte kommen Sie schnell!',
  detail1: 'Ich weiß es nicht genau.',
  detail2: 'Schwer zu sagen.',
}

/** plausible patient age by caller role when the variant has no range */
function alterFuerRolle(rng: Rng, rolle: AnruferRolle): number {
  const ranges: Record<AnruferRolle, [number, number]> = {
    selbst: [18, 85],
    angehoeriger: [35, 92],
    passant: [15, 88],
    fachpersonal: [20, 95],
    kind: [28, 55], // a child calls about a parent
  }
  const [min, max] = ranges[rolle]
  return Math.round(randBetween(rng, min, max))
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
  /** sim hour of day (0–23) — drives time-of-day weight multipliers */
  hour?: number
  /** current weather — 'schlecht' boosts traffic/fall categories in winter */
  weather?: 'gut' | 'schlecht'
  /** shift season — needed for the winter ice rule (weather alone is ambiguous) */
  season?: 'winter' | 'summer' | 'none'
  /** Sonderlage category multipliers, applied on top of time/weather factors */
  categoryFactors?: Record<string, number>
  /** scripted MANV (Sonderlage Busunglück): overrides personen for a traffic scenario */
  forceManvPersonen?: number
}

/**
 * Deterministic time-of-day/weather weight multiplier per category
 * (Welt-Direktor: incident mix follows the day rhythm, ANNAHMEN.md):
 * - night 22:00–03:59: INTOX/GEWALT/PSYCH ×2, RUFHILFE (elder alert) ×1.5
 * - rush hours 07–09 / 16–18: VERKEHR ×1.8
 * - weather 'schlecht' in winter (ice): VERKEHR/TRAUMA ×1.6
 * Missing opts → factor 1 (existing callers stay unchanged).
 */
export function timeWeatherFactor(
  cid: string,
  opts: Pick<GenerateOpts, 'hour' | 'weather' | 'season'>,
): number {
  let f = 1
  if (opts.hour !== undefined) {
    const h = opts.hour
    const night = h >= 22 || h < 4
    if (night) {
      if (cid === 'INTOX' || cid === 'GEWALT' || cid === 'PSYCH') f *= 2
      if (cid === 'RUFHILFE') f *= 1.5
    }
    const rush = (h >= 7 && h < 9) || (h >= 16 && h < 18)
    if (rush && cid === 'VERKEHR') f *= 1.8
  }
  if (opts.weather === 'schlecht' && opts.season === 'winter') {
    if (cid === 'VERKEHR' || cid === 'TRAUMA') f *= 1.6
  }
  return f
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

  // duplicate caller for an existing incident (GAME_MECHANICS §1);
  // scripted MANV calls are always a fresh incident
  const duplicates = opts.openIncidents ?? []
  const isDuplicate =
    callType === 'notfall' &&
    opts.forceManvPersonen === undefined &&
    duplicates.length > 0 &&
    rng() < 0.18
  const dupTarget = isDuplicate
    ? duplicates[Math.floor(rng() * duplicates.length)]
    : undefined

  // weighted emergency category (balancing.json) × time/weather/Sonderlage factors
  const weights = applyCategoryFactors(
    Object.entries(balancing.categoryWeights).map(([cid, w]) => ({
      cid,
      weight: (w[opts.region] ?? w.base) * timeWeatherFactor(cid, opts),
    })),
    opts.categoryFactors,
  ).filter((w) => w.weight > 0 && categoryById.get(w.cid)?.group === 'emergency')
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

  // scripted MANV (Sonderlage) overrides the rolled person count
  const personen =
    opts.forceManvPersonen ??
    (hb.categoryId === 'VERKEHR' && rng() < 0.12
      ? 6 + Math.floor(rng() * 8)
      : rng() < 0.06
        ? 2
        : 1)

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

  // ONE variant binds Lagetext + Detailantworten + Rolle/Alter/Geschlecht
  // (Rework 2: Anrufer-Konsistenz)
  const varianten = LAGEN[hb.id] ?? [FALLBACK_VARIANTE]
  const variante = varianten[Math.floor(rng() * varianten.length)]!

  // caller profile — variant constraint wins, otherwise weighted
  const rolle: AnruferRolle =
    variante.rolle ??
    (hb.id === 'reanimation' || !ansprechbar
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
        ]))

  const truth: ScenarioTruth = {
    categoryId: hb.categoryId,
    hauptbeschwerdeId: hb.id,
    severity: hb.severity,
    personen,
    alter: variante.alter
      ? Math.round(randBetween(rng, variante.alter[0], variante.alter[1]))
      : alterFuerRolle(rng, rolle),
    geschlecht: variante.geschlecht ?? (rng() < 0.5 ? 'm' : 'w'),
    ansprechbar,
    atmet,
    zugang: rng() < 0.8 ? 'frei' : rng() < 0.5 ? 'versperrt' : 'schwer',
    lageText: variante.text,
    detail1: variante.detail1,
    detail2: variante.detail2,
    ort,
  }
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
