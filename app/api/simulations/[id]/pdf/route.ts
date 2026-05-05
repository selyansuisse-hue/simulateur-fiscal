import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  type Scored,
  fmt, formeColor,
  situLabel, secteurLabel,
  genAnalyse, genLeviers,
} from '@/lib/pdf/utils'

/* ─── Helpers ─── */
const STRUCT_COLOR: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6',
  'SAS / SASU':       '#8B5CF6',
  'EI (réel normal)': '#F59E0B',
  'Micro-entreprise': '#94A3B8',
}
const STRUCT_SHORT: Record<string, string> = {
  'EURL / SARL (IS)': 'Gérant TNS — IS 15%/25% + dividendes PFU 30%',
  'SAS / SASU':       'Assimilé salarié — fiche de paie + dividendes PFU',
  'EI (réel normal)': 'Bénéfice net imposable IR — charges réelles déductibles',
  'Micro-entreprise': 'Abattement forfaitaire sur CA — sans déduction de charges',
}
const STRUCT_TYPE: Record<string, string> = {
  'EURL / SARL (IS)': 'TNS — SSI',
  'SAS / SASU':       'Assimilé salarié',
  'EI (réel normal)': 'TNS — IR direct',
  'Micro-entreprise': 'Régime forfaitaire',
}
const STRUCT_PROT: Record<string, { label: string; val: number; color: string }> = {
  'SAS / SASU':       { label: 'Élevée ★★★', val: 10, color: '#10b981' },
  'EURL / SARL (IS)': { label: 'Moyenne ★★',  val: 8,  color: '#f59e0b' },
  'EI (réel normal)': { label: 'Moyenne ★★',  val: 7,  color: '#f59e0b' },
  'Micro-entreprise': { label: 'Faible ★',     val: 4,  color: '#ef4444' },
}
const sc = (f: string) => STRUCT_COLOR[f] ?? '#64748b'
const sn = (f: string) => f.replace(' / SARL (IS)', '').replace(' / SASU', '')

function pct(val: number, total: number) {
  return total > 0 ? Math.round(val / total * 100) : 0
}

/* Sub-scores estimation (NET/60, FLEX/20, PROT/12, ADMIN/8) */
function subScores(r: Scored, all: Scored[]) {
  const maxNet = Math.max(...all.map(s => s.netAnnuel), 1)
  const netS = Math.min(60, Math.round(r.netAnnuel / maxNet * 60))
  const f = r.forme
  const flexS  = f.includes('SAS') ? 16 : f.includes('EURL') ? 12 : f.includes('EI') ? 9 : 5
  const protS  = f.includes('SAS') ? 10 : f.includes('EURL') ? 8  : f.includes('EI') ? 7 : 4
  const adminS = f.includes('Micro') ? 8 : f.includes('EI') ? 7 : f.includes('EURL') ? 5 : 4
  return { net: netS, flex: flexS, prot: protS, admin: adminS }
}

/* ─────────────────────────────────────────────────────────
   CSS GLOBAL
───────────────────────────────────────────────────────── */
const CSS = `
@page { size: A4 portrait; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', -apple-system, system-ui, sans-serif;
  background: #060b18; color: #f1f5f9; font-size: 10px;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.mono { font-family: 'Courier New', 'Lucida Console', monospace; letter-spacing: -0.02em; }

/* Print bar (screen only) */
.pbar {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 10px 20px; background: #040810; border-bottom: 1px solid #1a2540;
  position: sticky; top: 0; z-index: 100;
}
.pbar-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.55); margin-right: 8px; }
.pbtn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
  border-radius: 8px; border: none; cursor: pointer; font-size: 11px;
  font-weight: 700; font-family: inherit;
}
.pbtn-p { background: linear-gradient(135deg,#2563eb,#7c3aed); color: #fff; box-shadow: 0 4px 12px rgba(37,99,235,.4); }
.pbtn-s { background: rgba(255,255,255,.08); color: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.12) !important; }
@media print { .pbar { display: none !important; } }

/* Page layout */
.pw { display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 20px; }
@media print { .pw { padding: 0; gap: 0; } }
.page {
  width: 210mm; height: 297mm; overflow: hidden;
  page-break-after: always; page-break-inside: avoid;
  background: #0a0f1e; color: #f1f5f9;
  display: flex; flex-direction: column; position: relative;
  box-shadow: 0 8px 40px rgba(0,0,0,.7);
}
.page:last-child { page-break-after: auto; }

/* Common page header */
.ph {
  padding: 10px 36px; background: #080d1a;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.ph-logo {
  width: 24px; height: 24px; border-radius: 6px;
  background: linear-gradient(135deg,#3b82f6,#1d4ed8);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 900; color: white; flex-shrink: 0;
}
.ph-brand { font-size: 11px; font-weight: 800; color: #fff; }
.ph-sep { width: 1px; height: 14px; background: rgba(255,255,255,0.12); }
.ph-tag {
  font-size: 8px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: #60a5fa;
  background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.2);
  padding: 2px 8px; border-radius: 999px;
}
.ph-right { font-size: 8.5px; color: rgba(255,255,255,.25); text-align: right; }
.ph-pnum {
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 700; color: #60a5fa; margin-left: 6px;
}

/* Common page body */
.pb { flex: 1; padding: 18px 36px; overflow: hidden; }

/* Common page footer */
.pf {
  padding: 7px 36px; border-top: 1px solid rgba(255,255,255,0.06);
  background: #080d1a; display: flex; justify-content: space-between; align-items: center;
  flex-shrink: 0;
}
.pf-t { font-size: 7.5px; color: rgba(255,255,255,0.2); }

/* Section labels */
.sl {
  font-size: 8px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  color: #64748b; margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; gap: 6px;
}
.sd { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

/* Cards */
.card {
  background: #111827; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 14px;
}
.card-blue  { border-color: rgba(59,130,246,0.3);  background: rgba(59,130,246,0.08); }
.card-green { border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); }
.card-amber { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }
.card-violet{ border-color: rgba(139,92,246,0.3); background: rgba(139,92,246,0.08); }

/* Tables */
.tbl { width: 100%; border-collapse: collapse; }
.tbl th {
  font-size: 7.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  color: #64748b; padding: 6px 10px; text-align: left;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
}
.tbl td { padding: 6px 10px; font-size: 9px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
.tbl tr:last-child td { border-bottom: none; }
.tbl .best { background: rgba(59,130,246,0.07); }

/* Badges */
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 999px; font-size: 8.5px; font-weight: 700;
}
.badge-blue  { background: rgba(59,130,246,0.15);  border: 1px solid rgba(59,130,246,0.3);  color: #60a5fa; }
.badge-green { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; }
.badge-amber { background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; }
.badge-violet{ background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); color: #a78bfa; }
.badge-slate { background: rgba(100,116,139,0.15); border: 1px solid rgba(100,116,139,0.3); color: #94a3b8; }

/* Bar */
.bar-track { background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 999px; transition: width 0.3s; }
`

