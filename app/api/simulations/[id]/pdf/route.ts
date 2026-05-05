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
  creation: "Création d'entreprise",
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
  'EURL / SARL (IS)': 'Rémunération TNS déductible IS + dividendes (IS 15 % / 25 %)',
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
   Génération du texte d'analyse dynamique (3 paragraphes)
───────────────────────────────────────────────────────── */
function genAnalyse(
  best: Scored,
  p: Record<string, unknown>,
  tmi: number,
  gain: number,
  scored: Scored[],
): { p1: string; p2: string; vigilance: string[]; optimisation: string[] } {
  const ca = (p.ca as number) || 0
  const worst = scored[scored.length - 1]
  const secteur = secteurLabel[(p.secteur as string)] || 'votre secteur'
  const perMax = Math.min(
    35194,
    Math.max(0, (ca - ((p.charges as number) || 0) - ((p.amort as number) || 0)) * 0.1),
  )
  const f = best.forme

  /* §1 — Constat chiffré (identique pour toutes structures) */
  const p1 = `Avec un CA de ${fmt(ca)} (${secteur}), ${f.startsWith('E') ? "l'" : 'la '}${f} vous permet de conserver ${fmt(best.netAnnuel)} nets annuels, soit ${fmt(Math.round(best.netAnnuel / 12))}/mois après impôts et cotisations sociales.${gain > 500 ? ` Cet écart de ${fmt(gain)}/an par rapport à ${worst.forme} représente ${fmt(Math.round(gain / 12))} supplémentaires chaque mois.` : ''}`

  /* §2 + vigilance + optimisation — selon structure */
  let p2 = ''
  let vigilance: string[] = []
  let optimisation: string[] = []

  const sasScored = scored.find(s => s.forme.includes('SAS'))
  const eurlScored = scored.find(s => s.forme.includes('EURL'))

  if (f.includes('EURL') || f.includes('SARL')) {
    const diffCotis = sasScored ? sasScored.charges - best.charges : 0
    p2 = `L'avantage principal vient des cotisations TNS (${fmt(best.charges)}) nettement inférieures aux charges salariales d'une SAS${sasScored ? ` (${fmt(sasScored.charges)})` : ''}, soit une économie de ${fmt(Math.max(0, diffCotis))}/an sur ce seul poste. L'IS à 15 % jusqu'à 42 500 € de bénéfice — contre votre TMI IR de ${tmi} % — complète cet avantage. La séparation patrimoine personnel/société protège en outre votre exposition personnelle.`
    vigilance = [
      "Tenue d'une comptabilité complète obligatoire (bilan annuel, liasse fiscale)",
      'Cotisations SSI minimales même sans rémunération (~1\u202f200\u202f€/an)',
      'IS à 15\u202f% jusqu\'à 42\u202f500\u202f€ de bénéfice, puis 25\u202f% au-delà',
      'Dividendes au-delà de 10\u202f% du capital : soumis aux cotisations TNS',
    ]
    optimisation = [
      `Versement PER individuel : jusqu'à ${fmt(perMax)} déductibles (TMI ${tmi}\u202f%)`,
      'Arbitrage rémunération gérant vs dividendes PFU 30\u202f% selon vos besoins',
      "Prévoyance Madelin déductible de l'IS (arrêt maladie, invalidité, décès)",
      'Indemnités kilométriques et domiciliation domicile partiellement déductibles',
    ]
  } else if (f.includes('SAS')) {
    const diffCotis = eurlScored ? best.charges - eurlScored.charges : 0
    p2 = `Malgré des charges sociales supérieures à l'EURL${eurlScored ? ` (+${fmt(Math.max(0, diffCotis))}/an)` : ''}, la SASU offre le régime général (meilleure retraite AGIRC-ARRCO, couverture maladie supérieure) et un double levier unique : salaire présidentiel + dividendes soumis uniquement au PFU 30\u202f% sans cotisations sociales. Ce profil convient si votre priorité est la protection sociale ou une future levée de fonds.`
    vigilance = [
      'Aucune couverture France Travail (chômage) — contrat GSC fortement recommandé',
      'Charges sociales patronales élevées sur le salaire (environ 42\u202f%)',
      'Pas de contrat Madelin possible — prévoyance via Article 83 ou PER entreprise',
      'Obligations comptables et juridiques supérieures à l\'EI (commissaire aux comptes si seuils)',
    ]
    optimisation = [
      `Versement PER individuel ou PER entreprise : jusqu'à ${fmt(perMax)} déductibles`,
      'Optimisation du ratio salaire / dividendes selon vos besoins de trésorerie',
      'Épargne salariale (PEE, PERCO) possible et avantageuse sur l\'IS',
      "Couverture GSC (assurance perte d'emploi dirigeant) déductible de l'IS",
    ]
  } else if (f.includes('EI')) {
    p2 = `Les cotisations SSI sont calculées sur votre résultat net réel de ${fmt(best.netAnnuel + best.ir + best.charges)} — sans surcoût lié à l'IS — ce qui les rend très compétitives à ce niveau de CA. La déduction directe de vos charges réelles (${fmt((p.charges as number) || 0)}) est un avantage déterminant face au régime micro. La gestion reste simple : aucune comptabilité de société, pas d'assemblée générale.`
    vigilance = [
      'Responsabilité personnelle illimitée sur les dettes professionnelles',
      'Cotisations SSI calculées sur la totalité du bénéfice net imposable',
      "Au-delà de 60\u202f000\u202f€ de résultat, l'EURL IS devient généralement plus avantageux",
      "Pas de rémunération du dirigeant déductible (le bénéfice = revenu)",
    ]
    optimisation = [
      `Versement PER individuel : jusqu'à ${fmt(perMax)} déductibles du revenu (TMI ${tmi}\u202f%)`,
      'Contrat Madelin prévoyance déductible du bénéfice imposable',
      'Envisager le passage en EURL IS si le résultat dépasse 60\u202f000\u202f€/an',
      'Domiciliation domicile et indemnités kilométriques déductibles',
    ]
  } else {
    p2 = `L'abattement forfaitaire du régime micro (34\u202f% à 72\u202f% selon activité) dépasse vos charges réelles estimées, ce qui rend ce régime actuellement optimal. La simplicité administrative est également un atout majeur : pas de comptabilité lourde, déclaration trimestrielle ou mensuelle du CA, aucun bilan. Ce régime est idéal en phase de démarrage ou pour tester votre activité.`
    vigilance = [
      'Plafond micro BIC : 77\u202f700\u202f€/an — surveiller l\'évolution du CA',
      'Aucune déduction des charges réelles ni récupération de TVA',
      'Protection sociale réduite (retraite et prévoyance faibles)',
      'Pas de déduction des amortissements ni des déficits reportables',
    ]
    optimisation = [
      "Anticiper le passage en EI réel si les charges réelles dépassent l'abattement",
      'Compléter la retraite par un PER individuel (déductible du revenu global)',
      'Mutuelle santé complémentaire recommandée (couverture micro insuffisante)',
      'Prévoir la transition de régime avant le dépassement du plafond',
    ]
  }

  return { p1, p2, vigilance, optimisation }
}

