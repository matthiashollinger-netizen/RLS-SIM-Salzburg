import { z } from 'zod'

/**
 * Zod schemas for all static game data extracted from research/GAME_DATA.md.
 * Values marked `estimated: true` are SCHÄTZUNG/Platzhalter per CLAUDE.md rule 2c.
 */

// ---- codes.json (GAME_DATA §4 "Einsatzcodes", official PDF) ----

export const einsatzKlasseSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'MANV'])
export type EinsatzKlasse = z.infer<typeof einsatzKlasseSchema>

export const einsatzCodeSchema = z.object({
  code: z.string().min(2), // e.g. "A1", "MANV2"
  class: einsatzKlasseSchema,
  label: z.string(),
  sosi: z.boolean(),
  /** MANV only: inclusive person-count bounds (GAME_DATA §4, official) */
  personsMin: z.number().int().positive().optional(),
  personsMax: z.number().int().positive().optional(),
  estimated: z.boolean().optional(),
})
export type EinsatzCode = z.infer<typeof einsatzCodeSchema>
export const codesFileSchema = z.array(einsatzCodeSchema)

// ---- categories.json (GAME_DATA §4, official category lists) ----

export const partnerSchema = z.enum(['FW', 'POL', 'WR', 'BR'])
export type Partner = z.infer<typeof partnerSchema>

export const categoryGroupSchema = z.enum(['emergency', 'transport', 'sonstige'])

export const categorySchema = z.object({
  id: z.string().min(2), // ASCII-safe id, e.g. "HOEHLE_GRUBE"
  label: z.string(), // official spelling, e.g. "HÖHLE_GRUBE"
  beschreibung: z.string(),
  group: categoryGroupSchema,
  /** Primary AO proposal (conservative = higher acuity of the official pair) */
  defaultCode: z.string(),
  /** Lower-acuity alternative when Abfrage downgrades (e.g. "B1" for "A1/B1") */
  altCode: z.string().optional(),
  partner: z.array(partnerSchema).default([]),
  manvCheck: z.boolean().default(false),
  /** Staging until police clears the scene (GEFAHRGUT/GEWALT/POLIZEI) */
  lagefreigabe: z.boolean().default(false),
  /** ALPIN/HOEHLE_GRUBE: prefer helicopter dispatch */
  heliPreferred: z.boolean().default(false),
  /** SCHWER: requires G-KTW (patient >130 kg) */
  requiresGktw: z.boolean().default(false),
  /** HITT: vehicle blocked for decontamination afterwards */
  blockzeitMin: z.number().int().nonnegative().optional(),
  estimated: z.boolean().optional(),
})
export type Category = z.infer<typeof categorySchema>
export const categoriesFileSchema = z.array(categorySchema)

// ---- status.json (GAME_DATA §10 — Insider, landesweit) ----

export const statusKindSchema = z.enum(['lifecycle', 'position', 'sonder'])

export const statusSchema = z.object({
  code: z.string(), // "00","1".."7","88","08","09","10","91".."95"
  label: z.string(),
  colorToken: z.string().startsWith('--'),
  kind: statusKindSchema,
  /** Vehicle counts as dispatchable in this status */
  available: z.boolean(),
  /** For 08/09/10: hospital id the position belongs to */
  positionHospital: z.string().optional(),
  estimated: z.boolean().optional(),
})
export type StatusDef = z.infer<typeof statusSchema>
export const statusFileSchema = z.array(statusSchema)

// ---- stations.json (GAME_DATA §6/§7/§12b) ----

export const regionSchema = z.enum(['NORD', 'SUED'])
export type Region = z.infer<typeof regionSchema>

export const stationTypeSchema = z.enum(['LST', 'BST', 'OST', 'DST', 'STUETZPUNKT'])