/* ─────────────────────────────────────────────────────────
   HTML GENERATOR — 8 pages
───────────────────────────────────────────────────────── */
function generateHtml(
  sim: Record<string, unknown>,
  cabinetNom = 'Belho Xper',
  cabinetEmail = 'contact@belhoxper.fr',
  clientName = '',
): string {
  /* ── Data extraction ── */
  let scored: Scored[] = []
  const raw = sim.results
  if (Array.isArray(raw)) scored = raw as Scored[]
  else if (raw && typeof raw === 'object' && 'scored' in (raw as object)) {
    scored = ((raw as { scored: Scored[] }).scored) || []
  }

  const best    = scored[0]
  const worst   = scored[scored.length - 1]
  const p       = (sim.params as Record<string, unknown>) || {}
  const tmi     = (sim.tmi as number) || 0
  const gain    = (sim.gain as number) || 0
  const ca      = (sim.ca as number) || (p.ca as number) || 0
  const charges = (p.charges as number) || 0
  const amort   = (p.amort as number) || 0
  const perMont = (p.perMontant as number) || 0

  const simName = (sim.name as string) || 'Simulation'
  const date    = new Date(sim.created_at as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const genDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  const bestColor  = best ? sc(best.forme) : '#3b82f6'
  const bestShort  = best ? sn(best.forme) : ''
  const bestNet    = best?.netAnnuel ?? 0
  const bestIR     = best?.ir ?? 0
  const bestIS     = best?.is ?? 0
  const bestCotis  = best?.charges ?? 0
  const bestScore  = best?.scoreTotal ?? 0
  const caSafe     = Math.max(ca, 1)

  const tmiColor = tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : tmi <= 41 ? '#f97316' : '#ef4444'
  const tmiLabel = tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Intermédiaire' : tmi <= 41 ? 'Tranche haute' : 'Tranche max'
  const tauxEff  = ca > 0 && best ? Math.round((bestIR + bestCotis + bestIS) / ca * 100) : 0

  const analyse  = best ? genAnalyse(best, p, tmi, gain, scored) : null
  const leviers  = best ? genLeviers(best, p, tmi, ca) : []

  const worstName = worst ? sn(worst.forme) : ''
  const gainMois  = Math.round(gain / 12)

  /* ── Section header template ── */
  const ph = (section: string, page: string) => `
  <div class="ph">
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="ph-logo">B</div>
      <div class="ph-brand">${cabinetNom}</div>
      <div class="ph-sep"></div>
      <div class="ph-tag">${section}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <div class="ph-right">${simName} · ${date}</div>
      <div class="ph-pnum">${page}</div>
    </div>
  </div>`

  /* ── Page footer template ── */
  const pf = (extra = '') => `
  <div class="pf">
    <div class="pf-t">${cabinetNom} · ${cabinetEmail} · belhoxper.fr · Barème fiscal 2025</div>
    <div class="pf-t">${extra}Simulation indicative — non contractuelle</div>
  </div>`

  /* ── Helper: colored dot ── */
  const dot = (color: string, size = 8) =>
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};flex-shrink:0;"></div>`

  /* ─── PAGE 1 — COUVERTURE ─── */
  const p1 = `
<div class="page" style="background:#0a0f1e;justify-content:space-between;">

  <!-- Logo header -->
  <div style="padding:32px 44px 0;display:flex;align-items:center;gap:12px;">
    <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#3B82F6,#1D4ED8);
      display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:22px;flex-shrink:0;">B</div>
    <div>
      <div style="color:white;font-weight:800;font-size:16px;line-height:1.2;">${cabinetNom}</div>
      <div style="color:#475569;font-size:9.5px;letter-spacing:2px;text-transform:uppercase;">SIMULATEUR FISCAL · DIRIGEANTS</div>
    </div>
    <div style="margin-left:auto;text-align:right;">
      <div style="color:#475569;font-size:9px;">Document confidentiel</div>
      <div style="color:#334155;font-size:8.5px;">${genDate}</div>
    </div>
  </div>

  <!-- Centre titre -->
  <div style="text-align:center;padding:0 44px;">
    <div style="color:#3B82F6;font-size:9.5px;letter-spacing:3px;text-transform:uppercase;margin-bottom:18px;">
      ─── RAPPORT PERSONNALISÉ · ÉDITION 2025 ───
    </div>
    <div style="color:white;font-size:48px;font-weight:900;line-height:1.1;margin-bottom:12px;letter-spacing:-0.02em;">
      Optimisation<br>rémunération<br><span style="background:linear-gradient(135deg,#8B5CF6,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">de dirigeant</span>
    </div>
    <div style="color:#64748b;font-size:13px;margin-bottom:4px;">
      Comparaison des ${scored.length || 4} structures juridiques · calculs aux barèmes 2025
    </div>
    <div style="height:2px;width:80px;background:linear-gradient(90deg,#3B82F6,#8B5CF6);border-radius:999px;margin:16px auto;"></div>
  </div>

  <!-- Cards résumé -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 44px;">
    <!-- Structure recommandée -->
    <div style="background:#111827;border:1px solid rgba(59,130,246,0.3);border-left:3px solid ${bestColor};border-radius:12px;padding:20px;">
      <div style="color:${bestColor};font-size:8.5px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;font-weight:700;">STRUCTURE RECOMMANDÉE</div>
      <div style="color:${bestColor};font-size:20px;font-weight:900;margin-bottom:8px;">${bestShort}</div>
      <div class="mono" style="color:white;font-size:30px;font-weight:900;line-height:1;margin-bottom:6px;">${fmt(bestNet)}</div>
      <div class="mono" style="color:#94a3b8;font-size:11px;">net après tout · ${fmt(Math.round(bestNet / 12))}/mois</div>
    </div>
    <!-- Gain -->
    <div style="background:#111827;border:1px solid rgba(16,185,129,0.3);border-left:3px solid #10B981;border-radius:12px;padding:20px;">
      <div style="color:#10B981;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;font-weight:700;">GAIN IDENTIFIÉ</div>
      <div class="mono" style="color:#10B981;font-size:30px;font-weight:900;line-height:1;margin-bottom:6px;">
        ${gain > 0 ? '+' + fmt(gain) : '—'}
      </div>
      <div style="color:#94a3b8;font-size:11px;">par an vs structure la moins avantageuse</div>
      ${gain > 0 ? `<div style="color:#64748b;font-size:9.5px;margin-top:4px;">soit +${fmt(gainMois)}/mois</div>` : ''}
    </div>
  </div>

  <!-- Footer couverture -->
  <div style="padding:16px 44px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="color:#475569;font-size:9px;margin-bottom:3px;">PRÉPARÉ POUR</div>
      <div style="color:white;font-size:13px;font-weight:700;">${clientName || 'Votre analyse'}</div>
      <div style="color:#64748b;font-size:10px;">${secteurLabel[(p.secteur as string)] || ''} · CA simulé ${fmt(ca)}</div>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.2);border-radius:999px;padding:4px 10px;">
        <div style="width:5px;height:5px;border-radius:50%;background:#3b82f6;"></div>
        <span style="font-size:8.5px;font-weight:700;color:#60a5fa;">Score ${bestScore}/100</span>
      </div>
      <div style="color:#334155;font-size:8px;margin-top:4px;">Barème fiscal 2025</div>
    </div>
  </div>
</div>`

  /* ─── PAGE 2 — SYNTHÈSE EXÉCUTIVE ─── */
  const p2 = `
<div class="page">
  ${ph('Synthèse exécutive', '2/8')}
  <div class="pb" style="display:grid;grid-template-columns:58% 42%;gap:16px;">

    <!-- GAUCHE — Recommandation principale -->
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <div class="sl"><div class="sd" style="background:${bestColor};"></div>RECOMMANDATION #1</div>
        <div style="background:linear-gradient(135deg,${bestColor}15,${bestColor}06);border:1px solid ${bestColor}30;border-radius:12px;padding:18px;">
          <div style="color:${bestColor};font-size:18px;font-weight:900;margin-bottom:2px;">${bestShort}</div>
          <div style="color:#64748b;font-size:9px;margin-bottom:12px;">rang #1 sur ${scored.length} — ${STRUCT_TYPE[best?.forme || ''] || ''}</div>
          <div style="color:rgba(255,255,255,0.45);font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">REVENU NET APRÈS TOUT</div>
          <div class="mono" style="color:white;font-size:38px;font-weight:900;letter-spacing:-0.03em;line-height:1;margin-bottom:4px;">${fmt(bestNet)}</div>
          <div class="mono" style="color:#94a3b8;font-size:10px;">${fmt(Math.round(bestNet / 12))}/mois · après IR, cotisations &amp; IS</div>
          ${gain > 500 ? `
          <div style="margin-top:10px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:8px 12px;display:inline-flex;align-items:center;gap:6px;">
            <span style="color:#10b981;font-size:13px;">↑</span>
            <span style="color:#34d399;font-size:10px;font-weight:700;">+${fmt(gain)}/an VS ${worstName.toUpperCase()}</span>
          </div>` : ''}
          <!-- Badges -->
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;">
            ${best?.is > 0 ? '<span class="badge badge-blue">RÉGIME IS</span>' : '<span class="badge badge-amber">RÉGIME IR</span>'}
            <span class="badge badge-slate">${STRUCT_TYPE[best?.forme || ''] || ''}</span>
            ${best?.div && best.div > 0 ? '<span class="badge badge-violet">DIVIDENDES PFU 30%</span>' : ''}
          </div>
        </div>
      </div>

      <!-- 2 mini cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="card" style="border-top:2px solid ${bestColor};">
          <div style="color:#64748b;font-size:7.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px;">Net élevé</div>
          <div class="mono" style="color:${bestColor};font-size:15px;font-weight:900;">${pct(bestNet, caSafe)}% du CA</div>
          <div style="color:#475569;font-size:8.5px;margin-top:3px;">conservé après tous prélèvements</div>
        </div>
        <div class="card" style="border-top:2px solid #10b981;">
          <div style="color:#64748b;font-size:7.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px;">Taux effectif</div>
          <div class="mono" style="color:#f87171;font-size:15px;font-weight:900;">${tauxEff}% prélevé</div>
          <div style="color:#475569;font-size:8.5px;margin-top:3px;">cotisations + impôts sur CA total</div>
        </div>
      </div>
    </div>

    <!-- DROITE — KPIs + aperçu structures -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="sl"><div class="sd" style="background:#8b5cf6;"></div>INDICATEURS CLÉS</div>

      <div style="display:flex;flex-direction:column;gap:7px;">
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#94a3b8;font-size:9px;font-weight:600;">CA simulé</div>
          <div class="mono" style="color:#f1f5f9;font-size:13px;font-weight:800;">${fmt(ca)}</div>
        </div>
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#94a3b8;font-size:9px;font-weight:600;">TMI · ${tmiLabel}</div>
          <div class="mono" style="color:${tmiColor};font-size:13px;font-weight:800;">${tmi}%</div>
        </div>
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#94a3b8;font-size:9px;font-weight:600;">Cotisations totales</div>
          <div class="mono" style="color:#f97316;font-size:13px;font-weight:800;">${fmt(bestCotis)}</div>
        </div>
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#94a3b8;font-size:9px;font-weight:600;">IR foyer</div>
          <div class="mono" style="color:#eab308;font-size:13px;font-weight:800;">${fmt(bestIR)}</div>
        </div>
        ${bestIS > 0 ? `
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#94a3b8;font-size:9px;font-weight:600;">IS société</div>
          <div class="mono" style="color:#a855f7;font-size:13px;font-weight:800;">${fmt(bestIS)}</div>
        </div>` : ''}
      </div>

      <div class="sl" style="margin-top:4px;"><div class="sd" style="background:#3b82f6;"></div>APERÇU DES ${scored.length} STRUCTURES</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${scored.map((r, i) => `
        <div style="display:flex;align-items:center;gap:7px;padding:6px 10px;border-radius:8px;
          background:${i === 0 ? sc(r.forme) + '12' : 'rgba(255,255,255,0.03)'};
          border:1px solid ${i === 0 ? sc(r.forme) + '30' : 'rgba(255,255,255,0.05)'};">
          ${dot(sc(r.forme))}
          <span style="font-size:9px;font-weight:${i === 0 ? '700' : '500'};color:${i === 0 ? '#f1f5f9' : '#64748b'};flex:1;">${sn(r.forme)}</span>
          <span class="mono" style="font-size:9px;font-weight:700;color:${sc(r.forme)};">${fmt(r.netAnnuel)}/an</span>
          <span style="font-size:8px;font-weight:600;padding:1px 6px;border-radius:999px;background:rgba(255,255,255,0.07);color:#94a3b8;">${r.scoreTotal}/100</span>
          ${i === 0 ? '<span style="font-size:9px;color:#fbbf24;">★</span>' : ''}
        </div>`).join('')}
      </div>
    </div>
  </div>
  ${pf()}
</div>`

  /* ─── PAGE 3 — STRUCTURE RECOMMANDÉE DÉTAIL ─── */
  const ben       = Math.max(0, ca - charges - amort)
  const remBrut   = best?.netAnnuel ? Math.round(bestNet / 0.65) : 0 // approx brut from net
  const caCotPct  = pct(bestCotis, caSafe)
  const caIrPct   = pct(bestIR, caSafe)
  const caIsPct   = pct(bestIS, caSafe)
  const caNetPct  = pct(bestNet, caSafe)
  const caChgPct  = Math.max(0, pct(charges, caSafe))

  // "Pourquoi pas l'autre structure?" box
  const altForme  = best?.forme.includes('SAS') ? scored.find(r => r.forme.includes('EURL')) : scored.find(r => r.forme.includes('SAS'))
  const altCotDiff = altForme ? Math.abs(altForme.charges - bestCotis) : 0

  const p3 = `
<div class="page">
  ${ph('Section 1 · Structure recommandée', '3/8')}
  <div class="pb" style="display:flex;flex-direction:column;gap:12px;">

    <div>
      <div class="sl"><div class="sd" style="background:${bestColor};"></div>SECTION 1 · STRUCTURE RECOMMANDÉE</div>
      <div style="color:white;font-size:16px;font-weight:900;margin-bottom:3px;">${bestShort} — pourquoi pour vous.</div>
      <div style="color:#64748b;font-size:10px;">${STRUCT_SHORT[best?.forme || ''] || ''}</div>
    </div>

    <!-- Encadré résultat principal -->
    <div style="background:linear-gradient(135deg,rgba(30,58,95,0.6),rgba(15,23,42,0.8));border:1px solid ${bestColor}35;border-left:3px solid ${bestColor};border-radius:12px;padding:18px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="color:rgba(255,255,255,0.4);font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px;">REVENU NET ANNUEL</div>
        <div class="mono" style="color:white;font-size:38px;font-weight:900;letter-spacing:-0.03em;line-height:1;">${fmt(bestNet)}</div>
        <div class="mono" style="color:#94a3b8;font-size:10px;margin-top:4px;">soit ${fmt(Math.round(bestNet / 12))}/mois disponibles</div>
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
        <span style="font-size:28px;font-weight:900;color:${bestColor};">${bestScore}<span style="font-size:14px;">/100</span></span>
        <span class="badge badge-blue">Score #${scored.indexOf(best) + 1} sur ${scored.length}</span>
        ${best?.is > 0 ? '<span class="badge badge-violet">IS 15%/25%</span>' : '<span class="badge badge-amber">IR direct</span>'}
      </div>
    </div>

    <!-- Tableau décomposition -->
    <div>
      <div class="sl"><div class="sd" style="background:#10b981;"></div>DÉCOMPOSITION DU REVENU</div>
      <table class="tbl" style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;">
        <thead><tr>
          <th style="width:50%;">Poste</th>
          <th style="text-align:right;">Montant</th>
          <th style="text-align:right;">% du CA</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="display:flex;align-items:center;gap:6px;">${dot('#3b82f6')} CA brut</td>
            <td class="mono" style="text-align:right;color:#f1f5f9;font-weight:700;">${fmt(ca)}</td>
            <td class="mono" style="text-align:right;color:#64748b;">100%</td>
          </tr>
          ${charges > 0 ? `
          <tr>
            <td style="display:flex;align-items:center;gap:6px;">${dot('#64748b')} Charges d'exploitation</td>
            <td class="mono" style="text-align:right;color:#f87171;font-weight:700;">−${fmt(charges)}</td>
            <td class="mono" style="text-align:right;color:#64748b;">${caChgPct}%</td>
          </tr>` : ''}
          <tr>
            <td style="display:flex;align-items:center;gap:6px;">${dot('#f97316')} Cotisations sociales</td>
            <td class="mono" style="text-align:right;color:#f87171;font-weight:700;">−${fmt(bestCotis)}</td>
            <td class="mono" style="text-align:right;color:#64748b;">${caCotPct}%</td>
          </tr>
          ${bestIS > 0 ? `
          <tr>
            <td style="display:flex;align-items:center;gap:6px;">${dot('#a855f7')} IS société (15%/25%)</td>
            <td class="mono" style="text-align:right;color:#f87171;font-weight:700;">−${fmt(bestIS)}</td>
            <td class="mono" style="text-align:right;color:#64748b;">${caIsPct}%</td>
          </tr>` : ''}
          <tr>
            <td style="display:flex;align-items:center;gap:6px;">${dot('#eab308')} Impôt sur le revenu (IR)</td>
            <td class="mono" style="text-align:right;color:#f87171;font-weight:700;">−${fmt(bestIR)}</td>
            <td class="mono" style="text-align:right;color:#64748b;">${caIrPct}%</td>
          </tr>
          <tr style="background:rgba(16,185,129,0.08);border-top:1px solid rgba(16,185,129,0.2);">
            <td style="display:flex;align-items:center;gap:6px;font-weight:800;color:#f1f5f9;">${dot('#10b981')} <strong>Revenu net</strong></td>
            <td class="mono" style="text-align:right;color:#10b981;font-weight:900;font-size:11px;"><strong>${fmt(bestNet)}</strong></td>
            <td class="mono" style="text-align:right;color:#10b981;font-weight:800;"><strong>${caNetPct}%</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pourquoi pas l'alternative ? -->
    ${altForme ? `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px;">
      <div style="font-size:9px;font-weight:700;color:#60a5fa;margin-bottom:5px;">💡 Pourquoi pas ${sn(altForme.forme)} ?</div>
      <div style="font-size:9px;color:#94a3b8;line-height:1.65;">
        ${altForme.forme.includes('SAS')
          ? `La SAS offre une meilleure protection sociale mais génère <strong style="color:#f1f5f9;">${fmt(altCotDiff)}</strong> de charges supplémentaires/an en cotisations patronales. Pour un profil avec TMI à ${tmi}%, l'avantage net penche clairement vers ${bestShort}.`
          : `L'EURL présente des cotisations TNS inférieures mais implique une comptabilité IS et une gestion dividendes distincte. À ce niveau de CA (${fmt(ca)}), ${bestShort} reste plus adapté selon votre priorité déclarée.`
        }
      </div>
    </div>` : ''}
  </div>
  ${pf()}
</div>`

  /* ─── PAGE 4 — COMPARAISON DÉTAILLÉE ─── */
  const p4 = `
<div class="page">
  ${ph('Section 2 · Comparaison détaillée', '4/8')}
  <div class="pb" style="display:flex;flex-direction:column;gap:12px;">
    <div>
      <div class="sl"><div class="sd" style="background:#8b5cf6;"></div>SECTION 2 · COMPARAISON DÉTAILLÉE — MÊME CA · MÊME CHARGES · MÊME FOYER</div>
    </div>

    <div style="display:grid;grid-template-columns:${scored.length >= 4 ? '1fr 1fr 1fr 1fr' : `repeat(${scored.length},1fr)`};gap:10px;flex:1;">
      ${scored.map((r, i) => {
        const rsc   = sc(r.forme)
        const rCout = r.charges + r.ir + (r.is || 0)
        const ps    = STRUCT_PROT[r.forme] || { label: 'Variable', val: 6, color: '#64748b' }
        const diffBest = r.netAnnuel - bestNet
        const isBest = i === 0
        return `
        <div style="background:${isBest ? rsc + '10' : '#111827'};border:1px solid ${isBest ? rsc + '40' : 'rgba(255,255,255,0.07)'};
          border-top:3px solid ${rsc};border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:7px;">
          <!-- Header -->
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
            ${dot(rsc, 7)}
            <span style="font-size:10px;font-weight:800;color:${rsc};">${sn(r.forme)}</span>
            ${isBest ? '<span style="font-size:9px;color:#fbbf24;margin-left:auto;">★ Best</span>' : ''}
          </div>

          <!-- Score -->
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:12px;font-weight:900;color:white;">${r.scoreTotal}</span>
            <span style="font-size:9px;color:#64748b;">/100</span>
            <span style="margin-left:auto;font-size:8px;padding:1px 6px;border-radius:999px;
              background:${r.scoreTotal >= 65 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)'};
              color:${r.scoreTotal >= 65 ? '#34d399' : '#fbbf24'};font-weight:700;">${STRUCT_TYPE[r.forme] || ''}</span>
          </div>

          <!-- Net -->
          <div>
            <div class="mono" style="color:${rsc};font-size:18px;font-weight:900;line-height:1;">${fmt(r.netAnnuel)}</div>
            <div class="mono" style="color:#64748b;font-size:9px;">${fmt(Math.round(r.netAnnuel / 12))}/mois</div>
          </div>

          <!-- Delta vs best -->
          ${!isBest ? `<div style="font-size:9px;font-weight:700;color:${diffBest > 0 ? '#4ade80' : '#f87171'};">
            ${diffBest > 0 ? '+' : ''}${fmt(diffBest)}/an
          </div>` : `<div style="font-size:8px;color:${rsc};background:${rsc}18;border-radius:5px;padding:2px 6px;display:inline-block;">Recommandée</div>`}

          <!-- Separator -->
          <div style="height:1px;background:rgba(255,255,255,0.06);"></div>

          <!-- Coûts détaillés -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;justify-content:space-between;">
              <span style="font-size:8.5px;color:#64748b;">Cotisations</span>
              <span class="mono" style="font-size:8.5px;color:#f97316;font-weight:700;">−${fmt(r.charges)}</span>
            </div>
            <!-- Mini bar cotis -->
            <div class="bar-track" style="height:3px;"><div class="bar-fill" style="width:${pct(r.charges, caSafe)}%;background:#f97316;"></div></div>
            <div style="display:flex;justify-content:space-between;margin-top:2px;">
              <span style="font-size:8.5px;color:#64748b;">IR</span>
              <span class="mono" style="font-size:8.5px;color:#eab308;font-weight:700;">−${fmt(r.ir)}</span>
            </div>
            <div class="bar-track" style="height:3px;"><div class="bar-fill" style="width:${pct(r.ir, caSafe)}%;background:#eab308;"></div></div>
            ${r.is > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-top:2px;">
              <span style="font-size:8.5px;color:#64748b;">IS</span>
              <span class="mono" style="font-size:8.5px;color:#a855f7;font-weight:700;">−${fmt(r.is)}</span>
            </div>
            <div class="bar-track" style="height:3px;"><div class="bar-fill" style="width:${pct(r.is, caSafe)}%;background:#a855f7;"></div></div>` : ''}
          </div>

          <!-- Separator -->
          <div style="height:1px;background:rgba(255,255,255,0.06);"></div>

          <!-- Coût total + protection -->
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:8px;color:#64748b;">Coût total</span>
            <span class="mono" style="font-size:8.5px;color:#f87171;font-weight:700;">${fmt(rCout)} · ${pct(rCout, caSafe)}%</span>
          </div>
          <div style="font-size:8px;font-weight:600;padding:2px 7px;border-radius:999px;text-align:center;
            background:${ps.color + '18'};color:${ps.color};border:1px solid ${ps.color + '30'};">${ps.label}</div>
        </div>`
      }).join('')}
    </div>
    <div style="font-size:8px;color:#475569;">* Simulation barème IR 2025 · Cotisations SSI par composante · Calculs indicatifs non contractuels</div>
  </div>
  ${pf()}
