/* ─────────────────────────────────────────────────────────
   Utilitaires partagés pour la génération PDF
   (importés par les routes API, ne pas exporter côté client)
───────────────────────────────────────────────────────── */

/* ── Types ── */
export interface Scored {
  forme: string
  netAnnuel: number
  ir: number
  charges: number
  is: number
  scoreTotal: number
  div?: number
}

/* ── Dictionnaires ── */
export const situLabel: Record<string, string> = {
  creation: "Création d'entreprise",
  existant: 'Structure existante',
  changement: 'Changement de forme',
}
export const secteurLabel: Record<string, string> = {
  services_bic: 'Prestations de services BIC',
  liberal_bnc: 'Professions libérales / BNC',
  commerce: 'Commerce / négoce',
  btp: 'BTP / Artisanat / Restauration',
}
export const remDesc: Record<string, string> = {
  'SAS / SASU': 'Salaire assimilé salarié + dividendes PFU 30 % sans cotisations sociales',
  'EURL / SARL (IS)': 'Rémunération TNS déductible IS + dividendes (IS 15 % / 25 %)',
  'EI (réel normal)': 'Bénéfice imposable IR — cotisations SSI sur résultat net',
  'Micro-entreprise': 'Abattement forfaitaire sur CA — sans déduction des charges réelles',
}
export const formeColor: Record<string, string> = {
  'SAS / SASU': '#8b5cf6',
  'EURL / SARL (IS)': '#3b82f6',
  'EI (réel normal)': '#f59e0b',
  'Micro-entreprise': '#64748b',
}
export const formeBorderColor: Record<string, string> = {
  'SAS / SASU': '#7c3aed',
  'EURL / SARL (IS)': '#2563eb',
  'EI (réel normal)': '#d97706',
  'Micro-entreprise': '#475569',
}

/* ── Formateur ── */
export const fmt = (n: number) =>
  Math.round(n).toLocaleString('fr-FR') + '\u202f€'

