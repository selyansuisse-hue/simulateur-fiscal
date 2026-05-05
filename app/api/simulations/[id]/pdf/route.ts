import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
interface Scored {
  forme: string
  netAnnuel: number
  ir: number
  charges: number
  is: number
  scoreTotal: number
  div?: number
}

/* ─────────────────────────────────────────────────────────
   Dictionnaires
───────────────────────────────────────────────────────── */
const situLabel: Record<string, string> = {
  creation: 'Création d\'entreprise',
  existant: 'Structure existante',
  changement: 'Changement de forme',
}
const secteurLabel: Record<string, string> = {
  services_bic: 'Prestations de services BIC',
  liberal_bnc: 'Professions libérales / BNC',
  commerce: 'Commerce / négoce',
  btp: 'BTP / Artisanat / Restauration',
}
const remDesc: Record<string, string> = {
  'SAS / SASU': 'Salaire assimilé salarié + dividendes sans cotisations sociales',
  'EURL / SARL (IS)': 'Rémunération TNS déductible IS + dividendes (IS 15% / 25%)',
  'EI (réel normal)': 'Bénéfice imposable IR — cotisations SSI sur résultat net',
  'Micro-entreprise': 'Abattement forfaitaire sur CA — sans déduction des charges réelles',
}
const formeColor: Record<string, string> = {
  'SAS / SASU': '#8b5cf6',
  'EURL / SARL (IS)': '#3b82f6',
  'EI (réel normal)': '#f59e0b',
  'Micro-entreprise': '#64748b',
}
const formeBorderColor: Record<string, string> = {
  'SAS / SASU': '#7c3aed',
  'EURL / SARL (IS)': '#2563eb',
  'EI (réel normal)': '#d97706',
  'Micro-entreprise': '#475569',
}

