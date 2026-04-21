import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateHtml(sim: Record<string, unknown>): string {
  const results = (sim.results as { scored?: Array<{forme: string; netAnnuel: number; ir: number; charges: number; is: number; scoreTotal: number}> }) || {}
  const scored = results.scored || []
  const best = scored[0]
  const date = new Date(sim.created_at as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0B1627; margin: 0; padding: 32px; font-size: 13px; }
  .header { background: #050c1a; color: white; padding: 28px 32px; margin: -32px -32px 32px; display: flex; justify-content: space-between; align-items: center; }
  .logo { font-size: 18px; font-weight: 800; }
  .header-right { font-size: 11px; color: rgba(255,255,255,.5); text-align: right; }
  h1 { font-size: 28px; font-weight: 800; margin: 0 0 6px; color: #0B1627; letter-spacing: -0.02em; }
  h2 { font-size: 14px; font-weight: 700; color: #0B1627; margin: 24px 0 10px; border-bottom: 1px solid #E2EAF5; padding-bottom: 6px; }
  .hero { background: #050c1a; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; color: white; }
  .hero-net { font-size: 48px; font-weight: 800; color: #60a5fa; }
  .hero-sub { color: rgba(255,255,255,.45); font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #4A6380; padding: 8px 12px; background: #F0F4FA; border-bottom: 1px solid #E2EAF5; }
  td { padding: 9px 12px; border-bottom: 1px solid #E2EAF5; font-size: 12px; }
  .best-row { background: rgba(29,78,216,.04); }
  .best-badge { background: #1D4ED8; color: white; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 100px; margin-left: 6px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2EAF5; font-size: 11px; color: #8FA3B8; text-align: center; }
  .tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 100px; }
  .tag-blue { background: #EFF6FF; color: #1539B2; border: 1px solid #BFDBFE; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">🏢 Belho Xper</div>
  <div class="header-right">
    ${sim.name as string}<br />
    ${date}
  </div>
</div>

<h1>${sim.name as string}</h1>
<p style="color:#4A6380;margin-bottom:20px">Simulation fiscale 2025 · CA ${fmt(sim.ca as number)} · TMI ${sim.tmi}%</p>

${best ? `
<div class="hero">
  <div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#60a5fa;margin-bottom:8px">Structure recommandée</div>
  <div style="font-size:16px;font-weight:700;color:rgba(255,255,255,.75);margin-bottom:4px">${best.forme}</div>
  <div class="hero-net">${fmt(best.netAnnuel)}</div>
  <div class="hero-sub">${fmt(best.netAnnuel / 12)}/mois · net après IR & cotisations</div>
</div>` : ''}

<h2>Comparaison des structures</h2>
<table>
  <thead>
    <tr>
      <th>Structure</th><th>Net/an</th><th>Net/mois</th><th>Cotisations</th><th>IR</th><th>IS</th><th>Score</th>
    </tr>
  </thead>
  <tbody>
    ${scored.map((r, i) => `
    <tr class="${i === 0 ? 'best-row' : ''}">
      <td><strong>${r.forme}</strong>${i === 0 ? '<span class="best-badge">⭐ Recommandé</span>' : ''}</td>
      <td><strong style="color:#166534">${fmt(r.netAnnuel)}</strong></td>
      <td style="color:#4A6380">${fmt(r.netAnnuel / 12)}/mois</td>
      <td style="color:#DC2626">−${fmt(r.charges)}</td>
      <td style="color:#DC2626">−${fmt(r.ir)}</td>
      <td style="color:#4A6380">${r.is > 0 ? `−${fmt(r.is)}` : '—'}</td>
      <td><strong style="color:${i === 0 ? '#1D4ED8' : '#4A6380'}">${r.scoreTotal}/100</strong></td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="footer">
  <strong>Estimation indicative — non contractuelle</strong><br />
  Belho Xper · Cabinet d'expertise comptable · Lyon &amp; Montluel<br />
  Générée le ${new Date().toLocaleDateString('fr-FR')} · belhoxper.com
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

  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(generateHtml(sim as Record<string, unknown>), { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '16mm', left: '0mm' },
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
    // Fallback HTML si Puppeteer non disponible (ex: dev)
    const html = generateHtml(sim as Record<string, unknown>)
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
