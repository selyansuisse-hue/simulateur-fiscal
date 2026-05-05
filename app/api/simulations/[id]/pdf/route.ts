import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  type Scored,
  fmt, secteurLabel, situLabel,
  genLeviers,
} from '@/lib/pdf/utils'

/* ─── Color / label helpers ─── */
const STRUCT_COLOR: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6',
  'SAS / SASU':       '#8B5CF6',
  'EI (réel normal)': '#F59E0B',
  'Micro-entreprise': '#94A3B8',
}
const STRUCT_TYPE: Record<string, string> = {
  'EURL / SARL (IS)': 'TNS — SSI',
  'SAS / SASU':       'Assimilé salarié',
  'EI (réel normal)': 'TNS — IR direct',
  'Micro-entreprise': 'Régime forfaitaire',
}
const sc = (f: string) => STRUCT_COLOR[f] ?? '#64748b'
const sn = (f: string) => f.replace(' / SARL (IS)', '').replace(' / SASU', '')
const pct = (val: number, total: number) => (total > 0 ? Math.round((val / total) * 100) : 0)

/* ─── Sub-scores estimation (NET/60 FLEX/20 PROT/12 ADMIN/8) ─── */
function subScores(r: Scored) {
  const f = r.forme
  const flexS  = f.includes('SAS') ? 16 : f.includes('EURL') ? 12 : f.includes('EI') ? 9  : 5
  const protS  = f.includes('SAS') ? 10 : f.includes('EURL') ? 8  : f.includes('EI') ? 7  : 4
  const adminS = f.includes('Micro') ? 8 : f.includes('EI') ? 7  : f.includes('EURL') ? 5 : 4
  const netS   = Math.max(0, Math.min(60, r.scoreTotal - flexS - protS - adminS))
  return [
    { label: 'NET',   val: netS,   max: 60, pct: Math.round(netS   / 60 * 100), color: '#3B82F6' },
    { label: 'FLEX',  val: flexS,  max: 20, pct: Math.round(flexS  / 20 * 100), color: '#8B5CF6' },
    { label: 'PROT',  val: protS,  max: 12, pct: Math.round(protS  / 12 * 100), color: '#10B981' },
    { label: 'ADMIN', val: adminS, max: 8,  pct: Math.round(adminS / 8  * 100), color: '#F59E0B' },
  ]
}

/* ─── Dynamic text generators ─── */
function getRaisonChoix(best: Scored, ca: number, tmi: number, charges: number): string {
  const f = best.forme
  if (f.includes('EURL')) {
    return `Pour un CA de ${fmt(ca)} avec un TMI de ${tmi}%, le régime IS combine cotisations TNS basses et dividendes Flat Tax 30% — c'est mathématiquement le scénario optimal.`
  }
  if (f.includes('SAS')) {
    return `Malgré des charges patronales plus élevées, la SASU offre le régime général (retraite AGIRC-ARRCO, couverture maladie supérieure) et une flexibilité optimale pour ce profil.`
  }
  if (f.includes('EI')) {
    return `La déduction directe des charges réelles (${fmt(charges)}) surpasse l'abattement micro et les cotisations sur bénéfice réel restent compétitives à ce niveau de CA.`
  }
  return `L'abattement forfaitaire dépasse les charges réelles estimées — ce régime ultra-simplifié est optimal à ce stade.`
}

function getPourquoiPasAlternative(best: Scored, scored: Scored[]): { titre: string; texte: string } {
  const f = best.forme
  if (f.includes('EURL') || f.includes('EI')) {
    const sasR = scored.find(r => r.forme.includes('SAS'))
    const diff = sasR ? Math.abs(sasR.charges - best.charges) : 0
    return {
      titre: 'Pourquoi pas SAS/SASU ?',
      texte: `La SAS offre une meilleure protection sociale (régime général) mais génère ${fmt(diff)} de charges supplémentaires/an. Sauf priorité protection sociale absolue, cela réduit inutilement le revenu disponible.`,
    }
  }
  if (f.includes('SAS')) {
    const eurlR = scored.find(r => r.forme.includes('EURL'))
    const diff  = eurlR ? Math.abs(best.charges - eurlR.charges) : 0
    return {
      titre: 'Pourquoi pas EURL ?',
      texte: `L'EURL présente des cotisations TNS inférieures (−${fmt(diff)}/an) mais la couverture du régime général (retraite, prévoyance, maladie) justifie le surcoût selon ce profil.`,
    }
  }
  return { titre: '', texte: '' }
}

function getBadges(best: Scored): string[] {
  const b: string[] = []
  if (best.is > 0)                   b.push('RÉGIME IS')
  if (best.forme.includes('EURL') || best.forme.includes('EI')) b.push('TNS — SSI')
  if (best.forme.includes('SAS'))    b.push('ASSIMILÉ SALARIÉ')
  if (best.forme.includes('Micro'))  b.push('MICRO-ENTREPRISE')
  if (best.div && best.div > 0)      b.push('DIVIDENDES PFU 30%')
  return b
}