/* ─────────────────────────────────────────────────────────
   Formateur
───────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  Math.round(n).toLocaleString('fr-FR') + '\u202f€'

/* ─────────────────────────────────────────────────────────
   Génération du texte d'analyse dynamique
───────────────────────────────────────────────────────── */
function genAnalyse(
  best: Scored,
  p: Record<string, unknown>,
  tmi: number,
  gain: number,
  scored: Scored[],
): { pourquoi: string; vigilance: string[]; optimisation: string[] } {
  const ca = (p.ca as number) || 0
  const worst = scored[scored.length - 1]
  const perMax = Math.min(35194, Math.max(0,
    (ca - ((p.charges as number) || 0) - ((p.amort as number) || 0)) * 0.10,
  ))
  const situStr = (p.partsBase as number) === 2 ? 'en couple' : 'célibataire'
  const f = best.forme

  let pourquoi = ''
  let vigilance: string[] = []
  let optimisation: string[] = []

  if (f.includes('EURL') || f.includes('SARL')) {
    pourquoi = `Avec un CA de ${fmt(ca)} et votre situation de ${situStr}, l'EURL IS vous permet de conserver ${fmt(best.netAnnuel)} nets annuels, soit ${gain > 500 ? `${fmt(gain)} de plus que ${worst.forme}` : 'la meilleure performance des 4 structures'}. L'IS à 15 % sur les premiers 42 500 € de bénéfice est significativement inférieur à votre TMI IR de ${tmi} %, rendant cette structure particulièrement efficace à votre niveau de revenu. La séparation patrimoine personnel / société limite en outre votre exposition personnelle.`
    vigilance = [
      'Tenue d\'une comptabilité complète obligatoire (bilan annuel, liasse fiscale)',
      'Cotisations SSI minimales même sans rémunération (~1 200 €/an)',
      'IS à 15 % jusqu\'à 42 500 € de bénéfice, puis 25 % au-delà',
      'Dividendes au-delà de 10 % du capital : soumis aux cotisations TNS',
    ]
    optimisation = [
      `Versement PER individuel : jusqu'à ${fmt(perMax)} déductibles (TMI ${tmi} %)`,
      'Optimisation dividendes : arbitrage rémunération gérant / PFU 30 % selon vos besoins',
      'Prévoyance Madelin déductible de l\'IS (arrêt maladie, invalidité, décès)',
      'Indemnités kilométriques et domiciliation domicile partiellement déductibles',
    ]
  } else if (f.includes('SAS')) {
    pourquoi = `Avec un CA de ${fmt(ca)} et votre situation de ${situStr}, la SASU vous permet de conserver ${fmt(best.netAnnuel)} nets annuels. La combinaison salaire président (régime général) + dividendes sans cotisations sociales (PFU 30 %) constitue un double levier d'optimisation unique en France. Vous bénéficiez de la meilleure protection sociale tout en pilotant votre rémunération avec souplesse.`
    vigilance = [
      'Aucune couverture France Travail (chômage) — contrat GSC fortement recommandé',
      'Charges sociales patronales élevées sur le salaire (environ 42 %)',
      'Pas de contrat Madelin possible — prévoyance via Article 83 ou PER entreprise',
      'Obligations comptables et juridiques supérieures à l\'EI',
    ]
    optimisation = [
      `Versement PER individuel ou PER entreprise : jusqu'à ${fmt(perMax)} déductibles`,
      'Optimisation du ratio salaire / dividendes selon vos besoins de trésorerie',
      'Épargne salariale (PEE, PERCO) possible et avantageuse IS',
      'Couverture GSC (assurance perte d\'emploi) déductible de l\'IS',
    ]
  } else if (f.includes('EI')) {
    pourquoi = `Avec un CA de ${fmt(ca)} et votre situation de ${situStr}, l'EI au réel vous permet de conserver ${fmt(best.netAnnuel)} nets annuels. Les cotisations SSI sont calculées sur votre résultat net réel — sans surcoût lié à l'IS — ce qui les rend très compétitives à ce niveau de CA. La déduction directe de vos charges réelles est un avantage déterminant face au régime micro.`
    vigilance = [
      'Responsabilité personnelle illimitée sur les dettes professionnelles',
      'Cotisations SSI calculées sur la totalité du bénéfice net',
      'Au-delà de 60 000 € de résultat, l\'EURL IS devient généralement plus avantageux',
      'Pas de rémunération du dirigeant déductible du bénéfice',
    ]
    optimisation = [
      `Versement PER individuel : jusqu'à ${fmt(perMax)} déductibles du revenu (TMI ${tmi} %)`,
      'Contrat Madelin prévoyance déductible du bénéfice imposable',
      'Envisager le passage en EURL IS si le résultat dépasse 60 000 €/an',
      'Domiciliation domicile et indemnités kilométriques déductibles',
    ]
  } else {
    pourquoi = `Avec un CA de ${fmt(ca)} et votre situation de ${situStr}, le régime micro-entreprise vous permet de conserver ${fmt(best.netAnnuel)} nets annuels grâce à l'abattement forfaitaire sur CA. Vos charges réelles étant inférieures à cet abattement, ce régime est actuellement le plus avantageux. La simplicité administrative (pas de comptabilité lourde) est également un atout.`
    vigilance = [
      'Plafond micro BIC : 77 700 €/an — surveiller l\'évolution du CA',
      'Aucune déduction des charges réelles ni récupération de TVA',
      'Protection sociale réduite (retraite et prévoyance faibles)',
      'Pas de déduction des amortissements ni des déficits',
    ]
    optimisation = [
      'Anticiper le passage en EI réel si les charges réelles dépassent l\'abattement',
      'Compléter la retraite par un PER individuel (déductible du revenu global)',
      'Mutuelle santé complémentaire recommandée (couverture micro insuffisante)',
      'Prévoir la transition de régime avant le dépassement du plafond',
    ]
  }

  return { pourquoi, vigilance, optimisation }
}