/* ─────────────────────────────────────────────────────────
   Template HTML — 3 pages A4
───────────────────────────────────────────────────────── */
function generateHtml(
  sim: Record<string, unknown>,
  cabinetNom = 'Belho Xper',
  cabinetEmail = 'contact@belhoxper.fr',
  clientName = '',
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
  const paramsRows: [string, string][] = [
    ['Situation', situLabel[(p.situation as string)] || (sim.situation as string) || '—'],
    ['Secteur d\'activité', secteurLabel[(p.secteur as string)] || (p.secteur as string) || '—'],
    ['Chiffre d\'affaires', fmt(ca)],
    ['Charges déductibles', fmt(charges)],
    ...(amort > 0 ? [['Amortissements', fmt(amort)] as [string, string]] : []),
    ['Foyer fiscal', `${(p.partsBase as number) === 2 ? 'En couple' : 'Célibataire'}${(p.nbEnfants as number) > 0 ? ` · ${p.nbEnfants} enfant${(p.nbEnfants as number) > 1 ? 's' : ''}` : ''}`],
    ['Parts fiscales', `${p.parts || 1} part${(p.parts as number) > 1 ? 's' : ''}`],
    ...((p.remNetAnn as number) > 0 ? [['Rémunération nette cible', fmt(p.remNetAnn as number)] as [string, string]] : []),
    ...((p.perMontant as number) > 0 ? [['PER versé', fmt(p.perMontant as number)] as [string, string]] : [['PER versé', '0 €'] as [string, string]]),
    ...((p.autresRev as number) > 0 ? [['Autres revenus', fmt(p.autresRev as number)] as [string, string]] : []),
  ]

  /* ── Couleur structure recommandée ── */
  const bestColor = best ? (formeColor[best.forme] || '#3b82f6') : '#3b82f6'
  const bestBorder = best ? (formeBorderColor[best.forme] || '#2563eb') : '#2563eb'

  /* ── TMI badge ── */
  const tmiColor = tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : '#ef4444'
  const tmiLabel = tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Intermédiaire' : 'Tranche haute'

  /* ── Taux effectif ── */
  const tauxEff = ca > 0 && best ? Math.round((best.ir + best.charges) / ca * 100) : 0

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport fiscal — ${simName} — ${cabinetNom}</title>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 600);
  };
