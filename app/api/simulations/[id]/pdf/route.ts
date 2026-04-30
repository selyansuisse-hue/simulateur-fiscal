import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Scored = { forme: string; netAnnuel: number; ir: number; charges: number; is: number; scoreTotal: number }

const situLabel: Record<string, string> = { creation: 'Création', existant: 'Existant', changement: 'Changement' }
const secteurLabel: Record<string, string> = {
  services_bic: 'Services BIC', liberal_bnc: 'BNC libéral', commerce: 'Commerce', btp: 'BTP/Artisanat',
}
const remDesc: Record<string, string> = {
  'SAS / SASU': 'Salaire assimilé salarié + dividendes sans cotisations sociales',
  'EURL / SARL (IS)': 'Rémunération TNS déductible IS + dividendes (IS 15%/25%)',
  'EI (réel normal)': 'Bénéfice imposable IR — cotisations SSI sur résultat net',
  'Micro-entreprise': 'Abattement forfaitaire sur CA — pas de déduction charges réelles',
}
const formeColor: Record<string, string> = {
  'SAS / SASU': '#a78bfa',
  'EURL / SARL (IS)': '#60a5fa',
  'EI (réel normal)': '#fbbf24',
  'Micro-entreprise': '#94a3b8',
}

function generateHtml(sim: Record<string, unknown>, cabinetNom?: string, cabinetEmail?: string): string {
  const results = (sim.results as { scored?: Scored[] }) || {}
  const scored = results.scored || []
  const best = scored[0]
  const p = (sim.params as Record<string, unknown>) || {}
  const date = new Date(sim.created_at as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const genDate = new Date().toLocaleDateString('fr-FR')
  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR') + '\u202f€'

  const params = [
    ['CA', fmt(sim.ca as number)],
    ['Charges déductibles', fmt((p.charges as number) || 0)],
    ...((p.amort as number) > 0 ? [['Amortissements', fmt(p.amort as number)]] : []),
    ['Situation', situLabel[(p.situation as string) || (sim.situation as string)] || (sim.situation as string)],
    ['Foyer', `${(p.partsBase as number) === 2 ? 'En couple' : 'Célibataire'}${(p.nbEnfants as number) > 0 ? ` · ${p.nbEnfants} enfant${(p.nbEnfants as number) > 1 ? 's' : ''}` : ''}`],
    ...((p.secteur as string) ? [['Secteur', secteurLabel[p.secteur as string] || (p.secteur as string)]] : []),
    ...((p.perMontant as number) > 0 ? [['PER', fmt(p.perMontant as number)]] : []),
    ...((p.autresRev as number) > 0 ? [['Autres revenus', fmt(p.autresRev as number)]] : []),
  ]

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }

  /* Header */
  .header { background: #050c1a; color: white; padding: 24px 36px; display: flex; justify-content: space-between; align-items: center; }
  .logo-box { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg,#3b82f6,#1d4ed8); display: inline-flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: white; margin-right: 10px; vertical-align: middle; }
  .logo-text { font-size: 17px; font-weight: 800; color: white; vertical-align: middle; }
  .header-right { text-align: right; font-size: 11px; color: rgba(255,255,255,0.45); }
  .header-right strong { color: rgba(255,255,255,0.75); display: block; font-size: 13px; }

  /* Page padding */
  .page { padding: 32px 36px; }

  /* Hero */
  .hero { background: linear-gradient(135deg,#0d1627,#0d1f3c); border-radius: 14px; padding: 28px 32px; margin-bottom: 28px; border: 1px solid rgba(37,99,235,0.2); }
  .hero-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #60a5fa; margin-bottom: 8px; }
  .hero-forme { font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.65); margin-bottom: 4px; }
  .hero-net { font-size: 48px; font-weight: 900; color: #60a5fa; letter-spacing: -0.03em; line-height: 1; margin-bottom: 4px; }
  .hero-sub { color: rgba(255,255,255,0.35); font-size: 13px; margin-bottom: 16px; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 999px; margin-right: 6px; margin-top: 4px; }
  .badge-blue { background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3); color: #93c5fd; }
  .badge-green { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25); color: #4ade80; }
  .badge-grey { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.45); }

  /* Section */
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }

  /* Params pills */
  .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
  .pill { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; font-size: 12px; }
  .pill-label { color: #64748b; margin-right: 4px; }
  .pill-val { color: #0f172a; font-weight: 600; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; padding: 9px 12px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; white-space: nowrap; }
  .best-row { background: rgba(37,99,235,0.03); }
  tr:last-child td { border-bottom: none; }
  .best-badge { background: #1d4ed8; color: white; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 100px; margin-left: 6px; }

  /* Remuneration cards */
  .rem-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
  .rem-card { border-radius: 10px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; }
  .rem-forme { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
  .rem-desc { font-size: 11px; color: #64748b; line-height: 1.4; }

  /* Footer */
  .footer { margin-top: 36px; padding: 16px 36px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
  .footer-legal { font-size: 10px; color: #cbd5e1; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="header">
  <div>
    <span class="logo-box">B</span>
    <span class="logo-text">${cabinetNom || 'Belho Xper'}</span>
  </div>
  <div class="header-right">
    <strong>Rapport de simulation fiscale</strong>
    ${sim.name as string} · ${date}
  </div>
</div>

<div class="page">

  ${best ? `
  <div class="hero">
    <div class="hero-label">Structure recommandée</div>
    <div class="hero-forme">${best.forme}</div>
    <div class="hero-net">${fmt(best.netAnnuel)}</div>
    <div class="hero-sub">${fmt(Math.round(best.netAnnuel / 12))}/mois net après IR, cotisations et IS</div>
    <span class="badge badge-blue">TMI ${sim.tmi}%</span>
    <span class="badge badge-grey">CA ${fmt(sim.ca as number)}</span>
    ${(sim.gain as number) > 500 ? `<span class="badge badge-green">+${fmt(sim.gain as number)}/an vs moins favorable</span>` : ''}
  </div>` : ''}

  <div class="section-title">Paramètres de simulation</div>
  <div class="pills">
    ${params.map(([l, v]) => `<div class="pill"><span class="pill-label">${l}</span><span class="pill-val">${v}</span></div>`).join('')}
  </div>

  <div class="section-title">Comparaison des 4 structures</div>
  <table>
    <thead>
      <tr>
        <th>Structure</th><th>Net annuel</th><th>Net / mois</th><th>Cotisations</th><th>IR</th><th>IS</th><th>Score</th>
      </tr>
    </thead>
    <tbody>
      ${scored.map((r, i) => `
      <tr class="${i === 0 ? 'best-row' : ''}">
        <td><strong style="color:${formeColor[r.forme] || '#1e293b'}">${r.forme}</strong>${i === 0 ? '<span class="best-badge">★ Recommandé</span>' : ''}</td>
        <td><strong style="color:#166534">${fmt(r.netAnnuel)}</strong></td>
        <td style="color:#475569">${fmt(Math.round(r.netAnnuel / 12))}</td>
        <td style="color:#dc2626">−${fmt(r.charges)}</td>
        <td style="color:#dc2626">−${fmt(r.ir)}</td>
        <td style="color:#7c3aed">${r.is > 0 ? `−${fmt(r.is)}` : '—'}</td>
        <td><strong style="color:${i === 0 ? '#1d4ed8' : '#64748b'}">${r.scoreTotal}/100</strong></td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="section-title">Mode de rémunération par structure</div>
  <div class="rem-grid">
    ${scored.map(r => `
    <div class="rem-card">
      <div class="rem-forme" style="color:${formeColor[r.forme] || '#1e293b'}">${r.forme}</div>
      <div class="rem-desc">${remDesc[r.forme] || ''}</div>
    </div>`).join('')}
  </div>

  <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;font-size:11px;color:#854d0e;line-height:1.6;">
    <strong>Mention légale :</strong> Ce rapport est fourni à titre indicatif et ne constitue pas un conseil fiscal ou juridique contractuel. Les calculs sont basés sur les données saisies et la législation fiscale 2025. Consultez un expert-comptable pour valider votre situation personnelle.
  </div>

</div>

<div class="footer">
  <div>
    <strong>${cabinetNom || 'Belho Xper'}</strong>${cabinetEmail ? ` · ${cabinetEmail}` : ' · belhoxper.com'}
  </div>
  <div class="footer-legal">Généré le ${genDate}</div>
</div>

</body>
</html>`
}

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

  // Récupérer infos cabinet pour le pied de page PDF
  let cabinetNom: string | undefined
  let cabinetEmail: string | undefined
  try {
    const { data: cab } = await supabase
      .from('cabinets')
      .select('nom, email_contact')
      .eq('slug', 'belho-xper')
      .single()
    if (cab) { cabinetNom = cab.nom; cabinetEmail = cab.email_contact }
  } catch { /* optionnel */ }

  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(
      generateHtml(sim as Record<string, unknown>, cabinetNom, cabinetEmail),
      { waitUntil: 'networkidle0' }
    )
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    })
    await browser.close()

    const safeName = ((sim as Record<string, unknown>).name as string).replace(/[^a-z0-9\-_ ]/gi, '_').slice(0, 60)
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="simulation-${safeName}.pdf"`,
      },
    })
  } catch {
    const html = generateHtml(sim as Record<string, unknown>, cabinetNom, cabinetEmail)
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