/* ─────────────────────────────────────────────────────────
   Template HTML — 3 pages A4
───────────────────────────────────────────────────────── */
function generateHtml(
  sim: Record<string, unknown>,
  cabinetNom = 'Belho Xper',
  cabinetEmail = 'contact@belhoxper.fr',
): string {
  /* ── Données ── */
  const results = (sim.results as { scored?: Scored[] }) || {}
  const scored = results.scored || []
  const best = scored[0]
  const p = (sim.params as Record<string, unknown>) || {}
  const tmi = (sim.tmi as number) || 0
  const gain = (sim.gain as number) || 0
  const ca = (sim.ca as number) || (p.ca as number) || 0
  const charges = (p.charges as number) || 0
  const amort = (p.amort as number) || 0
  const date = new Date(sim.created_at as string).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const genDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const simName = (sim.name as string) || 'Simulation'

  /* ── Décomposition CA ── */
  const bestCharges = best ? best.charges : 0
  const bestIR = best ? best.ir : 0
  const bestIS = best ? (best.is || 0) : 0
  const bestNet = best ? best.netAnnuel : 0
  const caSafe = Math.max(1, ca)
  const netPct = Math.round(bestNet / caSafe * 100)
  const cotisPct = Math.round(bestCharges / caSafe * 100)
  const irPct = Math.round(bestIR / caSafe * 100)
  const isPct = Math.round(bestIS / caSafe * 100)
  const chargesPct = Math.max(0, 100 - netPct - cotisPct - irPct - isPct)

  /* ── Analyse dynamique ── */
  const analyse = best ? genAnalyse(best, p, tmi, gain, scored) : null

  /* ── Paramètres simulation (tableau page 3) ── */
  const paramsRows = [
    ['Situation', situLabel[(p.situation as string)] || (sim.situation as string) || '—'],
    ['Secteur d\'activité', secteurLabel[(p.secteur as string)] || (p.secteur as string) || '—'],
    ['Chiffre d\'affaires', fmt(ca)],
    ['Charges déductibles', fmt(charges)],
    ...(amort > 0 ? [['Amortissements', fmt(amort)]] : []),
    ['Foyer fiscal', `${(p.partsBase as number) === 2 ? 'En couple' : 'Célibataire'}${(p.nbEnfants as number) > 0 ? ` · ${p.nbEnfants} enfant${(p.nbEnfants as number) > 1 ? 's' : ''}` : ''}`],
    ['Parts fiscales', `${p.parts || 1} part${(p.parts as number) > 1 ? 's' : ''}`],
    ...((p.remNetAnn as number) > 0 ? [['Rémunération nette cible', fmt(p.remNetAnn as number)]] : []),
    ...((p.perMontant as number) > 0 ? [['PER versé', fmt(p.perMontant as number)]] : [['PER versé', '0 €']]),
    ...((p.autresRev as number) > 0 ? [['Autres revenus', fmt(p.autresRev as number)]] : []),
  ]

  /* ── Couleur structure recommandée ── */
  const bestColor = best ? (formeColor[best.forme] || '#3b82f6') : '#3b82f6'
  const bestBorder = best ? (formeBorderColor[best.forme] || '#2563eb') : '#2563eb'

  /* ── TMI badge ── */
  const tmiColor = tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : '#ef4444'
  const tmiLabel = tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Intermédiaire' : 'Tranche haute'

  /* ── Pct effectif ── */
  const tauxEff = ca > 0 && best ? Math.round((best.ir + best.charges) / ca * 100) : 0

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #1e293b;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    page-break-after: always;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: auto; }

  /* ── Page 1 — Cover ── */
  .cover { background: #080d1a; color: white; }
  .cover-logo {
    padding: 32px 40px 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-badge {
    width: 40px; height: 40px; border-radius: 10px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 900; color: white;
    flex-shrink: 0;
  }
  .logo-text-block { display: flex; flex-direction: column; }
  .logo-name { font-size: 15px; font-weight: 800; color: white; line-height: 1.2; }
  .logo-sub { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 1px; }

  .cover-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 40px;
    text-align: center;
  }
  .cover-eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: 0.15em;
    text-transform: uppercase; color: #60a5fa; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px; justify-content: center;
  }
  .cover-dot { width: 5px; height: 5px; border-radius: 50%; background: #3b82f6; }
  .cover-title {
    font-size: 34px; font-weight: 900; color: white;
    letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 10px;
  }
  .cover-title-gradient {
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .cover-divider {
    width: 120px; height: 3px; border-radius: 999px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    margin: 20px auto;
  }

  .cover-summary {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 16px;
    padding: 28px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
    max-width: 460px;
  }
  .cover-client { font-size: 13px; color: rgba(255,255,255,0.5); }
  .cover-date { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: -12px; }
  .cover-ca-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.08em; }
  .cover-ca-val { font-size: 44px; font-weight: 900; color: #f1f5f9; letter-spacing: -0.03em; line-height: 1; }
  .cover-ca-sub { font-size: 11px; color: rgba(255,255,255,0.3); }
  .cover-badge {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 18px; border-radius: 999px;
    font-size: 13px; font-weight: 700;
  }

  .cover-footer {
    padding: 20px 40px;
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cover-footer-left { font-size: 10px; color: rgba(255,255,255,0.35); line-height: 1.6; }
  .cover-footer-right { font-size: 10px; color: rgba(255,255,255,0.25); text-align: right; }
  .page-num {
    width: 26px; height: 26px; border-radius: 50%;
    background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #60a5fa;
  }

  /* ── Pages 2 & 3 — Content ── */
  .page-header {
    background: #080d1a;
    padding: 14px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .page-header-left { display: flex; align-items: center; gap: 10px; }
  .page-header-logo {
    width: 26px; height: 26px; border-radius: 7px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 900; color: white;
  }
  .page-header-brand { font-size: 12px; font-weight: 700; color: white; }
  .page-header-label {
    font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #60a5fa;
    background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.25);
    padding: 2px 10px; border-radius: 999px;
  }
  .page-header-right { font-size: 10px; color: rgba(255,255,255,0.35); text-align: right; }

  .page-body { flex: 1; padding: 24px 36px; background: #f8fafc; }

  .page-footer {
    padding: 10px 36px;
    border-top: 1px solid #e2e8f0;
    background: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .page-footer-text { font-size: 9px; color: #94a3b8; }

  /* ── Section labels ── */
  .section-label {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #64748b;
    margin-bottom: 10px; padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    display: flex; align-items: center; gap: 6px;
  }
  .section-label-dot { width: 4px; height: 4px; border-radius: 50%; background: #3b82f6; }

  /* ── Section A — Recommended ── */
  .rec-card {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    border-left: 4px solid ${bestBorder};
    padding: 18px 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .rec-eyebrow {
    font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
    text-transform: uppercase; color: ${bestColor}; margin-bottom: 6px;
  }
  .rec-title { font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 3px; line-height: 1.1; }
  .rec-desc { font-size: 10px; color: #64748b; margin-bottom: 14px; }
  .rec-score {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2);
    border-radius: 999px; padding: 3px 10px;
    font-size: 10px; font-weight: 700; color: #3b82f6;
  }

  .kpi-row { display: flex; gap: 10px; margin-top: 14px; }
  .kpi-box {
    flex: 1; background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 10px; padding: 12px 14px;
  }
  .kpi-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; }
  .kpi-val { font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1; }
  .kpi-sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }

  .gain-box {
    margin-top: 12px; padding: 10px 16px; border-radius: 10px;
    background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.2);
    display: flex; align-items: center; gap: 10px;
  }
  .gain-arrow { font-size: 16px; color: #10b981; }
  .gain-text { font-size: 12px; font-weight: 700; color: #065f46; line-height: 1.4; }

  /* ── Section B — Table ── */
  .compare-table {
    width: 100%; border-collapse: collapse; border-radius: 10px;
    overflow: hidden; margin-bottom: 8px;
    border: 1px solid #e2e8f0;
  }
  .compare-table th {
    text-align: left; font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;
    padding: 8px 12px; background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
  }
  .compare-table td {
    padding: 9px 12px; font-size: 11px;
    border-bottom: 1px solid #f1f5f9;
  }
  .compare-table tr:last-child td { border-bottom: none; }
  .best-tr { background: rgba(37,99,235,0.04); }
  .star-badge {
    display: inline-block; font-size: 8px; font-weight: 700;
    background: #1d4ed8; color: white; padding: 1px 6px;
    border-radius: 999px; margin-left: 5px; vertical-align: middle;
  }
  .neg { color: #dc2626; }
  .pos { color: #16a34a; font-weight: 700; }
  .table-note { font-size: 9px; color: #94a3b8; margin-top: 4px; }

  /* ── Section C — Stacked bar ── */
  .bar-container { margin-bottom: 6px; }
  .bar-track {
    display: flex; height: 24px; border-radius: 6px; overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  .bar-seg {
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 700; overflow: hidden;
  }
  .bar-legend { display: flex; gap: 14px; margin-top: 8px; flex-wrap: wrap; }
  .bar-leg-item { display: flex; align-items: center; gap: 5px; font-size: 9px; color: #475569; }
  .bar-leg-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

  /* ── Page 3 ── */
  .params-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .params-table td { padding: 6px 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
  .params-table tr:last-child td { border-bottom: none; }
  .params-table .param-label { color: #64748b; font-weight: 600; width: 45%; }
  .params-table .param-val { color: #0f172a; font-weight: 700; }
  .params-block {
    background: white; border: 1px solid #e2e8f0; border-radius: 10px;
    overflow: hidden; margin-bottom: 16px;
  }

  .analyse-block {
    background: white; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 18px 20px; margin-bottom: 16px;
  }
  .analyse-title { font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 10px; }
  .analyse-p { font-size: 10.5px; color: #374151; line-height: 1.65; margin-bottom: 12px; }
  .analyse-list { list-style: none; padding: 0; }
  .analyse-list li {
    font-size: 10.5px; color: #374151; line-height: 1.55;
    padding: 3px 0 3px 14px; position: relative;
  }
  .analyse-list li::before {
    content: '•'; position: absolute; left: 0;
    color: #3b82f6; font-weight: 900;
  }
  .analyse-sub {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; margin-bottom: 6px; margin-top: 12px;
  }

  .contact-block {
    background: #080d1a; border-radius: 12px; padding: 20px 24px;
    display: flex; gap: 24px; align-items: flex-start;
  }
  .contact-left { flex: 1; }
  .contact-right { flex: 1; }
  .contact-brand { font-size: 15px; font-weight: 900; color: white; margin-bottom: 4px; }
  .contact-tagline { font-size: 10px; color: rgba(255,255,255,0.45); line-height: 1.5; margin-bottom: 14px; }
  .contact-item { font-size: 10px; color: rgba(255,255,255,0.6); line-height: 1.8; }
  .contact-item strong { color: rgba(255,255,255,0.85); }
  .contact-cta {
    display: inline-block; margin-top: 12px;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: white; font-size: 10px; font-weight: 700;
    padding: 7px 16px; border-radius: 8px;
  }
</style>
</head>
<body>

<!-- ════════════════════════════════════════════════
     PAGE 1 — COUVERTURE
═════════════════════════════════════════════════ -->
<div class="page cover">

  <!-- Logo -->
  <div class="cover-logo">
    <div class="logo-badge">B</div>
    <div class="logo-text-block">
      <div class="logo-name">${cabinetNom}</div>
      <div class="logo-sub">Cabinet d'expertise comptable</div>
    </div>
  </div>

  <!-- Centre -->
  <div class="cover-center">
    <div class="cover-eyebrow">
      <div class="cover-dot"></div>
      Analyse fiscale personnalisée
    </div>
    <div class="cover-title">
      Optimisation de votre<br>
      <span class="cover-title-gradient">rémunération</span>
    </div>
    <div class="cover-divider"></div>

    <div class="cover-summary">
      <div class="cover-client">Simulation : ${simName}</div>
      <div class="cover-date">Générée le ${date}</div>

      <div style="text-align:center;">
        <div class="cover-ca-label">Chiffre d'affaires analysé</div>
        <div class="cover-ca-val">${fmt(ca)}</div>
        <div class="cover-ca-sub">par an</div>
      </div>

      ${best ? `
      <div>
        <div class="cover-ca-label" style="text-align:center;margin-bottom:8px;">Structure recommandée</div>
        <div class="cover-badge" style="background:${bestColor}18;border:1px solid ${bestColor}40;color:${bestColor};">
          <span style="width:6px;height:6px;border-radius:50%;background:${bestColor};display:inline-block;"></span>
          ${best.forme}
        </div>
      </div>
      <div style="text-align:center;">
        <div class="cover-ca-label">Revenu net annuel</div>
        <div style="font-size:28px;font-weight:900;color:${bestColor};letter-spacing:-0.02em;line-height:1.1;">${fmt(best.netAnnuel)}</div>
        <div class="cover-ca-sub">${fmt(Math.round(best.netAnnuel / 12))}/mois · Score ${best.scoreTotal}/100</div>
      </div>` : ''}

      ${gain > 500 ? `
      <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px 16px;text-align:center;">
        <div style="font-size:16px;font-weight:900;color:#34d399;">+${fmt(gain)}/an</div>
        <div style="font-size:9px;color:rgba(52,211,153,0.65);margin-top:2px;">vs structure la moins avantageuse</div>
      </div>` : ''}
    </div>
  </div>

  <!-- Footer -->
  <div class="cover-footer">
    <div class="cover-footer-left">
      <strong style="color:rgba(255,255,255,0.6);">${cabinetNom}</strong> · Lyon &amp; Montluel<br>
      ${cabinetEmail} · belhoxper.fr<br>
      <span style="font-size:9px;color:rgba(255,255,255,0.2);">Document confidentiel — simulation indicative non contractuelle</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
      <div class="page-num">1/3</div>
      <div class="cover-footer-right">Barème fiscal 2025</div>
    </div>
  </div>

</div>

<!-- ════════════════════════════════════════════════
     PAGE 2 — RÉSULTATS & COMPARAISON
═════════════════════════════════════════════════ -->
<div class="page">

  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">B</div>
      <div class="page-header-brand">${cabinetNom}</div>
      <div class="page-header-label">Résultats de simulation</div>
    </div>
    <div class="page-header-right">
      ${simName} · ${date}
    </div>
  </div>

  <div class="page-body">

    <!-- SECTION A — Recommandée -->
    ${best ? `
    <div class="section-label" style="margin-bottom:10px;">
      <div class="section-label-dot"></div>
      A — Structure recommandée
    </div>
    <div class="rec-card">
      <div class="rec-eyebrow">✦ Structure recommandée</div>
      <div class="rec-title">${best.forme}</div>
      <div class="rec-desc">${remDesc[best.forme] || ''}</div>
      <div class="rec-score">Score ${best.scoreTotal}/100</div>

      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-label">Revenu net</div>
          <div class="kpi-val" style="color:${bestColor};">${fmt(best.netAnnuel)}</div>
          <div class="kpi-sub">${fmt(Math.round(best.netAnnuel / 12))}/mois</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Taux effectif</div>
          <div class="kpi-val">${tauxEff}%</div>
          <div class="kpi-sub">sur le CA total</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">TMI</div>
          <div class="kpi-val" style="color:${tmiColor};">${tmi}%</div>
          <div class="kpi-sub">${tmiLabel}</div>
        </div>
      </div>

      ${gain > 500 ? `
      <div class="gain-box">
        <div class="gain-arrow">↑</div>
        <div class="gain-text">+${fmt(gain)}/an par rapport à la structure la moins avantageuse · soit +${fmt(Math.round(gain / 12))}/mois</div>
      </div>` : ''}
    </div>` : ''}

    <!-- SECTION B — Tableau comparatif -->
    <div class="section-label">
      <div class="section-label-dot" style="background:#8b5cf6;"></div>
      B — Tableau comparatif des 4 structures
    </div>
    <table class="compare-table">
      <thead>
        <tr>
          <th>Structure</th>
          <th>Net / an</th>
          <th>Net / mois</th>
          <th>Cotisations</th>
          <th>IR</th>
          <th>IS</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${scored.map((r, i) => `
        <tr class="${i === 0 ? 'best-tr' : ''}">
          <td>
            <strong style="color:${formeColor[r.forme] || '#1e293b'}">${r.forme}</strong>
            ${i === 0 ? '<span class="star-badge">★ Recommandé</span>' : ''}
          </td>
          <td class="pos">${fmt(r.netAnnuel)}</td>
          <td style="color:#475569;">${fmt(Math.round(r.netAnnuel / 12))}</td>
          <td class="neg">−${fmt(r.charges)}</td>
          <td class="neg">−${fmt(r.ir)}</td>
          <td style="color:#7c3aed;">${r.is > 0 ? `−${fmt(r.is)}` : '—'}</td>
          <td><strong style="color:${i === 0 ? '#1d4ed8' : '#94a3b8'}">${r.scoreTotal}/100</strong></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="table-note">* Barème IR 2025 · Cotisations SSI par composante · Calculs indicatifs</div>

    <!-- SECTION C — Décomposition CA -->
    ${best ? `
    <div style="margin-top:16px;">
      <div class="section-label" style="margin-bottom:10px;">
        <div class="section-label-dot" style="background:#10b981;"></div>
        C — Décomposition du CA de ${fmt(ca)} avec ${best.forme}
      </div>
      <div class="bar-container">
        <div class="bar-track">
          ${chargesPct > 0 ? `<div class="bar-seg" style="width:${chargesPct}%;background:#cbd5e1;color:#475569;">${chargesPct > 4 ? chargesPct + '%' : ''}</div>` : ''}
          <div class="bar-seg" style="width:${cotisPct}%;background:#fca5a5;color:#7f1d1d;">${cotisPct > 4 ? cotisPct + '%' : ''}</div>
          <div class="bar-seg" style="width:${irPct}%;background:#fdba74;color:#7c2d12;">${irPct > 4 ? irPct + '%' : ''}</div>
          ${isPct > 0 ? `<div class="bar-seg" style="width:${isPct}%;background:#c4b5fd;color:#3b0764;">${isPct > 4 ? isPct + '%' : ''}</div>` : ''}
          <div class="bar-seg" style="width:${netPct}%;background:#86efac;color:#14532d;font-weight:900;">NET ${netPct}%</div>
        </div>
        <div class="bar-legend">
          ${chargesPct > 0 ? `<div class="bar-leg-item"><div class="bar-leg-dot" style="background:#cbd5e1;"></div>Charges déductibles ${fmt(charges)}</div>` : ''}
          <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#fca5a5;"></div>Cotisations sociales −${fmt(bestCharges)}</div>
          <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#fdba74;"></div>Impôt sur le revenu −${fmt(bestIR)}</div>
          ${bestIS > 0 ? `<div class="bar-leg-item"><div class="bar-leg-dot" style="background:#c4b5fd;"></div>IS société −${fmt(bestIS)}</div>` : ''}
          <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#86efac;"></div><strong>Revenu net ${fmt(bestNet)}</strong></div>
        </div>
      </div>
    </div>` : ''}

  </div>

  <div class="page-footer">
    <div class="page-footer-text">${cabinetNom} · ${cabinetEmail} · belhoxper.fr</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="page-footer-text">Simulation indicative — barème fiscal 2025</div>
      <div class="page-num" style="width:22px;height:22px;font-size:9px;">2/3</div>
    </div>
  </div>

</div>

<!-- ════════════════════════════════════════════════
     PAGE 3 — ANALYSE & CONTACT
═════════════════════════════════════════════════ -->
<div class="page">

  <div class="page-header">
    <div class="page-header-left">
      <div class="page-header-logo">B</div>
      <div class="page-header-brand">${cabinetNom}</div>
      <div class="page-header-label">Analyse &amp; recommandations</div>
    </div>
    <div class="page-header-right">
      ${simName} · ${date}
    </div>
  </div>

  <div class="page-body">

    <!-- SECTION A — Paramètres -->
    <div class="section-label" style="margin-bottom:10px;">
      <div class="section-label-dot"></div>
      A — Paramètres de la simulation
    </div>
    <div class="params-block">
      <table class="params-table">
        ${paramsRows.map(([l, v], i) => `
        <tr style="${i % 2 === 0 ? 'background:#fafbfc;' : 'background:white;'}">
          <td class="param-label">${l}</td>
          <td class="param-val">${v}</td>
        </tr>`).join('')}
      </table>
    </div>

    <!-- SECTION B — Analyse experte -->
    ${analyse ? `
    <div class="section-label" style="margin-bottom:10px;">
      <div class="section-label-dot" style="background:#8b5cf6;"></div>
      B — Notre analyse pour votre situation
    </div>
    <div class="analyse-block">
      <div class="analyse-title">💡 Pourquoi ${best?.forme || 'cette structure'} ?</div>
      <p class="analyse-p">${analyse.pourquoi}</p>

      <div class="analyse-sub" style="color:#dc2626;">⚠ Points de vigilance</div>
      <ul class="analyse-list">
        ${analyse.vigilance.map(v => `<li>${v}</li>`).join('')}
      </ul>

      <div class="analyse-sub" style="color:#10b981;">✦ Axes d'optimisation identifiés</div>
      <ul class="analyse-list">
        ${analyse.optimisation.map(o => `<li>${o}</li>`).join('')}
      </ul>
    </div>` : ''}

    <!-- SECTION C — Contact -->
    <div class="section-label" style="margin-bottom:10px;">
      <div class="section-label-dot" style="background:#10b981;"></div>
      C — Votre cabinet d'expertise
    </div>
    <div class="contact-block">
      <div class="contact-left">
        <div class="contact-brand">${cabinetNom}</div>
        <div class="contact-tagline">Nos experts vous accompagnent pour mettre en œuvre cette stratégie et optimiser votre situation fiscale.</div>
        <div class="contact-item">📍 <strong>Lyon</strong> — 10 rue de la République, 69001</div>
        <div class="contact-item">📍 <strong>Montluel</strong> — 12 place du Marché, 01120</div>
        <div class="contact-cta">Prendre RDV — Première consultation offerte</div>
      </div>
      <div class="contact-right" style="padding-top:4px;">
        <div class="contact-item">📞 <strong>+33 4 XX XX XX XX</strong></div>
        <div class="contact-item">✉ <strong>${cabinetEmail}</strong></div>
        <div class="contact-item">🌐 <strong>belhoxper.fr</strong></div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:9px;color:rgba(255,255,255,0.3);line-height:1.6;">
            © 2025 ${cabinetNom}<br>
            Document généré le ${genDate}<br>
            Simulation indicative — législation fiscale 2025<br>
            Ne constitue pas un conseil fiscal contractuel.
          </div>
        </div>
      </div>
    </div>

  </div>

  <div class="page-footer">
    <div class="page-footer-text">${cabinetNom} · ${cabinetEmail} · belhoxper.fr</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="page-footer-text">Généré le ${genDate}</div>
      <div class="page-num" style="width:22px;height:22px;font-size:9px;">3/3</div>
    </div>
  </div>

</div>

</body>
</html>`
}

/* ─────────────────────────────────────────────────────────
   Route GET /api/simulations/[id]/pdf
───────────────────────────────────────────────────────── */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: sim, error } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !sim) return NextResponse.json({ error: 'Simulation introuvable' }, { status: 404 })

  let cabinetNom = 'Belho Xper'
  let cabinetEmail = 'contact@belhoxper.fr'
  try {
    const { data: cab } = await supabase
      .from('cabinets')
      .select('nom, email_contact')
      .eq('slug', 'belho-xper')
      .single()
    if (cab) {
      cabinetNom = cab.nom || cabinetNom
      cabinetEmail = cab.email_contact || cabinetEmail
    }
  } catch { /* optionnel */ }

  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 }) // A4 @ 96dpi
    await page.setContent(
      generateHtml(sim as Record<string, unknown>, cabinetNom, cabinetEmail),
      { waitUntil: 'networkidle0' },
    )
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false,
    })
    await browser.close()

    const safeName = ((sim as Record<string, unknown>).name as string)
      .replace(/[^a-z0-9\-_ ]/gi, '_')
      .slice(0, 60)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-belhoxper-${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[pdf] Erreur génération:', err)
    // Fallback : renvoyer l'HTML directement
    const html = generateHtml(sim as Record<string, unknown>, cabinetNom, cabinetEmail)
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
