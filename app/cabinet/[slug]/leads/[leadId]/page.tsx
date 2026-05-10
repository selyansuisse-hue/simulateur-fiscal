import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { LeadDetailClient } from './LeadDetailClient'
import type { Lead } from '@/lib/types/cabinet'
import { runSimulation } from '@/lib/fiscal'
import type { SimParams, StructureResult } from '@/lib/fiscal'
import {
  type Simulation, type ComparisonRow, type Insight,
  structColor, fmt, avatarGrad, initials,
} from './types'

/* ─── Admin client (bypass RLS) ─── */
function makeAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const FORME_LABELS: Record<string, string> = {
  micro: 'Micro-entreprise', ei: 'EI réel',
  eurl_is: 'EURL/SARL IS', sas_sasu: 'SAS/SASU', none: '',
}

/* ─── Insights ─── */
function generateInsights(lead: Lead, simulations: Simulation[]): Insight[] {
  if (!simulations.length) return []
  const insights: Insight[] = []
  const lastSim = simulations[0]
  const joursDepuis = Math.floor((Date.now() - new Date(lastSim.created_at).getTime()) / 86_400_000)
  const ca = lastSim.ca ?? 0
  const formeActuelle = (lastSim.params?.formeActuelle as string | undefined) ?? ''

  if (joursDepuis <= 3) {
    insights.push({
      icon: '🔥',
      message: `Simulation effectuée il y a ${joursDepuis === 0 ? 'moins d\'un jour' : `${joursDepuis} jour${joursDepuis > 1 ? 's' : ''}`} — prospect chaud, contacter maintenant.`,
      priorite: 'urgente',
      couleur: '#f87171', couleurBg: 'rgba(239,68,68,0.08)', couleurBorder: 'rgba(239,68,68,0.25)',
    })
  } else if (joursDepuis <= 7) {
    insights.push({
      icon: '⏱️',
      message: `Simulation effectuée il y a ${joursDepuis} jours — une relance maintenant augmente fortement les chances de conversion.`,
      priorite: 'moyenne',
      couleur: '#fbbf24', couleurBg: 'rgba(245,158,11,0.08)', couleurBorder: 'rgba(245,158,11,0.25)',
    })
  }

  if (formeActuelle === 'micro' && ca > 77_700) {
    insights.push({
      icon: '🚨',
      message: `CA ${fmt(ca)} dépasse le plafond micro (77 700 €) — sortie du régime micro obligatoire à traiter en urgence.`,
      priorite: 'urgente',
      couleur: '#f87171', couleurBg: 'rgba(239,68,68,0.08)', couleurBorder: 'rgba(239,68,68,0.25)',
    })
  }

  if ((lastSim.situation === 'existant' || lastSim.situation === 'changement') && formeActuelle && formeActuelle !== 'none') {
    const currentLabel = FORME_LABELS[formeActuelle] || formeActuelle
    const bestForme = (lastSim.params?.best_forme as string | undefined)
      ?? (lastSim.params?.bestForme as string | undefined)
      ?? null
    if (bestForme && currentLabel !== bestForme) {
      insights.push({
        icon: '🔄',
        message: `Actuellement en ${currentLabel} — passage en ${bestForme} potentiellement intéressant${lastSim.gain ? ` (+${fmt(lastSim.gain)}/an estimé)` : ''}.`,
        priorite: 'haute',
        couleur: '#fbbf24', couleurBg: 'rgba(245,158,11,0.08)', couleurBorder: 'rgba(245,158,11,0.25)',
      })
    }
  }

  if (ca > 80_000) {
    insights.push({
      icon: '📊',
      message: `CA de ${fmt(ca)} — le régime IS à 15% devient très avantageux. Structure société fortement recommandée.`,
      priorite: 'haute',
      couleur: '#a78bfa', couleurBg: 'rgba(139,92,246,0.08)', couleurBorder: 'rgba(139,92,246,0.25)',
    })
  }

  const tmi = lastSim.tmi ?? 0
  if (tmi >= 30) {
    const economiePer = Math.round(ca * 0.1 * (tmi / 100))
    insights.push({
      icon: '💰',
      message: `TMI à ${tmi}% — versement PER fortement recommandé. Économie estimée jusqu'à ${fmt(economiePer)}/an.`,
      priorite: 'haute',
      couleur: '#60a5fa', couleurBg: 'rgba(37,99,235,0.08)', couleurBorder: 'rgba(37,99,235,0.25)',
    })
  }

  if ((lastSim.gain ?? 0) > 8_000) {
    insights.push({
      icon: '⚠️',
      message: `Gain potentiel de ${fmt(lastSim.gain)}/an identifié vs structure la moins avantageuse — optimisation à fort impact.`,
      priorite: 'haute',
      couleur: '#fbbf24', couleurBg: 'rgba(245,158,11,0.08)', couleurBorder: 'rgba(245,158,11,0.25)',
    })
  }

  const ORDER: Record<string, number> = { urgente: 0, haute: 1, moyenne: 2 }
  return insights.sort((a, b) => ORDER[a.priorite] - ORDER[b.priorite])
}

