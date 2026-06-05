import { SimParams, StructureResult, SwotResult, Levier, PlanAction, ProjectionPoint, Priorite } from './types'
import { irMarginal, tmiRate, bestDiv } from './ir'
import { calcIS, protTNS, protSalarie, PASS } from './cotisations'

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + '\u00a0€'
}

// Taux de cotisations forfaitaires micro-entrepreneur 2025 (URSSAF)
// Ces taux incluent SSI + CSG/CRDS + formation pro — ne pas ajouter CSG en plus
const TAUX_COTIS_MICRO: Record<string, number> = {
  services_bic: 0.211,  // Prestations de services BIC
  liberal_bnc:  0.211,  // Professions libérales (SSI/CIPAV)
  commerce:     0.123,  // Vente de marchandises
  btp:          0.211,  // Prestations artisanales
}

// Micro-entreprise
// Base IR = CA × (1 - abat) uniquement (abattement forfaitaire fiscal — ne déduit pas les charges réelles)
// Net ÉCONOMIQUE = CA - charges_réelles - cotisations - IR
// Les charges réelles ne sont PAS déductibles fiscalement (l'abattement les remplace),
// mais ce sont de vrais décaissements qui réduisent le revenu disponible réel.
export function calcMicro(p: SimParams): StructureResult | null {
  if (!p.abat) return null
  const ben = p.ca * (1 - p.abat)   // base IR forfaitaire (abattement fiscal)
  const tauxCotis = TAUX_COTIS_MICRO[p.secteur] ?? 0.211
  const cotis = p.ca * tauxCotis     // cotisations sur CA brut encaissé
  // PER : plafond = 10% du bénéfice forfaitaire, plancher 4 399 €, plafond 35 194 € (2025)
  const plafondPerMicro = Math.min(35194, Math.max(4399, ben * 0.10))
  const perDed = Math.min(p.perMontant || 0, plafondPerMicro)
  const baseIR = Math.max(0, ben - perDed)
  const ir = irMarginal(baseIR, p.autresRev, p.partsBase, p.nbEnfants)
  // Net disponible réel : on déduit charges, cotis, IR et versements PER (cash sorti)
  const net = p.ca - p.charges - cotis - ir - perDed
  // Alerte si les charges réelles dépassent ce que l'abattement "couvre"
  const avantageAbattement = p.ca * p.abat
  const alerteChargesNonDeductibles = p.charges > 0 && p.charges > avantageAbattement
  return {
    forme: 'Micro-entreprise',
    netAnnuel: net,
    charges: cotis,
    ir,
    is: 0,
    ben,
    div: 0,
    remBrute: p.ca,
    remNet: net,
    ratioDivPct: 0,
    strat: 'Revenu micro forfaitaire',
    scoreTotal: 0,
    prot: protTNS(Math.max(0, net)),
    methDiv: '—',
    tauxCotis,
    chargesReelles: p.charges > 0 ? p.charges : undefined,
    alerteChargesNonDeductibles,
  }
}

// EI régime réel
// Art.L.131-6 CSS : cotisations SSI calculées sur le revenu professionnel NET (après cotisations)
// → résolution itérative : cotis = f(bNet), bNet = bBrut - cotis
// Formule par composante — même règles que cotisTNS_sur_revenu (pc=0, sans prévoyance)
const _p40    = PASS * 0.40   // 18 547 € — seuil maladie bas
const _p60    = PASS * 0.60   // 27 821 € — seuil maladie haut
const _p110   = PASS * 1.10   // 51 005 € — seuil AF bas
const _p140   = PASS * 1.40   // 64 915 € — seuil AF haut
const _pRCI1  = 38493         // seuil T1/T2 retraite complémentaire
const _p4PASS = PASS * 4
const _p5PASS = PASS * 5

function cotisEI(R: number): number {
  const retraiteBase  = Math.min(R, PASS) * 0.1775
  const retraiteCompl = Math.min(R, _pRCI1) * 0.07
    + Math.max(0, Math.min(R, _p4PASS) - _pRCI1) * 0.08
  const invalidite    = R * 0.013
  let maladie: number
  if (R <= _p40) {
    maladie = R * 0.0135
  } else if (R <= _p60) {
    const taux = 0.0135 + (0.065 - 0.0135) * ((R - _p40) / (_p60 - _p40))
    maladie = R * taux
  } else {
    maladie = R * 0.065
  }
  const ij = Math.min(R, _p5PASS) * 0.005
  let allocFam = 0
  if (R > _p140) {
    allocFam = R * 0.0215
  } else if (R > _p110) {
    allocFam = R * 0.0215 * ((R - _p110) / (_p140 - _p110))
  }
  const csgCrds  = R * 0.98 * 0.097
  const formation = PASS * 0.0025
  return retraiteBase + retraiteCompl + invalidite + maladie + ij + allocFam + csgCrds + formation
}

