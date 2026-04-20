// Cotisations TNS SSI 2025 par composante réelle — Art.L.131-6 CSS
// PASS 2025 = 46 368 €

export const PASS = 46368

export interface CotisTNSDetail {
  total: number
  maladie: number
  ij: number
  ret_base: number
  rci: number
  inval: number
  af: number
  cfp: number
  prev: number
  csg: number
}

// Cotisations calculées sur le bénéfice brut AVANT cotisations
// pc = taux prévoyance facultative (Madelin/PER)
export function cotisTNS_sur_revenu(bBrut: number, pc: number): CotisTNSDetail {
  const R = bBrut
  const p40 = PASS * 0.40
  const p110 = PASS * 1.10
  const p375 = PASS * 0.375
  const p140 = PASS * 1.40

  // 1. MALADIE-MATERNITÉ — progressif 0%→6,5% entre 40% et 110% PASS
  const maladie = R > p40 ? R * 0.065 * Math.min(1, (R - p40) / (p110 - p40)) : 0

  // 2. INDEMNITÉS JOURNALIÈRES — 0,85% ≤ 5 PASS
  const ij = Math.min(R, PASS * 5) * 0.0085

  // 3. RETRAITE DE BASE — plafonnée à 1 PASS
  const ret_base = Math.min(R, PASS) * 0.1775 + Math.max(0, R - PASS) * 0.006

  // 4. RETRAITE COMPLÉMENTAIRE RCI — plafonnée à 4 PASS
  // T1 : 7% sur part ≤ 37,5% PASS | T2 : 8% sur part > 37,5% PASS jusqu'à 4 PASS
  const p4PASS = PASS * 4
  const rci = Math.min(R, p375) * 0.07 + Math.max(0, Math.min(R, p4PASS) - p375) * 0.08

  // 5. INVALIDITÉ-DÉCÈS — plafonnée à 1 PASS
  const inval = Math.min(R, PASS) * 0.013

  // 6. ALLOCATIONS FAMILIALES — exonéré ≤ 110% PASS
  let af = 0
  if (R > p110) {
    if (R <= p140) af = (R - p110) * 0.031
    else af = (p140 - p110) * 0.031 + (R - p140) * 0.0525
  }

  // 7. FORMATION PROFESSIONNELLE — fixe annuel
  const cfp = PASS * 0.0025

  // 8. PRÉVOYANCE facultative
  const prev = R * pc

  // 9. CSG/CRDS : 9,70% sur base élargie = bBrut + cotisations obligatoires hors CSG
  const cotisAvantCSG = maladie + ij + ret_base + rci + inval + af + cfp + prev
  const baseCsg = R + cotisAvantCSG - prev
  const csg = baseCsg * 0.097

  const total = cotisAvantCSG + csg
  return { total, maladie, ij, ret_base, rci, inval, af, cfp, prev, csg }
}

export function calcCotisTNS(bBrut: number, pc: number): { cotis: number; bNet: number } {
  const c = cotisTNS_sur_revenu(bBrut, pc)
  return { cotis: c.total, bNet: Math.max(0, bBrut - c.total) }
}

// IS 2025 : 15% ≤ 42 500 €, 25% au-delà
export function calcIS(resultat: number): number {
  if (resultat <= 0) return 0
  if (resultat <= 42500) return resultat * 0.15
  return 42500 * 0.15 + (resultat - 42500) * 0.25
}

// Protection sociale TNS
export function protTNS(rem: number) {
  const ijJ = Math.min(rem, PASS) / 730
  const trims = Math.min(4, Math.floor(Math.max(0, rem) / 1711.8))
  const qual: 'moyen' | 'faible' | 'très faible' = rem >= PASS ? 'moyen' : rem > 20000 ? 'faible' : 'très faible'
  return { ijJ: Math.round(ijJ * 10) / 10, ijM: Math.round(ijJ * 30), trims, regime: 'TNS (SSI)', complement: 'SSI — limitée', qual }
}

// Protection sociale assimilé salarié
export function protSalarie(brut: number) {
  const ijJ = Math.min(brut, PASS) / 365 * 0.50
  const trims = Math.min(4, Math.floor(Math.max(0, brut) / 1711.8))
  const qual: 'bon' | 'moyen' = brut >= PASS ? 'bon' : 'moyen'
  return { ijJ: Math.round(ijJ * 10) / 10, ijM: Math.round(ijJ * 30), trims, regime: 'Assimilé salarié', complement: 'AGIRC-ARRCO — bonne', qual }
}
