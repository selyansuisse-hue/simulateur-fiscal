import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  type Scored,
  fmt, secteurLabel, situLabel,
  genLeviers,
} from '@/lib/pdf/utils'

/* ─── Color / type helpers ─── */
const STRUCT_COLOR: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6',
  'SAS / SASU':       '#8B5CF6',
  'EI (réel normal)': '#F59E0B',
  'Micro-entreprise': '#94a3b8',
}
const STRUCT_TYPE: Record<string, string> = {
  'EURL / SARL (IS)': 'TNS + dividendes — régime IS',
  'SAS / SASU':       'Salaire assimilé + dividendes',
  'EI (réel normal)': 'IR/BNC, cotis. SSI sur résultat',
  'Micro-entreprise': 'Abattement forfaitaire',
}
const sc   = (f: string) => STRUCT_COLOR[f] ?? '#64748b'
const pctN = (val: number, total: number) => (total > 0 ? Math.round((val / total) * 100) : 0)
const pct1 = (val: number, total: number) => (total > 0 ? ((val / total) * 100).toFixed(1) : '0')

/* ─── Sub-scores estimation (NET/60 FLEX/20 PROT/12 ADMIN/8) ─── */
function subScores(r: Scored) {
  const f = r.forme
  const flexS  = f.includes('SAS') ? 18 : f.includes('EURL') ? 17 : f.includes('EI') ? 13 : 1
  const protS  = f.includes('SAS') ? 12 : f.includes('EURL') ? 11 : f.includes('EI') ?  9 : 2
  const adminS = f.includes('Micro') ? 2 : f.includes('EI') ? 6  : f.includes('SAS') ? 8 : 7
  const netS   = Math.max(0, Math.min(60, r.scoreTotal - flexS - protS - adminS))
  return [
    { label: 'Net',   val: netS,   max: 60, pct: Math.round(netS   / 60 * 100), color: '#3B82F6' },
    { label: 'Flex',  val: flexS,  max: 20, pct: Math.round(flexS  / 20 * 100), color: '#8B5CF6' },
    { label: 'Prot',  val: protS,  max: 12, pct: Math.round(protS  / 12 * 100), color: '#10B981' },
    { label: 'Admin', val: adminS, max:  8, pct: Math.round(adminS /  8 * 100), color: '#F59E0B' },
  ]
}

/* ─── Dynamic text ─── */
function getPourquoiPasAlt(best: Scored, scored: Scored[]): string {
  const f = best.forme
  if (f.includes('EURL') || f.includes('EI')) {
    const sasR = scored.find(r => r.forme.includes('SAS'))
    const diff = sasR ? Math.abs(sasR.charges - best.charges) : 0
    return `<strong>Pourquoi pas SAS/SASU ?</strong> La SAS offre une meilleure protection sociale (régime général) mais génère ${fmt(diff)} de charges supplémentaires/an. Sauf priorité protection sociale absolue, cela réduit inutilement le revenu disponible.`
  }
  if (f.includes('SAS')) {
    const eurlR = scored.find(r => r.forme.includes('EURL'))
    const diff  = eurlR ? Math.abs(best.charges - eurlR.charges) : 0
    return `<strong>Pourquoi pas EURL ?</strong> L'EURL présente des cotisations TNS inférieures (−${fmt(diff)}/an) mais la couverture du régime général (retraite, prévoyance, maladie) justifie le surcoût selon ce profil.`
  }
  return `<strong>Structure optimale.</strong> Le régime choisi est mathématiquement le plus avantageux au regard de votre CA et de votre foyer fiscal.`
}

/* ─── Protection sociale dotmeters ─── */
const PROT_SOCIAL: Record<string, { maladie: number; retraite: number; prevoyance: number; desc: string }> = {
  'EURL / SARL (IS)': { maladie: 3, retraite: 4, prevoyance: 2, desc: 'Régime TNS · couverture standard, complément mutuelle conseillé.' },
  'SAS / SASU':       { maladie: 4, retraite: 5, prevoyance: 4, desc: 'Assimilé-salarié · meilleure protection maladie / retraite de base.' },
  'EI (réel normal)': { maladie: 3, retraite: 3, prevoyance: 1, desc: 'TNS sans séparation patrimoine · risque personnel.' },
  'Micro-entreprise': { maladie: 1, retraite: 1, prevoyance: 0, desc: 'Protection minimale · à éviter pour activité principale.' },
}

function dotMeter(color: string, filled: number): string {
  let out = '<div class="dotmeter">'
  for (let i = 0; i < 5; i++) {
    out += filled > i
      ? `<span style="background:${color};box-shadow:0 0 6px ${color}99;"></span>`
      : `<span></span>`
  }
  return out + '</div>'
}

