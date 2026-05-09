import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { LeadDetailClient } from './LeadDetailClient'
import type { Lead } from '@/lib/types/cabinet'

// Client admin inline — bypass total de la RLS, ne dépend pas du cookie session
function makeAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface Simulation {
  id: string
  name: string
  ca: number | null
  best_forme: string | null
  best_net_annuel: number | null
  best_net_mois: number | null
  tmi: number | null
  score: number | null
  gain: number | null
  situation: string | null
  created_at: string
  params: Record<string, unknown> | null
}

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6', 'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B', 'Micro-entreprise': '#94A3B8',
}
function structColor(forme: string | null): string {
  return forme ? (STRUCT_COLORS[forme] ?? '#64748B') : '#64748B'
}
function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

/* ─────────────────────────────────────────────────────────
   Insights intelligents — pure function
───────────────────────────────────────────────────────── */
interface Insight {
  icon: string
  message: string
  priorite: 'urgente' | 'haute' | 'moyenne'
  couleur: string
  couleurBg: string
  couleurBorder: string
}

const FORME_LABELS: Record<string, string> = {
  micro: 'Micro-entreprise', ei: 'EI réel',
  eurl_is: 'EURL/SARL IS', sas_sasu: 'SAS/SASU', none: '',
}

function generateInsights(lead: Lead, simulations: Simulation[]): Insight[] {
  if (!simulations.length) return []
  const insights: Insight[] = []
  const lastSim = simulations[0]
  const joursDepuis = Math.floor((Date.now() - new Date(lastSim.created_at).getTime()) / 86_400_000)
  const ca = lastSim.ca ?? 0
  const formeActuelle = (lastSim.params?.formeActuelle as string | undefined) ?? ''

  // 1 — Récence / timing
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

  // 2 — Micro dépassant le plafond (urgence)
  if (formeActuelle === 'micro' && ca > 77_700) {
    insights.push({
      icon: '🚨',
      message: `CA ${fmt(ca)} dépasse le plafond micro (77 700€) — sortie du régime micro obligatoire à traiter en urgence.`,
      priorite: 'urgente',
      couleur: '#f87171', couleurBg: 'rgba(239,68,68,0.08)', couleurBorder: 'rgba(239,68,68,0.25)',
    })
  }

  // 3 — Changement de structure recommandé
  if ((lastSim.situation === 'existant' || lastSim.situation === 'changement') && formeActuelle && formeActuelle !== 'none') {
    const currentLabel = FORME_LABELS[formeActuelle] || formeActuelle
    if (lastSim.best_forme && currentLabel !== lastSim.best_forme) {
      insights.push({
        icon: '🔄',
        message: `Actuellement en ${currentLabel} — passage en ${lastSim.best_forme} potentiellement intéressant${lastSim.gain ? ` (+${fmt(lastSim.gain)}/an estimé)` : ''}.`,
        priorite: 'haute',
        couleur: '#fbbf24', couleurBg: 'rgba(245,158,11,0.08)', couleurBorder: 'rgba(245,158,11,0.25)',
      })
    }
  }

  // 4 — CA élevé → IS très avantageux
  if (ca > 80_000) {
    insights.push({
      icon: '📊',
      message: `CA de ${fmt(ca)} — le régime IS à 15% devient très avantageux. Structure société fortement recommandée.`,
      priorite: 'haute',
      couleur: '#a78bfa', couleurBg: 'rgba(139,92,246,0.08)', couleurBorder: 'rgba(139,92,246,0.25)',
    })
  }

  // 5 — TMI élevé → PER recommandé
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

  // 6 — Gain potentiel élevé
  if ((lastSim.gain ?? 0) > 8_000) {
    insights.push({
      icon: '⚠️',
      message: `Gain potentiel de ${fmt(lastSim.gain)}/an identifié vs structure la moins avantageuse — optimisation à fort impact.`,
      priorite: 'haute',
      couleur: '#fbbf24', couleurBg: 'rgba(245,158,11,0.08)', couleurBorder: 'rgba(245,158,11,0.25)',
    })
  }

  // Trier par priorité
  const ORDER: Record<string, number> = { urgente: 0, haute: 1, moyenne: 2 }
  return insights.sort((a, b) => ORDER[a.priorite] - ORDER[b.priorite])
}

/* ─────────────────────────────────────────────────────────
   Intention config
───────────────────────────────────────────────────────── */
const INTENTION_CONFIG = {
  urgent:    { label: '🔥 Chaud',  bg: 'rgba(239,68,68,0.15)',  color: '#f87171',  border: 'rgba(239,68,68,0.3)'  },
  reflechis: { label: '🟡 Tiède',  bg: 'rgba(245,158,11,0.15)', color: '#fbbf24',  border: 'rgba(245,158,11,0.3)' },
  info:      { label: '🔵 Info',   bg: 'rgba(59,130,246,0.15)', color: '#60a5fa',  border: 'rgba(59,130,246,0.3)' },
} as const

