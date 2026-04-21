import { SimParams, StructureResult, SwotResult, Levier, PlanAction, ProjectionPoint, Priorite } from './types'
import { irMarginal, tmiRate, bestDiv } from './ir'
import { calcCotisTNS, cotisTNS_sur_revenu, calcIS, protTNS, protSalarie, PASS } from './cotisations'

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + '\u00a0€'
}

// Micro-entreprise
// Base IR = CA × (1 - abat) ; cotisations = CA × 24.6%
export function calcMicro(p: SimParams): StructureResult | null {
  if (!p.abat) return null
  const ben = p.ca * (1 - p.abat)
  const cotis = p.ca * 0.246
  const ir = irMarginal(ben, p.autresRev, p.partsBase, p.nbEnfants)
  const net = ben - cotis - ir
  return {
    forme: 'Micro-entreprise',
    netAnnuel: net,
    charges: cotis,
    ir,
    is: 0,
    ben,
    div: 0,
    remBrute: ben,
    remNet: net,
    ratioDivPct: 0,
    strat: 'Revenu micro forfaitaire',
    scoreTotal: 0,
    prot: protTNS(Math.max(0, ben - cotis)),
    methDiv: '—',
  }
}

// EI régime réel
export function calcEIReel(p: SimParams): StructureResult {
  const pc = p.prevoy === 'moyen' ? 0.05 : p.prevoy === 'max' ? 0.10 : 0.02
  const bBrut = Math.max(0, p.ca - p.charges - p.amort - p.deficit)
  const { cotis, bNet } = calcCotisTNS(bBrut, pc)
  const perDed = Math.min(p.perMontant || 0, bNet * 0.10 + Math.max(0, bNet - PASS) * 0.15)
  const ir = irMarginal(Math.max(0, bNet - perDed), p.autresRev, p.partsBase, p.nbEnfants)
  const net = bNet - ir - (p.perMontant || 0)
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
    tauxCotis,
  }
}

// EURL / SARL IS — Art.62 CGI + Art.154 bis CGI
// Cotisations TNS calculées sur la rémunération versée
// Bisection pour trouver rem max : rem + cotisSSI(rem) = capa
export function calcEURL(p: SimParams): StructureResult {
  const pc = p.prevoy === 'moyen' ? 0.05 : p.prevoy === 'max' ? 0.10 : 0.02
  const capa = Math.max(0, p.ca - p.charges - p.amort - p.deficit)
  let lo = 0, hi = capa, rem = capa * 0.6
  for (let i = 0; i < 40; i++) {
    const c = cotisTNS_sur_revenu(rem, pc)
    const diff = (rem + c.total) - capa
    if (Math.abs(diff) < 0.50) break
    if (diff > 0) hi = rem; else lo = rem
    rem = (lo + hi) / 2
  }
  rem = Math.max(0, rem)
  const cotisObj = cotisTNS_sur_revenu(rem, pc)
  const cotis = cotisObj.total
  const resIS = Math.max(0, capa - rem - cotis)
  const is = calcIS(resIS)
  const resNet = resIS - is
  const seuilCap = p.capital * 0.10
  const divBruts = (seuilCap > 300 && resNet > seuilCap) ? Math.min(resNet, seuilCap) : 0
  // BASE IR Art.62 : rémunération × 0.90 (abat 10%, plafonné 14 171 €)
  const abat10 = Math.min(rem * 0.10, 14171)
  const baseIR = rem - abat10
  const perDedEURL = Math.min(p.perMontant || 0, baseIR * 0.10 + Math.max(0, baseIR - PASS) * 0.15)
  const irGerant = irMarginal(Math.max(0, baseIR - perDedEURL), p.autresRev, p.partsBase, p.nbEnfants)
  const { tax: tDiv, meth } = divBruts > 0
    ? bestDiv(divBruts, baseIR, p.partsBase, p.nbEnfants, p.autresRev)
    : { tax: 0, meth: '—' }
  const netGerant = rem - irGerant
  const net = netGerant + divBruts - tDiv
  let strat: string
  if (!divBruts || divBruts < 300) {
    strat = `Rémunération ${fmt(rem)}/an — net après IR : ${fmt(netGerant)}`
  } else {
    strat = `Rémunération ${fmt(rem)}/an + ${fmt(divBruts)} dividendes`
  }
  return {
    forme: 'EURL / SARL (IS)',
    netAnnuel: net,
    charges: cotis,
    ir: irGerant + tDiv,
    is,
    ben: resIS,
    div: divBruts,
    divNet: divBruts > 0 ? divBruts - tDiv : 0,
    remBrute: rem,
    remNet: netGerant,
    remMois: rem / 12,
    netMois: netGerant / 12,
    ratioDivPct: 0,
    strat,
    scoreTotal: 0,
    prot: protTNS(rem),
    methDiv: meth,
    seuilCap,
    resEnReserve: Math.max(0, resNet - divBruts),
    cotisSurDiv: 0,
    irSalSeul: irGerant,
    baseIR,
    abat10,
  }
}