export const stationSchema = z.object({
  id: z.string().min(2),
  name: z.string(),
  /** 3-digit Dienststellen code, e.g. "071" (estimated ones marked) */
  dstCode: z.string().optional(),
  /** Funk-Kennung, e.g. "5.71" */
  funk: z.string().optional(),
  type: stationTypeSchema,
  region: regionSchema,
  bezirk: z.string(),
  lat: z.number().min(46).max(49),
  lon: z.number().min(11.5).max(14.5),
  /** Staffing model — drives turnout time (GAME_MECHANICS §2) */
  staffing: z.enum(['hauptamtlich', 'gemischt', 'ehrenamtlich']),
  estimated: z.boolean().optional(),
  notes: z.string().optional(),
})
export type Station = z.infer<typeof stationSchema>
export const stationsFileSchema = z.array(stationSchema)

// ---- vehicles.json (GAME_DATA §5–§7, §12b) ----

export const vehicleTypeSchema = z.enum([
  'NEF',
  'NAW',
  'RTW',
  'ITW',
  'KTW',
  'GKTW',
  'BTW',
  'MTW',
  'EL',
])
export type VehicleType = z.infer<typeof vehicleTypeSchema>

/** Duty window. `to < from` means overnight; "24:00" allowed as end of day. */
export const dutyWindowSchema = z.object({
  /** ISO weekday numbers, 1 = Monday … 7 = Sunday */
  days: z.array(z.number().int().min(1).max(7)).min(1),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  to: z.string().regex(/^(\d{2}:\d{2}|24:00)$/),
  /** Window only active in the given season (balancing.json seasons) */
  season: z.enum(['winter', 'summer']).optional(),
})
export type DutyWindow = z.infer<typeof dutyWindowSchema>

export const vehicleSchema = z.object({
  funkrufname: z.string().regex(/^5\.\d{2}-\d{3}$/),
  typ: vehicleTypeSchema,
  homeStation: z.string(),
  dienstzeiten: z.array(dutyWindowSchema),
  /** Reserve vehicle: only activated when another unit goes 94 */
  reserve: z.boolean().default(false),
  /** N-KTW (Notfall-KTW): KTW with emergency capability */
  notfallKtw: z.boolean().default(false),
  rollstuhlgeeignet: z.boolean().default(false),
  nickname: z.string().optional(), // e.g. "Jumbo" (GAME_DATA §10d)
  /** Secondary role, e.g. "AEND" (Ärztenotdienst) */
  role: z.string().optional(),
  /** Engine special-case hook, e.g. "nef101" (GAME_DATA §12b NEF-Stadt) */
  specialRule: z.string().optional(),
  /** Default Vorhalteposition status code ("08"/"09"/"10") */
  vorhalteposition: z.string().optional(),
  besonderheiten: z.string().optional(),
  estimated: z.boolean().optional(),
})
export type Vehicle = z.infer<typeof vehicleSchema>
export const vehiclesFileSchema = z.array(vehicleSchema)

// ---- hospitals.json (GAME_DATA §9) ----

export const hospitalCapabilitiesSchema = z.object({
  stroke: z.boolean(),
  trauma: z.boolean(), // Polytrauma/Schwerverletzte
  paed: z.boolean(),
  psych: z.boolean(),
  cardiac: z.boolean(), // Herzkatheter
  schockraum: z.boolean(),
  gyn: z.boolean(),
  /** Basic internal/surgical care — true for every acute hospital */
  basic: z.boolean(),
})
export type HospitalCapabilities = z.infer<typeof hospitalCapabilitiesSchema>

export const hospitalSchema = z.object({
  id: z.string().min(2),
  name: z.string(),
  short: z.string(),
  ort: z.string(),
  stufe: z.enum(['ZENTRAL', 'SONDER', 'SCHWERPUNKT', 'STANDARD', 'PRIVAT']),
  lat: z.number().min(46).max(49),
  lon: z.number().min(11.5).max(14.5),
  capabilities: hospitalCapabilitiesSchema,
  /** Status position code if vehicles can hold position here (08/09/10) */
  positionsCode: z.string().optional(),
  heliport: z.boolean().default(false),
  /** Outside Salzburg (e.g. BKH St. Johann in Tirol) */
  external: z.boolean().default(false),
  estimated: z.boolean().optional(),
  notes: z.string().optional(),
})
export type Hospital = z.infer<typeof hospitalSchema>
export const hospitalsFileSchema = z.array(hospitalSchema)

