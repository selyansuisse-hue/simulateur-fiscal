// Barème IR 2025 — Art.197 CGI, LFI 2025
// PASS 2025 = 46 368 €

// Parts fiscales exactes (Art.194 CGI)
// partsBase : 1 (célibataire) ou 2 (marié/pacsé/veuf)
// nbEnfants : enfants à charge
export function calcPartsTotal(partsBase: number, nbEnfants: number): number {
  const e1 = Math.min(nbEnfants, 2)      // 1er et 2ème → 0.5 part chacun
  const e2 = Math.max(0, nbEnfants - 2)  // à partir du 3ème → 1 part
  return partsBase + e1 * 0.5 + e2 * 1.0
}

// IR brut avant décote et plafonnement QF
export function irBrut2025(rev: number, parts: number): number {
  if (rev <= 0) return 0
  const q = rev / parts
  const T: [number, number, number][] = [
    [0, 11497, 0],
    [11497, 29315, 0.11],
    [29315, 83823, 0.30],
    [83823, 180294, 0.41],
    [180294, Infinity, 0.45],
  ]
  let ir = 0
  for (const [lo, hi, t] of T) {
    if (q <= lo) break
    ir += (Math.min(q, hi) - lo) * t
  }
  return ir * parts
}

// IR après décote 2025 (873 € - 45.25% × IR brut)
export function irApresDecote(irBrut: number): number {
  const d = Math.max(0, 873 - irBrut * 0.4525)
  return Math.max(0, irBrut - d)
}

// IR FINAL avec plafonnement QF (Art.197 CGI)
// Plafond 2025 : 1 807 € par demi-part supplémentaire
export function irFinal(revImposable: number, partsBase: number, nbEnfants: number): number {
  if (revImposable <= 0) return 0
  const partsTotal = calcPartsTotal(partsBase, nbEnfants)
  const irAvec = irApresDecote(irBrut2025(revImposable, partsTotal))
  if (nbEnfants === 0) return irAvec
  const irSans = irApresDecote(irBrut2025(revImposable, partsBase))
  const demiPartsSup = (partsTotal - partsBase) * 2
  const plafond = demiPartsSup * 1807
  const reductionBrute = irSans - irAvec
  const reductionEffective = Math.min(reductionBrute, plafond)
  return Math.max(0, irSans - reductionEffective)
}

// IR marginal imputable à un revenu d'activité
export function irMarginal(
  revActivite: number,
  autresRev: number,
  partsBase: number,
  nbEnfants: number
): number {
  if (revActivite <= 0) return 0
  const total = irFinal(Math.max(0, revActivite + autresRev), partsBase, nbEnfants)
  const sans = irFinal(Math.max(0, autresRev), partsBase, nbEnfants)
  return Math.max(0, total - sans)
}

// TMI (tranche marginale d'imposition)
export function tmiRate(revImposable: number, partsBase: number, nbEnfants: number): number {
  if (revImposable <= 0) return 0
  const q = revImposable / calcPartsTotal(partsBase, nbEnfants || 0)
  if (q <= 11497) return 0
  if (q <= 29315) return 0.11
  if (q <= 83823) return 0.30
  if (q <= 180294) return 0.41
  return 0.45
}

// Meilleure option dividendes : PFU 30% vs barème IR
// PFU 30% = IR 12.8% + PS 17.2%
// Barème = IR sur 60% des div (abat 40%) + PS 17.2%
export function bestDiv(
  div: number,
  baseRevImposable: number,
  partsBase: number,
  nbEnfants: number,
  autresRev: number
): { tax: number; meth: string } {
  if (div <= 0) return { tax: 0, meth: '—' }
  const pfu = div * 0.30
  const divImposable = div * 0.60
  const irSans = irFinal(Math.max(0, baseRevImposable + autresRev), partsBase, nbEnfants || 0)
  const irAvec = irFinal(Math.max(0, baseRevImposable + divImposable + autresRev), partsBase, nbEnfants || 0)
  const bar = (irAvec - irSans) + div * 0.172
  return pfu <= bar ? { tax: pfu, meth: 'PFU 30%' } : { tax: bar, meth: 'Barème IR' }
}
