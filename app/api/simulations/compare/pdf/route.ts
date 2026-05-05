import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  type Scored, fmt, formeColor, formeBorderColor,
  situLabel, secteurLabel, PDF_BASE_CSS,
} from '@/lib/pdf/utils'

/* ─────────────────────────────────────────────────────────
   Types locaux
───────────────────────────────────────────────────────── */
type SimRecord = Record<string, unknown>

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
const HORIZONS = [
  { label: '1 an',   mult: 1 },
  { label: '3 ans',  mult: 3 },
  { label: '5 ans',  mult: 5 },
  { label: '10 ans', mult: 10 },
]

function bestOf(a: number, b: number): 0 | 1 { return a >= b ? 0 : 1 }

function getScored(sim: SimRecord): Scored[] {
  const results = (sim.results as { scored?: Scored[] }) || {}
  return results.scored || []
}
function getBest(sim: SimRecord): Scored | undefined { return getScored(sim)[0] }
function getParams(sim: SimRecord): Record<string, unknown> {
  return (sim.params as Record<string, unknown>) || {}
}

/* ─────────────────────────────────────────────────────────
   Analyse comparative dynamique
───────────────────────────────────────────────────────── */
function genCompareAnalyse(simA: SimRecord, simB: SimRecord): { p1: string; p2: string; p3: string } {
  const bestA = getBest(simA)
  const bestB = getBest(simB)
  const pA = getParams(simA)
  const pB = getParams(simB)
  const caA = (simA.ca as number) || (pA.ca as number) || 0
  const caB = (simB.ca as number) || (pB.ca as number) || 0
  const nameA = (simA.name as string) || 'Scénario A'
  const nameB = (simB.name as string) || 'Scénario B'

  if (!bestA || !bestB) {
    return { p1: 'Données insuffisantes pour l\'analyse.', p2: '', p3: '' }
  }

  const diff = bestA.netAnnuel - bestB.netAnnuel
  const winner = diff >= 0 ? nameA : nameB
  const loser = diff >= 0 ? nameB : nameA
  const absDiff = Math.abs(diff)
  const absMonthly = Math.round(absDiff / 12)

  const p1 = `Le scénario « ${winner} » ressort comme le plus avantageux, avec un revenu net annuel de ${fmt(diff >= 0 ? bestA.netAnnuel : bestB.netAnnuel)} contre ${fmt(diff >= 0 ? bestB.netAnnuel : bestA.netAnnuel)} pour « ${loser} ». Cet écart de ${fmt(absDiff)}/an représente ${fmt(absMonthly)} supplémentaires chaque mois.`

  const sameCA = Math.abs(caA - caB) < caA * 0.05
  const p2 = sameCA
    ? `À CA équivalent (${fmt(caA)}), la différence s'explique principalement par le choix de structure : ${bestA.forme} pour le scénario A, ${bestB.forme} pour le scénario B. La structure ${diff >= 0 ? bestA.forme : bestB.forme} génère un meilleur équilibre cotisations / fiscalité à ce niveau de revenus. Les cotisations s'élèvent à ${fmt(diff >= 0 ? bestA.charges : bestB.charges)} contre ${fmt(diff >= 0 ? bestB.charges : bestA.charges)}, soit ${fmt(Math.abs(bestA.charges - bestB.charges))} d'écart.`
    : `Les deux scénarios ont des CA différents (${fmt(caA)} vs ${fmt(caB)}), ce qui amplifie l'écart net. Toutes choses égales par ailleurs, la structure ${diff >= 0 ? bestA.forme : bestB.forme} reste plus efficiente à ces niveaux de revenus grâce à un régime de cotisations plus favorable.`

  const p3 = `À 10 ans, le gain cumulé en faveur du scénario « ${winner} » atteint ${fmt(absDiff * 10)}, sans prise en compte des revalorisations. Cette simulation est indicative — un expert-comptable peut affiner ces projections et identifier des leviers complémentaires (PER, Madelin, arbitrage dividendes) non intégrés ici.`

  return { p1, p2, p3 }
}

