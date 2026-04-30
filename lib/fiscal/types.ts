export type PrevoyanceLevel = 'min' | 'moyen' | 'max'
export type StratActif = 'max' | 'reserve'
export type Situation = 'creation' | 'existant' | 'changement'
export type Secteur = 'services_bic' | 'liberal_bnc' | 'commerce' | 'btp'
export type Priorite = 'equilibre' | 'net' | 'protection' | 'simplicite' | 'croissance'
export type FormeActuelle = 'none' | 'micro' | 'ei' | 'eurl_is' | 'sas_sasu'

export interface SimParams {
  ca: number
  charges: number
  amort: number
  deficit: number
  capital: number
  abat: number
  remNetAnn: number
  partsBase: number
  nbEnfants: number
  parts: number
  autresRev: number
  prevoy: PrevoyanceLevel
  priorite: Priorite
  situation: Situation
  secteur: Secteur
  formeActuelle: FormeActuelle
  reserves: number
  remActuelle: number
  stratActif: StratActif
  reserveVoulue: number
  stratRaison: string
  perActif: 'oui' | 'non'
  perMontant: number
  mutuelleMontant: number
  prevoyanceMontant: number
}

export interface ProtectionSociale {
  ijJ: number
  ijM: number
  trims: number
  regime: string
  complement: string
  qual: 'bon' | 'moyen' | 'faible' | 'très faible'
}

export interface StructureResult {
  forme: string
  netAnnuel: number
  charges: number
  ir: number
  is: number
  ben: number
  div: number
  divNet?: number
  remBrute: number
  remNet: number
  remMois?: number
  netMois?: number
  divNetAn?: number
  divNetMois?: number
  cotisPatronales?: number
  cotisSalariales?: number
  irSalSeul?: number
  ratioDivPct: number
  strat: string
  scoreTotal: number
  scoreBreakdown?: {
    netScore: number; netMax: number
    flexScore: number; flexMax: number
    protScore: number; protMax: number
    adminScore: number; adminMax: number
  }
  prot: ProtectionSociale
  methDiv: string
  seuilCap?: number
  resEnReserve?: number
  cotisSurDiv?: number
  baseIR?: number
  abat10?: number
  bNet?: number
  tauxCotis?: number
}

export interface SwotResult {
  pos: string[]
  neg: string[]
  opp: string[]
  rsk: string[]
}

export interface Levier {
  ico: string
  nom: string
  desc: string
  gain: number
  cond: string
}

export interface PlanAction {
  t: string
  d: string
  cls: string
  tag: string
}

export interface ProjectionPoint {
  t: number
  ca: number
  projs: { forme: string; net: number }[]
}

export const MICRO_PLAFONDS: Record<Secteur, { plafond: number; abat: number; label: string }> = {
  services_bic: { plafond: 77700, abat: 0.50, label: 'Services BIC — abattement 50%' },
  liberal_bnc: { plafond: 77700, abat: 0.34, label: 'BNC libéral — abattement 34%' },
  commerce: { plafond: 188700, abat: 0.71, label: 'Commerce/vente — abattement 71%' },
  btp: { plafond: 77700, abat: 0.50, label: 'BTP/artisanat — abattement 50%' },
}