export function calcEIReel(p: SimParams): StructureResult {
  const bBrut = Math.max(0, p.ca - p.charges - p.amort)
  // Iteration : cotisations sur bNet (Art.L.131-6 CSS)
  let bNet = bBrut * 0.65   // estimation initiale ~65% du brut
  let cotis = cotisEI(bNet)
  for (let i = 0; i < 40; i++) {
    const newBNet = Math.max(0, bBrut - cotis)
    if (Math.abs(newBNet - bNet) < 0.50) { bNet = newBNet; break }
    bNet = newBNet
    cotis = cotisEI(bNet)
  }
  bNet = Math.max(0, bBrut - cotis)
  // EI réel : charges déduites au réel (CA − charges − amort − cotis)
  // Pas d'abattement forfaitaire 10% — réservé aux salariés (Art.83 CGI)
  // Art.13 CGI : bénéfice imposable = recettes − dépenses professionnelles réelles
  const plafondPER = Math.min(35194, Math.max(4399, bNet * 0.10))
  const perDed = Math.min(p.perMontant || 0, plafondPER)
  const baseIR = Math.max(0, bNet - perDed)
  const ir = irMarginal(baseIR, p.autresRev, p.partsBase, p.nbEnfants)
  const net = bNet - ir - perDed    // perDed = montant effectivement versé sur PER (plafonné)
  const tauxCotis = bNet > 0 ? Math.round(cotis / bNet * 100) : 0
  return {
    forme: 'EI (réel normal)',
    netAnnuel: net,
    charges: cotis,
    ir,
    is: 0,
    ben: bBrut,
    div: 0,
    remBrute: bNet,
    remNet: net,
    ratioDivPct: 0,
    strat: `Bénéfice net ${fmt(bNet)} — cotis ${tauxCotis}% du net`,
    scoreTotal: 0,
    prot: protTNS(bNet),
    methDiv: '—',
    bNet,
    baseIR,
    tauxCotis,
  }
}

// EURL / SARL IS — Art.62 CGI + Art.154 bis CGI
// Arbitrage optimisé : rémunération TNS vs dividendes PFU (≤ 10% capital uniquement)
// Dividendes ≤ 10% capital → PFU 30% (ou barème), 0 cotisations TNS
// Dividendes > 10% capital → distribués en TNS si rentable, sinon réserves
// Stratégie : protection → 100% rem ; equilibre → 1 PASS net ; autres → optimisation

// Comparer dividendes TNS vs rémunération pour 1€ de bénéfice IS résiduel
// Net/€ rémunération (abat 10% Art.62) : (1/1.423) × (1 − 0.90 × tmi)
// Net/€ dividendes TNS (IS payé, cotis ~42%, IR 12.8%) : ((1−tauxIS)/1.423) × (1−0.128)
// TMI 30% IS 15% → divTNS 0.521 > remun 0.513 → DISTRIBUER ✅
// TMI 11% IS 15% → remun 0.633 > divTNS 0.521 → réserves
// TMI 41% IS 25% → divTNS 0.461 > remun 0.444 → DISTRIBUER ✅
function comparerDividendeTNSvsRemun(tmi: number, tauxIS: number): boolean {
  const netRemun = (1 / 1.423) * (1 - 0.90 * tmi)
  const netDivTNS = ((1 - tauxIS) / 1.423) * (1 - 0.128)
  return netDivTNS > netRemun
}

// Calcul circulaire dividendes TNS : cotisEI sur le net (Art.L.131-6 CSS)
// IR 12.8% sur le net (PS inclus dans cotisEI — pas de double prélèvement)
function calculDividendesTNS(montantBrut: number): {
  cotisations: number; netAvantIR: number; ir: number; net: number
} {
  let netDiv = montantBrut * 0.70
  for (let i = 0; i < 50; i++) {
    const nvNet = Math.max(0, montantBrut - cotisEI(netDiv))
    if (Math.abs(nvNet - netDiv) < 0.50) { netDiv = nvNet; break }
    netDiv = nvNet
  }
  netDiv = Math.max(0, montantBrut - cotisEI(netDiv))
  const cotisations = Math.max(0, montantBrut - netDiv)
  const ir = netDiv * 0.128
  return {
    cotisations: Math.round(cotisations),
    netAvantIR: Math.round(netDiv),
    ir: Math.round(ir),
    net: Math.round(netDiv - ir),
  }
}