// SAS / SASU — Assimilé salarié
// Patronales ~42%, salariales ~22%
// Abattement 10% sur salaire net (Art.83 CGI), plafonné 14 171 €
function calcSASU_net(p: SimParams, brutSal: number, ratioDivPct: number) {
  const pc = p.prevoy === 'moyen' ? 0.05 : p.prevoy === 'max' ? 0.10 : 0.02
  const capa = Math.max(0, p.ca - p.charges - p.amort - p.deficit)
  const pat = brutSal * 0.42
  const sal = brutSal * 0.22
  const netSal = brutSal - sal
  const prev = brutSal * pc
  const resIS = Math.max(0, capa - brutSal - pat - prev)
  const is = calcIS(resIS)
  const resNet = resIS - is
  const div = resNet * (ratioDivPct / 100)
  const abat10 = Math.min(netSal * 0.10, 14171)
  const baseIR = netSal - abat10
  const perDedSASU = Math.min(p.perMontant || 0, baseIR * 0.10)
  const irSal = irMarginal(Math.max(0, baseIR - perDedSASU), p.autresRev, p.partsBase, p.nbEnfants)
  const { tax: tDiv, meth } = bestDiv(div, baseIR, p.partsBase, p.nbEnfants, p.autresRev)
  const net = netSal - irSal + div - tDiv
  return {
    net, div, divNet: div > 0 ? div - tDiv : 0, is, netSal,
    irTotal: irSal + tDiv, irSalSeul: irSal, cotisTotal: pat + sal,
    cotisPatronales: pat, cotisSalariales: sal, resIS, meth, resNet,
    brutSal, netSalMois: netSal / 12,
    divNetMois: div > 0 ? (div - tDiv) / 12 : 0,
    baseIR, abat10,
  }
}

