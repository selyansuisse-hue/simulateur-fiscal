import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { LeadDetailClient } from './LeadDetailClient'
import type { Lead } from '@/lib/types/cabinet'

interface Simulation {
  id: string
  name: string
  best_forme: string | null
  best_net_annuel: number | null
  best_net_mois: number | null
  tmi: number | null
  ca: number | null
  gain: number | null
  created_at: string
}

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6',
  'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B',
  'Micro-entreprise': '#94A3B8',
}
function structColor(forme: string | null): string {
  return forme ? (STRUCT_COLORS[forme] ?? '#64748B') : '#64748B'
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

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
    .from('cabinets')
    .select('id, nom, slug')
    .eq('slug', params.slug)
    .single()

  if (!cabinet) notFound()

  const { data: membre } = await supabase
    .from('cabinet_membres')
    .select('id')
    .eq('cabinet_id', cabinet.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membre) redirect(`/`)

  // Charger le lead
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.leadId)
    .eq('cabinet_id', cabinet.id)
    .single()

  if (!lead) notFound()

  // Charger les simulations liées via lead_simulations
  const { data: leadSims = [] } = await supabase
    .from('lead_simulations')
    .select('simulation_id')
    .eq('lead_id', params.leadId)

  const simulationIds = (leadSims || []).map((ls: { simulation_id: string }) => ls.simulation_id)

  let simulations: Simulation[] = []
  if (simulationIds.length > 0) {
    const { data: sims } = await supabase
      .from('simulations')
      .select('id, name, best_forme, best_net_annuel, best_net_mois, tmi, ca, gain, created_at')
      .in('id', simulationIds)
      .order('created_at', { ascending: false })
    simulations = (sims || []) as Simulation[]
  }

  const typedLead = lead as Lead

  return (
    <div style={{ padding: '28px 32px', maxWidth: '960px' }}>

      {/* Fil d'Ariane */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '12px', color: '#475569' }}>
        <Link href={`/cabinet/${params.slug}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>
          Leads
        </Link>
        <span>›</span>
        <span style={{ color: '#94a3b8' }}>{typedLead.nom || typedLead.email || 'Prospect'}</span>
      </div>

      {/* Header lead */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px',
        background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)',
        borderRadius: '16px', padding: '24px 28px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          {/* Avatar */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(139,92,246,0.3))',
            border: '1px solid rgba(37,99,235,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: 700, color: '#93c5fd',
          }}>
            {(typedLead.nom || typedLead.email || 'P')[0]?.toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
              {typedLead.nom || 'Prospect sans nom'}
            </h1>
            {typedLead.email && (
              <a href={`mailto:${typedLead.email}`} style={{ fontSize: '13px', color: '#60a5fa', textDecoration: 'none', display: 'block', marginTop: '2px' }}>
                {typedLead.email}
              </a>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {/* Source badge */}
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {typedLead.source?.replace('_', ' ')}
              </span>
              {/* User lié */}
              {typedLead.user_id && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399',
                }}>
                  ✓ Compte lié
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI rapides */}
        <div style={{ display: 'flex', gap: '16px', flexShrink: 0, flexWrap: 'wrap' }}>
          <KpiPill label="CA simulé" value={fmt(typedLead.ca_simule)} color="#60a5fa" />
          <KpiPill label="Net/an optimal" value={fmt(typedLead.net_annuel)} color="#34d399" />
          {typedLead.score != null && (
            <KpiPill
              label="Score gain"
              value={`${typedLead.score}/100`}
              color={typedLead.score >= 60 ? '#34d399' : typedLead.score >= 40 ? '#fbbf24' : '#94a3b8'}
            />
          )}
        </div>
      </div>

      {/* Grille principale */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>

        {/* Colonne gauche — simulations + simulation_data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Simulations enregistrées */}
          <div style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '14px', padding: '20px 24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
              Simulations enregistrées ({simulations.length})
            </div>
            {simulations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#334155', fontSize: '13px' }}>
                Aucune simulation sauvegardée
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {simulations.map((sim, idx) => {
                  const color = structColor(sim.best_forme)
                  return (
                    <div key={sim.id} style={{
                      padding: '14px 16px', borderRadius: '10px',
                      background: idx === 0 ? 'rgba(37,99,235,0.06)' : '#1e293b',
                      border: `1px solid ${idx === 0 ? 'rgba(37,99,235,0.3)' : 'rgba(51,65,85,0.5)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            {idx === 0 && (
                              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: 'rgba(37,99,235,0.2)', color: '#60a5fa', flexShrink: 0 }}>
                                Dernière
                              </span>
                            )}
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sim.name || 'Simulation sans titre'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {sim.best_forme && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {sim.best_forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                                </span>
                              </div>
                            )}
                            {sim.ca && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>CA {fmt(sim.ca)}</span>
                            )}
                            {sim.tmi != null && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>TMI {sim.tmi}%</span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {sim.best_net_annuel && (
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#34d399' }}>{fmt(sim.best_net_annuel)}</div>
                          )}
                          {sim.gain && (
                            <div style={{ fontSize: '10px', color: '#64748b' }}>+{fmt(sim.gain)} de gain</div>
                          )}
                          <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>
                            {new Date(sim.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dernières données simulation_data */}
          {typedLead.simulation_data && (
            <div style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '14px', padding: '20px 24px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
                Données de la dernière simulation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Structure recommandée', value: typedLead.structure_recommandee, color: structColor(typedLead.structure_recommandee) },
                  { label: 'Net annuel optimal', value: fmt(typedLead.net_annuel), color: '#34d399' },
                  { label: 'CA simulé', value: fmt(typedLead.ca_simule), color: '#60a5fa' },
                  { label: 'Score gain', value: typedLead.score != null ? `${typedLead.score}/100` : null, color: '#fbbf24' },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} style={{ padding: '10px 14px', borderRadius: '8px', background: '#1e293b', border: '1px solid rgba(51,65,85,0.4)' }}>
                    <div style={{ fontSize: '10px', color: '#475569', marginBottom: '3px' }}>{item.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite — statut + actions + timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Gestion statut + notes (client component) */}
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
                  <a href={`tel:${typedLead.telephone}`}
                    style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'none' }}>
                    {typedLead.telephone}
                  </a>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(51,65,85,0.4)', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: '#475569' }}>Créé le</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {new Date(typedLead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {typedLead.derniere_simulation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Dernière sim.</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {new Date(typedLead.derniere_simulation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CTA email rapide */}
          {typedLead.email && (
            <a
              href={`mailto:${typedLead.email}?subject=Votre simulation fiscale - Belho Xper&body=Bonjour ${typedLead.nom?.split(' ')[0] || ''},`}
              style={{
                display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: '10px',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                color: '#34d399', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                transition: 'all 150ms',
              }}
            >
              ✉️ Envoyer un email
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '90px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
