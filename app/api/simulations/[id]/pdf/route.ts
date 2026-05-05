import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  type Scored,
  fmt, formeColor, formeBorderColor, remDesc,
  situLabel, secteurLabel,
  PDF_BASE_CSS,
  genAnalyse, genLeviers,
} from '@/lib/pdf/utils'

/* ─────────────────────────────────────────────────────────
   Template HTML — 3 pages A4
───────────────────────────────────────────────────────── */
function generateHtml(
  sim: Record<string, unknown>,
  cabinetNom = 'Belho Xper',
  cabinetEmail = 'contact@belhoxper.fr',
  clientName = '',
): string {
  const results = (sim.results as { scored?: Scored[] }) || {}
  const scored = results.scored || []
  const best = scored[0]
  const p = (sim.params as Record<string, unknown>) || {}
  const tmi = (sim.tmi as number) || 0
  const gain = (sim.gain as number) || 0
  const ca = (sim.ca as number) || (p.ca as number) || 0
  const charges = (p.charges as number) || 0
  const amort = (p.amort as number) || 0
  const date = new Date(sim.created_at as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const genDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const simName = (sim.name as string) || 'Simulation'

  /* Décomposition CA */
  const bestCharges = best?.charges ?? 0
  const bestIR = best?.ir ?? 0
  const bestIS = best?.is ?? 0
  const bestNet = best?.netAnnuel ?? 0
  const caSafe = Math.max(1, ca)
  const netPct = Math.round(bestNet / caSafe * 100)
  const cotisPct = Math.round(bestCharges / caSafe * 100)
  const irPct = Math.round(bestIR / caSafe * 100)
  const isPct = Math.round(bestIS / caSafe * 100)
  const chargesPct = Math.max(0, 100 - netPct - cotisPct - irPct - isPct)

  const analyse = best ? genAnalyse(best, p, tmi, gain, scored) : null
  const leviers = best ? genLeviers(best, p, tmi, ca) : []

  const paramsRows: [string, string][] = [
    ['Situation', situLabel[(p.situation as string)] || '—'],
    ["Secteur d'activité", secteurLabel[(p.secteur as string)] || '—'],
    ['Chiffre d\'affaires', fmt(ca)],
    ['Charges déductibles', fmt(charges)],
    ...(amort > 0 ? [['Amortissements', fmt(amort)] as [string, string]] : []),
    ['Foyer fiscal', `${(p.partsBase as number) === 2 ? 'En couple' : 'Célibataire'}${(p.nbEnfants as number) > 0 ? ` · ${p.nbEnfants} enfant${(p.nbEnfants as number) > 1 ? 's' : ''}` : ''}`],
    ['Parts fiscales', `${p.parts || 1} part${(p.parts as number) > 1 ? 's' : ''}`],
    ...((p.remNetAnn as number) > 0 ? [['Rémunération cible', fmt(p.remNetAnn as number)] as [string, string]] : []),
    ...((p.perMontant as number) > 0 ? [['PER versé', fmt(p.perMontant as number)] as [string, string]] : [['PER versé', '0 €'] as [string, string]]),
    ...((p.autresRev as number) > 0 ? [['Autres revenus', fmt(p.autresRev as number)] as [string, string]] : []),
  ]

  const bestColor = best ? (formeColor[best.forme] || '#3b82f6') : '#3b82f6'
  const bestBorder = best ? (formeBorderColor[best.forme] || '#2563eb') : '#2563eb'
  const tmiColor = tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : '#ef4444'
  const tmiLabel = tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Intermédiaire' : 'Tranche haute'
  const tauxEff = ca > 0 && best ? Math.round((best.ir + best.charges) / ca * 100) : 0

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport — ${simName} — ${cabinetNom}</title>
<script>window.onload=function(){setTimeout(function(){window.print()},700);};</script>
<style>
${PDF_BASE_CSS}
.cv-logo { padding: 30px 42px 0; display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
.cv-ctr { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 42px; text-align: center; }
.cv-ey { font-size: 9.5px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: #60a5fa; margin-bottom: 14px; display: flex; align-items: center; gap: 7px; justify-content: center; }
.cv-dot { width: 5px; height: 5px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }
.cv-div { width: 90px; height: 3px; border-radius: 999px; background: linear-gradient(90deg,#3b82f6,#8b5cf6); margin: 16px auto; }
.cv-grad { background: linear-gradient(135deg,#60a5fa,#a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.cv-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 18px; padding: 24px 36px; display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; max-width: 476px; }
.cv-lbl { font-size: 8.5px; font-weight: 700; color: rgba(255,255,255,.28); text-transform: uppercase; letter-spacing: .09em; }
.cv-val { font-size: 38px; font-weight: 900; color: #f1f5f9; letter-spacing: -.03em; line-height: 1; }
.cv-sub { font-size: 9px; color: rgba(255,255,255,.28); }
.cv-score { font-size: 50px; font-weight: 900; letter-spacing: -.03em; line-height: 1; }
.cv-row { display: flex; gap: 28px; align-items: flex-start; }
.cv-col { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.cv-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.cv-gain { background: rgba(16,185,129,.13); border: 1px solid rgba(16,185,129,.28); border-radius: 11px; padding: 10px 18px; text-align: center; width: 100%; }
.cv-gv { font-size: 18px; font-weight: 900; color: #34d399; letter-spacing: -.02em; }
.cv-gs { font-size: 8.5px; color: rgba(52,211,153,.55); margin-top: 2px; }
.cv-foot { padding: 16px 42px; border-top: 1px solid rgba(255,255,255,.07); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.cv-ft { font-size: 9px; color: rgba(255,255,255,.28); line-height: 1.6; }
</style>
</head>
<body>
<div class="print-bar">
  <span class="print-bar-title">Rapport fiscal — ${simName}</span>
  <button class="pbtn pbtn-p" onclick="window.print()">⬇&nbsp; Télécharger en PDF</button>
  <button class="pbtn pbtn-s" onclick="window.close()">← Retour</button>
</div>
<div class="page-wrap">

<!-- PAGE 1 — COUVERTURE -->
<div class="page cover">
  <div class="cv-logo">
    <div class="logo-badge">B</div>
    <div>
      <div style="font-size:14px;font-weight:800;color:white;line-height:1.2;">${cabinetNom}</div>
      <div style="font-size:9.5px;color:rgba(255,255,255,.32);">Cabinet d'expertise comptable &amp; conseil fiscal</div>
    </div>
  </div>

  <div class="cv-ctr">
    <div class="cv-ey"><div class="cv-dot"></div>Analyse fiscale personnalisée · Barème 2025</div>
    <div style="font-size:34px;font-weight:900;color:white;letter-spacing:-.02em;line-height:1.1;margin-bottom:8px;">Optimisation de votre<br><span class="cv-grad">rémunération</span></div>
    <div class="cv-div"></div>

    <div class="cv-card">
      <div style="font-size:13px;color:rgba(255,255,255,.55);font-weight:500;">${simName}</div>
      ${clientName ? `<div style="font-size:11px;color:rgba(255,255,255,.3);">${clientName}</div>` : ''}
      <div style="font-size:9.5px;color:rgba(255,255,255,.22);">Générée le ${genDate}</div>

      <div class="cv-row">
        <div class="cv-col">
          <div class="cv-lbl">CA analysé</div>
          <div class="cv-val">${fmt(ca)}</div>
          <div class="cv-sub">annuel</div>
        </div>
        ${best ? `
        <div class="cv-col">
          <div class="cv-lbl">Score</div>
          <div class="cv-score" style="color:${bestColor};">${best.scoreTotal}</div>
          <div class="cv-sub">/100</div>
        </div>` : ''}
      </div>

      ${best ? `
      <div style="text-align:center;">
        <div class="cv-lbl" style="margin-bottom:6px;">Structure recommandée</div>
        <div class="cv-badge" style="background:${bestColor}18;border:1px solid ${bestColor}38;color:${bestColor};">
          <span style="width:5px;height:5px;border-radius:50%;background:${bestColor};display:inline-block;flex-shrink:0;"></span>
          ${best.forme}
        </div>
      </div>
      <div style="text-align:center;">
        <div class="cv-lbl" style="margin-bottom:4px;">Revenu net annuel</div>
        <div style="font-size:28px;font-weight:900;color:${bestColor};letter-spacing:-.02em;line-height:1.1;">${fmt(best.netAnnuel)}</div>
        <div class="cv-sub">${fmt(Math.round(best.netAnnuel / 12))}/mois</div>
      </div>` : ''}

      ${gain > 500 ? `
      <div class="cv-gain">
        <div class="cv-gv">+${fmt(gain)}/an</div>
        <div class="cv-gs">vs structure la moins avantageuse · +${fmt(Math.round(gain / 12))}/mois</div>
      </div>` : ''}
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

<!-- PAGE 2 — PARAMÈTRES + RÉSULTATS -->
<div class="page">
  <div class="ph">
    <div class="ph-l">
      <div class="ph-logo">B</div>
      <div class="ph-brand">${cabinetNom}</div>
      <div class="ph-tag">Paramètres &amp; résultats</div>
    </div>
    <div class="ph-r">${simName} · ${date}</div>
  </div>

  <div class="pb">

    <!-- A — Paramètres -->
    <div class="sl" style="margin-bottom:7px;"><div class="sd"></div>A — Paramètres de la simulation</div>
    <div style="background:white;border:1px solid #e2e8f0;border-radius:9px;overflow:hidden;margin-bottom:12px;">
      <table class="ptb">
        ${paramsRows.map(([l, v], i) => `
        <tr style="${i % 2 === 0 ? 'background:#fafbfc;' : 'background:white;'}">
          <td class="pl">${l}</td>
          <td class="pv">${v}</td>
        </tr>`).join('')}
      </table>
    </div>

    <!-- B — Structure recommandée -->
    ${best ? `
    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:${bestColor};"></div>B — Structure recommandée</div>
    <div class="rc" style="border-left-width:4px;border-left-color:${bestBorder};margin-bottom:12px;">
      <div class="rc-ey" style="color:${bestColor};">✦ Meilleure structure pour votre profil</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:2px;">
        <div class="rc-t">${best.forme}</div>
        <div class="rc-sb">Score ${best.scoreTotal}/100</div>
      </div>
      <div class="rc-d">${remDesc[best.forme] || ''}</div>
      <div class="krow">
        <div class="kb">
          <div class="kl">Net annuel</div>
          <div class="kv" style="color:${bestColor};">${fmt(best.netAnnuel)}</div>
          <div class="ks">${fmt(Math.round(best.netAnnuel / 12))}/mois</div>
        </div>
        <div class="kb">
          <div class="kl">Taux effectif</div>
          <div class="kv">${tauxEff}%</div>
          <div class="ks">sur CA total</div>
        </div>
        <div class="kb">
          <div class="kl">TMI</div>
          <div class="kv" style="color:${tmiColor};">${tmi}%</div>
          <div class="ks">${tmiLabel}</div>
        </div>
        <div class="kb">
          <div class="kl">CA simulé</div>
          <div class="kv">${fmt(ca)}</div>
          <div class="ks">brut annuel</div>
        </div>
      </div>
      ${gain > 500 ? `
      <div class="gbox">
        <div class="ga">↑</div>
        <div class="gt">+${fmt(gain)}/an vs moins avantageuse &nbsp;·&nbsp; +${fmt(Math.round(gain / 12))}/mois</div>
      </div>` : ''}
    </div>` : ''}

    <!-- C — Tableau comparatif -->
    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#8b5cf6;"></div>C — Tableau comparatif des 4 structures</div>
    <table class="ct">
      <thead><tr>
        <th>Structure</th><th>Net/an</th><th>Net/mois</th><th>Cotisations</th><th>IR</th><th>IS</th><th>Score</th>
      </tr></thead>
      <tbody>
        ${scored.map((r, i) => `
        <tr class="${i === 0 ? 'btr' : ''}">
          <td><strong style="color:${formeColor[r.forme] || '#1e293b'}">${r.forme}</strong>${i === 0 ? '<span class="sbadge">★ Rec.</span>' : ''}</td>
          <td class="pos">${fmt(r.netAnnuel)}</td>
          <td style="color:#475569;">${fmt(Math.round(r.netAnnuel / 12))}</td>
          <td class="neg">−${fmt(r.charges)}</td>
          <td class="neg">−${fmt(r.ir)}</td>
          <td style="color:#7c3aed;">${r.is > 0 ? `−${fmt(r.is)}` : '—'}</td>
          <td><strong style="color:${i === 0 ? '#1d4ed8' : '#94a3b8'}">${r.scoreTotal}/100</strong></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="tn">* Barème IR 2025 · Cotisations SSI par composante · Calculs indicatifs non contractuels</div>

    <!-- D — Décomposition CA -->
    ${best ? `
    <div style="margin-top:12px;">
      <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#10b981;"></div>D — Décomposition du CA (${fmt(ca)}) avec ${best.forme}</div>
      <div class="bt">
        ${chargesPct > 0 ? `<div class="bs" style="width:${chargesPct}%;background:#cbd5e1;color:#475569;">${chargesPct > 5 ? chargesPct + '%' : ''}</div>` : ''}
        <div class="bs" style="width:${cotisPct}%;background:#fca5a5;color:#7f1d1d;">${cotisPct > 5 ? cotisPct + '%' : ''}</div>
        <div class="bs" style="width:${irPct}%;background:#fdba74;color:#7c2d12;">${irPct > 5 ? irPct + '%' : ''}</div>
        ${isPct > 0 ? `<div class="bs" style="width:${isPct}%;background:#c4b5fd;color:#3b0764;">${isPct > 5 ? isPct + '%' : ''}</div>` : ''}
        <div class="bs" style="width:${netPct}%;background:#86efac;color:#14532d;font-weight:900;">NET ${netPct}%</div>
      </div>
      <div class="bl">
        ${chargesPct > 0 ? `<div class="bli"><div class="bld" style="background:#cbd5e1;"></div>Charges ${fmt(charges)}</div>` : ''}
        <div class="bli"><div class="bld" style="background:#fca5a5;"></div>Cotisations −${fmt(bestCharges)}</div>
        <div class="bli"><div class="bld" style="background:#fdba74;"></div>IR −${fmt(bestIR)}</div>
        ${bestIS > 0 ? `<div class="bli"><div class="bld" style="background:#c4b5fd;"></div>IS −${fmt(bestIS)}</div>` : ''}
        <div class="bli"><div class="bld" style="background:#86efac;"></div><strong>Net ${fmt(bestNet)}</strong></div>
      </div>
    </div>` : ''}

  </div>
  <div class="pf">
    <div class="pf-t">${cabinetNom} · ${cabinetEmail} · belhoxper.fr</div>
    <div style="display:flex;align-items:center;gap:7px;">
      <div class="pf-t">Simulation indicative — barème fiscal 2025</div>
      <div class="pn">2/3</div>
    </div>
  </div>
</div>

<!-- PAGE 3 — ANALYSE + LEVIERS + CONTACT -->
<div class="page">
  <div class="ph">
    <div class="ph-l">
      <div class="ph-logo">B</div>
      <div class="ph-brand">${cabinetNom}</div>
      <div class="ph-tag">Analyse &amp; optimisation</div>
    </div>
    <div class="ph-r">${simName} · ${date}</div>
  </div>

  <div class="pb">

    <!-- A — Analyse experte -->
    ${analyse ? `
    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#8b5cf6;"></div>A — Analyse experte</div>
    <div class="ab">
      <div class="ah">💡 Pourquoi ${best?.forme || 'cette structure'} ?</div>
      <p class="ap">${analyse.p1}</p>
      <p class="ap">${analyse.p2}</p>
      <div class="asub" style="color:#dc2626;">⚠ Points de vigilance</div>
      <ul class="alist">${analyse.vigilance.map(v => `<li>${v}</li>`).join('')}</ul>
    </div>` : ''}

    <!-- B — Leviers d'optimisation -->
    ${leviers.length > 0 ? `
    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#f59e0b;"></div>B — Leviers d'optimisation identifiés</div>
    <table class="lt">
      <thead><tr>
        <th style="width:42%;">Levier</th><th style="width:43%;">Impact estimé</th><th style="width:15%;">Priorité</th>
      </tr></thead>
      <tbody>
        ${leviers.map((l, i) => `
        <tr style="${i % 2 === 0 ? 'background:#fafbfc;' : 'background:white;'}">
          <td style="font-weight:700;color:#0f172a;">${l.levier}</td>
          <td style="color:#475569;">${l.impact}</td>
          <td style="font-size:9px;font-weight:700;color:#475569;white-space:nowrap;">${l.prio}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="tn" style="margin-bottom:10px;">Ces leviers sont indicatifs. Votre expert-comptable calculera l'impact précis selon votre dossier.</div>` : ''}

    <!-- C — Contact -->
    <div class="sl" style="margin-bottom:7px;"><div class="sd" style="background:#10b981;"></div>C — Mettre en œuvre cette stratégie</div>
    <div class="cb">
      <div class="cb-l">
        <div class="cbn">${cabinetNom}</div>
        <div class="cbt">Nos experts fiscalistes vous accompagnent pour déployer cette stratégie et piloter votre optimisation en continu.</div>
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

  let cabinetNom = 'Belho Xper'
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