export function calcSASU(p: SimParams): StructureResult {
  const pc = p.prevoy === 'moyen' ? 0.05 : p.prevoy === 'max' ? 0.10 : 0.02
  const capa = Math.max(0, p.ca - p.charges - p.amort - p.deficit)
  const brutMax = capa / (1 + 0.42 + pc)
  const brutMin = Math.min(PASS, brutMax)
  let bestNet = -Infinity, bestBrut = brutMin, bestRatio = 0
  for (let b = brutMin; b <= brutMax; b += 300) {
    for (let r = 0; r <= 100; r += 10) {
      const { net } = calcSASU_net(p, b, r)
      if (net > bestNet) { bestNet = net; bestBrut = b; bestRatio = r }
    }
  }
  // Affinage
  for (let b = Math.max(brutMin, bestBrut - 300); b <= Math.min(brutMax, bestBrut + 300); b += 30) {
    for (let r = Math.max(0, bestRatio - 10); r <= Math.min(100, bestRatio + 10); r += 2) {
      const { net } = calcSASU_net(p, b, r)
      if (net > bestNet) { bestNet = net; bestBrut = b; bestRatio = r }
    }
  }
  const { net, div, is, netSal, irTotal, cotisTotal, resIS, meth, resNet } = calcSASU_net(p, bestBrut, bestRatio)
  const { divNet, cotisPatronales, cotisSalariales, irSalSeul, divNetMois, netSalMois, baseIR } = calcSASU_net(p, bestBrut, bestRatio)
  let strat: string
  if (bestRatio === 0 || !div || div < 100) {
    strat = `Salaire — ${fmt(netSal)} nets/an (brut ${fmt(bestBrut)})`
  } else {
    strat = `Salaire ${fmt(netSal)} nets/an + ${fmt(div)} dividendes (${meth})`
  }
  return {
    forme: 'SAS / SASU',
    netAnnuel: net,
    charges: cotisTotal,
    ir: irTotal,
    is,
    ben: resIS,
    div,
    divNet: div > 0 ? div - (irTotal - irSalSeul) : 0,
    remBrute: bestBrut,
    remNet: netSal,
    remMois: bestBrut / 12,
    netMois: (netSal - irSalSeul) / 12,
    divNetAn: div > 0 ? div - (irTotal - irSalSeul) : 0,
    divNetMois: div > 0 ? (div - (irTotal - irSalSeul)) / 12 : 0,
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

// Score multicritère
export function scoreMulti(res: StructureResult[], priorite: Priorite): StructureResult[] {
  const wN = priorite === 'net' ? 6 : priorite === 'equilibre' ? 4 : priorite === 'protection' ? 2 : priorite === 'simplicite' ? 3 : 3
  const wP = priorite === 'protection' ? 6 : priorite === 'equilibre' ? 4 : 1
  const wS = priorite === 'simplicite' ? 5 : 1
  const wF = priorite === 'croissance' ? 5 : 1
  const SC: Record<string, { s: number; f: number }> = {
    'Micro-entreprise': { s: 5, f: 1 },
    'EI (réel normal)': { s: 4, f: 2 },
    'EURL / SARL (IS)': { s: 2, f: 4 },
    'SAS / SASU': { s: 2, f: 5 },
  }
  const protS = (r: StructureResult) => {
    const q = r.prot?.qual
    if (q === 'bon') return r.ratioDivPct > 60 ? 3 : 5
    if (q === 'moyen') return 3
    return 1
  }
  const nets = res.map(r => r.netAnnuel)
  const mn = Math.min(...nets), mx = Math.max(...nets)
  return res.map(r => {
    const b = SC[r.forme] || { s: 2, f: 2 }
    const prot = protS(r)
    const sNet = mx === mn ? 5 : Math.round(((r.netAnnuel - mn) / (mx - mn)) * 5)
    const total = sNet * wN + prot * wP + b.s * wS + b.f * wF
    return { ...r, scoreTotal: Math.round(total / (5 * (wN + wP + wS + wF)) * 100) }
  })
}

// Analyse SWOT par structure — valeurs spécifiques au profil simulé
export function swot(r: StructureResult, p: SimParams): SwotResult {
  const s: SwotResult = { pos: [], neg: [], opp: [], rsk: [] }
  const f = r.forme
  const ben = Math.max(0, p.ca - p.charges - p.amort - p.deficit)

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
    const bBase = Math.max(0, p.ca - p.charges - p.amort - p.deficit)
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
      { t: 'Assurance perte d\'emploi : GSC ou Madelin', d: 'Le président de SASU n\'est pas couvert par France Travail. Déductible IS.', cls: 'tg-a', tag: 'Protection obligatoire' },
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
  const tmi = Math.round(
    tmiRate(
      Math.max(0, (best.remBrute || 0) * (best.forme === 'EI (réel normal)' ? 1 : 0.90) + p.autresRev),
      p.partsBase, p.nbEnfants
    ) * 100
  )
  const gain = byNet[0].netAnnuel - byNet[byNet.length - 1].netAnnuel

  return { scored, byNet, best, tmi, gain }
}