/* ─────────────────────────────────────────────────────────
   generateHtml — 8 pages A4 dark
───────────────────────────────────────────────────────── */
function generateHtml(
  sim: Record<string, unknown>,
  cabinetNom   = 'Belho Xper',
  cabinetEmail = 'contact@belho-xper.fr',
  clientName   = '',
): string {

  /* ── Data extraction ── */
  let scored: Scored[] = []
  const raw = sim.results
  if (Array.isArray(raw))
    scored = raw as Scored[]
  else if (raw && typeof raw === 'object' && 'scored' in (raw as object))
    scored = ((raw as { scored: Scored[] }).scored) || []

  const best  = scored[0]
  const worst = scored[scored.length - 1]
  const p     = (sim.params as Record<string, unknown>) || {}

  const tmi        = (sim.tmi  as number) || 0
  const gain       = (sim.gain as number) || 0
  const ca         = (sim.ca   as number) || (p.ca as number) || 0
  const caSafe     = Math.max(ca, 1)
  const perMontant = (sim.per_montant as number) || 0
  const simParts   = (sim.parts as number) || (p.parts as number) || 1
  const partsBase  = (p.partsBase as number) || 1

  const simName = (sim.name as string) || 'Simulation'
  const simId   = (sim.id   as string) || ''
  const simRef  = simId ? `SIM-${simId.substring(0, 8).toUpperCase()}` : 'SIM-2026'
  const genDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sectLabel  = secteurLabel[(p.secteur as string)] || (p.secteur as string) || 'Activité'
  const prioriteV  = (p.priorite as string) || 'équilibre'
  const situFam    = partsBase >= 2 ? 'Marié(e) / Pacsé(e)' : 'Célibataire'

  /* Best-structure metrics */
  const bestForme  = best?.forme      ?? '—'
  const bestColor  = sc(bestForme)
  const bestNet    = best?.netAnnuel  ?? 0
  const bestMois   = Math.round(bestNet / 12)
  const bestIR     = best?.ir         ?? 0
  const bestIS     = best?.is         ?? 0
  const bestCotis  = best?.charges    ?? 0
  const bestScore  = best?.scoreTotal ?? 0
  const tauxEff    = pctN(bestCotis + bestIR + bestIS, caSafe)

  const tmiLabel   = tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Intermédiaire' : tmi <= 41 ? 'Tranche haute' : 'Tranche max'

  /* Leviers */
  const leviers      = best ? genLeviers(best, p, tmi, ca) : []
  const leviersStep3 = leviers.length > 0
    ? leviers.slice(0, 3).map(l => l.levier).join(', ') + `. <strong style="color:#6ee7b7">Détaillé en rendez-vous.</strong>`
    : `Optimisation fiscale via les déductions disponibles selon votre profil.`

  /* Rings dasharray */
  const ring60   = 376.99  // 2π×60
  const ring68   = 427.26  // 2π×68
  const dash60   = (bestScore / 100 * ring60).toFixed(1)
  const dash68   = (bestScore / 100 * ring68).toFixed(1)

  /* Waterfall bar heights */
  const wfCotH = Math.max(5,  pctN(bestCotis, caSafe))
  const wfISH  = Math.max(3,  pctN(bestIS,    caSafe))
  const wfIRH  = Math.max(3,  pctN(bestIR,    caSafe))
  const wfNetH = Math.max(10, pctN(bestNet,   caSafe))

  /* Decoposiion table mid-values */
  const avantIS    = Math.max(0, ca - bestCotis)
  const remunBrut  = Math.max(0, bestNet + bestIR)

  /* Insight page 3 */
  const pourquoiAlt = best ? getPourquoiPasAlt(best, scored) : ''

  /* Micro inéligible */
  const microInelig = ca > 77700

  /* ── Dynamic: comparison table rows (page 2) ── */
  const tableRows = scored.map((r, i) => {
    const color  = sc(r.forme)
    const diff   = r.netAnnuel - bestNet
    const diffStr   = i === 0 ? 'référence' : `−${fmt(Math.abs(diff))}`
    const diffColor = i === 0 ? '#10B981'   : '#f87171'
    return `
          <tr>
            <td class="label"><span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:${color};margin-right:8px;vertical-align:middle;"></span><strong style="color:${color}">${r.forme}</strong>${i === 0 ? ' <span style="color:#64748b;font-size:10px;">· #1 reco</span>' : ''}</td>
            <td class="num" style="color:${i === 0 ? '#f8fafc' : 'inherit'};font-weight:${i === 0 ? 700 : 400};">${fmt(r.netAnnuel)}</td>
            <td class="num">${fmt(Math.round(r.netAnnuel / 12))}</td>
            <td class="num" style="color:${color};">${r.scoreTotal}/100</td>
            <td class="num" style="color:${diffColor};">${diffStr}</td>
          </tr>`
  }).join('')

  /* ── Dynamic: compare cards (page 4) ── */
  const rankLabels = ['★ Reco', '2ᵉ choix', '3ᵉ choix', '4ᵉ choix']
  const compCards  = scored.map((r, i) => {
    const color  = sc(r.forme)
    const sub    = subScores(r)
    const diff   = r.netAnnuel - bestNet
    const worstDiff = Math.abs((worst?.netAnnuel ?? 0) - bestNet)
    const diffBadge = i === 0
      ? `+${fmt(worstDiff)}/an vs pire`
      : `−${fmt(Math.abs(diff))}/an vs reco`
    const diffStyle = i === 0
      ? 'background:rgba(16,185,129,0.10);border:1px solid rgba(16,185,129,0.30);color:#6ee7b7'
      : 'background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.25);color:#fca5a5'
    const cout    = r.charges + r.ir + r.is
    const coutPct = pctN(cout, caSafe)
    return `
      <div class="card" style="padding:0;${i === 0 ? 'border-color:rgba(59,130,246,0.45);box-shadow:0 0 0 1px rgba(59,130,246,0.20);' : ''}">
        <div style="height:3px;background:${color};"></div>
        <div style="padding:12px 12px 0 12px;display:flex;justify-content:space-between;align-items:center;">
          <span class="pill ${i === 0 ? 'blue' : 'slate'}" style="padding:3px 7px;font-size:9px;">${rankLabels[i] ?? `${i + 1}ᵉ`}</span>
          <span class="mono" style="font-size:10px;color:${color};background:${color}1a;padding:2px 6px;border-radius:5px;border:1px solid ${color}4d;">${r.scoreTotal}/100</span>
        </div>
        <div style="padding:8px 12px;">
          <div style="display:flex;align-items:center;gap:6px;"><span style="width:5px;height:5px;border-radius:99px;background:${color};"></span><span style="font-size:12.5px;font-weight:800;color:${color};">${r.forme}</span></div>
          <p style="font-size:10px;color:#64748b;margin-top:4px;line-height:1.45;min-height:26px;">${STRUCT_TYPE[r.forme] ?? '—'}</p>
        </div>
        <div style="border-top:1px solid rgba(30,41,59,0.7);padding:10px 12px;">
          <div class="label-xs">Net après impôts</div>
          <div class="mono" style="font-size:22px;font-weight:900;color:#f8fafc;margin-top:4px;">${fmt(r.netAnnuel)}</div>
          <div class="mono" style="font-size:10px;color:#64748b;margin-top:2px;">${fmt(Math.round(r.netAnnuel / 12))}/mois</div>
          <div style="margin-top:8px;display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border-radius:5px;font:600 9.5px 'JetBrains Mono',monospace;${diffStyle};">${diffBadge}</div>
        </div>
        <div style="border-top:1px solid rgba(30,41,59,0.7);padding:10px 12px;font-size:10.5px;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Cotis.</span><span class="mono" style="color:#fca5a5;">−${fmt(r.charges)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">IR</span><span class="mono" style="color:#fca5a5;">−${fmt(r.ir)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">IS</span><span class="mono" style="color:${r.is > 0 ? '#fca5a5' : '#475569'};">${r.is > 0 ? `−${fmt(r.is)}` : '—'}</span></div>
          <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid rgba(30,41,59,0.7);font-weight:800;"><span style="color:#f1f5f9;">Coût</span><span class="mono" style="color:#f1f5f9;">−${fmt(cout)}</span></div>
          <div style="font-size:9.5px;color:#64748b;">${coutPct}% du CA</div>
        </div>
        <div style="border-top:1px solid rgba(30,41,59,0.7);padding:10px 12px;display:flex;flex-direction:column;gap:6px;">
          ${sub.map(s => `<div><div style="display:flex;justify-content:space-between;font-size:10px;"><span class="label-xs">${s.label}</span><span class="mono" style="color:${color};">${s.val}/${s.max}</span></div><div class="barwrap" style="margin-top:4px;height:4px;"><div class="barfill" style="width:${s.pct}%;background:${color};"></div></div></div>`).join('')}
        </div>
      </div>`
  }).join('\n')

  /* ── Dynamic: score detail rows (page 5) ── */
  const scoreRows = scored.map(r => {
    const color = sc(r.forme)
    const sub   = subScores(r)
    return `
        <div style="padding:12px 18px;display:grid;grid-template-columns:130px 1fr 60px;gap:14px;align-items:center;border-bottom:1px solid rgba(30,41,59,0.5);">
          <div style="display:flex;align-items:center;gap:8px;"><span style="width:6px;height:6px;border-radius:99px;background:${color};"></span><span style="font-size:12px;font-weight:700;color:${color};">${r.forme}</span></div>
          <div style="display:grid;grid-template-columns:3fr 1fr 1fr 1fr;gap:8px;">
            ${sub.map(s => `<div><div style="display:flex;justify-content:space-between;font-size:10px;"><span class="label-xs">${s.label}</span><span class="mono" style="color:${color};">${s.val}${s.label === 'Net' ? '/60' : ''}</span></div><div class="barwrap" style="margin-top:3px;"><div class="barfill" style="width:${s.pct}%;background:${color};"></div></div></div>`).join('')}
          </div>
          <div class="mono" style="text-align:right;font-size:18px;font-weight:800;color:${color};">${r.scoreTotal}</div>
        </div>`
  }).join('')

  /* ── Dynamic: protection sociale cards (page 7) ── */
  const protCards = scored.map(r => {
    const color = sc(r.forme)
    const pd    = PROT_SOCIAL[r.forme] ?? { maladie: 2, retraite: 2, prevoyance: 2, desc: '—' }
    return `
      <div class="card tight" style="border-color:${color}66;border-top-width:2px;">
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:6px;height:6px;border-radius:99px;background:${color};"></span><span style="font-size:12px;font-weight:800;color:${color};">${r.forme}</span></div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;"><span class="label-xs">Maladie</span>${dotMeter(color, pd.maladie)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;"><span class="label-xs">Retraite</span>${dotMeter(color, pd.retraite)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;"><span class="label-xs">Prévoyance</span>${dotMeter(color, pd.prevoyance)}</div>
        </div>
        <p style="font-size:10px;color:#94a3b8;margin-top:14px;padding-top:10px;border-top:1px solid rgba(30,41,59,0.7);line-height:1.55;">${pd.desc}</p>
      </div>`
  }).join('\n')

  /* ── Best sub-scores for page 3 ── */
  const bSub = best ? subScores(best) : [
    { label: 'Net', val: 0, max: 60, pct: 0, color: '#3B82F6' },
    { label: 'Flex', val: 0, max: 20, pct: 0, color: '#8B5CF6' },
    { label: 'Prot', val: 0, max: 12, pct: 0, color: '#10B981' },
    { label: 'Admin', val: 0, max: 8, pct: 0, color: '#F59E0B' },
  ]
  const [bNet, bFlex, bProt] = bSub

  /* ─────────────────────────────────────────────
     BUILD HTML
  ───────────────────────────────────────────── */
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rapport — ${simName} — ${cabinetNom}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  /* ---------- Reset ---------- */
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #0b1220;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #e2e8f0;
    padding: 24px 0;
  }
  .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
  .tabular { font-variant-numeric: tabular-nums; }

  /* ---------- A4 page ---------- */
  .page {
    width: 794px;
    min-height: 1123px;
    margin: 0 auto 24px auto;
    background: #020617;
    color: #e2e8f0;
    position: relative;
    overflow: hidden;
    box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
  }
  .page-body { flex: 1; padding: 56px 56px 28px 56px; display: flex; flex-direction: column; gap: 20px; }
  .page-cover { padding: 0; }

  /* ---------- Header / Footer ---------- */
  .pg-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 56px;
    border-bottom: 1px solid rgba(51,65,85,0.5);
    background: rgba(15,23,42,0.55);
    font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; font-weight: 600;
  }
  .pg-header .brand { display: flex; align-items: center; gap: 8px; }
  .pg-header .logo {
    width: 22px; height: 22px; border-radius: 6px;
    background: linear-gradient(135deg, #3B82F6, #8B5CF6);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 18px -6px rgba(59,130,246,0.6);
  }
  .pg-header .logo svg { width: 12px; height: 12px; color: white; }
  .pg-header .brand-name { color: #e2e8f0; font-weight: 700; letter-spacing: 0.04em; text-transform: none; font-size: 13px; }
  .pg-header .meta { display: flex; gap: 16px; align-items: center; }
  .pg-header .dot { width: 3px; height: 3px; border-radius: 99px; background: #475569; }

  .pg-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 56px;
    border-top: 1px solid rgba(51,65,85,0.5);
    color: #475569;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .pg-footer .right { font-family: 'JetBrains Mono', monospace; }

  /* ---------- Type ---------- */
  h1, h2, h3, h4 { margin: 0; color: #f1f5f9; letter-spacing: -0.01em; }
  p { margin: 0; }

  .eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
    font-weight: 700; color: #93c5fd;
  }
  .eyebrow .bar { display: block; width: 18px; height: 1px; background: rgba(147,197,253,0.6); }
  .eyebrow.violet { color: #c4b5fd; } .eyebrow.violet .bar { background: rgba(196,181,253,0.6); }
  .eyebrow.amber { color: #fcd34d; } .eyebrow.amber .bar { background: rgba(252,211,77,0.6); }
  .eyebrow.emerald { color: #6ee7b7; } .eyebrow.emerald .bar { background: rgba(110,231,183,0.6); }

  .section-title { font-size: 24px; font-weight: 800; color: #f8fafc; line-height: 1.15; letter-spacing: -0.02em; }
  .section-sub { font-size: 12.5px; color: #94a3b8; line-height: 1.55; max-width: 580px; }

  /* ---------- Cards ---------- */
  .card {
    background: #0f172a;
    border: 1px solid rgba(51,65,85,0.55);
    border-radius: 14px;
    padding: 16px;
    position: relative;
  }
  .card.tight { padding: 14px; }
  .card.lg { padding: 20px; }
  .card-accent {
    position: absolute; left: 0; right: 0; top: 0; height: 2px; border-radius: 14px 14px 0 0;
  }

  /* color helpers */
  .c-blue { color: #3B82F6; } .c-violet { color: #8B5CF6; } .c-amber { color: #F59E0B; } .c-slate { color: #94a3b8; }
  .c-emerald { color: #10B981; } .c-rose { color: #f87171; }

  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  }
  .pill.blue { background: rgba(59,130,246,0.14); color: #93c5fd; border: 1px solid rgba(59,130,246,0.35); }
  .pill.violet { background: rgba(139,92,246,0.14); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.35); }
  .pill.amber { background: rgba(245,158,11,0.14); color: #fcd34d; border: 1px solid rgba(245,158,11,0.35); }
  .pill.emerald { background: rgba(16,185,129,0.14); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.35); }
  .pill.slate { background: rgba(148,163,184,0.10); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.30); }

  /* ---------- Numbers ---------- */
  .figure-xxl { font-size: 56px; font-weight: 900; letter-spacing: -0.035em; line-height: 1; color: #f8fafc; }
  .figure-xl  { font-size: 36px; font-weight: 800; letter-spacing: -0.025em; line-height: 1; color: #f8fafc; }
  .figure-lg  { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; color: #f8fafc; }
  .figure-md  { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; line-height: 1; color: #f8fafc; }
  .label-xs   { font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; font-weight: 700; }

  /* ---------- Bar / Ring ---------- */
  .barwrap { width: 100%; height: 6px; background: #1e293b; border-radius: 99px; overflow: hidden; }
  .barfill { height: 100%; border-radius: 99px; }

  /* ---------- Utility flex/grid ---------- */
  .row { display: flex; gap: 12px; }
  .row.between { justify-content: space-between; align-items: center; }
  .row.center { align-items: center; }
  .col { display: flex; flex-direction: column; gap: 12px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }

  /* ---------- Cover specifics ---------- */
  .cover {
    background:
      radial-gradient(1100px 500px at 80% -10%, rgba(139,92,246,0.22), transparent 60%),
      radial-gradient(900px 480px at 0% 0%, rgba(59,130,246,0.18), transparent 60%),
      radial-gradient(700px 400px at 50% 110%, rgba(245,158,11,0.10), transparent 60%),
      #020617;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 56px;
    position: relative;
  }
  .cover-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent 80%);
    pointer-events: none;
  }

  /* ---------- Print ---------- */
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #020617; padding: 0; }
    .page { box-shadow: none; margin: 0 auto; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .toolbar { display: none !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }

  /* ---------- Toolbar (screen only) ---------- */
  .toolbar {
    position: fixed; top: 14px; right: 14px; z-index: 50;
    display: flex; gap: 8px;
    background: rgba(15,23,42,0.85); backdrop-filter: blur(8px);
    border: 1px solid rgba(51,65,85,0.6); border-radius: 12px; padding: 8px;
    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
  }
  .toolbar button {
    display: inline-flex; align-items: center; gap: 6px;
    background: #1e293b; border: 1px solid rgba(51,65,85,0.6); color: #cbd5e1;
    padding: 7px 12px; border-radius: 8px; font: 600 12px Inter, sans-serif; cursor: pointer;
    transition: all .2s;
  }
  .toolbar button:hover { background: #334155; color: white; border-color: rgba(59,130,246,0.5); }
  .toolbar button.primary { background: #3B82F6; color: white; border-color: #3B82F6; }
  .toolbar button.primary:hover { background: #2563eb; }

  /* ---------- Score ring (SVG) ---------- */
  .ring { transform: rotate(-90deg); }

  /* ---------- Dot meter ---------- */
  .dotmeter { display: flex; gap: 4px; }
  .dotmeter span { width: 7px; height: 7px; border-radius: 99px; background: rgba(71,85,105,0.5); display: inline-block; }

  /* ---------- Insight box ---------- */
  .insight {
    border-radius: 10px; padding: 12px 14px;
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 11.5px; line-height: 1.55;
  }
  .insight.blue { background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.25); color: #cbd5e1; }
  .insight.violet { background: rgba(139,92,246,0.06); border: 1px solid rgba(139,92,246,0.25); color: #cbd5e1; }
  .insight.amber { background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.25); color: #cbd5e1; }
  .insight.emerald { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.25); color: #cbd5e1; }
  .insight .ico {
    flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
  }
  .insight.blue .ico { background: rgba(59,130,246,0.15); color: #93c5fd; border: 1px solid rgba(59,130,246,0.30); }
  .insight.violet .ico { background: rgba(139,92,246,0.15); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.30); }
  .insight.amber .ico { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.30); }
  .insight.emerald .ico { background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.30); }
  .insight .ico svg { width: 14px; height: 14px; }
  .insight strong { color: #f1f5f9; }

  /* ---------- Tables ---------- */
  table.dt { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.dt th, table.dt td { padding: 10px 12px; text-align: left; }
  table.dt th { font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; font-weight: 700; border-bottom: 1px solid rgba(51,65,85,0.6); }
  table.dt tr td { border-bottom: 1px solid rgba(30,41,59,0.7); }
  table.dt tr:last-child td { border-bottom: 0; }
  table.dt td.num { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  table.dt td.label { color: #cbd5e1; }
  table.dt td.hint { font-size: 10px; color: #64748b; }
  table.dt tr.total td { border-top: 1px solid rgba(51,65,85,0.6); padding-top: 12px; font-weight: 800; color: #f8fafc; }

  /* ---------- Step list ---------- */
  .steps { display: flex; flex-direction: column; gap: 10px; }
  .step {
    display: flex; gap: 12px; padding: 12px 14px;
    background: rgba(15,23,42,0.6); border: 1px solid rgba(51,65,85,0.45);
    border-radius: 10px;
  }
  .step .num {
    flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px;
    background: rgba(59,130,246,0.14); color: #93c5fd; border: 1px solid rgba(59,130,246,0.35);
    display: flex; align-items: center; justify-content: center; font: 700 12px 'JetBrains Mono', monospace;
  }
  .step h4 { font-size: 13px; font-weight: 700; color: #f1f5f9; margin-bottom: 3px; }
  .step p { font-size: 11.5px; color: #94a3b8; line-height: 1.55; }

  /* ---------- Page accents (corner glow) ---------- */
  .page-accent-tl, .page-accent-br { position: absolute; pointer-events: none; }
  .page-accent-tl { top: -120px; left: -120px; width: 380px; height: 380px;
    background: radial-gradient(circle, rgba(59,130,246,0.18), transparent 60%); }
  .page-accent-br { bottom: -120px; right: -120px; width: 380px; height: 380px;
    background: radial-gradient(circle, rgba(139,92,246,0.16), transparent 60%); }
</style>
</head>
<body>

<!-- Toolbar -->
<div class="toolbar">
  <button onclick="window.print()" class="primary">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    Imprimer / PDF
  </button>
</div>

<!-- ============================================================ -->
<!-- PAGE 1 — COVER                                                -->
<!-- ============================================================ -->
<section class="page" data-screen-label="01 Couverture">
  <div class="cover">
    <div class="cover-grid"></div>

    <!-- top brand -->
    <div style="display:flex; justify-content: space-between; align-items: center; position: relative;">
      <div style="display:flex; align-items:center; gap: 10px;">
        <div style="width:34px; height:34px; border-radius:9px; background: linear-gradient(135deg,#3B82F6,#8B5CF6); display:flex; align-items:center; justify-content:center; box-shadow: 0 10px 30px -10px rgba(59,130,246,0.6);">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>
        </div>
        <div>
          <div style="font-weight:800; color:#f1f5f9; letter-spacing:-0.01em; font-size:16px;">${cabinetNom}</div>
          <div style="font-size:10px; color:#64748b; letter-spacing:0.18em; text-transform:uppercase; margin-top:2px;">Simulateur fiscal · Dirigeants</div>
        </div>
      </div>
      <div style="text-align:right; font-size:10px; color:#64748b; letter-spacing:0.16em; text-transform:uppercase; font-weight:600;">
        Réf. simulation<br>
        <span class="mono" style="color:#94a3b8; letter-spacing:0.04em; text-transform:none; font-size:11px;">${simRef}</span>
      </div>
    </div>

    <!-- main title -->
    <div style="margin-top: 90px; position: relative;">
      <div class="eyebrow"><span class="bar"></span>Rapport personnalisé · Édition 2026<span class="bar"></span></div>
      <h1 style="font-size: 60px; line-height: 1.02; font-weight: 900; letter-spacing: -0.035em; margin-top: 22px; max-width: 620px;">
        Optimisation de votre<br>
        rémunération<br>
        <span style="background: linear-gradient(90deg, #60a5fa, #a78bfa); -webkit-background-clip: text; background-clip: text; color: transparent;">de dirigeant.</span>
      </h1>
      <p style="margin-top: 24px; font-size: 16px; color: #94a3b8; line-height: 1.55; max-width: 560px;">
        Comparaison des ${scored.length || 4} structures juridiques applicables à votre activité, calculs aux barèmes 2026, et plan d'optimisation chiffré.
      </p>
    </div>

    <!-- key figures -->
    <div style="margin-top: 70px; display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 14px; position: relative;">
      <div class="card lg" style="background: linear-gradient(135deg, rgba(59,130,246,0.10), rgba(139,92,246,0.06)); border-color: rgba(59,130,246,0.30);">
        <div class="card-accent" style="background: linear-gradient(90deg, transparent, ${bestColor}, transparent);"></div>
        <div class="label-xs">Structure recommandée</div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
          <span style="width:8px; height:8px; border-radius:99px; background:${bestColor}; box-shadow:0 0 10px ${bestColor};"></span>
          <span style="font-size: 18px; font-weight: 800; color:${bestColor};">${bestForme}</span>
        </div>
        <div class="figure-xl" style="margin-top: 14px; color: #f8fafc;">${fmt(bestNet)}</div>
        <div class="mono" style="color:#94a3b8; font-size: 11.5px; margin-top: 6px;">net après tout · ${fmt(bestMois)}/mois</div>
      </div>

      <div class="card lg" style="border-color: rgba(16,185,129,0.30); background: linear-gradient(180deg, rgba(16,185,129,0.06), transparent 70%);">
        <div class="card-accent" style="background: linear-gradient(90deg, transparent, #10B981, transparent);"></div>
        <div class="label-xs" style="color:#10B981;">Gain identifié</div>
        <div class="figure-xl" style="margin-top: 14px; color: #6ee7b7;">+${fmt(gain)}</div>
        <div class="mono" style="color:#94a3b8; font-size: 11.5px; margin-top: 6px;">/an vs structure la moins<br>avantageuse</div>
      </div>

      <div class="card lg">
        <div class="card-accent" style="background: linear-gradient(90deg, transparent, #8B5CF6, transparent);"></div>
        <div class="label-xs">Score d'optimisation</div>
        <div class="figure-xl" style="margin-top: 14px;">${bestScore}<span style="font-size:18px; color:#475569;">&nbsp;/&nbsp;100</span></div>
        <div class="mono" style="color:#94a3b8; font-size: 11.5px; margin-top: 6px;">profil « ${prioriteV} »<br>4 axes pondérés</div>
      </div>
    </div>

    <!-- spacer -->
    <div style="flex:1"></div>

    <!-- client info -->
    <div style="position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
      <div class="card">
        <div class="label-xs">Préparé pour</div>
        <div style="font-size: 18px; font-weight: 700; color: #f1f5f9; margin-top: 8px;">${clientName || 'Dirigeant(e)'}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${sectLabel} · CA simulé <span class="mono" style="color:#cbd5e1">${fmt(ca)}</span></div>
      </div>
      <div class="card">
        <div class="label-xs">Hypothèses retenues</div>
        <div style="display:flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;">
          <span class="pill slate">CA ${fmt(ca)}</span>
          <span class="pill slate">${situFam}</span>
          <span class="pill slate">${simParts} part${simParts > 1 ? 's' : ''}</span>
          ${perMontant > 0 ? `<span class="pill slate">PER ${fmt(perMontant)}</span>` : ''}
        </div>
      </div>
    </div>

    <!-- bottom bar -->
    <div style="margin-top: 28px; display: flex; justify-content: space-between; align-items: center; padding-top: 18px; border-top: 1px solid rgba(51,65,85,0.5); font-size: 10px; color: #64748b; letter-spacing: 0.06em;">
      <div>Document confidentiel · Diffusion réservée au destinataire</div>
      <div class="mono" style="color:#94a3b8; letter-spacing: 0; font-size: 11px;">Édité le ${genDate}</div>
    </div>
  </div>
</section>

<!-- ============================================================ -->
<!-- PAGE 2 — SYNTHÈSE EXÉCUTIVE                                   -->
<!-- ============================================================ -->
<section class="page" data-screen-label="02 Synthèse">
  <div class="page-accent-tl"></div>
  <header class="pg-header">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div>
      <span class="brand-name">${cabinetNom}</span>
    </div>
    <div class="meta"><span>Rapport · CA ${fmt(ca)}</span><span class="dot"></span><span>${simRef}</span></div>
  </header>

  <div class="page-body">
    <div>
      <div class="eyebrow"><span class="bar"></span>Synthèse exécutive</div>
      <h2 class="section-title" style="margin-top:10px; font-size:30px;">Ce que vous devez retenir<br>en une page.</h2>
      <p class="section-sub" style="margin-top:10px;">Vue d'ensemble du résultat et des leviers d'optimisation. Le détail chiffré commence page&nbsp;3.</p>
    </div>

    <!-- Big result block -->
    <div class="card lg" style="background: radial-gradient(700px 280px at 80% 0%, rgba(59,130,246,0.18), transparent 70%), linear-gradient(180deg, #0f172a, #0b1426); border-color: rgba(59,130,246,0.30); padding: 22px 24px;">
      <div class="card-accent" style="background: linear-gradient(90deg, transparent, ${bestColor}, transparent);"></div>
      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap: 24px; align-items: center;">
        <div>
          <span class="pill blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/></svg> Recommandation #1</span>
          <div style="display:flex; align-items:baseline; gap:10px; margin-top:14px;">
            <span style="font-size:20px; font-weight:800; color:${bestColor};">${bestForme}</span>
            <span style="font-size:11px; color:#64748b;">— rang #1 sur ${scored.length}</span>
          </div>
          <div class="label-xs" style="margin-top:14px;">Revenu net après tout</div>
          <div class="figure-xxl" style="margin-top:8px;">${fmt(bestNet)}</div>
          <div class="mono" style="color:#94a3b8; font-size:12px; margin-top:8px;">${fmt(bestMois)}/mois · après IR, cotisations &amp; IS</div>
          <div style="margin-top:14px; display:inline-flex; align-items:center; gap:10px; padding: 8px 12px; border-radius: 10px; background: rgba(16,185,129,0.10); border: 1px solid rgba(16,185,129,0.30);">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
            <div>
              <div class="mono" style="color:#6ee7b7; font-weight:700; font-size:14px;">+${fmt(gain)}/an</div>
              <div style="color:#10B981; font-size:9.5px; letter-spacing:0.18em; text-transform:uppercase; font-weight:700; margin-top:2px;">vs structure la moins avantageuse</div>
            </div>
          </div>
        </div>

        <!-- Score donut -->
        <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
          <div style="position:relative; width:140px; height:140px;">
            <svg width="140" height="140" class="ring">
              <circle cx="70" cy="70" r="60" stroke="rgba(51,65,85,0.5)" stroke-width="10" fill="none"/>
              <circle cx="70" cy="70" r="60" stroke="${bestColor}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${dash60} ${ring60}" style="filter: drop-shadow(0 0 6px ${bestColor}80);"/>
            </svg>
            <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <div style="font-size:36px; font-weight:900; color:${bestColor}; line-height:1;">${bestScore}</div>
              <div class="label-xs" style="margin-top:6px;">/ 100</div>
            </div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px; font-weight:700; color:#f1f5f9;">Score d'optimisation</div>
            <div style="font-size:10px; color:#64748b; margin-top:3px;">Profil « ${prioriteV} »</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4 KPIs -->
    <div class="grid-4">
      <div class="card tight">
        <div class="label-xs">CA simulé</div>
        <div class="figure-md" style="margin-top:8px;">${fmt(ca)}</div>
        <div style="font-size:10px; color:#64748b; margin-top:6px;">Hypothèse barème 2026</div>
      </div>
      <div class="card tight">
        <div class="label-xs">TMI</div>
        <div class="figure-md" style="margin-top:8px;">${tmi}&nbsp;%</div>
        <div style="font-size:10px; color:#64748b; margin-top:6px;">${tmiLabel}</div>
      </div>
      <div class="card tight">
        <div class="label-xs">Taux effectif</div>
        <div class="figure-md" style="margin-top:8px;">${tauxEff}&nbsp;%</div>
        <div style="font-size:10px; color:#64748b; margin-top:6px;">Charges + IR + IS / CA</div>
      </div>
      <div class="card tight">
        <div class="label-xs">Foyer fiscal</div>
        <div class="figure-md" style="margin-top:8px;">${simParts}&nbsp;part${simParts > 1 ? 's' : ''}</div>
        <div style="font-size:10px; color:#64748b; margin-top:6px;">${situFam}</div>
      </div>
    </div>

    <!-- Quick comparison table -->
    <div class="card" style="padding: 0; overflow:hidden;">
      <div style="padding: 14px 18px; border-bottom: 1px solid rgba(30,41,59,0.7); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:700; color:#f1f5f9;">Aperçu des ${scored.length} structures comparées</div>
          <div style="font-size:11px; color:#64748b; margin-top:3px;">Net annuel après IR, cotisations &amp; IS — détail page 4</div>
        </div>
        <span class="pill slate">Même CA · même foyer</span>
      </div>
      <table class="dt">
        <thead>
          <tr><th style="width:32%">Structure</th><th>Net annuel</th><th>Net mensuel</th><th>Score</th><th style="text-align:right;">Vs recommandée</th></tr>
        </thead>
        <tbody>${tableRows}
        </tbody>
      </table>
    </div>

    <!-- Insight -->
    <div class="insight blue">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg></span>
      <div><strong>Comment lire ce rapport.</strong> Pages 3-4 : le détail chiffré pour chaque structure. Page 5 : la méthode de notation. Page 6 : où part votre argent. Page 7 : votre couverture sociale. Page 8 : les étapes pour mettre en place la solution.</div>
    </div>
  </div>

  <footer class="pg-footer"><span>${cabinetNom} · Rapport personnalisé</span><span class="right">Page 02 · 08</span></footer>
</section>


<!-- ============================================================ -->
<!-- PAGE 3 — STRUCTURE RECOMMANDÉE                                -->
<!-- ============================================================ -->
<section class="page" data-screen-label="03 Recommandation">
  <div class="page-accent-tl"></div>
  <header class="pg-header">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div>
      <span class="brand-name">${cabinetNom}</span>
    </div>
    <div class="meta"><span>Section 1 · Recommandation</span><span class="dot"></span><span>${simRef}</span></div>
  </header>

  <div class="page-body">
    <div>
      <div class="eyebrow"><span class="bar"></span>Section 1 · Structure recommandée</div>
      <h2 class="section-title" style="margin-top:10px;">${bestForme} — pourquoi c'est la meilleure option pour vous.</h2>
      <p class="section-sub" style="margin-top:10px;">${STRUCT_TYPE[bestForme] ?? bestForme}. Avec votre CA et votre foyer, c'est mathématiquement le scénario le plus rentable sur 4 axes.</p>
    </div>

    <!-- Big amount + ring -->
    <div class="card lg" style="background: radial-gradient(600px 240px at 100% 0%, rgba(59,130,246,0.16), transparent 70%); border-color: rgba(59,130,246,0.30);">
      <div class="card-accent" style="background:${bestColor};"></div>
      <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap: 22px;">
        <div>
          <div class="label-xs">Revenu net annuel</div>
          <div class="figure-xxl" style="margin-top:10px;">${fmt(bestNet)}</div>
          <div class="mono" style="color:#94a3b8; font-size:12.5px; margin-top:10px;">soit ${fmt(bestMois)}/mois disponibles</div>
          <div style="display:flex; gap:8px; margin-top:14px; flex-wrap: wrap;">
            ${bestIS > 0 ? '<span class="pill blue">Régime IS</span>' : ''}
            ${bestForme.includes('EURL') || bestForme.includes('EI') ? '<span class="pill slate">TNS gérance</span>' : ''}
            ${bestForme.includes('SAS') ? '<span class="pill slate">Assimilé salarié</span>' : ''}
            ${(best?.div ?? 0) > 0 ? '<span class="pill slate">Dividendes flat tax 30%</span>' : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; justify-content:center;">
          <div style="position:relative; width:160px; height:160px;">
            <svg width="160" height="160" class="ring">
              <circle cx="80" cy="80" r="68" stroke="rgba(51,65,85,0.5)" stroke-width="11" fill="none"/>
              <circle cx="80" cy="80" r="68" stroke="${bestColor}" stroke-width="11" fill="none" stroke-linecap="round" stroke-dasharray="${dash68} ${ring68}" style="filter: drop-shadow(0 0 8px ${bestColor}8c);"/>
            </svg>
            <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <div style="font-size:42px; font-weight:900; color:${bestColor}; line-height:1;">${bestScore}</div>
              <div class="label-xs" style="margin-top:6px;">Score · / 100</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Why this — 3 sub-score cards -->
    <div class="grid-3" style="gap:12px;">
      <div class="card tight">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:26px;height:26px;border-radius:7px;background:rgba(59,130,246,0.14);border:1px solid rgba(59,130,246,0.30);display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          </div>
          <div style="font-size:12px; font-weight:700; color:#f1f5f9;">Net élevé</div>
        </div>
        <p style="font-size:11px; color:#94a3b8; margin-top:8px; line-height:1.55;">Optimisation via combinaison rémunération et dividendes, IR maîtrisé sur votre foyer fiscal.</p>
        <div class="barwrap" style="margin-top:10px;"><div class="barfill" style="width:${bNet.pct}%; background:#3B82F6;"></div></div>
        <div style="display:flex; justify-content:space-between; margin-top:6px;"><span class="label-xs">Net</span><span class="mono" style="font-size:11px; color:#3B82F6;">${bNet.val}/${bNet.max}</span></div>
      </div>
      <div class="card tight">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:26px;height:26px;border-radius:7px;background:rgba(139,92,246,0.14);border:1px solid rgba(139,92,246,0.30);display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>
          </div>
          <div style="font-size:12px; font-weight:700; color:#f1f5f9;">Flexible</div>
        </div>
        <p style="font-size:11px; color:#94a3b8; margin-top:8px; line-height:1.55;">Choix libre du curseur rémunération / dividendes pour piloter cotisations et trésorerie.</p>
        <div class="barwrap" style="margin-top:10px;"><div class="barfill" style="width:${bFlex.pct}%; background:#8B5CF6;"></div></div>
        <div style="display:flex; justify-content:space-between; margin-top:6px;"><span class="label-xs">Flex</span><span class="mono" style="font-size:11px; color:#8B5CF6;">${bFlex.val}/${bFlex.max}</span></div>
      </div>
      <div class="card tight">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:26px;height:26px;border-radius:7px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.30);display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg>
          </div>
          <div style="font-size:12px; font-weight:700; color:#f1f5f9;">Couverture solide</div>
        </div>
        <p style="font-size:11px; color:#94a3b8; margin-top:8px; line-height:1.55;">${PROT_SOCIAL[bestForme]?.desc ?? 'Couverture maladie, retraite, prévoyance.'}</p>
        <div class="barwrap" style="margin-top:10px;"><div class="barfill" style="width:${bProt.pct}%; background:#10B981;"></div></div>
        <div style="display:flex; justify-content:space-between; margin-top:6px;"><span class="label-xs">Prot</span><span class="mono" style="font-size:11px; color:#10B981;">${bProt.val}/${bProt.max}</span></div>
      </div>
    </div>

    <!-- Decomposition mini cascade -->
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
        <div>
          <div style="font-size:13px; font-weight:700; color:#f1f5f9;">D'où vient ce résultat ?</div>
          <div style="font-size:11px; color:#64748b; margin-top:3px;">Décomposition CA → Net en 4 étapes</div>
        </div>
        <span class="pill blue">CA ${fmt(ca)}</span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(51,65,85,0.4); border-radius:10px; padding:12px;">
          <div class="label-xs">1. CA HT</div>
          <div class="mono" style="font-size:18px; font-weight:800; color:#f8fafc; margin-top:6px;">${fmt(ca)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:4px;">point de départ</div>
        </div>
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(51,65,85,0.4); border-radius:10px; padding:12px;">
          <div class="label-xs" style="color:#fca5a5;">2. − Cotis.</div>
          <div class="mono" style="font-size:18px; font-weight:800; color:#fca5a5; margin-top:6px;">−${fmt(bestCotis)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:4px;">${bestForme.includes('SAS') ? 'Assimilé salarié' : 'SSI gérance'}</div>
        </div>
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(51,65,85,0.4); border-radius:10px; padding:12px;">
          <div class="label-xs" style="color:#fca5a5;">3. − IS &amp; IR</div>
          <div class="mono" style="font-size:18px; font-weight:800; color:#fca5a5; margin-top:6px;">−${fmt(bestIS + bestIR)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:4px;">${bestIS > 0 ? `IS ${fmt(bestIS)} + IR ${fmt(bestIR)}` : `IR ${fmt(bestIR)}`}</div>
        </div>
        <div style="background:linear-gradient(180deg,rgba(16,185,129,0.10),transparent); border:1px solid rgba(16,185,129,0.30); border-radius:10px; padding:12px;">
          <div class="label-xs" style="color:#6ee7b7;">4. = NET</div>
          <div class="mono" style="font-size:18px; font-weight:900; color:#6ee7b7; margin-top:6px;">${fmt(bestNet)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:4px;">disponible</div>
        </div>
      </div>
    </div>

    <!-- Insight dynamique -->
    <div class="insight blue">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg></span>
      <div>${pourquoiAlt}</div>
    </div>
  </div>

  <footer class="pg-footer"><span>${cabinetNom} · Rapport personnalisé</span><span class="right">Page 03 · 08</span></footer>
</section>


<!-- ============================================================ -->
<!-- PAGE 4 — COMPARAISON DES ${scored.length} STRUCTURES           -->
<!-- ============================================================ -->
<section class="page" data-screen-label="04 Comparaison">
  <div class="page-accent-br"></div>
  <header class="pg-header">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div>
      <span class="brand-name">${cabinetNom}</span>
    </div>
    <div class="meta"><span>Section 2 · Comparaison</span><span class="dot"></span><span>${simRef}</span></div>
  </header>

  <div class="page-body">
    <div>
      <div class="eyebrow violet"><span class="bar"></span>Section 2 · Comparaison détaillée</div>
      <h2 class="section-title" style="margin-top:10px;">Même CA · même charges · même foyer.</h2>
      <p class="section-sub" style="margin-top:10px;">${scored.length} structures juridiques simulées dans des conditions strictement identiques. Triées par score multicritère.</p>
    </div>

    <!-- Structure cards -->
    <div style="display:grid; grid-template-columns: repeat(${scored.length}, 1fr); gap:8px;">
      ${compCards}
    </div>

    <div class="insight amber">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg></span>
      <div>${microInelig ? `<strong>Micro-entreprise non éligible.</strong> Le plafond CA 77&nbsp;700&nbsp;€ est dépassé par votre activité (${fmt(ca)}). La simulation est conservée à titre de comparaison uniquement.` : `<strong>Toutes les structures sont éligibles</strong> à votre niveau de CA (${fmt(ca)}). La recommandation repose sur le score multicritère.`}</div>
    </div>
  </div>

  <footer class="pg-footer"><span>${cabinetNom} · Rapport personnalisé</span><span class="right">Page 04 · 08</span></footer>
</section>


<!-- ============================================================ -->
<!-- PAGE 5 — SCORE MULTICRITÈRE                                   -->
<!-- ============================================================ -->
<section class="page" data-screen-label="05 Score">
  <div class="page-accent-tl"></div>
  <header class="pg-header">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div>
      <span class="brand-name">${cabinetNom}</span>
    </div>
    <div class="meta"><span>Section 3 · Méthode</span><span class="dot"></span><span>${simRef}</span></div>
  </header>

  <div class="page-body">
    <div>
      <div class="eyebrow"><span class="bar"></span>Section 3 · Score multicritère</div>
      <h2 class="section-title" style="margin-top:10px;">Comment on a noté chaque structure.</h2>
      <p class="section-sub" style="margin-top:10px;">Chaque structure est évaluée sur 100 points répartis sur 4 axes pondérés selon votre profil « ${prioriteV} ».</p>
    </div>

    <!-- 4 axes definitions -->
    <div class="grid-4">
      <div class="card tight" style="border-color: rgba(59,130,246,0.30);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span class="label-xs" style="color:#93c5fd;">Net /60</span>
          <span class="mono" style="font-size:11px; color:#3B82F6; font-weight:700;">60 pts</span>
        </div>
        <div style="font-size:13px; font-weight:700; color:#f1f5f9; margin-top:8px;">Revenu disponible</div>
        <p style="font-size:10.5px; color:#94a3b8; margin-top:6px; line-height:1.5;">Net annuel après impôts &amp; cotisations. Plus le net est haut, plus le score est élevé.</p>
      </div>
      <div class="card tight" style="border-color: rgba(139,92,246,0.30);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span class="label-xs" style="color:#c4b5fd;">Flex /20</span>
          <span class="mono" style="font-size:11px; color:#8B5CF6; font-weight:700;">20 pts</span>
        </div>
        <div style="font-size:13px; font-weight:700; color:#f1f5f9; margin-top:8px;">Flexibilité</div>
        <p style="font-size:10.5px; color:#94a3b8; margin-top:6px; line-height:1.5;">Souplesse rémunération / dividendes, capacité à piloter l'imposition année par année.</p>
      </div>
      <div class="card tight" style="border-color: rgba(16,185,129,0.30);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span class="label-xs" style="color:#6ee7b7;">Prot /12</span>
          <span class="mono" style="font-size:11px; color:#10B981; font-weight:700;">12 pts</span>
        </div>
        <div style="font-size:13px; font-weight:700; color:#f1f5f9; margin-top:8px;">Protection sociale</div>
        <p style="font-size:10.5px; color:#94a3b8; margin-top:6px; line-height:1.5;">Couverture maladie, retraite, prévoyance — base obligatoire de chaque régime.</p>
      </div>
      <div class="card tight" style="border-color: rgba(245,158,11,0.30);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span class="label-xs" style="color:#fcd34d;">Admin /8</span>
          <span class="mono" style="font-size:11px; color:#F59E0B; font-weight:700;">8 pts</span>
        </div>
        <div style="font-size:13px; font-weight:700; color:#f1f5f9; margin-top:8px;">Charge administrative</div>
        <p style="font-size:10.5px; color:#94a3b8; margin-top:6px; line-height:1.5;">Comptabilité, formalisme, obligations déclaratives. Plus simple = score plus haut.</p>
      </div>
    </div>

    <!-- Score detail per structure -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding: 14px 18px; border-bottom: 1px solid rgba(30,41,59,0.7);">
        <div style="font-size:13px; font-weight:700; color:#f1f5f9;">Détail des scores par axe</div>
        <div style="font-size:11px; color:#64748b; margin-top:3px;">Score total = Net + Flex + Prot + Admin · sur 100</div>
      </div>
      <div style="padding: 8px 0;">
        ${scoreRows}
      </div>
    </div>

    <div class="insight violet">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg></span>
      <div><strong>Pondération « ${prioriteV} ».</strong> Vous avez priorisé un compromis entre revenu, souplesse et protection. Si vous ciblez « net max », SAS perd des points (charges plus élevées). Si vous ciblez « protection max », SAS prend la 1ʳᵉ place.</div>
    </div>
  </div>

  <footer class="pg-footer"><span>${cabinetNom} · Rapport personnalisé</span><span class="right">Page 05 · 08</span></footer>
</section>


<!-- ============================================================ -->
<!-- PAGE 6 — DÉCOMPOSITION FISCALE                                -->
<!-- ============================================================ -->
<section class="page" data-screen-label="06 Décomposition">
  <div class="page-accent-br"></div>
  <header class="pg-header">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div>
      <span class="brand-name">${cabinetNom}</span>
    </div>
    <div class="meta"><span>Section 4 · Décomposition</span><span class="dot"></span><span>${simRef}</span></div>
  </header>

  <div class="page-body">
    <div>
      <div class="eyebrow amber"><span class="bar"></span>Section 4 · Où part votre argent</div>
      <h2 class="section-title" style="margin-top:10px;">Décomposition complète du CA au net.</h2>
      <p class="section-sub" style="margin-top:10px;">Pour la structure recommandée — ${bestForme} — voici précisément ce qui est prélevé à chaque étape.</p>
    </div>

    <!-- Waterfall -->
    <div class="card lg">
      <div style="font-size:13px; font-weight:700; color:#f1f5f9; margin-bottom:14px;">Cascade CA → Net (en €)</div>
      <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:8px; align-items:end; height: 200px;">
        <div style="display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px;">
          <div class="mono" style="font-size:13px; font-weight:800; color:#f8fafc;">${fmt(ca)}</div>
          <div style="width:100%; height:100%; background:linear-gradient(180deg, rgba(59,130,246,0.40), rgba(59,130,246,0.10)); border:1px solid rgba(59,130,246,0.40); border-radius:6px;"></div>
          <div class="label-xs" style="text-align:center;">CA HT</div>
        </div>
        <div style="display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px;">
          <div class="mono" style="font-size:13px; font-weight:800; color:#fca5a5;">−${fmt(bestCotis)}</div>
          <div style="width:100%; height:${wfCotH}%; background:linear-gradient(180deg, rgba(248,113,113,0.30), rgba(248,113,113,0.05)); border:1px solid rgba(248,113,113,0.30); border-radius:6px;"></div>
          <div class="label-xs" style="text-align:center;">Cotis. soc.</div>
        </div>
        <div style="display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px;">
          <div class="mono" style="font-size:13px; font-weight:800; color:${bestIS > 0 ? '#fca5a5' : '#475569'};">${bestIS > 0 ? `−${fmt(bestIS)}` : '—'}</div>
          <div style="width:100%; height:${Math.max(5, wfISH)}%; background:linear-gradient(180deg, rgba(248,113,113,0.30), rgba(248,113,113,0.05)); border:1px solid rgba(248,113,113,0.30); border-radius:6px;${bestIS === 0 ? 'opacity:0.3;' : ''}"></div>
          <div class="label-xs" style="text-align:center;">IS société</div>
        </div>
        <div style="display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px;">
          <div class="mono" style="font-size:13px; font-weight:800; color:#fca5a5;">−${fmt(bestIR)}</div>
          <div style="width:100%; height:${wfIRH}%; background:linear-gradient(180deg, rgba(248,113,113,0.30), rgba(248,113,113,0.05)); border:1px solid rgba(248,113,113,0.30); border-radius:6px;"></div>
          <div class="label-xs" style="text-align:center;">IR · TMI ${tmi}%</div>
        </div>
        <div style="display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px;">
          <div class="mono" style="font-size:13px; font-weight:800; color:#6ee7b7;">${fmt(bestNet)}</div>
          <div style="width:100%; height:${wfNetH}%; background:linear-gradient(180deg, rgba(16,185,129,0.40), rgba(16,185,129,0.10)); border:1px solid rgba(16,185,129,0.40); border-radius:6px; box-shadow: 0 0 20px rgba(16,185,129,0.20) inset;"></div>
          <div class="label-xs" style="text-align:center; color:#6ee7b7;">NET</div>
        </div>
      </div>
    </div>

    <!-- Detailed table -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding: 14px 18px; border-bottom: 1px solid rgba(30,41,59,0.7);">
        <div style="font-size:13px; font-weight:700; color:#f1f5f9;">Détail ligne par ligne</div>
        <div style="font-size:11px; color:#64748b; margin-top:3px;">Calculs barème 2026 · TMI ${tmi}&nbsp;% · ${simParts} parts fiscales</div>
      </div>
      <table class="dt">
        <thead>
          <tr><th style="width:38%">Poste</th><th style="width:32%">Base / Méthode</th><th style="text-align:right">Montant</th><th style="text-align:right">% du CA</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="label" style="font-weight:700; color:#f1f5f9;">Chiffre d'affaires HT</td>
            <td class="hint">Hypothèse retenue</td>
            <td class="num" style="color:#f8fafc; font-weight:700;">${fmt(ca)}</td>
            <td class="num">100&nbsp;%</td>
          </tr>
          <tr>
            <td class="label">Cotisations sociales</td>
            <td class="hint">${bestForme.includes('SAS') ? 'Régime général assimilé-salarié' : 'SSI · gérance majoritaire'}</td>
            <td class="num" style="color:#fca5a5;">−${fmt(bestCotis)}</td>
            <td class="num">${pct1(bestCotis, caSafe)}&nbsp;%</td>
          </tr>
          <tr>
            <td class="label">Résultat avant IS</td>
            <td class="hint">CA − cotisations</td>
            <td class="num">${fmt(avantIS)}</td>
            <td class="num">${pct1(avantIS, caSafe)}&nbsp;%</td>
          </tr>
          ${bestIS > 0 ? `<tr>
            <td class="label">IS société</td>
            <td class="hint">15&nbsp;% jusqu'à 42&nbsp;500&nbsp;€</td>
            <td class="num" style="color:#fca5a5;">−${fmt(bestIS)}</td>
            <td class="num">${pct1(bestIS, caSafe)}&nbsp;%</td>
          </tr>` : ''}
          <tr>
            <td class="label">Rémunération brute</td>
            <td class="hint">${bestForme.includes('SAS') ? 'Salaire net + dividendes' : 'Mix gérance + dividendes'}</td>
            <td class="num">${fmt(remunBrut)}</td>
            <td class="num">${pct1(remunBrut, caSafe)}&nbsp;%</td>
          </tr>
          <tr>
            <td class="label">Impôt sur le revenu</td>
            <td class="hint">TMI ${tmi}&nbsp;% · ${simParts} parts</td>
            <td class="num" style="color:#fca5a5;">−${fmt(bestIR)}</td>
            <td class="num">${pct1(bestIR, caSafe)}&nbsp;%</td>
          </tr>
          <tr style="background: rgba(16,185,129,0.05);">
            <td class="label" style="color:#6ee7b7; font-weight:800;">Revenu NET disponible</td>
            <td class="hint">Après tout</td>
            <td class="num" style="color:#6ee7b7; font-weight:900; font-size:14px;">${fmt(bestNet)}</td>
            <td class="num" style="color:#6ee7b7; font-weight:700;">${pct1(bestNet, caSafe)}&nbsp;%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="insight emerald">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg></span>
      <div><strong>Leviers d'optimisation possibles.</strong> ${leviersStep3}</div>
    </div>
  </div>

  <footer class="pg-footer"><span>${cabinetNom} · Rapport personnalisé</span><span class="right">Page 06 · 08</span></footer>
</section>


<!-- ============================================================ -->
<!-- PAGE 7 — PROTECTION SOCIALE                                   -->
<!-- ============================================================ -->
<section class="page" data-screen-label="07 Protection">
  <div class="page-accent-tl"></div>
  <header class="pg-header">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div>
      <span class="brand-name">${cabinetNom}</span>
    </div>
    <div class="meta"><span>Section 5 · Couverture sociale</span><span class="dot"></span><span>${simRef}</span></div>
  </header>

  <div class="page-body">
    <div>
      <div class="eyebrow violet"><span class="bar"></span>Section 5 · Protection sociale</div>
      <h2 class="section-title" style="margin-top:10px;">Maladie · retraite · prévoyance par structure.</h2>
      <p class="section-sub" style="margin-top:10px;">Niveau de couverture de base — hors complémentaires souscrites individuellement. Important pour décider entre TNS (EURL/EI) et assimilé-salarié (SAS).</p>
    </div>

    <!-- Protection cards per structure -->
    <div class="grid-4">
      ${protCards}
    </div>

    <!-- Comparison summary -->
    <div class="card">
      <div style="font-size:13px; font-weight:700; color:#f1f5f9;">Que retenir pour votre profil ?</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px;">
        <div style="padding:12px; border-radius:10px; background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.25);">
          <div style="font-size:11px; font-weight:700; color:#93c5fd; letter-spacing:0.06em; text-transform:uppercase;">Si vous choisissez ${bestForme} (reco)</div>
          <p style="font-size:11.5px; color:#cbd5e1; margin-top:8px; line-height:1.55;">${bestForme.includes('EURL') || bestForme.includes('EI') ? 'Couverture suffisante pour démarrer. Souscrivez une <strong>prévoyance TNS</strong> (déductible du résultat) pour combler la différence sur l\'arrêt maladie / invalidité.' : 'Couverture assimilé-salarié — meilleure protection de base. Prévoyance complémentaire facultative mais recommandée pour invalidité.'}</p>
        </div>
        <div style="padding:12px; border-radius:10px; background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.25);">
          <div style="font-size:11px; font-weight:700; color:#c4b5fd; letter-spacing:0.06em; text-transform:uppercase;">Alternative envisageable</div>
          <p style="font-size:11.5px; color:#cbd5e1; margin-top:8px; line-height:1.55;">${bestForme.includes('SAS') ? `L'EURL présente des cotisations inférieures (~${fmt(Math.abs((scored.find(r => r.forme.includes('EURL'))?.charges ?? bestCotis) - bestCotis))}/an) mais une protection sociale moins complète. Pertinent si priorité sur le revenu disponible.` : `La SAS offre +1 niveau de protection sur 3 axes mais génère ~${fmt(Math.abs((scored.find(r => r.forme.includes('SAS'))?.charges ?? bestCotis) - bestCotis))}/an de charges supplémentaires. Pertinent si santé fragile ou priorité retraite.`}</p>
        </div>
      </div>
    </div>

    <div class="insight violet">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg></span>
      <div><strong>Prévoyance TNS déductible.</strong> Les primes (arrêt maladie, invalidité, décès) sont déductibles du résultat IS ou BIC dans les limites Madelin. Économie d'impôt + meilleure couverture en un seul produit.</div>
    </div>
  </div>

  <footer class="pg-footer"><span>${cabinetNom} · Rapport personnalisé</span><span class="right">Page 07 · 08</span></footer>
</section>


<!-- ============================================================ -->
<!-- PAGE 8 — PLAN D'ACTION & CONTACT                              -->
<!-- ============================================================ -->
<section class="page" data-screen-label="08 Plan d'action">
  <div class="page-accent-tl"></div>
  <div class="page-accent-br"></div>
  <header class="pg-header">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div>
      <span class="brand-name">${cabinetNom}</span>
    </div>
    <div class="meta"><span>Section 6 · Plan d'action</span><span class="dot"></span><span>${simRef}</span></div>
  </header>

  <div class="page-body">
    <div>
      <div class="eyebrow emerald"><span class="bar"></span>Étape suivante · Mise en œuvre</div>
      <h2 class="section-title" style="margin-top:10px; font-size:30px;">Ces chiffres vous parlent ?<br><span style="background:linear-gradient(90deg,#60a5fa,#a78bfa); -webkit-background-clip:text; background-clip:text; color:transparent;">Passons à la mise en œuvre.</span></h2>
      <p class="section-sub" style="margin-top:10px;">Validez la stratégie avec un expert-comptable et lancez la mise en place : statuts, choix du régime, optimisation année 1.</p>
    </div>

    <!-- Steps -->
    <div class="steps">
      <div class="step">
        <div class="num">01</div>
        <div>
          <h4>RDV gratuit avec un expert-comptable</h4>
          <p>30 minutes en visio pour valider les hypothèses du rapport, ajuster votre profil et challenger la recommandation ${bestForme}. Aucun engagement.</p>
        </div>
      </div>
      <div class="step">
        <div class="num">02</div>
        <div>
          <h4>Rédaction des statuts &amp; immatriculation</h4>
          <p>Mise en place du véhicule juridique recommandé. Capital, gérance, dénomination, objet social — tout est cadré pour démarrer en règle.</p>
        </div>
      </div>
      <div class="step">
        <div class="num">03</div>
        <div>
          <h4>Activation des leviers d'optimisation</h4>
          <p>${leviersStep3}</p>
        </div>
      </div>
      <div class="step">
        <div class="num">04</div>
        <div>
          <h4>Pilotage trimestriel</h4>
          <p>Réajustement du curseur rémunération / dividendes selon résultat réel, anticipation IS et IR — pour rester optimal toute l'année.</p>
        </div>
      </div>
    </div>

    <!-- Contact card -->
    <div class="card lg" style="background: radial-gradient(700px 280px at 100% 0%, rgba(59,130,246,0.18), transparent 60%), linear-gradient(180deg, #0f172a, #0b1426); border-color: rgba(59,130,246,0.30);">
      <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap: 18px; align-items: center;">
        <div>
          <div class="label-xs" style="color:#93c5fd;">Prendre rendez-vous</div>
          <div style="font-size:20px; font-weight:800; color:#f1f5f9; margin-top:8px; letter-spacing:-0.01em;">Réservez votre créneau de validation</div>
          <p style="font-size:12px; color:#94a3b8; margin-top:8px; line-height:1.55;">30 min · visio ou présentiel · gratuit et sans engagement</p>
          <div style="display:flex; gap:18px; margin-top:18px; flex-wrap: wrap;">
            <div>
              <div class="label-xs">Email</div>
              <div class="mono" style="font-size:13px; color:#f1f5f9; font-weight:700; margin-top:4px;">${cabinetEmail}</div>
            </div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="background: rgba(2,6,23,0.6); border:1px solid rgba(51,65,85,0.5); border-radius:12px; padding:16px;">
            <div class="label-xs">Votre meilleur résultat</div>
            <div class="mono" style="font-size:28px; font-weight:900; color:#f8fafc; margin-top:6px; letter-spacing:-0.02em;">${fmt(bestNet)}</div>
            <div class="mono" style="font-size:11px; color:#94a3b8; margin-top:3px;">${bestForme} · ${fmt(bestMois)}/mois</div>
            <div style="margin-top:10px; padding:8px 10px; border-radius:8px; background:rgba(16,185,129,0.10); border:1px solid rgba(16,185,129,0.30);">
              <div class="label-xs" style="color:#10B981;">Gain identifié</div>
              <div class="mono" style="color:#6ee7b7; font-weight:800; font-size:14px; margin-top:3px;">+${fmt(gain)}/an</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Trust strip -->
    <div style="display:flex; justify-content: center; gap: 22px; flex-wrap: wrap; padding: 6px 0;">
      <span style="display:inline-flex; align-items:center; gap:6px; font-size:10.5px; color:#64748b;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        Données chiffrées en local
      </span>
      <span style="display:inline-flex; align-items:center; gap:6px; font-size:10.5px; color:#64748b;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg>
        Estimations PLF 2026 — à valider
      </span>
      <span style="display:inline-flex; align-items:center; gap:6px; font-size:10.5px; color:#64748b;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polyline points="20 6 9 17 4 12"/></svg>
        Calculs vérifiés par expert-comptable
      </span>
    </div>

    <!-- Disclaimer -->
    <div style="margin-top:auto; padding-top: 12px; border-top: 1px solid rgba(51,65,85,0.4); font-size: 9.5px; color: #475569; line-height: 1.6;">
      <strong style="color:#94a3b8;">Avertissement.</strong> Les chiffres présentés sont des estimations basées sur les hypothèses fiscales et sociales du PLF 2026 (barème IR, taux IS, cotisations SSI, assimilé-salarié). Ils ne constituent pas un conseil juridique ou comptable et doivent être validés en rendez-vous par un expert-comptable agréé. Les résultats peuvent varier selon votre situation patrimoniale et personnelle effective.
    </div>
  </div>

  <footer class="pg-footer"><span>${cabinetNom} · ${cabinetEmail}</span><span class="right">Page 08 · 08</span></footer>
</section>

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

  const clientName = (user.user_metadata?.full_name as string) || (user.email as string) || ''

  let cabinetNom   = 'Belho Xper'
  let cabinetEmail = 'contact@belho-xper.fr'
  try {
    const { data: cab } = await supabase
      .from('cabinets').select('nom, email_contact').eq('slug', 'belho-xper').single()
    if (cab) { cabinetNom = cab.nom || cabinetNom; cabinetEmail = cab.email_contact || cabinetEmail }
  } catch { /* optionnel */ }

  const html = generateHtml(sim as Record<string, unknown>, cabinetNom, cabinetEmail, clientName)

  /* ── Puppeteer → vrai PDF binaire ── */
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

    const rawName  = ((sim as Record<string, unknown>).name as string) || 'rapport'
    const safeName = rawName.replace(/[^a-z0-9\-_ ]/gi, '_').slice(0, 60)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-belhoxper-${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[pdf] Puppeteer indisponible — fallback HTML:', err)
  }

  /* ── Fallback HTML (bouton print manuel, pas d'auto-trigger) ── */
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