</script>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #1e293b;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: #e5e7eb;
  }

  /* ── Barre d'action (écran uniquement) ── */
  .print-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 20px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .print-bar-title {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    margin-right: 8px;
  }
  .print-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 700; font-family: inherit;
  }
  .print-btn-primary {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: white;
    box-shadow: 0 4px 12px rgba(37,99,235,0.4);
  }
  .print-btn-secondary {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.65);
    border: 1px solid rgba(255,255,255,0.12) !important;
  }
  @media print { .print-bar { display: none !important; } }

  /* ── Pages ── */
  .page-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 0;
    gap: 24px;
  }
  @media print {
    body { background: white; }
    .page-wrap { padding: 0; gap: 0; }
  }
  .page {
    width: 210mm;
    height: 297mm;
    page-break-after: always;
    page-break-inside: avoid;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    background: white;
    box-shadow: 0 4px 32px rgba(0,0,0,0.18);
  }
  .page:last-child { page-break-after: auto; }

  /* ── Page 1 — Cover ── */
  .cover { background: #080d1a; color: white; }
  .cover-logo {
    padding: 32px 44px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .logo-badge {
    width: 42px; height: 42px; border-radius: 10px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    display: flex; align-items: center; justify-content: center;
    font-size: 21px; font-weight: 900; color: white;
    flex-shrink: 0;
  }
  .logo-name { font-size: 15px; font-weight: 800; color: white; line-height: 1.2; }
  .logo-sub { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 1px; }

  .cover-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 44px;
    text-align: center;
  }
  .cover-eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: 0.15em;
    text-transform: uppercase; color: #60a5fa; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px; justify-content: center;
  }
  .cover-dot { width: 5px; height: 5px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }
  .cover-title {
    font-size: 36px; font-weight: 900; color: white;
    letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 10px;
  }
  .cover-title-gradient {
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .cover-divider {
    width: 100px; height: 3px; border-radius: 999px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    margin: 18px auto;
  }

  .cover-summary {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 18px;
    padding: 28px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    width: 100%;
    max-width: 480px;
  }
  .cover-row { display: flex; gap: 32px; align-items: flex-start; }
  .cover-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .cover-client { font-size: 14px; color: rgba(255,255,255,0.6); font-weight: 500; }
  .cover-date { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: -10px; }
  .cover-label { font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.09em; }
  .cover-val { font-size: 40px; font-weight: 900; color: #f1f5f9; letter-spacing: -0.03em; line-height: 1; }
  .cover-val-sub { font-size: 10px; color: rgba(255,255,255,0.3); }
  .cover-badge {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 16px; border-radius: 999px;
    font-size: 12px; font-weight: 700;
  }
  .cover-score-big {
    font-size: 52px; font-weight: 900; letter-spacing: -0.03em; line-height: 1;
  }
  .cover-score-label { font-size: 9px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.09em; }
  .gain-pill {
    background: rgba(16,185,129,0.13);
    border: 1px solid rgba(16,185,129,0.28);
    border-radius: 12px;
    padding: 11px 20px;
    text-align: center;
    width: 100%;
  }
  .gain-pill-val { font-size: 20px; font-weight: 900; color: #34d399; letter-spacing: -0.02em; }
  .gain-pill-sub { font-size: 9px; color: rgba(52,211,153,0.6); margin-top: 3px; }

  .cover-footer {
    padding: 18px 44px;
    border-top: 1px solid rgba(255,255,255,0.07);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .cover-footer-text { font-size: 10px; color: rgba(255,255,255,0.3); line-height: 1.6; }
  .page-num {
    width: 26px; height: 26px; border-radius: 50%;
    background: rgba(59,130,246,0.18); border: 1px solid rgba(59,130,246,0.28);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: #60a5fa;
    flex-shrink: 0;
  }

  /* ── Pages 2 & 3 — Structure ── */
  .page-header {
    background: #080d1a;
    padding: 12px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .page-header-left { display: flex; align-items: center; gap: 10px; }
  .page-header-logo {
    width: 24px; height: 24px; border-radius: 6px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 900; color: white; flex-shrink: 0;
  }
  .page-header-brand { font-size: 12px; font-weight: 700; color: white; }
  .page-header-label {
    font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: #60a5fa;
    background: rgba(59,130,246,0.14); border: 1px solid rgba(59,130,246,0.22);
    padding: 2px 9px; border-radius: 999px;
  }
  .page-header-right { font-size: 9px; color: rgba(255,255,255,0.3); text-align: right; }

  .page-body { flex: 1; padding: 20px 36px 16px; background: #f8fafc; overflow: hidden; }

  .page-footer {
    padding: 9px 36px;
    border-top: 1px solid #e2e8f0;
    background: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .page-footer-text { font-size: 9px; color: #94a3b8; }

  /* ── Section labels ── */
  .sec-label {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #64748b;
    margin-bottom: 8px; padding-bottom: 5px;
    border-bottom: 1px solid #e2e8f0;
    display: flex; align-items: center; gap: 5px;
  }
  .sec-dot { width: 4px; height: 4px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }

  /* ── Rec card ── */
  .rec-card {
    background: white; border-radius: 11px;
    border: 1px solid #e2e8f0;
    border-left-width: 4px;
    border-left-color: ${bestBorder};
    padding: 14px 18px; margin-bottom: 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  }
  .rec-eyebrow { font-size: 8px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: ${bestColor}; margin-bottom: 4px; }
  .rec-title { font-size: 19px; font-weight: 900; color: #0f172a; margin-bottom: 2px; line-height: 1.1; }
  .rec-desc { font-size: 9.5px; color: #64748b; margin-bottom: 10px; }
  .rec-score-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(59,130,246,0.07); border: 1px solid rgba(59,130,246,0.18);
    border-radius: 999px; padding: 2px 9px;
    font-size: 9.5px; font-weight: 700; color: #3b82f6;
  }
  .kpi-row { display: flex; gap: 9px; margin-top: 12px; }
  .kpi-box {
    flex: 1; background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 9px; padding: 10px 12px;
  }
  .kpi-label { font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 3px; }
  .kpi-val { font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1; }
  .kpi-sub { font-size: 8.5px; color: #94a3b8; margin-top: 2px; }
  .gain-box {
    margin-top: 10px; padding: 8px 14px; border-radius: 9px;
    background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.18);
    display: flex; align-items: center; gap: 9px;
  }
  .gain-arrow { font-size: 14px; color: #10b981; }
  .gain-text { font-size: 11px; font-weight: 700; color: #065f46; line-height: 1.4; }

  /* ── Tableau comparatif ── */
  .compare-table {
    width: 100%; border-collapse: collapse; border-radius: 9px;
    overflow: hidden; margin-bottom: 6px;
    border: 1px solid #e2e8f0;
  }
  .compare-table th {
    text-align: left; font-size: 8.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;
    padding: 7px 10px; background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
  }
  .compare-table td { padding: 7px 10px; font-size: 10.5px; border-bottom: 1px solid #f1f5f9; }
  .compare-table tr:last-child td { border-bottom: none; }
  .best-tr { background: #eff6ff; }
  .star-badge {
    display: inline-block; font-size: 7.5px; font-weight: 700;
    background: #1d4ed8; color: white; padding: 1px 5px;
    border-radius: 999px; margin-left: 4px; vertical-align: middle;
  }
  .neg { color: #dc2626; }
  .pos { color: #16a34a; font-weight: 700; }
  .table-note { font-size: 8.5px; color: #94a3b8; margin-top: 4px; }

  /* ── Stacked bar ── */
  .bar-track {
    display: flex; height: 22px; border-radius: 5px; overflow: hidden;
    border: 1px solid #e2e8f0; margin-bottom: 8px;
  }
  .bar-seg {
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 700; overflow: hidden;
    white-space: nowrap;
  }
  .bar-legend { display: flex; gap: 12px; flex-wrap: wrap; }
  .bar-leg-item { display: flex; align-items: center; gap: 4px; font-size: 8.5px; color: #475569; }
  .bar-leg-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

  /* ── Page 3 ── */
  .params-block { background: white; border: 1px solid #e2e8f0; border-radius: 9px; overflow: hidden; margin-bottom: 12px; }
  .params-table { width: 100%; border-collapse: collapse; }
  .params-table td { padding: 5px 10px; font-size: 10.5px; border-bottom: 1px solid #f1f5f9; }
  .params-table tr:last-child td { border-bottom: none; }
  .params-table .param-label { color: #64748b; font-weight: 600; width: 46%; }
  .params-table .param-val { color: #0f172a; font-weight: 700; }

  .analyse-block { background: white; border: 1px solid #e2e8f0; border-radius: 9px; padding: 14px 18px; margin-bottom: 12px; }
  .analyse-h { font-size: 11.5px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
  .analyse-p { font-size: 10px; color: #374151; line-height: 1.65; margin-bottom: 10px; }
  .analyse-sub { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; margin-top: 10px; }
  .analyse-list { list-style: none; padding: 0; }
  .analyse-list li { font-size: 10px; color: #374151; line-height: 1.5; padding: 2px 0 2px 13px; position: relative; }
  .analyse-list li::before { content: '•'; position: absolute; left: 0; color: #3b82f6; font-weight: 900; }

  /* ── Contact block ── */
  .contact-block {
    background: #1e3a5f;
    border-radius: 12px; padding: 18px 24px;
    display: flex; gap: 24px; align-items: flex-start;
  }
  .contact-left { flex: 1; }
  .contact-right { flex-shrink: 0; width: 180px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; padding-top: 2px; }
  .contact-brand { font-size: 16px; font-weight: 900; color: white; margin-bottom: 4px; }
  .contact-tagline { font-size: 10px; color: rgba(255,255,255,0.5); line-height: 1.55; margin-bottom: 12px; }
  .contact-item { font-size: 10px; color: rgba(255,255,255,0.65); line-height: 1.9; }
  .contact-item strong { color: white; }
  .contact-cta {
    margin-top: 10px; display: inline-block;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white; font-size: 10px; font-weight: 700;
    padding: 7px 16px; border-radius: 7px;
    letter-spacing: 0.01em;
  }
  .contact-badge {
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; padding: 8px 14px; font-size: 9px;
    color: rgba(255,255,255,0.5); line-height: 1.6; text-align: right;
  }
  .contact-offert {
    display: inline-block;
    background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.3);
    border-radius: 999px; padding: 3px 12px;
    font-size: 10px; font-weight: 700; color: #34d399;
  }
</style>
</head>
<body>

<!-- Barre d'action écran -->
<div class="print-bar">
  <span class="print-bar-title">Rapport fiscal — ${simName}</span>
  <button class="print-btn print-btn-primary" onclick="window.print()">⬇&nbsp; Télécharger en PDF</button>
  <button class="print-btn print-btn-secondary" onclick="window.close()">← Retour</button>
</div>

<div class="page-wrap">

<!-- ════════════════════════════════════════════════
     PAGE 1 — COUVERTURE
═════════════════════════════════════════════════ -->
<div class="page cover">

  <!-- Logo -->
  <div class="cover-logo">
    <div class="logo-badge">B</div>
    <div>
      <div class="logo-name">${cabinetNom}</div>
      <div class="logo-sub">Cabinet d'expertise comptable &amp; conseil fiscal</div>
    </div>
  </div>

  <!-- Centre -->
  <div class="cover-center">
    <div class="cover-eyebrow">
      <div class="cover-dot"></div>
      Analyse fiscale personnalisée · Barème 2025
    </div>
    <div class="cover-title">
      Optimisation de votre<br>
      <span class="cover-title-gradient">rémunération</span>
    </div>
    <div class="cover-divider"></div>

    <div class="cover-summary">
      <div class="cover-client">${simName}</div>
      ${clientName ? `<div class="cover-client" style="font-size:12px;color:rgba(255,255,255,0.4);">${clientName}</div>` : ''}
      <div class="cover-date">Générée le ${genDate}</div>

      <!-- CA + Score -->
      <div class="cover-row">
        <div class="cover-col">
          <div class="cover-label">CA analysé</div>
          <div class="cover-val">${fmt(ca)}</div>
          <div class="cover-val-sub">chiffre d'affaires annuel</div>
        </div>
        ${best ? `
        <div class="cover-col">
          <div class="cover-label">Score</div>
          <div class="cover-score-big" style="color:${bestColor};">${best.scoreTotal}</div>
          <div class="cover-score-label">/100</div>
        </div>` : ''}
      </div>

      ${best ? `
      <!-- Structure recommandée -->
      <div style="text-align:center;">
        <div class="cover-label" style="margin-bottom:7px;">Structure recommandée</div>
        <div class="cover-badge" style="background:${bestColor}18;border:1px solid ${bestColor}38;color:${bestColor};">
          <span style="width:6px;height:6px;border-radius:50%;background:${bestColor};display:inline-block;flex-shrink:0;"></span>
          ${best.forme}
        </div>
      </div>
      <div style="text-align:center;">
        <div class="cover-label" style="margin-bottom:5px;">Revenu net annuel</div>
        <div style="font-size:30px;font-weight:900;color:${bestColor};letter-spacing:-0.02em;line-height:1.1;">${fmt(best.netAnnuel)}</div>
        <div class="cover-val-sub">${fmt(Math.round(best.netAnnuel / 12))}/mois</div>
      </div>` : ''}

      ${gain > 500 ? `
      <div class="gain-pill" style="width:100%;">
        <div class="gain-pill-val">+${fmt(gain)}/an</div>
        <div class="gain-pill-sub">vs structure la moins avantageuse · soit +${fmt(Math.round(gain / 12))}/mois</div>
      </div>` : ''}
    </div>
  </div>

  <!-- Footer -->
  <div class="cover-footer">
    <div class="cover-footer-text">
      <strong style="color:rgba(255,255,255,0.5);">${cabinetNom}</strong> · Lyon &amp; Montluel<br>
      ${cabinetEmail} · belhoxper.fr<br>
      <span style="color:rgba(255,255,255,0.18);font-size:9px;">Document confidentiel — simulation indicative non contractuelle</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
      <div class="page-num">1/3</div>
      <div class="cover-footer-text">Barème fiscal 2025</div>
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
    <div class="page-header-right">${simName} · ${date}</div>
  </div>

  <div class="page-body">

    ${best ? `
    <!-- A — Structure recommandée -->
    <div class="sec-label" style="margin-bottom:8px;">
      <div class="sec-dot"></div>A — Structure recommandée
    </div>
    <div class="rec-card">
      <div class="rec-eyebrow">✦ Meilleure structure pour votre profil</div>
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:2px;">
        <div class="rec-title">${best.forme}</div>
        <div class="rec-score-badge">Score ${best.scoreTotal}/100</div>
      </div>
      <div class="rec-desc">${remDesc[best.forme] || ''}</div>

      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-label">Revenu net annuel</div>
          <div class="kpi-val" style="color:${bestColor};">${fmt(best.netAnnuel)}</div>
          <div class="kpi-sub">${fmt(Math.round(best.netAnnuel / 12))}/mois</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Taux effectif total</div>
          <div class="kpi-val">${tauxEff}%</div>
          <div class="kpi-sub">cotis. + IR sur CA</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">TMI</div>
          <div class="kpi-val" style="color:${tmiColor};">${tmi}%</div>
          <div class="kpi-sub">${tmiLabel}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">CA simulé</div>
          <div class="kpi-val">${fmt(ca)}</div>
          <div class="kpi-sub">chiffre d'affaires</div>
        </div>
      </div>

      ${gain > 500 ? `
      <div class="gain-box">
        <div class="gain-arrow">↑</div>
        <div class="gain-text">+${fmt(gain)}/an par rapport à la structure la moins avantageuse &nbsp;·&nbsp; soit +${fmt(Math.round(gain / 12))}/mois supplémentaires</div>
      </div>` : ''}
    </div>` : ''}

    <!-- B — Tableau comparatif -->
    <div class="sec-label" style="margin-bottom:8px;">
      <div class="sec-dot" style="background:#8b5cf6;"></div>B — Tableau comparatif des 4 structures
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
    <div class="table-note">* Barème IR 2025 · Cotisations SSI par composante · Calculs indicatifs non contractuels</div>

    ${best ? `
    <!-- C — Décomposition CA -->
    <div style="margin-top:12px;">
      <div class="sec-label" style="margin-bottom:8px;">
        <div class="sec-dot" style="background:#10b981;"></div>C — Décomposition du CA (${fmt(ca)}) avec ${best.forme}
      </div>
      <div class="bar-track">
        ${chargesPct > 0 ? `<div class="bar-seg" style="width:${chargesPct}%;background:#cbd5e1;color:#475569;">${chargesPct > 4 ? chargesPct + '%' : ''}</div>` : ''}
        <div class="bar-seg" style="width:${cotisPct}%;background:#fca5a5;color:#7f1d1d;">${cotisPct > 4 ? cotisPct + '%' : ''}</div>
        <div class="bar-seg" style="width:${irPct}%;background:#fdba74;color:#7c2d12;">${irPct > 4 ? irPct + '%' : ''}</div>
        ${isPct > 0 ? `<div class="bar-seg" style="width:${isPct}%;background:#c4b5fd;color:#3b0764;">${isPct > 4 ? isPct + '%' : ''}</div>` : ''}
        <div class="bar-seg" style="width:${netPct}%;background:#86efac;color:#14532d;font-weight:900;">NET ${netPct}%</div>
      </div>
      <div class="bar-legend">
        ${chargesPct > 0 ? `<div class="bar-leg-item"><div class="bar-leg-dot" style="background:#cbd5e1;"></div>Charges ${fmt(charges)}</div>` : ''}
        <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#fca5a5;"></div>Cotisations −${fmt(bestCharges)}</div>
        <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#fdba74;"></div>IR −${fmt(bestIR)}</div>
        ${bestIS > 0 ? `<div class="bar-leg-item"><div class="bar-leg-dot" style="background:#c4b5fd;"></div>IS −${fmt(bestIS)}</div>` : ''}
        <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#86efac;"></div><strong>Net ${fmt(bestNet)}</strong></div>
      </div>
    </div>` : ''}

  </div>

  <div class="page-footer">
    <div class="page-footer-text">${cabinetNom} · ${cabinetEmail} · belhoxper.fr</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="page-footer-text">Simulation indicative — barème fiscal 2025</div>
      <div class="page-num" style="width:22px;height:22px;font-size:8.5px;">2/3</div>
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
    <div class="page-header-right">${simName} · ${date}</div>
  </div>

  <div class="page-body">

    <!-- A — Paramètres -->
    <div class="sec-label" style="margin-bottom:8px;">
      <div class="sec-dot"></div>A — Paramètres de la simulation
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

    <!-- B — Analyse experte -->
    ${analyse ? `
    <div class="sec-label" style="margin-bottom:8px;">
      <div class="sec-dot" style="background:#8b5cf6;"></div>B — Notre analyse pour votre situation
    </div>
    <div class="analyse-block">
      <div class="analyse-h">💡 Pourquoi ${best?.forme || 'cette structure'} ?</div>

      <p class="analyse-p">${analyse.p1}</p>
      <p class="analyse-p">${analyse.p2}</p>

      <div class="analyse-sub" style="color:#dc2626;">⚠ Points de vigilance</div>
      <ul class="analyse-list">
        ${analyse.vigilance.map(v => `<li>${v}</li>`).join('')}
      </ul>

      <div class="analyse-sub" style="color:#10b981;">✦ Axes d'optimisation identifiés</div>
      <ul class="analyse-list">
        ${analyse.optimisation.map(o => `<li>${o}</li>`).join('')}
      </ul>
    </div>` : ''}

    <!-- C — Contact -->
    <div class="sec-label" style="margin-bottom:8px;">
      <div class="sec-dot" style="background:#10b981;"></div>C — Mettre en œuvre cette stratégie
    </div>
    <div class="contact-block">
      <div class="contact-left">
        <div class="contact-brand">${cabinetNom}</div>
        <div class="contact-tagline">Nos experts fiscalistes vous accompagnent pour déployer cette stratégie et piloter votre optimisation en continu.</div>
        <div class="contact-item">📍 <strong>Lyon</strong> — 10 rue de la République, 69001</div>
        <div class="contact-item">📍 <strong>Montluel</strong> — 12 place du Marché, 01120</div>
        <div class="contact-item">✉ <strong>${cabinetEmail}</strong></div>
        <div class="contact-item">🌐 <strong>belhoxper.fr</strong></div>
        <div class="contact-cta">Prenez RDV — nous vous rappelons sous 24h</div>
      </div>
      <div class="contact-right">
        <div class="contact-offert">Première consultation offerte</div>
        <div class="contact-badge">
          © 2025 ${cabinetNom}<br>
          Généré le ${genDate}<br>
          Simulation indicative<br>
          non contractuelle<br>
          Barème fiscal 2025
        </div>
      </div>
    </div>

  </div>

  <div class="page-footer">
    <div class="page-footer-text">© 2025 ${cabinetNom} · Document généré le ${genDate} · Simulation indicative non contractuelle · Barème fiscal 2025</div>
    <div class="page-num" style="width:22px;height:22px;font-size:8.5px;">3/3</div>
  </div>

</div>

</div><!-- /page-wrap -->
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

  /* Nom du client (depuis user metadata) */
  const clientName = (user.user_metadata?.full_name as string)
    || (user.email as string)
    || ''

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

  const html = generateHtml(
    sim as Record<string, unknown>,
    cabinetNom,
    cabinetEmail,
    clientName,
  )

  /* ── Tentative Puppeteer (vrai PDF binaire) ── */
  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 }) // A4 @ 96dpi
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false,
    })
    await browser.close()

    const simRecord = sim as Record<string, unknown>
    const rawName = (simRecord.name as string) || 'rapport'
    const safeName = rawName.replace(/[^a-z0-9\-_ ]/gi, '_').slice(0, 60)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-belhoxper-${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[pdf] Puppeteer indisponible, fallback HTML+print:', err)
  }

  /* ── Fallback : page HTML avec window.print() auto ──
     L'utilisateur voit la page dans un nouvel onglet,
     la boîte d'impression du navigateur s'ouvre automatiquement.
     Il peut alors "Enregistrer en PDF". */
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