function eurlScenario(
  p: SimParams,
  capaPourRem: number,
  remNet: number,
  deficit: number
): {
  net: number; remNet: number; cotis: number; is: number; resNet: number
  beneficeIS: number; divPFU: number; reserves: number; netDivPFU: number
  tDivPFU: number; irGerant: number; abat10: number; baseIR: number
  perDed: number; seuilCap: number; methPFU: string; netRem: number
  divTNS: number; cotisDivTNS: number; irDivTNS: number; netDivTNS: number
} | null {
  const cotis = cotisEI(remNet)
  const beneficeIS = capaPourRem - remNet - cotis
  if (beneficeIS < -50) return null

  const beneficeISClamped = Math.max(0, beneficeIS)
  const resISforIS = Math.max(0, beneficeISClamped - deficit)
  const is = calcIS(resISforIS)
  const resNet = beneficeISClamped - is

  const seuilCap = (p.capital || 0) * 0.10
  // Tranche PFU uniquement (≤ 10% capital) — 0 cotisations TNS
  const divPFU = seuilCap > 300 ? Math.min(resNet, seuilCap) : 0
  const excedentCap = Math.max(0, resNet - divPFU)

  // IR rémunération (Art.62 CGI — abattement 10%, min 448€, max 14 555€)
  const abat10 = remNet > 0 ? Math.max(448, Math.min(remNet * 0.10, 14555)) : 0
  const baseIR = remNet - abat10
  const plafondPER = Math.min(35194, Math.max(4399, remNet * 0.10))
  const perDed = Math.min(p.perMontant || 0, plafondPER)
  const irGerant = irMarginal(
    Math.max(0, baseIR - perDed),
    p.autresRev, p.partsBase, p.nbEnfants
  )
  const netRem = remNet - irGerant - perDed

  // Dividendes PFU — bestDiv choisit automatiquement PFU 30% ou barème IR
  const { tax: tDivPFU, meth: methPFU } = divPFU > 0
    ? bestDiv(divPFU, Math.max(0, baseIR - perDed), p.partsBase, p.nbEnfants, p.autresRev)
    : { tax: 0, meth: '—' }
  const netDivPFU = divPFU - tDivPFU

  // Dividendes TNS (excédent > 10% capital) — distribuer si plus rentable que garder en réserves
  const tauxISEff = beneficeISClamped > 42500 ? 0.25 : 0.15
  const tmiGerant = tmiRate(Math.max(0, baseIR - perDed + p.autresRev), p.partsBase, p.nbEnfants)
  let divTNS = 0, cotisDivTNS = 0, irDivTNS = 0, netDivTNS = 0, reserves: number
  if (excedentCap > 100 && comparerDividendeTNSvsRemun(tmiGerant, tauxISEff)) {
    const res = calculDividendesTNS(excedentCap)
    divTNS = excedentCap
    cotisDivTNS = res.cotisations
    irDivTNS = res.ir
    netDivTNS = res.net
    reserves = 0
  } else {
    reserves = excedentCap
  }

  return {
    net: netRem + netDivPFU + netDivTNS,
    remNet, cotis, is, resNet, beneficeIS: beneficeISClamped,
    divPFU, reserves, netDivPFU, tDivPFU,
    irGerant, abat10, baseIR, perDed, seuilCap, methPFU, netRem,
    divTNS, cotisDivTNS, irDivTNS, netDivTNS,
  }
}