/* ─────────────────────────────────────────────────────────
   Template HTML — 3 pages comparaison
───────────────────────────────────────────────────────── */
function generateCompareHtml(
  simA: SimRecord,
  simB: SimRecord,
  cabinetNom: string,
  cabinetEmail: string,
  clientName: string,
): string {
  const bestA = getBest(simA)
  const bestB = getBest(simB)
  const pA = getParams(simA)
  const pB = getParams(simB)
  const nameA = (simA.name as string) || 'Scénario A'
  const nameB = (simB.name as string) || 'Scénario B'
  const caA = (simA.ca as number) || (pA.ca as number) || 0
  const caB = (simB.ca as number) || (pB.ca as number) || 0
  const gainA = (simA.gain as number) || 0
  const gainB = (simB.gain as number) || 0
  const netA = bestA?.netAnnuel ?? 0
  const netB = bestB?.netAnnuel ?? 0
  const diff = netA - netB
  const absDiff = Math.abs(diff)
  const winnerIdx = diff >= 0 ? 0 : 1
  const genDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  const colorA = bestA ? (formeColor[bestA.forme] || '#3b82f6') : '#3b82f6'
  const colorB = bestB ? (formeColor[bestB.forme] || '#8b5cf6') : '#8b5cf6'
  const borderA = bestA ? (formeBorderColor[bestA.forme] || '#2563eb') : '#2563eb'
  const borderB = bestB ? (formeBorderColor[bestB.forme] || '#7c3aed') : '#7c3aed'

  const analyse = genCompareAnalyse(simA, simB)

  /* Lignes de comparaison */
  const rows: Array<{ label: string; vA: string; vB: string; winA: boolean | null }> = [
    /* Paramètres */
    { label: 'Situation', vA: situLabel[(pA.situation as string)] || '—', vB: situLabel[(pB.situation as string)] || '—', winA: null },
    { label: 'Secteur', vA: secteurLabel[(pA.secteur as string)] || '—', vB: secteurLabel[(pB.secteur as string)] || '—', winA: null },
    { label: 'CA annuel', vA: fmt(caA), vB: fmt(caB), winA: caA >= caB },
    { label: 'Charges déductibles', vA: fmt((pA.charges as number) || 0), vB: fmt((pB.charges as number) || 0), winA: null },
    { label: 'Foyer fiscal', vA: (pA.partsBase as number) === 2 ? 'En couple' : 'Célibataire', vB: (pB.partsBase as number) === 2 ? 'En couple' : 'Célibataire', winA: null },
    /* Résultats */
    { label: 'Structure recommandée', vA: bestA?.forme ?? '—', vB: bestB?.forme ?? '—', winA: null },
    { label: 'Score multicritère', vA: `${bestA?.scoreTotal ?? '—'}/100`, vB: `${bestB?.scoreTotal ?? '—'}/100`, winA: (bestA?.scoreTotal ?? 0) >= (bestB?.scoreTotal ?? 0) },
    { label: 'Revenu net annuel', vA: fmt(netA), vB: fmt(netB), winA: netA >= netB },
    { label: 'Revenu net mensuel', vA: fmt(Math.round(netA / 12)), vB: fmt(Math.round(netB / 12)), winA: netA >= netB },
    { label: 'Cotisations sociales', vA: `−${fmt(bestA?.charges ?? 0)}`, vB: `−${fmt(bestB?.charges ?? 0)}`, winA: (bestA?.charges ?? 0) <= (bestB?.charges ?? 0) },
    { label: 'Impôt sur le revenu', vA: `−${fmt(bestA?.ir ?? 0)}`, vB: `−${fmt(bestB?.ir ?? 0)}`, winA: (bestA?.ir ?? 0) <= (bestB?.ir ?? 0) },
    { label: 'IS société', vA: (bestA?.is ?? 0) > 0 ? `−${fmt(bestA!.is)}` : '—', vB: (bestB?.is ?? 0) > 0 ? `−${fmt(bestB!.is)}` : '—', winA: null },
    { label: 'Gain vs moins avantageuse', vA: gainA > 0 ? `+${fmt(gainA)}/an` : '—', vB: gainB > 0 ? `+${fmt(gainB)}/an` : '—', winA: gainA >= gainB },
  ]

  const sectionBreak = 5 // rows before results section

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Comparaison — ${nameA} vs ${nameB} — ${cabinetNom}</title>
<script>window.onload=function(){setTimeout(function(){window.print()},700);};</script>
<style>
${PDF_BASE_CSS}
/* Cover */
.cv-logo { padding: 30px 42px 0; display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
.cv-ctr { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 42px; text-align: center; }
.cv-ey { font-size: 9.5px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #60a5fa; margin-bottom: 14px; display: flex; align-items: center; gap: 7px; justify-content: center; }
.cv-dot { width: 5px; height: 5px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }
.cv-div { width: 90px; height: 3px; border-radius: 999px; background: linear-gradient(90deg,#3b82f6,#8b5cf6); margin: 14px auto; }
.cv-grad { background: linear-gradient(135deg,#60a5fa,#a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.cv-foot { padding: 16px 42px; border-top: 1px solid rgba(255,255,255,.07); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.cv-ft { font-size: 9px; color: rgba(255,255,255,.28); line-height: 1.6; }
/* Sim cards on cover */
.sc-row { display: flex; gap: 16px; width: 100%; max-width: 520px; }
.sc { flex: 1; border-radius: 12px; padding: 14px 18px; text-align: left; }
.sc-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 5px; }
.sc-name { font-size: 13px; font-weight: 800; color: white; margin-bottom: 3px; line-height: 1.2; }
.sc-forme { font-size: 10px; color: rgba(255,255,255,.55); margin-bottom: 8px; }
.sc-net { font-size: 22px; font-weight: 900; letter-spacing: -.02em; line-height: 1; }
.sc-sub { font-size: 9px; color: rgba(255,255,255,.4); margin-top: 2px; }
.sc-score { font-size: 12px; font-weight: 700; margin-top: 6px; }
/* Winner badge */
.win-badge { background: rgba(16,185,129,.13); border: 1px solid rgba(16,185,129,.28); border-radius: 12px; padding: 12px 22px; text-align: center; width: 100%; max-width: 520px; }
.win-v { font-size: 22px; font-weight: 900; color: #34d399; letter-spacing: -.02em; }
.win-s { font-size: 9px; color: rgba(52,211,153,.55); margin-top: 3px; }
/* Compare table */
.cmp { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 9px; overflow: hidden; margin-bottom: 10px; }
.cmp th { padding: 7px 10px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
.cmp td { padding: 5.5px 10px; font-size: 9.5px; border-bottom: 1px solid #f1f5f9; }
.cmp tr:last-child td { border-bottom: none; }
.cmp .sec-row td { background: #f8fafc; font-size: 8px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: .08em; padding: 4px 10px; border-top: 1px solid #e2e8f0; }
.win-cell { background: rgba(16,185,129,.06); font-weight: 700; color: #065f46; }
/* Projection */
.proj { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 9px; overflow: hidden; margin-bottom: 10px; }
.proj th { padding: 7px 10px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
.proj td { padding: 6px 10px; font-size: 10.5px; border-bottom: 1px solid #f1f5f9; }
.proj tr:last-child td { border-bottom: none; }
.proj .hl td { background: rgba(251,191,36,.07); }
/* Analysis */
.ab { background: white; border: 1px solid #e2e8f0; border-radius: 9px; padding: 13px 16px; margin-bottom: 10px; }
.ah { font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 7px; }
.ap { font-size: 9.5px; color: #374151; line-height: 1.62; margin-bottom: 8px; }
/* Contact */
.cb { background: #1e3a5f; border-radius: 11px; padding: 16px 22px; display: flex; gap: 20px; }
.cb-l { flex: 1; }
.cbn { font-size: 15px; font-weight: 900; color: white; margin-bottom: 3px; }
.cbt { font-size: 9.5px; color: rgba(255,255,255,.45); line-height: 1.5; margin-bottom: 10px; }
.cbi { font-size: 9.5px; color: rgba(255,255,255,.65); line-height: 1.9; }
.cbi strong { color: white; }
.cbcta { margin-top: 9px; display: inline-block; background: linear-gradient(135deg,#3b82f6,#2563eb); color: white; font-size: 9.5px; font-weight: 700; padding: 6px 14px; border-radius: 7px; }
.cboff { display: inline-block; background: rgba(16,185,129,.18); border: 1px solid rgba(16,185,129,.3); border-radius: 999px; padding: 3px 10px; font-size: 9.5px; font-weight: 700; color: #34d399; }
.cbnote { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 7px; padding: 7px 12px; font-size: 8.5px; color: rgba(255,255,255,.4); line-height: 1.6; text-align: right; margin-top: 8px; }
</style>
</head>
<body>
<div class="print-bar">
  <span class="print-bar-title">Comparaison — ${nameA} vs ${nameB}</span>
  <button class="pbtn pbtn-p" onclick="window.print()">⬇&nbsp; Télécharger en PDF</button>
  <button class="pbtn pbtn-s" onclick="window.close()">← Retour</button>
</div>
<div class="page-wrap">

<!-- PAGE 1 — COUVERTURE COMPARAISON -->
<div class="page cover">
  <div class="cv-logo">
    <div class="logo-badge">B</div>
    <div>
      <div style="font-size:14px;font-weight:800;color:white;line-height:1.2;">${cabinetNom}</div>
      <div style="font-size:9.5px;color:rgba(255,255,255,.32);">Cabinet d'expertise comptable &amp; conseil fiscal</div>
    </div>
  </div>

  <div class="cv-ctr">
    <div class="cv-ey"><div class="cv-dot"></div>Analyse comparative · Barème 2025</div>
    <div style="font-size:32px;font-weight:900;color:white;letter-spacing:-.02em;line-height:1.1;margin-bottom:6px;">
      Comparaison de vos<br><span class="cv-grad">scénarios</span>
    </div>
    <div class="cv-div"></div>
    ${clientName ? `<div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:12px;">${clientName}</div>` : ''}
    <div style="font-size:9.5px;color:rgba(255,255,255,.22);margin-bottom:20px;">Générée le ${genDate}</div>

    <!-- 2 sim cards -->
    <div class="sc-row">
      <div class="sc" style="background:${colorA}14;border:1px solid ${colorA}35;">
        <div class="sc-label" style="color:${colorA};">Scénario A${winnerIdx === 0 ? ' · ★ Favori' : ''}</div>
        <div class="sc-name">${nameA}</div>
        <div class="sc-forme">${bestA?.forme ?? '—'}</div>
        <div class="sc-net" style="color:${colorA};">${fmt(netA)}</div>
        <div class="sc-sub">${fmt(Math.round(netA / 12))}/mois</div>
        <div class="sc-score" style="color:${colorA};">Score ${bestA?.scoreTotal ?? '—'}/100</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;padding:0 6px;">
        <div style="font-size:20px;font-weight:900;color:rgba(255,255,255,.2);">vs</div>
      </div>
      <div class="sc" style="background:${colorB}14;border:1px solid ${colorB}35;">
        <div class="sc-label" style="color:${colorB};">Scénario B${winnerIdx === 1 ? ' · ★ Favori' : ''}</div>
        <div class="sc-name">${nameB}</div>
        <div class="sc-forme">${bestB?.forme ?? '—'}</div>
        <div class="sc-net" style="color:${colorB};">${fmt(netB)}</div>
        <div class="sc-sub">${fmt(Math.round(netB / 12))}/mois</div>
        <div class="sc-score" style="color:${colorB};">Score ${bestB?.scoreTotal ?? '—'}/100</div>
      </div>
    </div>

    <!-- Écart -->
    <div class="win-badge" style="margin-top:16px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(52,211,153,.55);margin-bottom:5px;">
        Avantage scénario ${winnerIdx === 0 ? 'A' : 'B'} · ${winnerIdx === 0 ? nameA : nameB}
      </div>
      <div class="win-v">+${fmt(absDiff)}/an</div>
      <div class="win-s">soit +${fmt(Math.round(absDiff / 12))}/mois · +${fmt(absDiff * 10)} sur 10 ans</div>
    </div>
  </div>

  <div class="cv-foot">
    <div class="cv-ft">
      <strong style="color:rgba(255,255,255,.45);">${cabinetNom}</strong> · Lyon &amp; Montluel<br>
      ${cabinetEmail} · belhoxper.fr<br>
      <span style="font-size:8px;color:rgba(255,255,255,.16);">Document confidentiel — simulation indicative non contractuelle</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
      <div class="pn" style="width:24px;height:24px;font-size:9px;">1/3</div>
      <div class="cv-ft">Barème fiscal 2025</div>
    </div>
  </div>
</div>

<!-- PAGE 2 — TABLEAU COMPARATIF DÉTAILLÉ -->
<div class="page">
  <div class="ph">
    <div class="ph-l">
      <div class="ph-logo">B</div>
      <div class="ph-brand">${cabinetNom}</div>
      <div class="ph-tag">Comparaison détaillée</div>
    </div>
    <div class="ph-r">${nameA} vs ${nameB} · ${genDate}</div>
  </div>

  <div class="pb">

    <!-- Bandeau recap -->
    <div style="display:flex;gap:10px;margin-bottom:14px;">
      <div style="flex:1;background:white;border:1px solid #e2e8f0;border-left:3px solid ${borderA};border-radius:8px;padding:10px 14px;">
        <div style="font-size:8px;font-weight:700;color:${colorA};text-transform:uppercase;letter-spacing:.09em;margin-bottom:3px;">Scénario A · ${nameA}</div>
        <div style="font-size:18px;font-weight:900;color:${colorA};line-height:1;">${fmt(netA)}</div>
        <div style="font-size:8.5px;color:#94a3b8;margin-top:2px;">${bestA?.forme ?? '—'} · Score ${bestA?.scoreTotal ?? '—'}/100</div>
      </div>
      <div style="display:flex;align-items:center;padding:0 4px;font-size:16px;font-weight:900;color:#cbd5e1;">vs</div>
      <div style="flex:1;background:white;border:1px solid #e2e8f0;border-left:3px solid ${borderB};border-radius:8px;padding:10px 14px;">
        <div style="font-size:8px;font-weight:700;color:${colorB};text-transform:uppercase;letter-spacing:.09em;margin-bottom:3px;">Scénario B · ${nameB}</div>
        <div style="font-size:18px;font-weight:900;color:${colorB};line-height:1;">${fmt(netB)}</div>
        <div style="font-size:8.5px;color:#94a3b8;margin-top:2px;">${bestB?.forme ?? '—'} · Score ${bestB?.scoreTotal ?? '—'}/100</div>
      </div>
      <div style="flex-shrink:0;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.18);border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:100px;">
        <div style="font-size:8px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Écart</div>
        <div style="font-size:17px;font-weight:900;color:#10b981;line-height:1;">+${fmt(absDiff)}</div>
        <div style="font-size:8px;color:rgba(16,185,129,.6);margin-top:2px;">en faveur de ${winnerIdx === 0 ? 'A' : 'B'}</div>
      </div>
    </div>

    <!-- Tableau -->
    <div class="sl" style="margin-bottom:7px;"><div class="sd"></div>Comparaison métrique par métrique</div>
    <table class="cmp">
      <thead><tr>
        <th style="width:34%;">Métrique</th>
        <th style="width:28%;">Scénario A — ${nameA}</th>
        <th style="width:28%;">Scénario B — ${nameB}</th>
        <th style="width:10%;text-align:center;">Favori</th>
      </tr></thead>
      <tbody>
        <tr class="sec-row"><td colspan="4">▸ Paramètres</td></tr>
        ${rows.slice(0, sectionBreak).map(r => `
        <tr>
          <td style="color:#475569;font-weight:600;">${r.label}</td>
          <td ${r.winA === true ? 'class="win-cell"' : ''}>${r.vA}</td>
          <td ${r.winA === false ? 'class="win-cell"' : ''}>${r.vB}</td>
          <td style="text-align:center;">${r.winA === null ? '' : r.winA ? `<span style="color:${colorA};font-weight:700;">A</span>` : `<span style="color:${colorB};font-weight:700;">B</span>`}</td>
        </tr>`).join('')}
        <tr class="sec-row"><td colspan="4">▸ Résultats &amp; Coûts</td></tr>
        ${rows.slice(sectionBreak).map(r => `
        <tr>
          <td style="color:#475569;font-weight:600;">${r.label}</td>
          <td ${r.winA === true ? 'class="win-cell"' : ''}>${r.vA}</td>
          <td ${r.winA === false ? 'class="win-cell"' : ''}>${r.vB}</td>
          <td style="text-align:center;">${r.winA === null ? '' : r.winA ? `<span style="color:${colorA};font-weight:700;">A</span>` : `<span style="color:${colorB};font-weight:700;">B</span>`}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="tn">* Barème IR 2025 · Cotisations SSI par composante · Valeur surlignée = meilleure performance</div>

    <!-- Projection -->
    <div style="margin-top:14px;">
      <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#f59e0b;"></div>Projection cumulative comparée</div>
      <table class="proj">
        <thead><tr>
          <th>Horizon</th>
          <th style="text-align:right;">Scénario A — ${nameA}</th>
          <th style="text-align:right;">Scénario B — ${nameB}</th>
          <th style="text-align:right;">Différence</th>
        </tr></thead>
        <tbody>
          ${HORIZONS.map(h => {
            const a = Math.round(netA * h.mult)
            const b = Math.round(netB * h.mult)
            const d = a - b
            const isHL = h.mult === 10
            return `
          <tr ${isHL ? 'class="hl"' : ''}>
            <td style="font-weight:${isHL ? '700' : '500'};color:${isHL ? '#f59e0b' : '#475569'};">${h.label}${isHL ? ' <span style="font-size:8px;background:rgba(251,191,36,.12);color:#f59e0b;border:1px solid rgba(251,191,36,.2);border-radius:5px;padding:1px 5px;">Long terme</span>' : ''}</td>
            <td style="text-align:right;font-weight:${isHL ? '800' : '600'};color:${colorA};font-size:${isHL ? '13px' : '10.5px'};">${fmt(a)}</td>
            <td style="text-align:right;font-weight:${isHL ? '700' : '500'};color:${isHL ? '#94a3b8' : '#475569'};font-size:${isHL ? '13px' : '10.5px'};">${fmt(b)}</td>
            <td style="text-align:right;font-weight:${isHL ? '800' : '700'};color:${d >= 0 ? '#10b981' : '#ef4444'};font-size:${isHL ? '13px' : '10.5px'};">${d >= 0 ? '+' : ''}${fmt(d)}</td>
          </tr>`
          }).join('')}
        </tbody>
      </table>
      <div class="tn">Projection linéaire indicative — hors revalorisation CA et évolution législative</div>
    </div>

  </div>
  <div class="pf">
    <div class="pf-t">${cabinetNom} · ${cabinetEmail} · belhoxper.fr</div>
    <div style="display:flex;align-items:center;gap:7px;">
      <div class="pf-t">Simulation indicative — barème fiscal 2025</div>
      <div class="pn">2/3</div>
    </div>
  </div>
</div>

<!-- PAGE 3 — ANALYSE + CONTACT -->
<div class="page">
  <div class="ph">
    <div class="ph-l">
      <div class="ph-logo">B</div>
      <div class="ph-brand">${cabinetNom}</div>
      <div class="ph-tag">Analyse &amp; recommandations</div>
    </div>
    <div class="ph-r">${nameA} vs ${nameB} · ${genDate}</div>
  </div>

  <div class="pb">

    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#8b5cf6;"></div>A — Analyse comparative</div>
    <div class="ab">
      <div class="ah">📊 Pourquoi le scénario ${winnerIdx === 0 ? 'A' : 'B'} (${winnerIdx === 0 ? nameA : nameB}) est plus avantageux</div>
      <p class="ap">${analyse.p1}</p>
      <p class="ap">${analyse.p2}</p>
      <p class="ap">${analyse.p3}</p>
    </div>

    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#f59e0b;"></div>B — Points clés par scénario</div>
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      <div style="flex:1;background:white;border:1px solid #e2e8f0;border-left:3px solid ${borderA};border-radius:9px;padding:12px 14px;">
        <div style="font-size:9px;font-weight:800;color:${colorA};text-transform:uppercase;letter-spacing:.09em;margin-bottom:6px;">Scénario A · ${nameA}</div>
        <div style="font-size:10px;color:#374151;line-height:1.6;">
          ✓ Net annuel : <strong>${fmt(netA)}</strong><br>
          ✓ Structure : <strong>${bestA?.forme ?? '—'}</strong><br>
          ✓ Score : <strong>${bestA?.scoreTotal ?? '—'}/100</strong><br>
          ✓ Cotisations : <strong>−${fmt(bestA?.charges ?? 0)}</strong><br>
          ✓ CA simulé : <strong>${fmt(caA)}</strong>
        </div>
      </div>
      <div style="flex:1;background:white;border:1px solid #e2e8f0;border-left:3px solid ${borderB};border-radius:9px;padding:12px 14px;">
        <div style="font-size:9px;font-weight:800;color:${colorB};text-transform:uppercase;letter-spacing:.09em;margin-bottom:6px;">Scénario B · ${nameB}</div>
        <div style="font-size:10px;color:#374151;line-height:1.6;">
          ✓ Net annuel : <strong>${fmt(netB)}</strong><br>
          ✓ Structure : <strong>${bestB?.forme ?? '—'}</strong><br>
          ✓ Score : <strong>${bestB?.scoreTotal ?? '—'}/100</strong><br>
          ✓ Cotisations : <strong>−${fmt(bestB?.charges ?? 0)}</strong><br>
          ✓ CA simulé : <strong>${fmt(caB)}</strong>
        </div>
      </div>
    </div>

    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#10b981;"></div>C — Votre cabinet d'expertise</div>
    <div class="cb">
      <div class="cb-l">
        <div class="cbn">${cabinetNom}</div>
        <div class="cbt">Nos experts vous accompagnent pour choisir le scénario optimal, le déployer et optimiser votre situation fiscale en continu.</div>
        <div class="cbi">📍 <strong>Lyon</strong> — 10 rue de la République, 69001</div>
        <div class="cbi">📍 <strong>Montluel</strong> — 12 place du Marché, 01120</div>
        <div class="cbi">✉ <strong>${cabinetEmail}</strong></div>
        <div class="cbi">🌐 <strong>belhoxper.fr</strong></div>
        <div class="cbcta">📅 Prenez RDV — rappel sous 24h</div>
      </div>
      <div style="flex-shrink:0;width:160px;display:flex;flex-direction:column;align-items:flex-end;gap:5px;padding-top:2px;">
        <div class="cboff">Consultation offerte</div>
        <div class="cbnote">
          © 2025 ${cabinetNom}<br>
          Généré le ${genDate}<br>
          Simulation indicative<br>
          non contractuelle<br>
          Barème fiscal 2025
        </div>
      </div>
    </div>

  </div>
  <div class="pf">
    <div class="pf-t">© 2025 ${cabinetNom} · Généré le ${genDate} · Simulation indicative non contractuelle · Barème fiscal 2025</div>
    <div class="pn">3/3</div>
  </div>
</div>

</div><!-- /page-wrap -->
</body>
</html>`
}

/* ─────────────────────────────────────────────────────────
   Route POST /api/simulations/compare/pdf
   Body : { simulationIds: [id1, id2] }
───────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: { simulationIds?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const ids = body.simulationIds || []
  if (ids.length < 2) return NextResponse.json({ error: 'Fournir exactement 2 IDs' }, { status: 400 })

  /* Récupérer les 2 simulations (sécurisé par user_id) */
  const { data: sims, error } = await supabase
    .from('simulations')
    .select('*')
    .in('id', ids.slice(0, 2))
    .eq('user_id', user.id)

  if (error || !sims || sims.length < 2) {
    return NextResponse.json({ error: 'Simulations introuvables ou accès non autorisé' }, { status: 404 })
  }

  /* Respecter l'ordre demandé */
  const simA = sims.find(s => s.id === ids[0]) || sims[0]
  const simB = sims.find(s => s.id === ids[1]) || sims[1]

  const clientName = (user.user_metadata?.full_name as string) || (user.email as string) || ''

  let cabinetNom = 'Belho Xper'
  let cabinetEmail = 'contact@belhoxper.fr'
  try {
    const { data: cab } = await supabase
      .from('cabinets').select('nom, email_contact').eq('slug', 'belho-xper').single()
    if (cab) { cabinetNom = cab.nom || cabinetNom; cabinetEmail = cab.email_contact || cabinetEmail }
  } catch { /* optionnel */ }

  const html = generateCompareHtml(
    simA as SimRecord, simB as SimRecord,
    cabinetNom, cabinetEmail, clientName,
  )

  /* Puppeteer → vrai PDF */
  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false,
    })
    await browser.close()

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comparaison-belhoxper-${Date.now()}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[compare/pdf] Puppeteer indisponible — fallback HTML:', err)
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
