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
  const p40   = PASS * 0.40   // 18 547 € — seuil maladie bas
  const p60   = PASS * 0.60   // 27 821 € — seuil maladie haut
  const p110  = PASS * 1.10   // 51 005 € — seuil AF bas
  const p140  = PASS * 1.40   // 64 915 € — seuil AF haut
  const pRCI1 = 38493         // seuil T1/T2 retraite complémentaire
  const p4PASS = PASS * 4

  // 1. MALADIE-MATERNITÉ — 3 zones : 1,35% / interpolation / 6,5%
  let maladie: number
  if (R <= p40) {
    maladie = R * 0.0135
  } else if (R <= p60) {
    const taux = 0.0135 + (0.065 - 0.0135) * ((R - p40) / (p60 - p40))
    maladie = R * taux
  } else {
    maladie = R * 0.065
  }

  // 2. INDEMNITÉS JOURNALIÈRES — 0,5% ≤ 5 PASS
  const ij = Math.min(R, PASS * 5) * 0.005

  // 3. RETRAITE DE BASE — plafonnée à 1 PASS + 0,6% déplafonnée
  const ret_base = Math.min(R, PASS) * 0.1775 + Math.max(0, R - PASS) * 0.006

  // 4. RETRAITE COMPLÉMENTAIRE RCI — seuil T1/T2 = 38 493 €
  const rci = Math.min(R, pRCI1) * 0.07
    + Math.max(0, Math.min(R, p4PASS) - pRCI1) * 0.08

  // 5. INVALIDITÉ-DÉCÈS — 1,3% sur totalité du revenu (pas de plafond)
  const inval = R * 0.013

  // 6. ALLOCATIONS FAMILIALES — progressif 0→2,15% entre 110% et 140% PASS
  let af = 0
  if (R > p140) {
    af = R * 0.0215
  } else if (R > p110) {
    af = R * 0.0215 * ((R - p110) / (p140 - p110))
  }

  // 7. FORMATION PROFESSIONNELLE — fixe annuel
  const cfp = PASS * 0.0025

  // 8. PRÉVOYANCE facultative
  const prev = R * pc

  // 9. CSG/CRDS : 9,7% × 98% du revenu net (base non élargie — §3 doc)
  const csg = R * 0.98 * 0.097

  const total = maladie + ij + ret_base + rci + inval + af + cfp + prev + csg
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