/* ── CSS commun (réutilisé dans les 2 templates) ── */
export const PDF_BASE_CSS = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 11px; color: #1e293b;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    background: #e5e7eb;
  }
  .print-bar {
    display: flex; align-items: center; justify-content: center;
    gap: 12px; padding: 12px 20px; background: #0f172a;
    border-bottom: 1px solid #1e293b; position: sticky; top: 0; z-index: 100;
  }
  .print-bar-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.65); margin-right: 8px; }
  .pbtn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 16px; border-radius: 8px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 700; font-family: inherit;
  }
  .pbtn-p { background: linear-gradient(135deg,#2563eb,#1d4ed8); color: #fff; box-shadow: 0 4px 12px rgba(37,99,235,.4); }
  .pbtn-s { background: rgba(255,255,255,.08); color: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.12) !important; }
  @media print { .print-bar { display: none !important; } body { background: #fff; } }
  .page-wrap { display: flex; flex-direction: column; align-items: center; padding: 24px 0; gap: 24px; }
  @media print { .page-wrap { padding: 0; gap: 0; } }
  .page {
    width: 210mm; height: 297mm;
    page-break-after: always; page-break-inside: avoid;
    overflow: hidden; position: relative;
    display: flex; flex-direction: column;
    background: white; box-shadow: 0 4px 32px rgba(0,0,0,.18);
  }
  .page:last-child { page-break-after: auto; }
  .cover { background: #080d1a; color: white; }
  .logo-badge {
    width: 40px; height: 40px; border-radius: 10px;
    background: linear-gradient(135deg,#3b82f6,#1d4ed8);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 900; color: white; flex-shrink: 0;
  }
  .ph { background: #080d1a; padding: 11px 34px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
  .ph-l { display: flex; align-items: center; gap: 9px; }
  .ph-logo { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg,#3b82f6,#1d4ed8); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; color: white; flex-shrink: 0; }
  .ph-brand { font-size: 11px; font-weight: 700; color: white; }
  .ph-tag { font-size: 8.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #60a5fa; background: rgba(59,130,246,.14); border: 1px solid rgba(59,130,246,.22); padding: 2px 8px; border-radius: 999px; }
  .ph-r { font-size: 9px; color: rgba(255,255,255,.28); text-align: right; }
  .pb { flex: 1; padding: 16px 34px 12px; background: #f8fafc; overflow: hidden; }
  .pf { padding: 8px 34px; border-top: 1px solid #e2e8f0; background: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
  .pf-t { font-size: 8.5px; color: #94a3b8; }
  .pn { width: 22px; height: 22px; border-radius: 50%; background: rgba(59,130,246,.16); border: 1px solid rgba(59,130,246,.26); display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: #60a5fa; flex-shrink: 0; }
  .sl { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: #64748b; margin-bottom: 7px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 5px; }
  .sd { width: 4px; height: 4px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }
  .rc { background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 13px 17px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.05); }
  .rc-ey { font-size: 8px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 3px; }
  .rc-t { font-size: 18px; font-weight: 900; color: #0f172a; line-height: 1.1; }
  .rc-d { font-size: 9px; color: #64748b; margin: 3px 0 9px; }
  .rc-sb { display: inline-flex; align-items: center; gap: 4px; background: rgba(59,130,246,.07); border: 1px solid rgba(59,130,246,.18); border-radius: 999px; padding: 2px 8px; font-size: 9px; font-weight: 700; color: #3b82f6; }
  .krow { display: flex; gap: 8px; margin-top: 10px; }
  .kb { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 11px; }
  .kl { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; margin-bottom: 3px; }
  .kv { font-size: 16px; font-weight: 900; color: #0f172a; line-height: 1; }
  .ks { font-size: 8px; color: #94a3b8; margin-top: 1px; }
  .gbox { margin-top: 9px; padding: 7px 13px; border-radius: 8px; background: rgba(16,185,129,.06); border: 1px solid rgba(16,185,129,.17); display: flex; align-items: center; gap: 8px; }
  .ga { font-size: 13px; color: #10b981; }
  .gt { font-size: 10.5px; font-weight: 700; color: #065f46; line-height: 1.4; }
  .ct { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; margin-bottom: 5px; border: 1px solid #e2e8f0; }
  .ct th { text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; padding: 6px 9px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
  .ct td { padding: 6px 9px; font-size: 10px; border-bottom: 1px solid #f1f5f9; }
  .ct tr:last-child td { border-bottom: none; }
  .btr { background: #eff6ff; }
  .sbadge { display: inline-block; font-size: 7px; font-weight: 700; background: #1d4ed8; color: white; padding: 1px 5px; border-radius: 999px; margin-left: 4px; vertical-align: middle; }
  .neg { color: #dc2626; }
  .pos { color: #16a34a; font-weight: 700; }
  .tn { font-size: 8.5px; color: #94a3b8; margin-top: 4px; }
  .bt { display: flex; height: 20px; border-radius: 5px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 7px; }
  .bs { display: flex; align-items: center; justify-content: center; font-size: 7.5px; font-weight: 700; overflow: hidden; white-space: nowrap; }
  .bl { display: flex; gap: 10px; flex-wrap: wrap; }
  .bli { display: flex; align-items: center; gap: 4px; font-size: 8px; color: #475569; }
  .bld { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
  .ptb { width: 100%; border-collapse: collapse; }
  .ptb td { padding: 4.5px 10px; font-size: 10px; border-bottom: 1px solid #f1f5f9; }
  .ptb tr:last-child td { border-bottom: none; }
  .pl { color: #64748b; font-weight: 600; width: 46%; }
  .pv { color: #0f172a; font-weight: 700; }
  .ab { background: white; border: 1px solid #e2e8f0; border-radius: 9px; padding: 13px 16px; margin-bottom: 10px; }
  .ah { font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 7px; }
  .ap { font-size: 9.5px; color: #374151; line-height: 1.62; margin-bottom: 8px; }
  .asub { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; margin-top: 9px; }
  .alist { list-style: none; padding: 0; }
  .alist li { font-size: 9.5px; color: #374151; line-height: 1.5; padding: 2px 0 2px 12px; position: relative; }
  .alist li::before { content: '•'; position: absolute; left: 0; color: #3b82f6; font-weight: 900; }
  .lt { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 9px; overflow: hidden; margin-bottom: 10px; }
  .lt th { text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; padding: 6px 10px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
  .lt td { padding: 6px 10px; font-size: 9.5px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .lt tr:last-child td { border-bottom: none; }
  .cb { background: #1e3a5f; border-radius: 11px; padding: 16px 22px; display: flex; gap: 20px; }
  .cb-l { flex: 1; }
  .cbn { font-size: 15px; font-weight: 900; color: white; margin-bottom: 3px; }
  .cbt { font-size: 9.5px; color: rgba(255,255,255,.45); line-height: 1.5; margin-bottom: 10px; }
  .cbi { font-size: 9.5px; color: rgba(255,255,255,.65); line-height: 1.9; }
  .cbi strong { color: white; }
  .cbcta { margin-top: 9px; display: inline-block; background: linear-gradient(135deg,#3b82f6,#2563eb); color: white; font-size: 9.5px; font-weight: 700; padding: 6px 14px; border-radius: 7px; }
  .cboff { display: inline-block; background: rgba(16,185,129,.18); border: 1px solid rgba(16,185,129,.3); border-radius: 999px; padding: 3px 10px; font-size: 9.5px; font-weight: 700; color: #34d399; }
  .cbnote { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 7px; padding: 7px 12px; font-size: 8.5px; color: rgba(255,255,255,.4); line-height: 1.6; text-align: right; }
`

/* ── Analyse experte (3 paragraphes) ── */
export function genAnalyse(
  best: Scored,
  p: Record<string, unknown>,
  tmi: number,
  gain: number,
  scored: Scored[],
): { p1: string; p2: string; vigilance: string[]; optimisation: string[] } {
  const ca = (p.ca as number) || 0
  const worst = scored[scored.length - 1]
  const secteur = secteurLabel[(p.secteur as string)] || 'votre secteur'
  const perMax = Math.min(35194, Math.max(0, (ca - ((p.charges as number) || 0) - ((p.amort as number) || 0)) * 0.1))
  const f = best.forme
  const art = f.startsWith('E') ? "l'" : 'la '

  const p1 = `Avec un CA de ${fmt(ca)} en ${secteur}, ${art}${f} vous permet de conserver ${fmt(best.netAnnuel)} nets par an, soit ${fmt(Math.round(best.netAnnuel / 12))}/mois après impôts et cotisations sociales.${gain > 500 ? ` Cet écart de ${fmt(gain)}/an représente ${fmt(Math.round(gain / 12))} supplémentaires chaque mois par rapport à ${worst.forme}.` : ''}`

  let p2 = ''
  let vigilance: string[] = []
  let optimisation: string[] = []

  const sasScored = scored.find(s => s.forme.includes('SAS'))
  const eurlScored = scored.find(s => s.forme.includes('EURL'))

  if (f.includes('EURL') || f.includes('SARL')) {
    const diffCotis = sasScored ? sasScored.charges - best.charges : 0
    p2 = `L'avantage principal vient des cotisations TNS (${fmt(best.charges)}) nettement inférieures aux charges salariales d'une SAS${sasScored ? ` (${fmt(sasScored.charges)})` : ''}, soit ${fmt(Math.max(0, diffCotis))} d'économie/an sur ce seul poste. L'IS à 15 % jusqu'à 42 500 € de bénéfice — contre un TMI IR de ${tmi} % — renforce cet avantage. La séparation patrimoine pro/perso protège vos biens personnels.`
    vigilance = [
      "Comptabilité complète obligatoire (bilan annuel, liasse fiscale)",
      'Cotisations SSI minimales même sans rémunération (~1 200 €/an)',
      "IS à 15 % jusqu'à 42 500 € de bénéfice, puis 25 % au-delà",
      'Dividendes > 10 % du capital : soumis aux cotisations TNS',
    ]
    optimisation = [
      `PER individuel : jusqu'à ${fmt(perMax)} déductibles (TMI ${tmi} %)`,
      'Arbitrage rémunération gérant vs dividendes PFU 30 %',
      "Madelin prévoyance déductible de l'IS",
      'Indemnités kilométriques et domiciliation partiellement déductibles',
    ]
  } else if (f.includes('SAS')) {
    const diffCotis = eurlScored ? best.charges - eurlScored.charges : 0
    p2 = `Malgré des charges sociales supérieures à l'EURL${eurlScored ? ` (+${fmt(Math.max(0, diffCotis))}/an)` : ''}, la SASU offre le régime général (retraite AGIRC-ARRCO, couverture maladie supérieure) et un double levier : salaire président + dividendes au PFU 30 % sans cotisations sociales. Ce profil convient si la protection sociale ou une future levée de fonds est prioritaire.`
    vigilance = [
      "Aucune couverture France Travail — contrat GSC fortement recommandé",
      'Charges patronales élevées sur le salaire (~42 %)',
      "Pas de contrat Madelin — prévoyance via PER entreprise ou Article 83",
      "Obligations comptables supérieures à l'EI",
    ]
    optimisation = [
      `PER individuel ou entreprise : jusqu'à ${fmt(perMax)} déductibles`,
      'Optimisation ratio salaire / dividendes selon besoins de trésorerie',
      'Épargne salariale (PEE, PERCO) avantageuse IS',
      "GSC déductible IS (~3–5 % de la rémunération brute)",
    ]
  } else if (f.includes('EI')) {
    p2 = `Les cotisations SSI sont calculées sur le résultat net réel — sans surcoût lié à l'IS — ce qui les rend très compétitives à ce niveau de CA. La déduction directe des charges réelles (${fmt((p.charges as number) || 0)}) est un avantage décisif face au micro. La gestion reste simple : pas de comptabilité de société, ni d'assemblée générale.`
    vigilance = [
      'Responsabilité personnelle illimitée sur les dettes professionnelles',
      'Cotisations SSI sur la totalité du bénéfice net imposable',
      "Passage en EURL IS conseillé si le résultat dépasse 60 000 €/an",
      "Pas de rémunération déductible (le bénéfice = le revenu)",
    ]
    optimisation = [
      `PER individuel : jusqu'à ${fmt(perMax)} déductibles du revenu (TMI ${tmi} %)`,
      'Madelin prévoyance déductible du bénéfice imposable',
      'Envisager EURL IS si résultat > 60 000 €/an',
      'Domiciliation et indemnités kilométriques déductibles',
    ]
  } else {
    p2 = `L'abattement forfaitaire (34–72 % selon activité) dépasse vos charges réelles, rendant ce régime optimal à ce stade. La simplicité administrative est un atout majeur : pas de bilan, déclaration trimestrielle du CA uniquement. Idéal en phase de démarrage ou pour tester l'activité avant un passage au réel.`
    vigilance = [
      "Plafond micro BIC 77 700 €/an — surveiller l'évolution du CA",
      'Aucune déduction des charges réelles ni récupération de TVA',
      'Protection sociale réduite (retraite et prévoyance faibles)',
      'Pas de déduction des amortissements ni des déficits',
    ]
    optimisation = [
      "Passer en EI réel si les charges dépassent l'abattement",
      'PER individuel pour compléter la retraite (déductible du revenu)',
      'Mutuelle santé complémentaire recommandée',
      'Anticiper la transition avant dépassement du plafond',
    ]
  }

  return { p1, p2, vigilance, optimisation }
}

/* ── Leviers d'optimisation ── */
export function genLeviers(
  best: Scored,
  p: Record<string, unknown>,
  tmi: number,
  ca: number,
): Array<{ levier: string; impact: string; prio: string }> {
  const acc: Array<{ levier: string; impact: string; prio: string }> = []
  const base = ca - ((p.charges as number) || 0) - ((p.amort as number) || 0)
  const perMax = Math.min(35194, Math.max(0, base * 0.1))
  const f = best.forme

  if (tmi >= 30) {
    acc.push({
      levier: `PER — Plan d'Épargne Retraite`,
      impact: `Économie IR jusqu'à ${fmt(Math.round(perMax * tmi / 100))}/an (versement ${fmt(perMax)})`,
      prio: '★★★ Haute',
    })
  } else if (tmi >= 11 && perMax > 1000) {
    acc.push({
      levier: `PER — Plan d'Épargne Retraite`,
      impact: `Déduction ${fmt(perMax)} · économie IR ${fmt(Math.round(perMax * tmi / 100))}/an`,
      prio: '★★ Moyenne',
    })
  }

  if (f.includes('EURL') || f.includes('EI')) {
    const madelinMax = Math.min(8000, Math.max(1200, ca * 0.05))
    acc.push({
      levier: 'Contrat Madelin prévoyance',
      impact: `Déductible du bénéfice imposable — jusqu'à ${fmt(madelinMax)}/an`,
      prio: '★★★ Haute',
    })
  }

  if (f.includes('SAS')) {
    acc.push({
      levier: 'GSC — Garantie Sociale dirigeant',
      impact: 'Protection chômage déductible IS (~3–5 % de la rémunération brute)',
      prio: '★★★ Haute',
    })
  }

  if (f.includes('EURL') || f.includes('SAS')) {
    acc.push({
      levier: 'Arbitrage rémunération / dividendes',
      impact: `Dividendes au PFU 30 % vs IR à ${tmi} % — piloter selon TMI marginal`,
      prio: `★★ ${tmi >= 30 ? 'Haute' : 'Selon situation'}`,
    })
  }

  if (ca > 50000) {
    acc.push({
      levier: 'Indemnités kilométriques professionnelles',
      impact: 'Barème officiel — réduction directe du résultat imposable',
      prio: '★★ Moyenne',
    })
  }

  acc.push({
    levier: 'Quote-part domiciliation / bureau à domicile',
    impact: 'Loyer + charges partiellement déductibles sous conditions',
    prio: '★ Faible',
  })

  return acc.slice(0, 5)
}