/* ─────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────── */
export default async function LeadDetailPage({
  params,
}: {
  params: { slug: string; leadId: string }
}) {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/cabinet/${params.slug}/leads/${params.leadId}`)

  // Vérifier appartenance cabinet
  const { data: cabinet } = await supabase
    .from('cabinets').select('id, nom, slug').eq('slug', params.slug).single()
  if (!cabinet) notFound()

  const { data: membre } = await supabase
    .from('cabinet_membres').select('id')
    .eq('cabinet_id', cabinet.id).eq('user_id', user.id).maybeSingle()
  if (!membre) redirect('/')

  // Client admin — bypass total de la RLS pour leads + lead_simulations + simulations
  const supabaseAdmin = makeAdminClient()

  // Charger le lead via admin (évite tout problème RLS sur leads aussi)
  const { data: lead } = await supabaseAdmin
    .from('leads').select('*')
    .eq('id', params.leadId).eq('cabinet_id', cabinet.id).single()
  if (!lead) notFound()

  // Charger les simulations liées
  console.log('[lead-detail] leadId:', params.leadId)
  const { data: leadSimRows, error: lsErr } = await supabaseAdmin
    .from('lead_simulations')
    .select('simulation_id, created_at')
    .eq('lead_id', params.leadId)

  console.log('[lead-detail] leadSimRows:', leadSimRows?.length ?? 0, 'error:', lsErr?.message)

  const simulationIds = (leadSimRows || []).map((ls: { simulation_id: string }) => ls.simulation_id)
  let simulations: Simulation[] = []
  if (simulationIds.length > 0) {
    const { data: sims, error: simErr } = await supabaseAdmin
      .from('simulations')
      .select('id, name, ca, best_forme, best_net_annuel, best_net_mois, tmi, score, gain, situation, created_at, params')
      .in('id', simulationIds)
      .order('created_at', { ascending: false })
    console.log('[lead-detail] simulations:', sims?.length ?? 0, 'error:', simErr?.message)
    simulations = (sims || []) as Simulation[]
  } else {
    console.log('[lead-detail] no simulationIds found — lead_simulations empty or query failed')
  }

  const typedLead = lead as Lead
  const insights = generateInsights(typedLead, simulations)

  return (
    <div style={{ minHeight: '100vh', background: '#020617', padding: '28px 32px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* ── Retour ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <Link
            href={`/cabinet/${params.slug}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 600, color: '#475569',
              textDecoration: 'none', padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.5)',
            }}
          >
            ← Retour aux leads
          </Link>
          <span style={{ color: '#334155', fontSize: '13px' }}>›</span>
          <span style={{ fontSize: '13px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {typedLead.nom || typedLead.email || 'Prospect'}
          </span>
        </div>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #070f1a 100%)',
          border: '1px solid rgba(51,65,85,0.6)', borderRadius: '20px',
          padding: '28px 32px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
            {/* Avatar + identité */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(139,92,246,0.3))',
                border: '2px solid rgba(37,99,235,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', fontWeight: 800, color: '#93c5fd',
              }}>
                {(typedLead.nom || typedLead.email || 'P')[0]?.toUpperCase()}
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
                  {typedLead.nom || 'Prospect sans nom'}
                </h1>
                {typedLead.email && (
                  <a href={`mailto:${typedLead.email}`} style={{ fontSize: '13px', color: '#60a5fa', textDecoration: 'none', display: 'block', marginTop: '3px' }}>
                    {typedLead.email}
                  </a>
                )}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                    background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {typedLead.source?.replace(/_/g, ' ')}
                  </span>
                  {typedLead.intention && INTENTION_CONFIG[typedLead.intention] && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      background: INTENTION_CONFIG[typedLead.intention].bg,
                      border: `1px solid ${INTENTION_CONFIG[typedLead.intention].border}`,
                      color: INTENTION_CONFIG[typedLead.intention].color,
                    }}>
                      {INTENTION_CONFIG[typedLead.intention].label}
                    </span>
                  )}
                  {typedLead.user_id && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                      ✓ Compte lié
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: '#475569' }}>
                    Inscrit le {new Date(typedLead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* KPI pills */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <KpiPill label="CA simulé"    value={fmt(typedLead.ca_simule)}  color="#60a5fa" />
              <KpiPill label="Net/an optimal" value={fmt(typedLead.net_annuel)} color="#34d399" />
              {typedLead.score != null && (
                <KpiPill label="Score gain" value={`${typedLead.score}/100`}
                  color={typedLead.score >= 60 ? '#34d399' : typedLead.score >= 40 ? '#fbbf24' : '#94a3b8'} />
              )}
            </div>
          </div>

          {/* Structure + dernière sim */}
          {typedLead.structure_recommandee && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(51,65,85,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: structColor(typedLead.structure_recommandee), flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Structure recommandée :</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: structColor(typedLead.structure_recommandee) }}>
                {typedLead.structure_recommandee}
              </span>
              {typedLead.derniere_simulation && (
                <span style={{ fontSize: '11px', color: '#475569', marginLeft: '6px' }}>
                  · sim. {new Date(typedLead.derniere_simulation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Grille principale ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>

          {/* Colonne gauche */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ── Insights intelligents ── */}
            {insights.length > 0 && (
              <div style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '16px', padding: '20px 24px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
                  💡 Insights automatiques
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '14px 16px', borderRadius: '12px',
                      background: insight.couleurBg, border: `1px solid ${insight.couleurBorder}`,
                    }}>
                      <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.2 }}>{insight.icon}</span>
                      <div>
                        <div style={{
                          fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                          letterSpacing: '0.1em', color: insight.couleur, marginBottom: '4px',
                        }}>
                          {insight.priorite}
                        </div>
                        <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                          {insight.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Simulations ── */}
            <div style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '16px', padding: '22px 26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                  Simulations effectuées
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px',
                  background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)',
                }}>
                  {simulations.length}
                </span>
              </div>

              {simulations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#475569', fontSize: '13px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
                  Ce lead n&apos;a pas encore de simulation enregistrée.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {simulations.map((sim, idx) => {
                    const color = structColor(sim.best_forme)
                    return (
                      <div key={sim.id} style={{
                        background: idx === 0 ? 'rgba(37,99,235,0.05)' : '#1e293b',
                        border: `1px solid ${idx === 0 ? 'rgba(37,99,235,0.25)' : 'rgba(51,65,85,0.5)'}`,
                        borderRadius: '14px', padding: '16px 18px',
                      }}>
                        {/* Titre + date */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {idx === 0 && (
                              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: 'rgba(37,99,235,0.2)', color: '#60a5fa', flexShrink: 0 }}>
                                Dernière
                              </span>
                            )}
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                              {sim.name || 'Simulation sans titre'}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#475569', flexShrink: 0 }}>
                            {new Date(sim.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        </div>

                        {/* KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                          {[
                            { label: 'CA', value: fmt(sim.ca), color: '#60a5fa' },
                            { label: 'Net/an', value: fmt(sim.best_net_annuel), color: '#34d399' },
                            { label: 'Net/mois', value: fmt(sim.best_net_mois), color: '#34d399' },
                            { label: 'Structure', value: sim.best_forme?.replace(' / SARL (IS)', '').replace(' / SASU', '') || '—', color },
                            { label: 'TMI', value: sim.tmi != null ? `${sim.tmi}%` : '—', color: '#94a3b8' },
                            { label: 'Score', value: sim.score != null ? `${sim.score}/100` : '—', color: '#fbbf24' },
                          ].map(kpi => (
                            <div key={kpi.label} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.3)' }}>
                              <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{kpi.label}</div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: kpi.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kpi.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Boutons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Link href={`/simulations/${sim.id}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                            background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.3)',
                            color: '#60a5fa', textDecoration: 'none',
                          }}>🔍 Voir le détail</Link>
                          <a href={`/api/simulations/${sim.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                            background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)',
                            color: '#34d399', textDecoration: 'none',
                          }}>📄 PDF</a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <LeadDetailClient lead={typedLead} cabinetSlug={params.slug} />

            {/* Infos contact */}
            <div style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '14px', padding: '18px 20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Contact
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {typedLead.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>✉️</span>
                    <a href={`mailto:${typedLead.email}?subject=Suite de votre simulation fiscale`}
                      style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typedLead.email}
                    </a>
                  </div>
                )}
                {typedLead.telephone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>📞</span>
                    <a href={`tel:${typedLead.telephone}`} style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'none' }}>
                      {typedLead.telephone}
                    </a>
                  </div>
                )}
                <div style={{ paddingTop: '6px', borderTop: '1px solid rgba(51,65,85,0.4)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#475569' }}>Inscrit le</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {new Date(typedLead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                  {typedLead.derniere_simulation && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#475569' }}>Dernière sim.</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(typedLead.derniere_simulation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CTA email */}
            {typedLead.email && (
              <a
                href={`mailto:${typedLead.email}?subject=Votre simulation fiscale - Belho Xper&body=Bonjour ${typedLead.nom?.split(' ')[0] || ''},`}
                style={{
                  display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: '10px',
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                  color: '#34d399', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                }}
              >
                ✉️ Envoyer un email
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '90px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