// ---- helicopters.json (GAME_DATA §8, official) ----

export const helicopterSchema = z.object({
  id: z.string(),
  rufname: z.string(),
  basis: z.string(),
  lat: z.number().min(46).max(49),
  lon: z.number().min(11.5).max(14.5),
  maschine: z.string(),
  betreiber: z.string(),
  /** Months (1–12) the helicopter is in service */
  saisonMonate: z.array(z.number().int().min(1).max(12)).min(1),
  daylightOnly: z.literal(true), // GAME_DATA §8: ALL sunrise–sunset
  region: regionSchema,
  estimated: z.boolean().optional(),
  notes: z.string().optional(),
})
export type Helicopter = z.infer<typeof helicopterSchema>
export const helicoptersFileSchema = z.array(helicopterSchema)

// ---- places.json (Orts-Index für Alarmtexte + Adress-Fuzzy-Suche, estimated) ----

export const placeSchema = z.object({
  id: z.string().min(2),
  name: z.string(),
  bezirk: z.string(),
  region: regionSchema,
  lat: z.number().min(46).max(49),
  lon: z.number().min(11.5).max(14.5),
  /** Inside the Salzburg city speed polygon */
  city: z.boolean().default(false),
  strassen: z.array(z.string()).min(1),
})
export type Place = z.infer<typeof placeSchema>
export const placesFileSchema = z.array(placeSchema)

// ---- balancing.json (GAME_DATA Jahreszahlen 2024 + §3 CLAUDE.md routing) ----

export const balancingSchema = z.object({
  estimated: z.literal(true), // balancing values are tuned, not official
  calls: z.object({
    NORD: z.object({ perDay: z.number(), emergenciesPerDay: z.number() }),
    SUED: z.object({ perDay: z.number(), emergenciesPerDay: z.number() }),
  }),
  /** 24 multipliers (hour 0–23), mean ≈ 1.0; peak ≈ 2× forenoon */
  hourlyFactors: z.array(z.number().positive()).length(24),
  /** ISO weekday (1=Mo) → multiplier */
  weekdayFactors: z.record(z.string(), z.number().positive()),
  seasons: z.object({
    winterMonths: z.array(z.number().int().min(1).max(12)),
    summerMonths: z.array(z.number().int().min(1).max(12)),
    winterFactor: z.number().positive(),
    summerFactor: z.number().positive(),
  }),
  routing: z.object({
    detourFactor: z.number().positive(), // 1.35 (CLAUDE.md §3)
    speedRuralKmh: z.number().positive(), // 60
    speedCityKmh: z.number().positive(), // 35
    sosiSpeedFactor: z.number().positive(), // 1.3
    heliSpeedKmh: z.number().positive(), // 220
    heliStartMin: z.number().positive(), // 3
    /** Rough Salzburg-city polygon [lon, lat][] for the 35 km/h zone */
    cityPolygon: z.array(z.tuple([z.number(), z.number()])).min(3),
  }),
  turnout: z.object({
    hauptamtlichSec: z.number().positive(),
    ehrenamtlichTagSec: z.number().positive(),
    ehrenamtlichNachtSec: z.number().positive(),
    khPersonalNachtSec: z.number().positive(), // NEF 101 at night (GAME_DATA §12b)
  }),
  hilfsfristMin: z.number().positive(), // 15 (GAME_DATA §11)
  /** Weights for the scenario generator per category id, with regional override */
  categoryWeights: z.record(
    z.string(),
    z.object({
      base: z.number().nonnegative(),
      NORD: z.number().nonnegative().optional(),
      SUED: z.number().nonnegative().optional(),
    }),
  ),
  /** Share of calls that are NOT emergencies (KT bookings, queries, misdials) */
  nonEmergencyCallShare: z.number().min(0).max(1),
})
export type Balancing = z.infer<typeof balancingSchema>