/* ─────────────────────────────────────────────────────────
   CSS — 8 pages A4, dark design #0a0f1e
───────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    background: #060b18;
    color: white;
  }

  .mono { font-family: 'Courier New', 'Lucida Console', monospace; }

  /* ── Print button — screen only ── */
  .print-btn {
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    background: linear-gradient(135deg, #2563EB, #7C3AED);
    color: white; border: none; padding: 12px 24px;
    border-radius: 10px; cursor: pointer; font-weight: 700;
    font-size: 14px; display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 20px rgba(37,99,235,0.4);
    font-family: 'Inter', sans-serif;
  }

  /* ── Print media ── */
  @media print {
    .print-btn { display: none !important; }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page { size: A4; margin: 0; }
    .page {
      page-break-after: always;
      border-bottom: none !important;
      margin: 0 !important;
    }
    .page:last-child { page-break-after: auto; }
  }

  /* ── Page ── */
  .page {
    width: 210mm;
    min-height: 297mm;
    background: #0a0f1e;
    padding: 40px 48px;
    position: relative;
    overflow: hidden;
    margin: 0 auto;
    border-bottom: 3px solid #0d1423;
  }

  /* ── Reusable components ── */
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .badge-blue   { background: rgba(59,130,246,0.15);  color: #60A5FA; border: 1px solid rgba(59,130,246,0.3);  }
  .badge-green  { background: rgba(16,185,129,0.15);  color: #34D399; border: 1px solid rgba(16,185,129,0.3);  }
  .badge-violet { background: rgba(139,92,246,0.15);  color: #A78BFA; border: 1px solid rgba(139,92,246,0.3);  }
  .badge-amber  { background: rgba(245,158,11,0.15);  color: #FCD34D; border: 1px solid rgba(245,158,11,0.3);  }
  .badge-slate  { background: rgba(100,116,139,0.15); color: #94A3B8; border: 1px solid rgba(100,116,139,0.3); }

  .section-label {
    color: #3B82F6; font-size: 10px; font-weight: 700;
    letter-spacing: 3px; text-transform: uppercase;
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 8px;
  }
  .section-label::before, .section-label::after {
    content: ''; flex: 1; height: 1px; background: #1e3a5f;
  }

  .big-number {
    font-size: 58px; font-weight: 900; line-height: 1;
    font-family: 'Courier New', monospace;
    text-shadow: 0 0 40px rgba(59,130,246,0.4);
  }

  .card {
    background: #111827; border-radius: 14px;
    padding: 20px; border: 1px solid #1e293b;
  }
  .card-blue   { border-left: 3px solid #3B82F6 !important; background: rgba(59,130,246,0.06);  }
  .card-green  { border-left: 3px solid #10B981 !important; background: rgba(16,185,129,0.06);  }
  .card-violet { border-left: 3px solid #8B5CF6 !important; background: rgba(139,92,246,0.06); }
  .card-amber  { border-left: 3px solid #F59E0B !important; background: rgba(245,158,11,0.06); }

  .logo-badge {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #3B82F6, #1D4ED8);
    border-radius: 10px; display: flex; align-items: center;
    justify-content: center; font-weight: 900; font-size: 18px;
    color: white; flex-shrink: 0;
  }

  .page-header {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 16px; margin-bottom: 24px;
    border-bottom: 1px solid #1e293b;
  }
  .page-footer {
    position: absolute; bottom: 20px; left: 48px; right: 48px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: #475569;
    border-top: 1px solid #1e293b; padding-top: 10px;
  }

  .score-bar { height: 6px; border-radius: 3px; background: #1e293b; overflow: hidden; margin-top: 4px; }
  .score-bar-fill { height: 100%; border-radius: 3px; }

  table { width: 100%; border-collapse: collapse; }
  th {
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: #64748b;
    padding: 8px 12px; text-align: left;
    background: #0f172a; border-bottom: 1px solid #1e293b;
  }
  td {
    padding: 10px 12px; font-size: 12px;
    border-bottom: 1px solid #0f172a; color: #cbd5e1;
    vertical-align: middle;
  }
  td.num  { font-family: 'Courier New', monospace; text-align: right; }
  td.red  { color: #f87171; }
  td.green { color: #34d399; font-weight: 700; }
  tr.best td { background: rgba(59,130,246,0.07); color: white; }
  tr.best td:first-child { border-left: 3px solid #3B82F6; padding-left: 9px; }
`

/* ─────────────────────────────────────────────────────────
   generateHtml — 8 pages A4
───────────────────────────────────────────────────────── */
function generateHtml(
  sim: Record<string, unknown>,
  cabinetNom  = 'Belho Xper',
  cabinetEmail = 'contact@belhoxper.fr',
  clientName  = '',
): string {

  /* ── Data extraction ── */
  let scored: Scored[] = []
  const raw = sim.results
  if (Array.isArray(raw))                                        scored = raw as Scored[]
  else if (raw && typeof raw === 'object' && 'scored' in (raw as object)) {
    scored = ((raw as { scored: Scored[] }).scored) || []
  }

  const best    = scored[0]
  const worst   = scored[scored.length - 1]
  const p       = (sim.params as Record<string, unknown>) || {}
  const tmi     = (sim.tmi as number)  || 0
  const gain    = (sim.gain as number) || 0
  const ca      = (sim.ca as number)   || (p.ca as number) || 0
  const charges = (p.charges as number) || 0
  const amort   = (p.amort as number)   || 0
  const caSafe  = Math.max(ca, 1)

  const simName   = (sim.name as string)    || 'Simulation'
  const simId     = (sim.id as string)      || ''
  const dateStr   = new Date(sim.created_at as string)
    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const genDate   = new Date()
    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const ben       = Math.max(0, ca - charges - amort)
  const perMax    = Math.min(35194, Math.max(0, ben * 0.1))

  /* Best-structure metrics */
  const bestForme   = best ? sn(best.forme) : '—'
  const bestColor   = best ? sc(best.forme) : '#3B82F6'
  const bestNet     = best?.netAnnuel ?? 0
  const bestIR      = best?.ir         ?? 0
  const bestIS      = best?.is         ?? 0
  const bestCotis   = best?.charges    ?? 0
  const bestScore   = best?.scoreTotal ?? 0
  const gainMois    = Math.round(gain / 12)
  const tauxEff     = pct(bestCotis + bestIR + bestIS, caSafe)

  const tmiColor = tmi <= 11 ? '#34D399' : tmi <= 30 ? '#FCD34D' : tmi <= 41 ? '#FB923C' : '#F87171'
  const tmiLabel = tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Intermédiaire' : tmi <= 41 ? 'Tranche haute' : 'Tranche max'

  const sectLabel   = secteurLabel[(p.secteur as string)]  || (p.secteur as string)  || '—'
  const sitLabel    = situLabel[(p.situation as string)]   || '—'
  const partsVal    = (p.parts as number) || 1
  const prioriteVal = (p.priorite as string) || 'équilibre'

  /* Derived texts */
  const raisonChoix       = best ? getRaisonChoix(best, ca, tmi, charges) : ''
  const pourquoiPasAlt    = best ? getPourquoiPasAlternative(best, scored) : { titre: '', texte: '' }
  const badges            = best ? getBadges(best) : []
  const leviers           = best ? genLeviers(best, p, tmi, ca) : []

  /* Levier flags */
  const lPER        = leviers.find(l => l.levier.includes('PER'))
  const lMadelin    = leviers.find(l => l.levier.includes('Madelin'))
  const lGSC        = leviers.find(l => l.levier.includes('GSC'))
  const lArb        = leviers.find(l => l.levier.includes('Arbitrage') || l.levier.includes('arbitrage'))
  const lIK         = leviers.find(l => l.levier.includes('kilométrique'))
  const lDom        = leviers.find(l => l.levier.includes('domiciliation') || l.levier.includes('Domiciliation'))

  /* Micro-inéligibilité */
  const hasMicro        = scored.some(r => r.forme.includes('Micro'))
  const microIneligible = !hasMicro || (hasMicro && ca > 77700)

  /* Waterfall percentages */
  const caChgPct  = pct(charges, caSafe)
  const caCotPct  = pct(bestCotis, caSafe)
  const caIRPct   = pct(bestIR,    caSafe)
  const caISPct   = pct(bestIS,    caSafe)
  const caNetPct  = pct(bestNet,   caSafe)

  /* ── Reusable logo ── */
  const logoH = (size = 40, fontSize = 18) =>
    `<div class="logo-badge" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">B</div>`

  /* ── Page header ── */
  const pageHeader = (extra = '') => `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:10px;">
      ${logoH(32, 14)}
      <span style="font-weight:700;font-size:14px;">${cabinetNom}</span>
    </div>
    <div style="color:#475569;font-size:11px;">${simName}${extra ? ' · ' + extra : ''}</div>
  </div>`

  /* ── Page footer ── */
  const pageFooter = (page: string) => `
  <div class="page-footer">
    <span>${cabinetNom} · Rapport personnalisé</span>
    <span>${page} / 8</span>
    <span>Simulation indicative — barème fiscal 2025</span>
  </div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 1 — COUVERTURE                         */
  /* ═══════════════════════════════════════════ */
  const p1 = `
<div class="page" style="display:flex;flex-direction:column;justify-content:space-between;padding-bottom:36px;">

  <!-- Logo header -->
  <div style="display:flex;align-items:center;gap:12px;">
    ${logoH()}
    <div>
      <div style="font-weight:700;font-size:15px;">${cabinetNom}</div>
      <div style="color:#475569;font-size:10px;letter-spacing:2px;text-transform:uppercase;">SIMULATEUR FISCAL · DIRIGEANTS</div>
    </div>
  </div>

  <!-- Titre central -->
  <div style="text-align:center;padding:0 20px;">
    <div class="section-label" style="margin-bottom:24px;">RAPPORT PERSONNALISÉ · ÉDITION 2025</div>
    <h1 style="font-size:52px;font-weight:900;line-height:1.05;margin-bottom:16px;letter-spacing:-0.02em;">
      Optimisation<br>rémunération<br>
      <span style="background:linear-gradient(135deg,#8B5CF6,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">de dirigeant</span>
    </h1>
    <p style="color:#94a3b8;font-size:15px;margin-bottom:0;">
      Comparaison des ${scored.length || 4} structures juridiques · calculs aux barèmes 2025
    </p>
  </div>

  <!-- Cards résumé -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

    <div class="card card-blue" style="padding:20px;">
      <div class="badge badge-blue" style="margin-bottom:10px;">STRUCTURE RECOMMANDÉE</div>
      <div style="color:#60A5FA;font-size:20px;font-weight:900;margin-bottom:6px;">${bestForme}</div>
      <div class="mono big-number" style="font-size:36px;color:white;margin-bottom:4px;">${fmt(bestNet)}</div>
      <div class="mono" style="color:#64748b;font-size:12px;">net après tout · ${fmt(Math.round(bestNet / 12))}/mois</div>
    </div>

    <div class="card card-green" style="padding:20px;">
      <div class="badge badge-green" style="margin-bottom:10px;">GAIN IDENTIFIÉ</div>
      <div class="mono big-number" style="font-size:36px;color:#34D399;margin-bottom:4px;">+${fmt(gain)}</div>
      <div style="color:#94a3b8;font-size:12px;">par an vs structure la moins avantageuse</div>
      <div class="mono" style="color:#475569;font-size:11px;margin-top:4px;">soit +${fmt(gainMois)}/mois</div>
    </div>

  </div>

  <!-- Préparé pour -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #1e293b;padding-top:16px;">
    <div>
      <div style="color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">PRÉPARÉ POUR</div>
      <div style="font-weight:700;font-size:15px;">${clientName || 'Votre analyse personnalisée'}</div>
      <div style="color:#64748b;font-size:12px;">${sectLabel} · CA simulé ${fmt(ca)}</div>
    </div>
    <div style="text-align:right;color:#475569;font-size:10px;line-height:1.7;">
      <div>Document confidentiel · Diffusion réservée au destinataire</div>
      <div>Généré le ${genDate} · Barème fiscal 2025</div>
    </div>
  </div>

</div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 2 — SYNTHÈSE EXÉCUTIVE                 */
  /* ═══════════════════════════════════════════ */
  const p2 = `
<div class="page">
  ${pageHeader(dateStr)}

  <div class="section-label">SYNTHÈSE EXÉCUTIVE</div>
  <h2 style="font-size:36px;font-weight:900;margin-bottom:6px;line-height:1.1;letter-spacing:-0.02em;">
    Ce que vous devez<br>retenir en une page.
  </h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:20px;">Vue d'ensemble du résultat et des leviers d'optimisation</p>

  <!-- Recommandation principale -->
  <div class="card" style="background:linear-gradient(135deg,#0f1f3d 0%,#0a1628 100%);border:1px solid rgba(59,130,246,0.3);border-left:3px solid #3B82F6;padding:22px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">

      <div style="flex:1;">
        <div class="badge badge-blue" style="margin-bottom:12px;">🏆 RECOMMANDATION #1</div>
        <div style="font-size:26px;font-weight:900;color:#60A5FA;margin-bottom:4px;">
          ${bestForme}
          <span style="color:#475569;font-size:13px;font-weight:400;"> — rang #1 sur ${scored.length}</span>
        </div>
        <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">REVENU NET APRÈS TOUT</div>
        <div class="big-number" style="margin-bottom:8px;">${fmt(bestNet)}</div>
        <div class="mono" style="color:#94a3b8;font-size:13px;margin-bottom:14px;">
          soit ${fmt(Math.round(bestNet / 12))}/mois · après IR, cotisations &amp; IS
        </div>
        ${gain > 500 ? `
        <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:10px 16px;display:inline-flex;align-items:center;gap:10px;">
          <span style="color:#34D399;font-size:18px;font-weight:900;" class="mono">+${fmt(gain)}/an</span>
          <span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">VS STRUCTURE LA MOINS AVANTAGEUSE</span>
        </div>` : ''}
      </div>

      <div style="min-width:150px;display:flex;flex-direction:column;gap:10px;">
        <div class="card" style="padding:12px;text-align:center;background:#0f172a;">
          <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">CA SIMULÉ</div>
          <div class="mono" style="font-size:18px;font-weight:900;">${fmt(ca)}</div>
        </div>
        <div class="card" style="padding:12px;text-align:center;background:#0f172a;">
          <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">TMI</div>
          <div class="mono" style="font-size:18px;font-weight:900;color:${tmiColor};">${tmi}%</div>
          <div style="color:#64748b;font-size:10px;">${tmiLabel}</div>
        </div>
        <div class="card" style="padding:12px;text-align:center;background:#0f172a;">
          <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">SCORE</div>
          <div class="mono" style="font-size:18px;font-weight:900;color:${bestColor};">${bestScore}<span style="font-size:11px;color:#475569;">/100</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Aperçu 4 structures -->
  <div class="card" style="background:#0d1422;padding:16px;">
    <div style="font-weight:700;font-size:13px;margin-bottom:12px;">
      Aperçu des ${scored.length} structures comparées
      <span style="color:#475569;font-weight:400;font-size:11px;"> · Net annuel après IR, cotisations &amp; IS</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Structure</th>
          <th style="text-align:right;">Net annuel</th>
          <th style="text-align:right;">Net mensuel</th>
          <th style="text-align:right;">Score</th>
        </tr>
      </thead>
      <tbody>
        ${scored.map((r, i) => {
          const rsc = sc(r.forme)
          return `
        <tr${i === 0 ? ' class="best"' : ''}>
          <td>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${rsc};margin-right:8px;vertical-align:middle;"></span>
            ${r.forme}
            ${i === 0 ? '<span class="badge badge-blue" style="margin-left:8px;font-size:9px;">#1 reco</span>' : ''}
          </td>
          <td class="num${i === 0 ? ' green' : ''}">${fmt(r.netAnnuel)}</td>
          <td class="num" style="color:#64748b;">${fmt(Math.round(r.netAnnuel / 12))}</td>
          <td class="num">
            <span style="background:#1e293b;padding:2px 8px;border-radius:6px;font-size:11px;">${r.scoreTotal}/100</span>
          </td>
        </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>

  ${pageFooter('2')}
</div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 3 — STRUCTURE RECOMMANDÉE DÉTAIL        */
  /* ═══════════════════════════════════════════ */
  const p3 = `
<div class="page">
  ${pageHeader()}

  <div class="section-label">SECTION 1 · STRUCTURE RECOMMANDÉE</div>
  <h2 style="font-size:28px;font-weight:900;margin-bottom:6px;letter-spacing:-0.02em;">
    ${bestForme} — pourquoi pour vous.
  </h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:18px;">${raisonChoix}</p>

  <!-- Grand bloc résultat -->
  <div style="background:linear-gradient(135deg,#0f1f3d,#0a1628);border:1px solid rgba(59,130,246,0.25);border-left:3px solid ${bestColor};border-radius:14px;padding:22px;margin-bottom:14px;">
    <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">REVENU NET ANNUEL</div>
    <div class="big-number" style="color:white;margin-bottom:8px;">${fmt(bestNet)}</div>
    <div class="mono" style="color:#64748b;font-size:13px;margin-bottom:14px;">soit ${fmt(Math.round(bestNet / 12))}/mois disponibles</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${badges.map(b => `<span class="badge badge-blue">${b}</span>`).join('')}
    </div>
  </div>

  <!-- Décomposition tableau -->
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px;">
    <div style="padding:14px 16px;border-bottom:1px solid #1e293b;">
      <span style="font-weight:700;font-size:13px;">Décomposition de votre rémunération</span>
    </div>
    <table>
      <thead><tr>
        <th>Poste</th><th style="text-align:right;">Montant</th><th style="text-align:right;">% du CA</th>
      </tr></thead>
      <tbody>
        <tr>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3B82F6;margin-right:8px;vertical-align:middle;"></span>CA brut HT</td>
          <td class="num mono">${fmt(ca)}</td>
          <td class="num">100%</td>
        </tr>
        ${charges > 0 ? `
        <tr>
          <td style="color:#94a3b8;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#64748b;margin-right:8px;vertical-align:middle;"></span>Charges d'exploitation</td>
          <td class="num red mono">−${fmt(charges)}</td>
          <td class="num red">${caChgPct}%</td>
        </tr>` : ''}
        <tr>
          <td style="color:#94a3b8;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F97316;margin-right:8px;vertical-align:middle;"></span>Cotisations sociales</td>
          <td class="num red mono">−${fmt(bestCotis)}</td>
          <td class="num red">${caCotPct}%</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#EAB308;margin-right:8px;vertical-align:middle;"></span>Impôt sur le revenu (IR)</td>
          <td class="num red mono">−${fmt(bestIR)}</td>
          <td class="num red">${caIRPct}%</td>
        </tr>
        ${bestIS > 0 ? `
        <tr>
          <td style="color:#94a3b8;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#A855F7;margin-right:8px;vertical-align:middle;"></span>IS société (15% / 25%)</td>
          <td class="num red mono">−${fmt(bestIS)}</td>
          <td class="num red">${caISPct}%</td>
        </tr>` : ''}
        <tr class="best">
          <td style="font-weight:800;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:8px;vertical-align:middle;"></span>= Revenu net disponible</td>
          <td class="num green mono" style="font-size:15px;font-weight:900;">${fmt(bestNet)}</td>
          <td class="num green" style="font-weight:700;">${caNetPct}%</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Pourquoi pas l'alternative -->
  ${pourquoiPasAlt.titre ? `
  <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:10px;padding:14px;display:flex;gap:12px;align-items:flex-start;">
    <span style="font-size:18px;flex-shrink:0;">ℹ</span>
    <div>
      <span style="font-weight:700;font-size:13px;">${pourquoiPasAlt.titre} </span>
      <span style="color:#94a3b8;font-size:13px;">${pourquoiPasAlt.texte}</span>
    </div>
  </div>` : ''}

  ${pageFooter('3')}
</div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 4 — COMPARAISON DÉTAILLÉE              */
  /* ═══════════════════════════════════════════ */
  const p4 = `
<div class="page">
  ${pageHeader()}

  <div class="section-label">SECTION 2 · COMPARAISON DÉTAILLÉE</div>
  <h2 style="font-size:28px;font-weight:900;margin-bottom:6px;letter-spacing:-0.02em;">Même CA · même charges · même foyer</h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:18px;">
    ${scored.length} structures simulées dans des conditions identiques · triées par score multicritère.
  </p>

  <!-- Grid structures -->
  <div style="display:grid;grid-template-columns:${scored.length >= 4 ? '1fr 1fr' : `repeat(${scored.length},1fr)`};gap:12px;margin-bottom:14px;">
    ${scored.map((r, i) => {
      const rsc     = sc(r.forme)
      const rCout   = r.charges + r.ir + (r.is || 0)
      const rCotPct = pct(r.charges, caSafe)
      const rIRPct  = pct(r.ir, caSafe)
      const rISPct  = pct(r.is || 0, caSafe)
      const rNetPct = pct(r.netAnnuel, caSafe)
      const rPctCA  = pct(rCout, caSafe)
      const ss      = subScores(r)
      const isBest  = i === 0
      return `
    <div class="card" style="border:1px solid ${rsc}20;border-left:3px solid ${rsc};background:${isBest ? rsc + '08' : '#111827'};padding:16px;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${rsc};"></span>
            <span style="font-weight:700;font-size:13px;color:${rsc};">${sn(r.forme)}</span>
          </div>
          ${isBest ? '<div class="badge badge-blue" style="font-size:9px;">★ RECOMMANDÉE</div>' : `<div style="color:#475569;font-size:10px;">${STRUCT_TYPE[r.forme] || ''}</div>`}
        </div>
        <div style="background:#1e293b;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;color:white;">${r.scoreTotal}/100</div>
      </div>
      <!-- Net -->
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">NET APRÈS IMPÔTS</div>
      <div class="mono" style="font-size:26px;font-weight:900;color:white;margin-bottom:1px;">${fmt(r.netAnnuel)}</div>
      <div class="mono" style="color:#64748b;font-size:11px;margin-bottom:10px;">${fmt(Math.round(r.netAnnuel / 12))}/mois</div>
      <!-- Détail coûts -->
      <div style="border-top:1px solid #1e293b;padding-top:8px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:10px;">
          <span style="color:#64748b;">Cotisations</span>
          <span style="color:#f87171;" class="mono">−${fmt(r.charges)} <span style="color:#334155;">${rCotPct}%</span></span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:10px;">
          <span style="color:#64748b;">IR</span>
          <span style="color:#f87171;" class="mono">−${fmt(r.ir)} <span style="color:#334155;">${rIRPct}%</span></span>
        </div>
        ${r.is > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:10px;">
          <span style="color:#64748b;">IS</span>
          <span style="color:#f87171;" class="mono">−${fmt(r.is)} <span style="color:#334155;">${rISPct}%</span></span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;border-top:1px solid #1e293b;padding-top:5px;font-size:10px;">
          <span style="font-weight:600;color:#94a3b8;">Coût total</span>
          <span style="color:#f87171;font-weight:700;" class="mono">−${fmt(rCout)} (${rPctCA}%)</span>
        </div>
      </div>
      <!-- Score bars -->
      <div style="border-top:1px solid #1e293b;padding-top:8px;">
        ${ss.map(s => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <div style="width:30px;color:#64748b;font-size:8px;text-transform:uppercase;">${s.label}</div>
          <div class="score-bar" style="flex:1;"><div class="score-bar-fill" style="width:${s.pct}%;background:${s.color};"></div></div>
          <div style="width:30px;text-align:right;font-size:9px;color:#94a3b8;">${s.val}/${s.max}</div>
        </div>`).join('')}
      </div>
    </div>`
    }).join('')}
  </div>

  ${microIneligible && !hasMicro ? `
  <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:11px 14px;display:flex;gap:10px;font-size:12px;align-items:flex-start;">
    <span style="flex-shrink:0;">⚠️</span>
    <span><strong>Micro-entreprise non éligible.</strong> Le plafond CA 77 700 € est dépassé (${fmt(ca)}). La simulation est conservée à titre indicatif.</span>
  </div>` : ''}

  ${pageFooter('4')}
</div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 5 — SCORE MULTICRITÈRE                  */
  /* ═══════════════════════════════════════════ */
  const p5 = `
<div class="page">
  ${pageHeader()}

  <div class="section-label">SECTION 3 · SCORE MULTICRITÈRE</div>
  <h2 style="font-size:28px;font-weight:900;margin-bottom:6px;letter-spacing:-0.02em;">Comment on note chaque structure.</h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:18px;">
    Chaque structure est évaluée sur 100 points répartis selon la priorité « ${prioriteVal} ».
  </p>

  <!-- 4 critères -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
    <div class="card card-blue" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">NET /60</span>
        <span style="color:#60A5FA;font-weight:700;">60 pts</span>
      </div>
      <div style="font-weight:700;margin-bottom:5px;">Revenu disponible</div>
      <div style="color:#64748b;font-size:11px;line-height:1.55;">Net annuel après impôts &amp; cotisations. Plus le net est haut, plus le score est élevé.</div>
    </div>
    <div class="card card-violet" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">FLEX /20</span>
        <span style="color:#A78BFA;font-weight:700;">20 pts</span>
      </div>
      <div style="font-weight:700;margin-bottom:5px;">Flexibilité</div>
      <div style="color:#64748b;font-size:11px;line-height:1.55;">Souplesse rémunération/dividendes, capacité à piloter l'imposition.</div>
    </div>
    <div class="card card-green" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">PROT /12</span>
        <span style="color:#34D399;font-weight:700;">12 pts</span>
      </div>
      <div style="font-weight:700;margin-bottom:5px;">Protection sociale</div>
      <div style="color:#64748b;font-size:11px;line-height:1.55;">Couverture maladie, retraite, prévoyance. SAS = régime général.</div>
    </div>
    <div class="card card-amber" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">ADMIN /8</span>
        <span style="color:#FCD34D;font-weight:700;">8 pts</span>
      </div>
      <div style="font-weight:700;margin-bottom:5px;">Simplicité administrative</div>
      <div style="color:#64748b;font-size:11px;line-height:1.55;">Charges comptables, obligations déclaratives, complexité.</div>
    </div>
  </div>

  <!-- Tableau détail scores -->
  <div class="card" style="padding:16px;background:#0d1422;">
    <div style="font-weight:700;font-size:13px;margin-bottom:16px;">
      Détail des scores par axe
      <span style="color:#475569;font-weight:400;font-size:11px;"> · Score total = NET + FLEX + PROT + ADMIN · sur 100</span>
    </div>
    ${scored.map(r => {
      const rsc = sc(r.forme)
      const ss  = subScores(r)
      return `
    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${rsc};"></span>
          <span style="font-weight:600;font-size:13px;color:${rsc};">${sn(r.forme)}</span>
        </div>
        <span style="background:#1e293b;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">${r.scoreTotal}/100</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">
        ${ss.map(s => `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">
            <span>${s.label}</span><span>${s.val}/${s.max}</span>
          </div>
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${s.pct}%;background:${s.color};box-shadow:0 0 4px ${s.color}80;"></div>
          </div>
        </div>`).join('')}
      </div>
    </div>`
    }).join('')}
  </div>

  ${pageFooter('5')}
</div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 6 — DÉCOMPOSITION FISCALE              */
  /* ═══════════════════════════════════════════ */
  const wfRows = [
    { label: 'CA brut HT',              val: ca,        color: '#3B82F6', neg: false },
    ...(charges > 0 ? [{ label: 'Charges exploitation', val: charges, color: '#64748b', neg: true }] : []),
    { label: 'Cotisations sociales',     val: bestCotis, color: '#F97316', neg: true  },
    ...(bestIS > 0 ? [{ label: 'IS société',             val: bestIS,    color: '#A855F7', neg: true  }] : []),
    { label: 'Impôt sur le revenu',      val: bestIR,    color: '#EAB308', neg: true  },
    { label: 'Revenu net disponible',    val: bestNet,   color: '#10B981', neg: false },
  ]

  const p6 = `
<div class="page">
  ${pageHeader()}

  <div class="section-label">SECTION 4 · OÙ PART VOTRE ARGENT</div>
  <h2 style="font-size:28px;font-weight:900;margin-bottom:6px;letter-spacing:-0.02em;">Décomposition complète du CA</h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:18px;">Pour la structure recommandée — <strong style="color:${bestColor};">${bestForme}</strong> — à chaque étape.</p>

  <!-- Cascade visuelle -->
  <div class="card" style="margin-bottom:14px;padding:18px;background:#0d1422;">
    <div style="font-weight:700;font-size:13px;margin-bottom:14px;">Cascade CA → Net (en €)</div>

    <!-- Barre waterfall -->
    <div style="display:flex;height:28px;border-radius:8px;overflow:hidden;margin-bottom:10px;">
      ${charges > 0 ? `<div style="background:#64748b;width:${caChgPct}%;display:flex;align-items:center;justify-content:center;font-size:9px;color:white;font-weight:700;min-width:16px;">${caChgPct > 7 ? caChgPct + '%' : ''}</div>` : ''}
      <div style="background:#F97316;width:${caCotPct}%;display:flex;align-items:center;justify-content:center;font-size:9px;color:white;font-weight:700;min-width:16px;">${caCotPct > 7 ? caCotPct + '%' : ''}</div>
      ${bestIS > 0 ? `<div style="background:#A855F7;width:${caISPct}%;display:flex;align-items:center;justify-content:center;font-size:9px;color:white;font-weight:700;min-width:12px;">${caISPct > 7 ? caISPct + '%' : ''}</div>` : ''}
      <div style="background:#EAB308;width:${caIRPct}%;display:flex;align-items:center;justify-content:center;font-size:9px;color:black;font-weight:700;min-width:12px;">${caIRPct > 7 ? caIRPct + '%' : ''}</div>
      <div style="background:#10B981;flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:900;min-width:40px;">NET ${caNetPct}%</div>
    </div>

    <!-- Légende -->
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#94a3b8;">
      ${charges > 0 ? `<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#64748b;margin-right:4px;vertical-align:middle;"></span>Charges ${fmt(charges)}</span>` : ''}
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#F97316;margin-right:4px;vertical-align:middle;"></span>Cotisations ${fmt(bestCotis)}</span>
      ${bestIS > 0 ? `<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#A855F7;margin-right:4px;vertical-align:middle;"></span>IS ${fmt(bestIS)}</span>` : ''}
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#EAB308;margin-right:4px;vertical-align:middle;"></span>IR ${fmt(bestIR)}</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#10B981;margin-right:4px;vertical-align:middle;"></span>Net disponible ${fmt(bestNet)}</span>
    </div>
  </div>

  <!-- Tableau ligne par ligne -->
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px;">
    <table>
      <thead><tr>
        <th>Poste fiscal</th><th style="text-align:right;">Montant</th><th style="text-align:right;">% du CA</th><th>Note</th>
      </tr></thead>
      <tbody>
        ${wfRows.map((row, ri) => {
          const isLast = ri === wfRows.length - 1
          return `
        <tr${isLast ? ' class="best"' : ''}>
          <td${isLast ? ' style="font-weight:800;"' : ''}>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${row.color};margin-right:8px;vertical-align:middle;"></span>
            ${row.label}
          </td>
          <td class="num mono${isLast ? ' green' : row.neg ? ' red' : ''}" style="${isLast ? 'font-size:15px;font-weight:900;' : ''}">
            ${row.neg ? '−' : ''}${fmt(row.val)}
          </td>
          <td class="num${isLast ? ' green' : row.neg ? ' red' : ''}" style="${isLast ? 'font-weight:700;' : ''}">
            ${pct(row.val, caSafe)}%
          </td>
          <td style="color:#64748b;font-size:11px;">
            ${row.label.includes('CA') ? 'Point de départ' :
              row.label.includes('Charges') ? 'Loyer, matériel, frais pro' :
              row.label.includes('Cotis') ? `SSI TNS · ${STRUCT_TYPE[best?.forme || ''] || ''}` :
              row.label.includes('IS') ? 'IS 15% ≤42 500€ · 25% au-delà' :
              row.label.includes('IR') ? `TMI ${tmi}% · ${partsVal} part${partsVal > 1 ? 's' : ''}` :
              `${fmt(Math.round(bestNet / 12))}/mois`}
          </td>
        </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Taux effectif -->
  <div style="display:flex;gap:12px;">
    <div class="card" style="flex:1;padding:14px;text-align:center;background:#0d1422;">
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">TAUX EFFECTIF</div>
      <div class="mono" style="font-size:22px;font-weight:900;color:#f87171;">${tauxEff}%</div>
      <div style="color:#475569;font-size:10px;">prélevé sur CA total</div>
    </div>
    <div class="card" style="flex:1;padding:14px;text-align:center;background:#0d1422;">
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">NET CONSERVÉ</div>
      <div class="mono" style="font-size:22px;font-weight:900;color:#34d399;">${caNetPct}%</div>
      <div style="color:#475569;font-size:10px;">du CA après tout</div>
    </div>
    <div class="card" style="flex:1;padding:14px;text-align:center;background:#0d1422;">
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">REVENU MENSUEL</div>
      <div class="mono" style="font-size:22px;font-weight:900;color:${bestColor};">${fmt(Math.round(bestNet / 12))}</div>
      <div style="color:#475569;font-size:10px;">disponible / mois</div>
    </div>
  </div>

  ${pageFooter('6')}
</div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 7 — LEVIERS D'OPTIMISATION             */
  /* ═══════════════════════════════════════════ */
  const prioColor = (p: string) => p.includes('Haute') ? '#FCD34D' : p.includes('Moyenne') ? '#60A5FA' : '#94A3B8'
  const prioBadge = (p: string) => p.includes('Haute') ? 'badge-amber' : p.includes('Moyenne') ? 'badge-blue' : 'badge-slate'

  const leverIcon: Record<string, string> = {
    'PER': '💰', 'Madelin': '🛡', 'GSC': '🔒', 'Arbitrage': '📊', 'kilométrique': '🚗', 'domiciliation': '🏠',
  }
  const getIcon = (levier: string) => {
    for (const [key, icon] of Object.entries(leverIcon)) {
      if (levier.toLowerCase().includes(key.toLowerCase())) return icon
    }
    return '✦'
  }

  const p7 = `
<div class="page">
  ${pageHeader()}

  <div class="section-label">SECTION 5 · LEVIERS D'OPTIMISATION</div>
  <h2 style="font-size:28px;font-weight:900;margin-bottom:6px;letter-spacing:-0.02em;">Actions concrètes pour améliorer votre net.</h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:18px;">
    Sur la base de votre situation (CA ${fmt(ca)}, TMI ${tmi}%), voici les leviers actionnables avec votre expert-comptable.
  </p>

  <!-- Leviers dynamiques -->
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
    ${leviers.map(l => {
      const pc    = prioColor(l.prio)
      const badge = prioBadge(l.prio)
      const icon  = getIcon(l.levier)
      return `
    <div class="card" style="border-left:3px solid ${pc};background:#111827;padding:14px;display:flex;justify-content:space-between;align-items:center;gap:16px;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:16px;">${icon}</span>
          <span style="font-weight:700;font-size:13px;">${l.levier}</span>
          <span class="badge ${badge}">${l.prio}</span>
        </div>
        <div style="color:#94a3b8;font-size:12px;line-height:1.55;">${l.impact}</div>
      </div>
    </div>`
    }).join('')}
  </div>

  <!-- Tableau récap -->
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">
    <table>
      <thead><tr>
        <th style="width:36%;">Levier</th>
        <th style="width:45%;">Impact estimé</th>
        <th>Priorité</th>
      </tr></thead>
      <tbody>
        ${leviers.map((l, i) => {
          const pc = prioColor(l.prio)
          return `
        <tr style="background:${i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};">
          <td style="font-weight:700;color:#f1f5f9;">${l.levier}</td>
          <td style="color:#94a3b8;font-size:11px;">${l.impact}</td>
          <td><span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;background:${pc}18;color:${pc};border:1px solid ${pc}30;">${l.prio}</span></td>
        </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>

  <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:10px;padding:12px 14px;font-size:12px;color:#94a3b8;line-height:1.65;">
    ℹ Ces leviers sont indicatifs. Votre expert-comptable calculera l'impact précis selon votre dossier complet, votre historique et vos objectifs patrimoniaux.
    ${perMax > 0 ? ` Plafond PER indicatif estimé : ${fmt(perMax)}/an.` : ''}
  </div>

  ${pageFooter('7')}
</div>`

  /* ═══════════════════════════════════════════ */
  /* PAGE 8 — PLAN D'ACTION + CONTACT            */
  /* ═══════════════════════════════════════════ */
  const steps = [
    { n: '1', color: '#3B82F6', title: 'Validation avec un expert', desc: `Consultation avec votre expert-comptable ${cabinetNom} pour confirmer la structure ${bestForme} et personnaliser les calculs à votre dossier complet.` },
    { n: '2', color: '#8B5CF6', title: 'Formalités de création',   desc: 'Rédaction des statuts, dépôt du capital social, immatriculation au Registre du Commerce. Délai moyen : 10–15 jours.' },
    { n: '3', color: '#10B981', title: 'Ouverture compte pro',      desc: 'Séparation patrimoine personnel / professionnel. Mise en place des virements de rémunération et paramétrage.' },
    { n: '4', color: '#F59E0B', title: 'Mise en place comptabilité', desc: `Calendrier déclaratif, suivi SSI, mise en œuvre des leviers d'optimisation identifiés dans ce rapport.` },
  ]

  const p8 = `
<div class="page" style="padding-bottom:30px;">
  ${pageHeader()}

  <div class="section-label">SECTION 6 · PLAN D'ACTION</div>
  <h2 style="font-size:28px;font-weight:900;margin-bottom:6px;letter-spacing:-0.02em;">4 étapes pour mettre en œuvre.</h2>
  <p style="color:#64748b;font-size:13px;margin-bottom:18px;">De la simulation à la mise en place de votre structure optimale.</p>

  <!-- 4 étapes -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
    ${steps.map(s => `
    <div class="card" style="border-left:3px solid ${s.color};background:${s.color}08;padding:18px;">
      <div style="width:34px;height:34px;background:${s.color};border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:17px;margin-bottom:10px;color:white;">${s.n}</div>
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${s.title}</div>
      <div style="color:#64748b;font-size:12px;line-height:1.6;">${s.desc}</div>
    </div>`).join('')}
  </div>

  <!-- Récap mini -->
  <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px 16px;margin-bottom:18px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center;">
    <div>
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">CA simulé</div>
      <div class="mono" style="font-size:14px;font-weight:800;">${fmt(ca)}</div>
    </div>
    <div>
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Structure</div>
      <div style="font-size:12px;font-weight:800;color:${bestColor};">${bestForme}</div>
    </div>
    <div>
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Net annuel</div>
      <div class="mono" style="font-size:14px;font-weight:800;color:#34d399;">${fmt(bestNet)}</div>
    </div>
    <div>
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Gain vs pire</div>
      <div class="mono" style="font-size:14px;font-weight:800;color:#4ade80;">+${fmt(gain)}</div>
    </div>
  </div>

  <!-- Contact cabinet -->
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f1f3d 100%);border-radius:14px;padding:22px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          ${logoH(40)}
          <div>
            <div style="font-weight:900;font-size:18px;">Cabinet ${cabinetNom}</div>
            <div style="color:#60A5FA;font-size:11px;">Experts en optimisation fiscale des dirigeants</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
          <span style="color:#94a3b8;">📍 Lyon — 10 rue de la République, 69001</span>
          <span style="color:#94a3b8;">✉ <strong style="color:#60a5fa;">${cabinetEmail}</strong></span>
          <span style="color:#94a3b8;">📍 Montluel — 12 place du Marché, 01120</span>
          <span style="color:#94a3b8;">🌐 <strong style="color:#60a5fa;">belhoxper.fr</strong></span>
        </div>
      </div>
      <div style="text-align:center;flex-shrink:0;">
        <div style="background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.35);border-radius:999px;padding:8px 18px;margin-bottom:6px;">
          <span style="color:#34D399;font-weight:800;font-size:13px;">📅 Première consultation offerte</span>
        </div>
        <div style="color:#64748b;font-size:10px;">Rappel sous 24h · Sans engagement</div>
      </div>
    </div>
  </div>

  <!-- Disclaimer -->
  <div style="text-align:center;color:#334155;font-size:9.5px;line-height:1.7;">
    © 2025 Cabinet ${cabinetNom} · Simulation indicative basée sur la législation fiscale 2025.<br>
    Ne constitue pas un conseil fiscal personnalisé. Consultez un expert-comptable pour validation.<br>
    Généré le ${genDate} · Rapport réf. ${simId.slice(0, 8).toUpperCase()}
  </div>

</div>`

  /* ═══════════════════════════════════════════ */
  /* ASSEMBLY                                    */
  /* ═══════════════════════════════════════════ */
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport Fiscal — ${simName} — ${cabinetNom}</title>
<style>${CSS}</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">🖨 Imprimer / PDF</button>

${p1}
${p2}
${p3}
${p4}
${p5}
${p6}
${p7}
${p8}

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
  let cabinetEmail = 'contact@belhoxper.fr'
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