</div>`

  /* ─── PAGE 5 — SCORE MULTICRITÈRE ─── */
  const p5 = `
<div class="page">
  ${ph('Section 3 · Score multicritère', '5/8')}
  <div class="pb" style="display:flex;flex-direction:column;gap:14px;">

    <div>
      <div class="sl"><div class="sd" style="background:#f59e0b;"></div>SECTION 3 · SCORE MULTICRITÈRE — COMMENT ON NOTE CHAQUE STRUCTURE</div>
    </div>

    <!-- 4 critères -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
      <div class="card card-blue" style="padding:12px;">
        <div style="font-size:20px;font-weight:900;color:#60a5fa;margin-bottom:2px;">NET <span style="font-size:11px;color:#94a3b8;">/60</span></div>
        <div style="font-size:8.5px;font-weight:700;color:#3b82f6;margin-bottom:4px;">Revenu disponible</div>
        <div style="font-size:8px;color:#64748b;line-height:1.5;">Revenu net annuel ramené au CA — principal critère de sélection.</div>
      </div>
      <div class="card card-violet" style="padding:12px;">
        <div style="font-size:20px;font-weight:900;color:#a78bfa;margin-bottom:2px;">FLEX <span style="font-size:11px;color:#94a3b8;">/20</span></div>
        <div style="font-size:8.5px;font-weight:700;color:#8b5cf6;margin-bottom:4px;">Flexibilité</div>
        <div style="font-size:8px;color:#64748b;line-height:1.5;">Arbitrage rémunération/dividendes, facilité de création.</div>
      </div>
      <div class="card card-green" style="padding:12px;">
        <div style="font-size:20px;font-weight:900;color:#34d399;margin-bottom:2px;">PROT <span style="font-size:11px;color:#94a3b8;">/12</span></div>
        <div style="font-size:8.5px;font-weight:700;color:#10b981;margin-bottom:4px;">Protection sociale</div>
        <div style="font-size:8px;color:#64748b;line-height:1.5;">Niveau de retraite, prévoyance et couverture maladie.</div>
      </div>
      <div class="card card-amber" style="padding:12px;">
        <div style="font-size:20px;font-weight:900;color:#fbbf24;margin-bottom:2px;">ADMIN <span style="font-size:11px;color:#94a3b8;">/8</span></div>
        <div style="font-size:8.5px;font-weight:700;color:#f59e0b;margin-bottom:4px;">Simplicité administrative</div>
        <div style="font-size:8px;color:#64748b;line-height:1.5;">Lourdeur comptable, obligations légales.</div>
      </div>
    </div>

    <!-- Tableau barres -->
    <div>
      <div class="sl"><div class="sd" style="background:#3b82f6;"></div>SCORES DÉTAILLÉS PAR STRUCTURE</div>
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;">
        <table class="tbl">
          <thead><tr>
            <th style="width:28%;">Structure</th>
            <th>NET /60</th>
            <th>FLEX /20</th>
            <th>PROT /12</th>
            <th>ADMIN /8</th>
            <th style="text-align:right;">TOTAL</th>
          </tr></thead>
          <tbody>
            ${scored.map((r, i) => {
              const rsc = sc(r.forme)
              const ss  = subScores(r, scored)
              return `
              <tr class="${i === 0 ? 'best' : ''}">
                <td>
                  <div style="display:flex;align-items:center;gap:6px;">
                    ${dot(rsc)}
                    <span style="font-size:9px;font-weight:${i === 0 ? '700' : '500'};color:${i === 0 ? '#f1f5f9' : '#94a3b8'};">${sn(r.forme)}</span>
                    ${i === 0 ? '<span style="font-size:8px;color:#fbbf24;">★</span>' : ''}
                  </div>
                </td>
                <td>
                  <div style="display:flex;align-items:center;gap:5px;">
                    <div class="bar-track" style="height:6px;width:70px;"><div class="bar-fill" style="width:${ss.net / 60 * 100}%;background:#3b82f6;"></div></div>
                    <span class="mono" style="font-size:8.5px;color:#60a5fa;font-weight:700;">${ss.net}</span>
                  </div>
                </td>
                <td>
                  <div style="display:flex;align-items:center;gap:5px;">
                    <div class="bar-track" style="height:6px;width:50px;"><div class="bar-fill" style="width:${ss.flex / 20 * 100}%;background:#8b5cf6;"></div></div>
                    <span class="mono" style="font-size:8.5px;color:#a78bfa;font-weight:700;">${ss.flex}</span>
                  </div>
                </td>
                <td>
                  <div style="display:flex;align-items:center;gap:5px;">
                    <div class="bar-track" style="height:6px;width:40px;"><div class="bar-fill" style="width:${ss.prot / 12 * 100}%;background:#10b981;"></div></div>
                    <span class="mono" style="font-size:8.5px;color:#34d399;font-weight:700;">${ss.prot}</span>
                  </div>
                </td>
                <td>
                  <div style="display:flex;align-items:center;gap:5px;">
                    <div class="bar-track" style="height:6px;width:30px;"><div class="bar-fill" style="width:${ss.admin / 8 * 100}%;background:#f59e0b;"></div></div>
                    <span class="mono" style="font-size:8.5px;color:#fbbf24;font-weight:700;">${ss.admin}</span>
                  </div>
                </td>
                <td style="text-align:right;">
                  <span style="font-size:13px;font-weight:900;color:${i === 0 ? rsc : '#64748b'};">${r.scoreTotal}</span>
                  <span style="font-size:8px;color:#475569;">/100</span>
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Note méthodologie -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:10px 14px;">
      <div style="font-size:8.5px;color:#475569;line-height:1.65;">
        <strong style="color:#64748b;">Méthodologie :</strong> Le score NET (/60) mesure le revenu net disponible après all-in (IR + cotisations + IS) rapporté au CA.
        FLEX (/20) : flexibilité de gestion et d'arbitrage. PROT (/12) : qualité de la protection sociale (retraite, maladie, prévoyance).
        ADMIN (/8) : complexité des obligations comptables et légales. Score total pondéré sur 100 points.
      </div>
    </div>
  </div>
  ${pf()}
</div>`

  /* ─── PAGE 6 — DÉCOMPOSITION FISCALE ─── */
  const wfRows = [
    { label: 'CA brut',            val: ca,        color: '#3b82f6', neg: false },
    ...(charges > 0 ? [{ label: 'Charges exploitation', val: charges, color: '#64748b', neg: true }] : []),
    { label: 'Cotisations sociales', val: bestCotis, color: '#f97316', neg: true  },
    { label: 'IS société',          val: bestIS,    color: '#a855f7', neg: bestIS > 0 },
    { label: 'Impôt sur le revenu', val: bestIR,    color: '#eab308', neg: true  },
    { label: 'Revenu net',          val: bestNet,   color: '#10b981', neg: false },
  ].filter(r => r.val > 0)

  const p6 = `
<div class="page">
  ${ph('Section 4 · Décomposition fiscale', '6/8')}
  <div class="pb" style="display:flex;flex-direction:column;gap:14px;">

    <div>
      <div class="sl"><div class="sd" style="background:#10b981;"></div>SECTION 4 · OÙ PART VOTRE ARGENT — DÉCOMPOSITION COMPLÈTE DU CA</div>
      <div style="color:#94a3b8;font-size:10px;">Structure analysée : <strong style="color:${bestColor};">${bestShort}</strong> · CA : ${fmt(ca)}</div>
    </div>

    <!-- Cascade visuelle -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;">
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${wfRows.map((row, ri) => {
          const barPct = Math.min(100, pct(row.val, caSafe))
          const isLast = ri === wfRows.length - 1
          return `
          <div style="display:flex;align-items:center;gap:10px;">
            ${dot(row.color)}
            <div style="width:130px;flex-shrink:0;font-size:9px;color:${isLast ? '#f1f5f9' : '#94a3b8'};font-weight:${isLast ? '700' : '500'};">${row.label}</div>
            <div style="flex:1;height:${isLast ? '14px' : '10px'};background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;">
              <div style="width:${barPct}%;height:100%;background:${row.color};border-radius:999px;"></div>
            </div>
            <div class="mono" style="width:80px;flex-shrink:0;text-align:right;font-size:10px;font-weight:${isLast ? '800' : '600'};color:${row.color};">
              ${row.neg ? '−' : ''}${fmt(row.val)}
            </div>
            <div class="mono" style="width:28px;flex-shrink:0;text-align:right;font-size:8.5px;color:#334155;">
              ${barPct}%
            </div>
          </div>`
        }).join('')}
      </div>
    </div>

    <!-- Barre waterfall horizontale -->
    <div>
      <div style="display:flex;height:24px;border-radius:6px;overflow:hidden;gap:1px;">
        ${charges > 0 ? `<div style="width:${pct(charges,caSafe)}%;background:#64748b;min-width:2px;display:flex;align-items:center;justify-content:center;font-size:7px;color:white;font-weight:700;">${pct(charges,caSafe) > 6 ? pct(charges,caSafe) + '%' : ''}</div>` : ''}
        <div style="width:${pct(bestCotis,caSafe)}%;background:#f97316;min-width:2px;display:flex;align-items:center;justify-content:center;font-size:7px;color:white;font-weight:700;">${pct(bestCotis,caSafe) > 6 ? pct(bestCotis,caSafe) + '%' : ''}</div>
        ${bestIS > 0 ? `<div style="width:${pct(bestIS,caSafe)}%;background:#a855f7;min-width:2px;display:flex;align-items:center;justify-content:center;font-size:7px;color:white;font-weight:700;">${pct(bestIS,caSafe) > 6 ? pct(bestIS,caSafe) + '%' : ''}</div>` : ''}
        <div style="width:${pct(bestIR,caSafe)}%;background:#eab308;min-width:2px;display:flex;align-items:center;justify-content:center;font-size:7px;color:#000;font-weight:700;">${pct(bestIR,caSafe) > 6 ? pct(bestIR,caSafe) + '%' : ''}</div>
        <div style="flex:1;background:#10b981;min-width:4px;display:flex;align-items:center;justify-content:center;font-size:7.5px;color:#022c22;font-weight:900;">NET ${caNetPct}%</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
        ${[
          ...(charges > 0 ? [{ c: '#64748b', l: `Charges −${fmt(charges)}` }] : []),
          { c: '#f97316', l: `Cotisations −${fmt(bestCotis)}` },
          ...(bestIS > 0 ? [{ c: '#a855f7', l: `IS −${fmt(bestIS)}` }] : []),
          { c: '#eab308', l: `IR −${fmt(bestIR)}` },
          { c: '#10b981', l: `Net ${fmt(bestNet)}` },
        ].map(l => `
        <div style="display:flex;align-items:center;gap:5px;">
          <div style="width:9px;height:9px;border-radius:2px;background:${l.c};"></div>
          <span style="font-size:8.5px;color:#64748b;">${l.l}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- Comparaison coût total des 4 structures -->
    <div>
      <div class="sl"><div class="sd" style="background:#f59e0b;"></div>COÛT TOTAL PAR STRUCTURE</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${scored.map(r => {
          const rCout = r.charges + r.ir + (r.is || 0)
          const rPct  = pct(rCout, caSafe)
          const rsc   = sc(r.forme)
          return `
          <div style="display:flex;align-items:center;gap:8px;">
            ${dot(rsc)}
            <div style="width:100px;font-size:9px;color:#94a3b8;">${sn(r.forme)}</div>
            <div style="flex:1;height:10px;background:rgba(255,255,255,0.05);border-radius:999px;overflow:hidden;">
              <div style="width:${rPct}%;height:100%;background:${rsc};border-radius:999px;opacity:0.7;"></div>
            </div>
            <div class="mono" style="width:70px;text-align:right;font-size:9px;color:#f87171;font-weight:700;">−${fmt(rCout)}</div>
            <div class="mono" style="width:28px;text-align:right;font-size:8.5px;color:#334155;">${rPct}%</div>
          </div>`
        }).join('')}
      </div>
    </div>
  </div>
  ${pf()}
</div>`

  /* ─── PAGE 7 — LEVIERS D'OPTIMISATION ─── */
  const prioColor = (prio: string) =>
    prio.includes('Haute') ? '#f59e0b' : prio.includes('Moyenne') ? '#3b82f6' : '#64748b'
  const prioLabel = (prio: string) =>
    prio.includes('Haute') ? 'HAUTE' : prio.includes('Moyenne') ? 'MOYENNE' : 'FAIBLE'

  const perMax = Math.min(35194, Math.max(0, ben * 0.1))

  const p7 = `
<div class="page">
  ${ph('Section 5 · Leviers d\'optimisation', '7/8')}
  <div class="pb" style="display:flex;flex-direction:column;gap:14px;">

    <div>
      <div class="sl"><div class="sd" style="background:#f59e0b;"></div>SECTION 5 · VOS LEVIERS D'OPTIMISATION — ACTIONS CONCRÈTES POUR AMÉLIORER VOTRE NET</div>
    </div>

    <!-- Leviers cards -->
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${leviers.map(l => {
        const pc = prioColor(l.prio)
        const pl = prioLabel(l.prio)
        return `
        <div style="background:#111827;border:1px solid rgba(255,255,255,0.07);border-left:3px solid ${pc};border-radius:10px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start;">
          <div style="flex:1;">
            <div style="font-size:10px;font-weight:800;color:#f1f5f9;margin-bottom:3px;">${l.levier}</div>
            <div style="font-size:9px;color:#94a3b8;line-height:1.55;">${l.impact}</div>
          </div>
          <div style="flex-shrink:0;text-align:right;">
            <div style="font-size:7.5px;font-weight:800;letter-spacing:0.1em;padding:3px 8px;border-radius:999px;
              background:${pc}18;color:${pc};border:1px solid ${pc}30;">${pl}</div>
          </div>
        </div>`
      }).join('')}
    </div>

    <!-- Tableau récapitulatif -->
    <div>
      <div class="sl"><div class="sd" style="background:#3b82f6;"></div>TABLEAU DE PRIORISATION</div>
      <table class="tbl" style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;">
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
              <td style="font-weight:700;color:#f1f5f9;font-size:9px;">${l.levier}</td>
              <td style="color:#94a3b8;font-size:8.5px;">${l.impact}</td>
              <td>
                <span style="font-size:7.5px;font-weight:800;padding:2px 7px;border-radius:999px;
                  background:${pc}15;color:${pc};border:1px solid ${pc}25;">${prioLabel(l.prio)}</span>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Note -->
    <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:10px 14px;">
      <div style="font-size:8.5px;color:#94a3b8;line-height:1.65;">
        <strong style="color:#fbbf24;">⚠ Important :</strong> Ces leviers sont indicatifs et dépendent de votre situation personnelle complète.
        Votre expert-comptable calculera l'impact précis selon votre dossier : revenus du foyer, statut marital, autres déductions.
        ${perMax > 0 ? ` Plafond PER indicatif estimé : ${fmt(perMax)}/an.` : ''}
      </div>
    </div>
  </div>
  ${pf()}
</div>`

  /* ─── PAGE 8 — PLAN D'ACTION + CONTACT ─── */
  const steps = [
    { n: '01', title: 'Validation de la structure', desc: 'Consultation avec votre expert-comptable pour confirmer le choix structurel selon votre situation complète (revenus du foyer, patrimoine, projets).', color: '#3b82f6' },
    { n: '02', title: 'Formalités de création',     desc: 'Rédaction des statuts, immatriculation au Registre du Commerce et des Sociétés. Délai moyen : 5 à 10 jours ouvrés avec accompagnement.', color: '#8b5cf6' },
    { n: '03', title: 'Ouverture compte professionnel', desc: 'Ouverture d\'un compte bancaire dédié à la structure. Obligatoire pour EURL et SASU. Recommandé dès le premier euro professionnel.', color: '#10b981' },
    { n: '04', title: 'Mise en place comptabilité', desc: 'Tenue comptable régulière, déclarations sociales (DSI/DSN), télédéclarations fiscales. Pilotage continu avec votre cabinet.', color: '#f59e0b' },
  ]

  const p8 = `
<div class="page">
  ${ph('Section 6 · Plan d\'action', '8/8')}
  <div class="pb" style="display:flex;flex-direction:column;gap:14px;">

    <div>
      <div class="sl"><div class="sd" style="background:#3b82f6;"></div>SECTION 6 · PLAN D'ACTION — 4 ÉTAPES POUR METTRE EN ŒUVRE</div>
      <div style="color:white;font-size:14px;font-weight:800;">Votre roadmap vers <span style="color:${bestColor};">${bestShort}</span></div>
    </div>

    <!-- 4 étapes -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${steps.map(s => `
      <div style="background:#111827;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px;display:flex;gap:12px;">
        <div style="width:32px;height:32px;border-radius:8px;background:${s.color}18;border:1px solid ${s.color}30;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:11px;font-weight:900;color:${s.color};">${s.n}</span>
        </div>
        <div>
          <div style="font-size:10px;font-weight:800;color:#f1f5f9;margin-bottom:4px;">${s.title}</div>
          <div style="font-size:8.5px;color:#64748b;line-height:1.6;">${s.desc}</div>
        </div>
      </div>`).join('')}
    </div>

    <!-- Récapitulatif simulation -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px;">
      <div class="sl" style="margin-bottom:8px;"><div class="sd" style="background:#64748b;"></div>RÉCAPITULATIF DE VOTRE SIMULATION</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <div style="text-align:center;">
          <div style="font-size:8px;color:#64748b;margin-bottom:2px;">CA simulé</div>
          <div class="mono" style="font-size:13px;font-weight:800;color:#f1f5f9;">${fmt(ca)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:8px;color:#64748b;margin-bottom:2px;">Structure</div>
          <div style="font-size:11px;font-weight:800;color:${bestColor};">${bestShort}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:8px;color:#64748b;margin-bottom:2px;">Net annuel</div>
          <div class="mono" style="font-size:13px;font-weight:800;color:#10b981;">${fmt(bestNet)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:8px;color:#64748b;margin-bottom:2px;">Gain vs pire</div>
          <div class="mono" style="font-size:13px;font-weight:800;color:#4ade80;">+${fmt(gain)}</div>
        </div>
      </div>
    </div>

    <!-- Footer contact (plein fond bleu) -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#0f2847);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:18px 20px;display:flex;gap:20px;align-items:center;">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;">
          <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
            display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:white;flex-shrink:0;">B</div>
          <div>
            <div style="color:white;font-size:13px;font-weight:800;">${cabinetNom}</div>
            <div style="color:#94a3b8;font-size:9px;">Experts en optimisation fiscale des dirigeants</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
          <div style="font-size:9px;color:#94a3b8;">📍 Lyon — 10 rue de la République, 69001</div>
          <div style="font-size:9px;color:#94a3b8;">✉ <strong style="color:#60a5fa;">${cabinetEmail}</strong></div>
          <div style="font-size:9px;color:#94a3b8;">📍 Montluel — 12 place du Marché, 01120</div>
          <div style="font-size:9px;color:#94a3b8;">🌐 <strong style="color:#60a5fa;">belhoxper.fr</strong></div>
        </div>
      </div>
      <div style="flex-shrink:0;text-align:center;">
        <div style="background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.35);border-radius:999px;
          padding:6px 16px;font-size:9.5px;font-weight:800;color:#34d399;margin-bottom:6px;">
          📅 Première consultation offerte
        </div>
        <div style="font-size:8.5px;color:#64748b;">Rappel sous 24h · Sans engagement</div>
      </div>
    </div>

    <!-- Disclaimer -->
    <div style="text-align:center;">
      <div style="font-size:7.5px;color:#334155;line-height:1.7;">
        © 2025 Cabinet ${cabinetNom} · Document généré le ${genDate} · Simulation indicative barème fiscal 2025<br>
        Ne constitue pas un conseil fiscal personnalisé. À valider avec votre expert-comptable pour application à votre situation réelle.
      </div>
    </div>
  </div>
  ${pf('')}
</div>`

  /* ─── ASSEMBLY ─── */
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport fiscal — ${simName} — ${cabinetNom}</title>
<script>window.onload=function(){setTimeout(function(){window.print()},800);};</script>
<style>
${CSS}
</style>
</head>
<body>

<!-- Print bar (screen only) -->
<div class="pbar">
  <span class="pbar-title">Rapport fiscal — ${simName}</span>
  <button class="pbtn pbtn-p" onclick="window.print()">⬇&nbsp; Télécharger en PDF</button>
  <button class="pbtn pbtn-s" onclick="history.back()">← Retour</button>
</div>

<div class="pw">
${p1}
${p2}
${p3}
${p4}
${p5}
${p6}
${p7}
${p8}
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

    const rawName = ((sim as Record<string, unknown>).name as string) || 'rapport'
    const safeName = rawName.replace(/[^a-z0-9\-_ ]/gi, '_').slice(0, 60)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-belhoxper-${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[pdf] Puppeteer indisponible — fallback HTML+print:', err)
  }

  /* ── Fallback HTML (window.print() auto) ── */
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