/* ─── Calcul du score de chaleur ─── */
function calculateHeatScore(lead: Lead, simulations: Simulation[]): number {
  let score = 0
  const lastSim = simulations[0]
  if (!lastSim) return 0

  const joursDepuis = Math.floor((Date.now() - new Date(lastSim.created_at).getTime()) / 86_400_000)
  if (joursDepuis === 0) score += 30
  else if (joursDepuis <= 1) score += 25
  else if (joursDepuis <= 3) score += 15
  else if (joursDepuis <= 7) score += 5

  const ca = lastSim.ca ?? 0
  if (ca > 100_000) score += 20
  else if (ca > 70_000) score += 15
  else if (ca > 40_000) score += 10
  else score += 5

  if ((lastSim.gain ?? 0) > 8_000) score += 20
  else if ((lastSim.gain ?? 0) > 4_000) score += 12
  else if ((lastSim.gain ?? 0) > 1_000) score += 6

  if (lead.user_id) score += 15
  if (simulations.length >= 2) score += 5
  if (simulations.length >= 3) score += 5

  const formeActuelle = (lastSim.params?.formeActuelle as string | undefined) ?? ''
  if (formeActuelle === 'micro' && ca > 77_700) score += 20

  return Math.min(100, score)
}

/* ─── Page ─── */
export default async function LeadDetailPage({
  params,
}: {
  params: { slug: string; leadId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/cabinet/${params.slug}/leads/${params.leadId}`)

  const { data: cabinet } = await supabase
    .from('cabinets').select('id, nom, slug').eq('slug', params.slug).single()
  if (!cabinet) notFound()

  const { data: membre } = await supabase
    .from('cabinet_membres').select('id')
    .eq('cabinet_id', cabinet.id).eq('user_id', user.id).maybeSingle()
  if (!membre) redirect('/')

  const supabaseAdmin = makeAdminClient()

  const { data: lead } = await supabaseAdmin
    .from('leads').select('*')
    .eq('id', params.leadId).eq('cabinet_id', cabinet.id).single()
  if (!lead) notFound()

  /* Simulations */
  console.log('[lead-detail] leadId:', params.leadId)
  const { data: leadSimRows, error: lsErr } = await supabaseAdmin
    .from('lead_simulations').select('simulation_id').eq('lead_id', params.leadId)
  console.log('[lead-detail] lead_simulations rows:', leadSimRows?.length ?? 0, 'error:', lsErr?.message)

  let simulations: Simulation[] = []

  if ((leadSimRows ?? []).length > 0) {
    const simulationIds = leadSimRows!.map((ls: { simulation_id: string }) => ls.simulation_id)
    const { data: sims, error: simErr } = await supabaseAdmin
      .from('simulations')
      .select('id, name, ca, tmi, situation, parts, per_montant, best_net_mois, best_ir, gain, created_at, params')
      .in('id', simulationIds)
      .order('created_at', { ascending: false })
    console.log('[lead-detail] sims via lead_simulations:', sims?.length ?? 0, 'error:', simErr?.message)
    simulations = (sims || []) as Simulation[]
  } else if (lead.user_id) {
    console.log('[lead-detail] fallback: querying simulations by user_id:', lead.user_id)
    const { data: sims, error: simErr } = await supabaseAdmin
      .from('simulations')
      .select('id, name, ca, tmi, situation, parts, per_montant, best_net_mois, best_ir, gain, created_at, params')
      .eq('user_id', lead.user_id)
      .order('created_at', { ascending: false })
    console.log('[lead-detail] sims via user_id:', sims?.length ?? 0, 'error:', simErr?.message)
    simulations = (sims || []) as Simulation[]
  }

  console.log('[lead-detail] simulations loaded:', simulations.length)
  console.log('[lead-detail] first sim:', simulations[0]?.name)

  const typedLead = lead as Lead
  const insights = generateInsights(typedLead, simulations)

  /* Score de chaleur */
  const heatScore = typedLead.score ?? calculateHeatScore(typedLead, simulations)
  const lastSim = simulations[0] ?? null

  /* Comparison table from fiscal lib */
  let comparisonData: ComparisonRow[] = []
  if (lastSim?.params) {
    try {
      const p = lastSim.params as unknown as SimParams
      const { scored } = runSimulation(p)
      comparisonData = scored.map((r: StructureResult) => ({
        forme: r.forme,
        netAnnuel: r.netAnnuel,
        charges: r.charges,
        ir: r.ir,
        is: r.is,
        score: r.scoreTotal,
        ineligible: r.netAnnuel < 0 && r.forme === 'Micro-entreprise',
        isRecommended: r.forme === scored[0].forme,
      }))
    } catch { /* ignore — missing params fields */ }
  }

  /* Avatar */
  const displayName = typedLead.nom || typedLead.email || 'Prospect'
  const avatarBg = avatarGrad(displayName)
  const avatarIni = initials(displayName)

  /* Heat ring SVG */
  const R = 36, CIRC = 2 * Math.PI * R
  const heatDashOffset = CIRC * (1 - heatScore / 100)
  const heatGradStop1 = heatScore >= 70
    ? { a: '#EF4444', b: '#F59E0B' }
    : heatScore >= 40
      ? { a: '#F59E0B', b: '#FBBF24' }
      : { a: '#64748B', b: '#94A3B8' }
  const heatGlowColor = heatScore >= 70
    ? 'rgba(239,68,68,0.55)'
    : heatScore >= 40
      ? 'rgba(245,158,11,0.55)'
      : 'rgba(100,116,139,0.35)'
  const heatLabel = heatScore >= 70 ? '🔥 Chaud' : heatScore >= 40 ? '🌤 Tiède' : '❄ Froid'
  const heatPillCls = heatScore >= 70 ? 'ld-pill-red' : heatScore >= 40 ? 'ld-pill-amber' : 'ld-pill-slate'

  /* Source badge */
  const sourceCls = typedLead.source === 'inscription' ? 'ld-pill-violet' : 'ld-pill-slate'
  const sourceLabel = typedLead.source === 'inscription'
    ? 'Inscription'
    : typedLead.source === 'widget' ? 'Widget' : typedLead.source?.replace(/_/g, ' ') || 'Direct'

  /* TMI from last sim */
  const tmi = lastSim?.tmi ?? null

  /* User info for notes */
  const userName = (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'EC'
  const userIni = userName.split(/\s+/).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() || 'EC'

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(900px 500px at 80% -10%, rgba(59,130,246,0.06), transparent 60%),
        radial-gradient(600px 400px at 0% 110%, rgba(139,92,246,0.05), transparent 60%),
        #080d1a
      `,
      padding: '24px 32px 48px',
    }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Link
          href={`/cabinet/${params.slug}`}
          className="ld-btn ld-btn-ghost"
          style={{ fontSize: '13px', padding: '7px 12px' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Retour aux leads
        </Link>
        <span style={{ color: '#334155', fontSize: '13px' }}>/</span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Pipeline</span>
        <span style={{ color: '#334155', fontSize: '13px' }}>/</span>
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
          {displayName}
        </span>
      </div>

      {/* ── Hero card ── */}
      <div className="ld-card-glow" style={{ padding: '24px 28px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr 4fr', gap: '24px', alignItems: 'start' }}>

          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <div
              className="ld-avatar-xl"
              style={{ background: avatarBg, boxShadow: '0 12px 32px rgba(139,92,246,0.35), inset 0 0 0 1px rgba(255,255,255,0.10)' }}
            >
              {avatarIni}
              <span style={{
                position: 'absolute', inset: '-2px', borderRadius: '20px',
                background: avatarBg, zIndex: -1, filter: 'blur(14px)', opacity: 0.55,
                pointerEvents: 'none',
              }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span className={`ld-pill ${sourceCls}`}>{sourceLabel}</span>
                {typedLead.user_id && <span className="ld-pill ld-pill-green">✓ Compte lié</span>}
              </div>
              <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </h1>
              {typedLead.email && (
                <a href={`mailto:${typedLead.email}`} className="ld-email-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8', textDecoration: 'none', marginTop: '6px', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  {typedLead.email}
                </a>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap', fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {new Date(typedLead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {simulations.length > 0 && (
                  <>
                    <span style={{ color: '#1e293b' }}>·</span>
                    <span>{simulations.length} simulation{simulations.length > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Heat ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="86" height="86" viewBox="0 0 86 86">
                <circle cx="43" cy="43" r={R} fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth="6"/>
                <circle
                  className="ld-ring-anim"
                  cx="43" cy="43" r={R} fill="none"
                  stroke="url(#heatG)" strokeWidth="6"
                  strokeLinecap="round"
                  transform="rotate(-90 43 43)"
                  strokeDasharray={CIRC.toFixed(1)}
                  strokeDashoffset={heatDashOffset.toFixed(1)}
                  style={{ ['--circ' as string]: CIRC.toFixed(1), filter: `drop-shadow(0 0 6px ${heatGlowColor})` }}
                />
                <defs>
                  <linearGradient id="heatG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={heatGradStop1.a}/>
                    <stop offset="100%" stopColor={heatGradStop1.b}/>
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span className="ld-big-num" style={{ color: '#fff', fontSize: '20px', lineHeight: 1 }}>{heatScore}</span>
                <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>/100</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#64748b', fontWeight: 600 }}>Chaleur</div>
              <div style={{ marginTop: '6px' }}>
                <span className={`ld-pill ${heatPillCls}`}>{heatLabel}</span>
              </div>
              {tmi != null && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                  TMI : <span style={{ color: '#fbbf24', fontWeight: 600 }}>{tmi}%</span>
                </div>
              )}
            </div>
          </div>

          {/* KPI 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'CA simulé', value: fmt(typedLead.ca_simule), accent: '#3B82F6', sub: 'annuel déclaré' },
              { label: 'Net / an optimal', value: fmt(typedLead.net_annuel), accent: '#10B981', sub: lastSim?.gain ? `▲ +${fmt(lastSim.gain)} vs pire` : 'net annuel' },
              { label: 'TMI', value: tmi != null ? `${tmi}%` : '—', accent: '#F59E0B', sub: 'taux marginal' },
              { label: 'Score chaleur', value: `${heatScore}`, accent: heatScore >= 70 ? '#EF4444' : heatScore >= 40 ? '#F59E0B' : '#64748B', sub: heatLabel },
            ].map(kpi => (
              <div key={kpi.label} style={{
                borderRadius: '12px', padding: '12px 14px',
                background: `${kpi.accent}0f`,
                border: `1px solid ${kpi.accent}38`,
              }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.18em', color: `${kpi.accent}b0`, fontWeight: 600, marginBottom: '6px' }}>
                  {kpi.label}
                </div>
                <div className="ld-big-num" style={{ color: '#fff', fontSize: '20px', lineHeight: 1.1, textShadow: `0 0 18px ${kpi.accent}66` }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{kpi.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended strip */}
        {typedLead.structure_recommandee && (
          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(148,163,184,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 10px #3B82F6', display: 'inline-block' }} className="cabinet-pulse-dot" />
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#64748b', fontWeight: 600 }}>Structure recommandée</span>
              <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.01em', background: `linear-gradient(90deg,${structColor(typedLead.structure_recommandee)},#A78BFA)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {typedLead.structure_recommandee}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {lastSim && (
                <a
                  href={`/api/simulations/${lastSim.id}/pdf`}
                  target="_blank" rel="noopener noreferrer"
                  className="ld-btn ld-btn-ghost"
                  style={{ fontSize: '12px', padding: '7px 12px' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Rapport PDF
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Grid: tabs + sidebar ── */}
      <LeadDetailClient
        lead={typedLead}
        simulations={simulations}
        insights={insights}
        comparisonData={comparisonData}
        cabinetSlug={params.slug}
        lastSimId={lastSim?.id ?? null}
        userName={userName}
        userInitials={userIni}
        heatScore={heatScore}
      />
    </div>
  )
}