export function calcEURL(p: SimParams): StructureResult {
  const capa = Math.max(0, p.ca - p.charges - p.amort)

  // Réserves volontaires — résultat intentionnellement laissé en société (soumis à IS)
  const reservesBrutes = p.stratActif === 'reserve'
    ? Math.min(p.reserveVoulue || 0, capa)
    : 0
  const capaPourRem = Math.max(0, capa - reservesBrutes)

  // Déficit : s'impute sur réserves en priorité, le solde reste disponible pour IS dividendes
  const deficitReserves = Math.min(p.deficit, reservesBrutes)
  const deficitRem = Math.max(0, p.deficit - deficitReserves)

  // IS sur les réserves volontaires
  const isReserves = calcIS(Math.max(0, reservesBrutes - deficitReserves))
  const resNetReserves = reservesBrutes - isReserves

  // remMax : rémunération nette maximale (0 bénéfice IS) — circulaire
  let remMax = capaPourRem * 0.65
  for (let i = 0; i < 50; i++) {
    const guess = Math.max(0, capaPourRem - cotisEI(remMax))
    if (Math.abs(guess - remMax) < 0.50) { remMax = guess; break }
    remMax = guess
  }
  remMax = Math.max(0, remMax)

  let bestRemNet: number

  if (p.priorite === 'protection') {
    // 100% rémunération — protection sociale maximale, aucun dividende
    bestRemNet = remMax

  } else if (p.priorite === 'equilibre') {
    // Cible : 1 PASS net de cotisations (protection complète : trimestres, IJ, retraite base)
    // Surplus → IS 15% + dividendes PFU si capital suffisant
    bestRemNet = PASS + cotisEI(PASS) <= capaPourRem ? PASS : remMax

  } else {
    // net / croissance / simplicite → optimiser le revenu net disponible total
    let bestNet = -Infinity
    bestRemNet = 0
    const step1 = Math.max(1000, Math.round(remMax / 40))
    for (let r = 0; r <= remMax; r += step1) {
      const sc = eurlScenario(p, capaPourRem, r, deficitRem)
      if (sc && sc.net > bestNet) { bestNet = sc.net; bestRemNet = r }
    }
    // Affinage ±2×step autour du meilleur point, pas 10× plus fin
    const refine = step1 * 2
    const step2 = Math.max(200, Math.round(step1 / 10))
    for (
      let r = Math.max(0, bestRemNet - refine);
      r <= Math.min(remMax, bestRemNet + refine);
      r += step2
    ) {
      const sc = eurlScenario(p, capaPourRem, r, deficitRem)
      if (sc && sc.net > bestNet) { bestNet = sc.net; bestRemNet = r }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sc = eurlScenario(p, capaPourRem, bestRemNet, deficitRem)!

  let strat: string
  if (p.priorite === 'protection') {
    strat = `100% rémunération — ${fmt(sc.remNet)}/an · protection maximale TNS`
  } else if (reservesBrutes > 0 && sc.divPFU < 100 && sc.divTNS < 100) {
    strat = `Rémunération ${fmt(sc.remNet)}/an — réserves nettes ${fmt(resNetReserves)} (IS ${fmt(isReserves)})`
  } else if (sc.divPFU > 100 || sc.divTNS > 100) {
    strat = `Rémunération ${fmt(sc.remNet)}`
    if (sc.divPFU > 100) strat += ` + ${fmt(sc.divPFU)} div PFU (${sc.methPFU})`
    if (sc.divTNS > 100) strat += ` + ${fmt(sc.divTNS)} div TNS → net ${fmt(sc.netDivTNS)}`
    if (sc.reserves > 100) strat += ` — ${fmt(sc.reserves)} en réserves IS`
  } else {
    strat = `Rémunération ${fmt(sc.remNet)}/an — net après IR : ${fmt(sc.netRem)}`
  }

  return {
    forme: 'EURL / SARL (IS)',
    netAnnuel: sc.net,
    charges: sc.cotis + sc.cotisDivTNS,
    ir: sc.irGerant + sc.tDivPFU + sc.irDivTNS,
    is: sc.is + isReserves,
    ben: sc.beneficeIS + reservesBrutes,
    div: sc.divPFU + sc.divTNS,
    divNet: sc.netDivPFU + sc.netDivTNS,
    remBrute: sc.remNet,
    remNet: sc.netRem,
    remMois: sc.remNet / 12,
    netMois: sc.net / 12,
    ratioDivPct: 0,
    strat,
    scoreTotal: 0,
    prot: protTNS(sc.remNet),
    methDiv: sc.methPFU,
    seuilCap: sc.seuilCap,
    resEnReserve: resNetReserves + sc.reserves,
    cotisSurDiv: sc.cotisDivTNS,
    irSalSeul: sc.irGerant,
    baseIR: sc.baseIR,
    abat10: sc.abat10,
  }
}

// SAS / SASU — Assimilé salarié
// Patronales ~42%, salariales ~22%
// Abattement 10% sur salaire net (Art.83 CGI), plafonné 14 171 €
function calcSASU_net(p: SimParams, brutSal: number, ratioDivPct: number) {
  const pc = p.prevoy === 'moyen' ? 0.05 : p.prevoy === 'max' ? 0.10 : 0.02
  const capa = Math.max(0, p.ca - p.charges - p.amort)
  const pat = brutSal * 0.45
  const sal = brutSal * 0.22
  const netSal = brutSal - sal
  const prev = brutSal * pc
  const resIS = Math.max(0, capa - brutSal - pat - prev)
  // Déficit antérieur : s'applique UNIQUEMENT sur la base IS (pas sur la capa de rémunération)
  const resISforIS = Math.max(0, resIS - p.deficit)
  const is = calcIS(resISforIS)
  const resNet = resIS - is
  const div = resNet * (ratioDivPct / 100)
  const abat10 = netSal > 0 ? Math.max(448, Math.min(netSal * 0.10, 14555)) : 0
  const baseIR = netSal - abat10
  const plafondPER = Math.min(35194, Math.max(4399, netSal * 0.10))
  const perDedSASU = Math.min(p.perMontant || 0, plafondPER)
  const irSal = irMarginal(Math.max(0, baseIR - perDedSASU), p.autresRev, p.partsBase, p.nbEnfants)
  const { tax: tDiv, meth } = bestDiv(div, baseIR, p.partsBase, p.nbEnfants, p.autresRev)
  const net = netSal - irSal + div - tDiv - perDedSASU  // PER = cash versé sur compte retraite
  return {
    net, div, divNet: div > 0 ? div - tDiv : 0, is, netSal,
    irTotal: irSal + tDiv, irSalSeul: irSal, cotisTotal: pat + sal,
    cotisPatronales: pat, cotisSalariales: sal, resIS, meth, resNet,
    brutSal, netSalMois: netSal / 12,
    divNetMois: div > 0 ? (div - tDiv) / 12 : 0,
    baseIR, abat10, perDedSASU,
  }
}

export function calcSASU(p: SimParams): StructureResult {
  const pc = p.prevoy === 'moyen' ? 0.05 : p.prevoy === 'max' ? 0.10 : 0.02
  const capa = Math.max(0, p.ca - p.charges - p.amort)
  // brutMax = salaire brut max absorbant 100% du résultat (aucun bénéfice IS résiduel)
  const brutMax = capa / (1 + 0.45 + pc)

  let bestBrut: number
  let bestRatio: number

  if (p.priorite === 'protection') {
    // Tout en salaire — cotisations maximales, aucun dividende
    // → meilleure couverture retraite/maladie assimilé salarié
    bestBrut = brutMax
    bestRatio = 0

  } else if (p.priorite === 'equilibre') {
    // 1 PASS brut = protection complète (trimestres validés, IJ max, retraite de base saturée)
    // Surplus → IS 15% + dividendes PFU 30% (plus efficace que cotisations au-delà du PASS)
    bestBrut = Math.min(PASS, brutMax)
    bestRatio = 100

  } else {
    // net / croissance / simplicite :
    // IS 15% + PFU 30% = 27,8% total < patronal 45% + salarial 22%
    // → 0 salaire TOUJOURS optimal pour le revenu net disponible en SAS
    bestBrut = 0
    bestRatio = 100
  }

  const { net, div, is, netSal, irTotal, cotisTotal, resIS, meth, resNet } = calcSASU_net(p, bestBrut, bestRatio)
  const { divNet, cotisPatronales, cotisSalariales, irSalSeul, baseIR } = calcSASU_net(p, bestBrut, bestRatio)
  const netDivReel = div > 0 ? div - (irTotal - irSalSeul) : 0

  let strat: string
  if (p.priorite === 'protection') {
    strat = `100% salaire — ${fmt(netSal)} nets/an · protection maximale`
  } else if (bestBrut < 100) {
    strat = `100% dividendes — ${fmt(netDivReel)} nets (${meth}, 0 cotisations sociales)`
  } else if (!div || div < 100) {
    strat = `Salaire — ${fmt(netSal)} nets/an (brut ${fmt(bestBrut)})`
  } else if (p.priorite === 'equilibre') {
    strat = `🛡 1 PASS salaire + dividendes — ${fmt(netSal)} sal. + ${fmt(netDivReel)} div nets`
  } else {
    strat = `Salaire ${fmt(netSal)} nets + ${fmt(netDivReel)} div nets (${meth})`
  }

  return {
    forme: 'SAS / SASU',
    netAnnuel: net,
    charges: cotisTotal,
    ir: irTotal,
    is,
    ben: resIS,
    div,
    divNet: netDivReel,
    remBrute: bestBrut,
    remNet: netSal,
    remMois: bestBrut / 12,
    netMois: net / 12,
    divNetAn: netDivReel,
    divNetMois: netDivReel / 12,
    cotisPatronales,
    cotisSalariales,
    irSalSeul,
    ratioDivPct: bestRatio,
    strat,
    scoreTotal: 0,
    prot: protSalarie(bestBrut),
    methDiv: meth,
    baseIR,
  }
}

// Score multicritère — net annuel est le critère dominant (60 pts par défaut)
export function scoreMulti(res: StructureResult[], priorite: Priorite): StructureResult[] {
  // Poids fixes par priorité, toujours somme = 100
  const W: Record<string, { n: number; f: number; p: number; a: number }> = {
    net:        { n: 75, f: 12, p:  8, a:  5 },
    equilibre:  { n: 60, f: 20, p: 12, a:  8 },
    croissance: { n: 50, f: 38, p:  7, a:  5 },
    simplicite: { n: 45, f: 10, p: 10, a: 35 },
    protection: { n: 35, f: 12, p: 45, a:  8 },
  }
  const { n: wN, f: wF, p: wP, a: wA } = W[priorite] ?? W.equilibre

  const SC: Record<string, { s: number; f: number }> = {
    'Micro-entreprise': { s: 5, f: 1 },
    'EI (réel normal)': { s: 4, f: 2 },
    'EURL / SARL (IS)': { s: 2, f: 4 },
    'SAS / SASU':       { s: 2, f: 5 },
  }
  // Protection : scores fixes par structure (sur 12 pts max), indépendants du niveau de rémunération
  const PROT_FIXED: Record<string, number> = {
    'Micro-entreprise': 2,
    'EI (réel normal)': 6,
    'EURL / SARL (IS)': 7,
    'SAS / SASU':       10,
  }
  const protRaw = (r: StructureResult) => PROT_FIXED[r.forme] ?? 5

  const nets = res.map(r => r.netAnnuel)
  const mn = Math.min(...nets), mx = Math.max(...nets)

  const scored = res.map(r => {
    const b = SC[r.forme] ?? { s: 2, f: 2 }
    const prot = protRaw(r)
    // Normalisation 0→1 pour chaque critère
    const netNorm   = mx === mn ? 1 : (r.netAnnuel - mn) / (mx - mn)
    const flexNorm  = (b.f - 1) / 4   // SC flex : 1-5 → 0-1
    const protNorm  = prot / 12        // Sur 12 points max → 0-1
    const adminNorm = (b.s - 1) / 4   // SC simp : 1-5 → 0-1

    const netScore   = Math.round(netNorm   * wN)
    const flexScore  = Math.round(flexNorm  * wF)
    const protScore  = Math.round(protNorm  * wP)
    const adminScore = Math.round(adminNorm * wA)

    return {
      ...r,
      scoreTotal: netScore + flexScore + protScore + adminScore,
      scoreBreakdown: {
        netScore,  netMax: wN,
        flexScore, flexMax: wF,
        protScore, protMax: wP,
        adminScore, adminMax: wA,
      },
    }
  })

  // Invariant : hors priorité protection, la structure au net le plus élevé
  // doit toujours avoir le score le plus élevé (ou ex-aequo).
  if (priorite !== 'protection') {
    const maxNetIdx = scored.reduce((best, r, i) =>
      r.netAnnuel > scored[best].netAnnuel ? i : best, 0)
    const maxOtherScore = Math.max(
      ...scored.filter((_, i) => i !== maxNetIdx).map(r => r.scoreTotal)
    )
    if (scored[maxNetIdx].scoreTotal < maxOtherScore) {
      scored[maxNetIdx] = { ...scored[maxNetIdx], scoreTotal: maxOtherScore + 1 }
    }
  }

  return scored
}

// Analyse SWOT par structure — valeurs spécifiques au profil simulé
export function swot(r: StructureResult, p: SimParams): SwotResult {
  const s: SwotResult = { pos: [], neg: [], opp: [], rsk: [] }
  const f = r.forme
  const ben = Math.max(0, p.ca - p.charges - p.amort)

  if (f === 'Micro-entreprise') {
    const plafond = p.secteur === 'commerce' ? 188700 : 77700
    const pctPlafond = Math.round(p.ca / plafond * 100)
    const abatPct = Math.round((p.abat || 0.5) * 100)
    s.pos = [
      `Gestion ultra-simple : abattement forfaitaire ${abatPct}% — aucune comptabilité obligatoire`,
      'Pas de charges sociales proportionnelles au résultat — cotisations sur CA uniquement',
    ]
    s.neg = [
      `Vos charges réelles (${fmt(p.charges + p.amort)}) ne sont pas déductibles — régime moins favorable`,
      'Protection sociale TNS minimale (IJ faibles, retraite très limitée)',
      `CA actuel (${fmt(p.ca)}) = ${pctPlafond}% du plafond — risque de dépassement`,
    ]
    s.opp = [
      'Versement libératoire IR si revenu fiscal N-2 ≤ 27 478 €/part',
      'Cumul ARE possible sous conditions lors de la création',
    ]
    s.rsk = [
      `Dépassement du plafond (${fmt(plafond)}) 2 ans → passage forcé au régime réel`,
      `Aucune déduction possible des ${fmt(p.charges + p.amort)} de charges et amortissements réels`,
    ]
  } else if (f === 'EI (réel normal)') {
    const bNet = r.bNet || ben
    const perPlafond = Math.round(Math.min(35194, bNet * 0.10))
    s.pos = [
      `Toutes les charges réelles déductibles : ${fmt(p.charges + p.amort)} déjà déduits`,
      'Cotisations SSI 2025 calculées par composante — taux dégressif au-delà du PASS',
      'PER/prévoyance TNS : réduction simultanée cotisations ET IR',
    ]
    s.neg = [
      'Pas de séparation patrimoine pro / personnel — responsabilité illimitée',
      'Protection sociale TNS inférieure à l\'assimilé salarié (SASU)',
      `Bénéfice net (${fmt(bNet)}) entièrement soumis aux cotisations SSI`,
    ]
    s.opp = [
      `PER individuel : jusqu'à ${fmt(perPlafond)}/an déductibles (votre plafond 2025)`,
      'Passage en IS recommandé si bénéfice net dépasse 60 000 €/an',
    ]
    s.rsk = [
      'Responsabilité illimitée sur le patrimoine personnel et familial',
      'Cession d\'activité complexe — apport en société nécessaire',
    ]
  } else if (f === 'EURL / SARL (IS)') {
    const seuilDiv = p.capital * 0.10
    const isEst = Math.min(r.ben || 0, 42500) * 0.15
    s.pos = [
      `IS 15% sur les premiers 42 500 € de résultat — économie estimée ${fmt(isEst)} vs IR`,
      'PER déductible IS ET IR — double effet de levier sur votre bénéfice',
      `Dividendes possibles jusqu'à ${fmt(seuilDiv)} sans surcoût de cotisations TNS`,
    ]
    s.neg = [
      `Dividendes > ${fmt(seuilDiv)} (10% du capital ${fmt(p.capital)}) → cotisations TNS ~45%`,
      'Protection sociale TNS inférieure à SASU (IJ et retraite complémentaire)',
      'Obligations comptables — coût expert-comptable annuel à prévoir',
    ]
    s.opp = [
      `Augmenter le capital au-delà de ${fmt(p.capital)} pour distribuer davantage sans surcoût`,
      'CCA rémunéré (5,23%/an) déductible IS — alternative aux dividendes',
    ]
    s.rsk = [
      `Capital actuel ${fmt(p.capital)} trop faible → dividendes > ${fmt(seuilDiv)} sur-cotisés TNS`,
      'Cotisations TNS minimum dues même si rémunération nulle',
    ]
  } else {
    const divMontant = r.div || 0
    const meth = r.methDiv || 'PFU 30%'
    s.pos = [
      `${divMontant > 0 ? fmt(divMontant) + ' de dividendes' : 'Dividendes'} sans cotisations sociales — avantage unique en France`,
      'Meilleure couverture maladie, AT/MP et retraite complémentaire (AGIRC-ARRCO)',
      'Frais professionnels remboursés sur justificatifs — exonérés de charges patronales',
    ]
    s.neg = [
      'Charges assimilé salarié élevées (~64% du brut vs ~45% pour les TNS)',
      'Pas de couverture chômage France Travail (président de SASU)',
      'Obligations comptables — coût expert-comptable annuel à prévoir',
    ]
    s.opp = [
      `Dividendes taxés ${meth} (option la plus favorable calculée automatiquement)`,
      'GSC / assurance perte d\'emploi déductible IS — se substitue au chômage',
    ]
    s.rsk = [
      `Salaire président trop bas → trimestres retraite insuffisants (min. ${fmt(PASS)}/an brut recommandé)`,
      'Résultat IS faible (CA bas ou charges élevées) = peu de dividendes distribuables',
    ]
  }
  return s
}

// Leviers d'optimisation
export function leviers(best: StructureResult, p: SimParams): Levier[] {
  const lv: Levier[] = []
  const isTNS = best.forme === 'EURL / SARL (IS)' || best.forme === 'EI (réel normal)'
  const isSoc = best.forme === 'EURL / SARL (IS)' || best.forme === 'SAS / SASU'
  const tmi = tmiRate(
    Math.max(0, (best.remBrute || 0) * (best.forme === 'EI (réel normal)' ? 1 : 0.90) + p.autresRev),
    p.partsBase, p.nbEnfants
  )
  const tauxIS = (best.is > 0 && best.ben > 42500) ? 0.25 : 0.15

  // IK — 8 000 km/an, 5 CV = 0,548 €/km
  const ikAnn = 8000 * 0.548
  let ikGain = 0
  if (isSoc) { ikGain = Math.round(ikAnn * tauxIS + (best.forme === 'SAS / SASU' ? ikAnn * 0.22 : 0)) }
  else { ikGain = Math.round(ikAnn * (0.45 / 1.45 + tmi)) }
  lv.push({
    ico: '🚗', nom: 'Indemnités kilométriques',
    desc: `Base : 8 000 km/an × 0,548 €/km = ${fmt(ikAnn)}. Déductible du résultat${isSoc ? ' IS' : ''}. En SASU, exonéré de charges patronales.`,
    gain: Math.max(200, ikGain), cond: 'Justificatifs obligatoires (registre kilométrique).',
  })

  // Domiciliation / frais de siège
  const domAnn = 1200
  const domGain = isSoc ? Math.round(domAnn * tauxIS) : Math.round(domAnn * (0.45 / 1.45 + tmi))
  lv.push({
    ico: '🏢', nom: 'Domiciliation / frais de siège',
    desc: `Contrat de domiciliation (~${fmt(domAnn)}/an) ou quote-part de loyer si bureau à domicile. Déductible du résultat${isSoc ? ' IS' : ''}.`,
    gain: domGain, cond: 'Si domicile : pièce dédiée, quote-part surface pro/totale × charges à documenter.',
  })

  // PER + prévoyance TNS
  if (isTNS) {
    const bBase = Math.max(0, p.ca - p.charges - p.amort)
    const pcMad = p.prevoy === 'max' ? 0.10 : 0.05
    const madAnn = Math.min(bBase * pcMad, 37094)
    if (madAnn > 300) {
      const econCotis = madAnn * 0.45 / 1.45
      const econIR = madAnn * tmi
      const perDejaActif = p.perActif === 'oui'
      lv.push({
        ico: '🛡', nom: perDejaActif ? 'Prévoyance TNS (arrêt maladie, invalidité)' : 'PER & prévoyance TNS',
        desc: perDejaActif
          ? 'Pensez au contrat de prévoyance TNS — primes déductibles du bénéfice IS ou BIC.'
          : `Versements PER estimés à ${fmt(madAnn)}/an. Déductibles du bénéfice ET de l'IR — double levier unique aux TNS.`,
        gain: perDejaActif ? Math.round(econCotis) : Math.round(econCotis + econIR),
        cond: 'Réservé aux TNS (EI, gérant maj. EURL). PER individuel ou contrat prévoyance TNS.',
      })
    }
  }

  // PER individuel (assimilé salarié)
  if (p.perActif !== 'oui' && !isTNS) {
    const perAnn = Math.min(p.remNetAnn * 0.08, 10000)
    const perGain = Math.round(perAnn * tmi)
    if (perGain > 100) {
      lv.push({
        ico: '🏦', nom: 'Plan d\'épargne retraite (PER)',
        desc: `Versement estimé à ${fmt(perAnn)}/an (~8% du revenu). Économie = versement × TMI (${Math.round(tmi * 100)}%).`,
        gain: perGain, cond: 'Plafond 2025 : 10% des revenus pro N-1, max 35 194 €.',
      })
    }
  }

  return lv
}

// Plan d'action par structure
export function plan(best: StructureResult, p: SimParams): PlanAction[] {
  const bM = fmt(Math.round((best.remBrute || 0) / 12)) + '/mois brut'
  const plans: Record<string, PlanAction[]> = {
    'Micro-entreprise': [
      { t: 'Vérifier les plafonds CA 2025', d: 'Services : 77 700 € · Commerce : 188 700 €. Deux exercices au-delà = passage forcé au réel.', cls: 'tg-a', tag: 'Prérequis' },
      { t: 'Option versement libératoire de l\'IR', d: 'Si revenu fiscal N-2 ≤ 27 478 €/part, le versement libératoire simplifie la gestion.', cls: 'tg-b', tag: 'Optimisation IR' },
      { t: 'Préparer le passage au régime réel ou en société', d: 'Dès 70% du plafond, simulez EI réel ou société IS.', cls: 'tg-g', tag: 'Anticipation' },
    ],
    'EI (réel normal)': [
      { t: 'Maximiser toutes les charges réelles déductibles', d: 'Véhicule (IK), local pro, matériel, formation, assurances, honoraires EC.', cls: 'tg-g', tag: 'Levier principal' },
      { t: 'PER individuel + contrat prévoyance TNS', d: 'Plafond PER 2025 : 10% du bénéfice (max 8 PASS). Déductible du bénéfice ET de l\'IR.', cls: 'tg-g', tag: 'Double levier' },
      { t: 'Seuil de passage en société IS : bénéfice net > 60 000 €', d: 'Au-delà, le taux IS 15% devient inférieur à votre TMI IR.', cls: 'tg-b', tag: 'Seuil clé' },
    ],
    'EURL / SARL (IS)': [
      { t: `Rémunération TNS : ${bM}`, d: `Déductible IS. Minimum recommandé : 1 PASS (${fmt(PASS)}/an brut). Rémunération nulle = IS sur tout.`, cls: 'tg-a', tag: 'Priorité 1' },
      { t: 'PER + prévoyance TNS — double déduction IS et IR', d: 'Plafond PER 2025 : jusqu\'à 37 094 €/an.', cls: 'tg-g', tag: 'Levier majeur' },
      { t: `Seuil dividendes sans surcoût : ${fmt(p.capital * 0.10)} max`, d: `Au-delà, chaque euro de dividende supporte 45% de cotisations TNS.`, cls: 'tg-a', tag: 'Point critique' },
    ],
    'SAS / SASU': [
      { t: `Salaire président : minimum 1 PASS (${fmt(PASS)}/an brut)`, d: 'En dessous, les trimestres retraite et IJ maladie sont insuffisants.', cls: 'tg-a', tag: 'Priorité 1' },
      { t: 'Dividendes sans cotisations sociales — optimisez le montant', d: 'Seule structure sans cotisation sociale sur les dividendes. PFU 30% ou barème IR calculé automatiquement.', cls: 'tg-g', tag: 'Avantage unique' },
      { t: 'Assurance perte d\'emploi : contrat GSC', d: 'Le président de SASU n\'est pas couvert par France Travail. Déductible IS.', cls: 'tg-a', tag: 'Protection obligatoire' },
    ],
  }
  return plans[best.forme] || []
}

// Projection sur variation de CA
export function projection(res: StructureResult[], p: SimParams): ProjectionPoint[] {
  return [-0.20, -0.10, 0, 0.20, 0.40, 0.60].map(t => {
    const pp: SimParams = { ...p, ca: Math.max(1, p.ca * (1 + t)) }
    const projs = res.map(r => {
      let proj: StructureResult | null = null
      if (r.forme === 'Micro-entreprise') proj = calcMicro(pp)
      else if (r.forme === 'EI (réel normal)') proj = calcEIReel(pp)
      else if (r.forme === 'EURL / SARL (IS)') proj = calcEURL(pp)
      else proj = calcSASU(pp)
      return { forme: r.forme, net: proj ? proj.netAnnuel : 0 }
    })
    return { t, ca: pp.ca, projs }
  })
}

// Calcul principal — retourne toutes les structures triées par score
export function runSimulation(p: SimParams): {
  scored: StructureResult[]
  byNet: StructureResult[]
  best: StructureResult
  tmi: number
  gain: number
} {
  const arr: StructureResult[] = []
  const micro = calcMicro(p)
  if (micro) arr.push(micro)
  arr.push(calcEIReel(p))
  arr.push(calcEURL(p))
  arr.push(calcSASU(p))

  const byNet = [...arr].sort((a, b) => b.netAnnuel - a.netAnnuel)
  const scored = scoreMulti(arr, p.priorite)
  scored.sort((a, b) => b.scoreTotal - a.scoreTotal)
  const best = scored[0]
  // TMI calculé sur la base imposable réelle de la structure recommandée
  // Micro : base = ca × (1-abat)
  // EI    : base = bNet - PER (baseIR stocké dans le résultat — pas de 10%)
  // Autres : rémunération brute × 0.90 (abattement Art.62/83 CGI)
  const tmiBase =
    best.forme === 'Micro-entreprise'
      ? (best.ben || 0)                          // ca × (1-abat) = base IR réelle
      : best.forme === 'EI (réel normal)'
        ? (best.baseIR ?? best.bNet ?? 0)        // bNet - PER (pas d'abat 10%)
        : (best.remBrute || 0) * 0.90            // rémunération × 90% (abat Art.62/83)
  const tmi = Math.round(
    tmiRate(Math.max(0, tmiBase + p.autresRev), p.partsBase, p.nbEnfants) * 100
  )
  const gain = byNet[0].netAnnuel - byNet[byNet.length - 1].netAnnuel

  return { scored, byNet, best, tmi, gain }
}
