import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { fmt } from '@/lib/utils'

interface SimResult { forme: string; netAnnuel: number; ir: number; charges: number; is: number; scoreTotal: number }
interface SimParams {
  ca: number; charges: number; amort: number; situation: string
  partsBase: number; nbEnfants: number; parts: number; remNetAnn: number
  perMontant: number; secteur: string; autresRev: number
}
interface SimRow {
  id: string; name: string; created_at: string
  params: SimParams
  results: { scored: SimResult[] }
  best_forme: string; best_net_annuel: number; tmi: number; ca: number; gain: number; situation: string
}

const situLabel: Record<string, string> = { creation: 'Création', existant: 'Existant', changement: 'Changement' }
const secteurLabel: Record<string, string> = {
  services_bic: 'Services BIC', liberal_bnc: 'BNC libéral', commerce: 'Commerce', btp: 'BTP/Artisanat',
}
const remDesc: Record<string, string> = {
  'SAS / SASU': 'Salaire assimilé salarié + dividendes sans cotisations sociales',
  'EURL / SARL (IS)': 'Rémunération TNS déductible de l\'IS + dividendes (IS 15%/25%)',
  'EI (réel normal)': 'Bénéfice imposable à l\'IR — cotisations SSI sur résultat net',
  'Micro-entreprise': 'Abattement forfaitaire sur CA — pas de déduction des charges réelles',
}

function structureBadge(forme: string) {
  const f = (forme || '').toLowerCase()
  if (f.includes('micro')) return { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
  if (f.includes('ei') && !f.includes('eurl')) return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' }
  if (f.includes('eurl') || f.includes('sarl')) return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
  return { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' }
}

export default async function SimulationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: sim } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sim) notFound()
  const s = sim as SimRow
  const scored: SimResult[] = s.results?.scored || []
  const best = scored[0]
  const p = s.params || {} as SimParams

  const date = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const bestBadge = structureBadge(s.best_forme)

  const paramPills = [
    { label: 'CA', val: fmt(s.ca) },
    { label: 'Charges', val: fmt(p.charges || 0) },
    ...(p.amort ? [{ label: 'Amortissements', val: fmt(p.amort) }] : []),
    { label: 'Situation', val: situLabel[p.situation || s.situation] || s.situation },
    { label: 'Foyer', val: `${p.partsBase === 2 ? 'En couple' : 'Célibataire'}${p.nbEnfants > 0 ? ` · ${p.nbEnfants} enfant${p.nbEnfants > 1 ? 's' : ''}` : ''}` },
    { label: 'Parts', val: `${p.parts ?? p.partsBase ?? 1}` },
    ...(p.remNetAnn ? [{ label: 'Rém. souhaitée', val: fmt(p.remNetAnn) }] : []),
    ...(p.perMontant ? [{ label: 'PER', val: fmt(p.perMontant) }] : []),
    ...(p.secteur ? [{ label: 'Secteur', val: secteurLabel[p.secteur] || p.secteur }] : []),
    ...(p.autresRev ? [{ label: 'Autres revenus', val: fmt(p.autresRev) }] : []),
  ]

  return (
    <>
      <style>{`
        .sim-tr:hover { background: rgba(51,65,85,0.25) !important; }
      `}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>
        <div style={{ maxWidth: '920px', margin: '0 auto', padding: '40px 24px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', marginBottom: '24px' }}>
            <Link href="/simulations" style={{ color: '#60a5fa', textDecoration: 'none' }}>Mes simulations</Link>
            <span>/</span>
            <span style={{ color: '#94a3b8' }}>{s.name}</span>
          </div>

          {/* HERO */}
          <div style={{
            background: 'linear-gradient(135deg, #0d1627 0%, #0d1f3c 100%)',
            borderRadius: '20px', padding: '32px',
            marginBottom: '20px', position: 'relative', overflow: 'hidden',
            border: '1px solid rgba(37,99,235,0.15)',
          }}>
            <div style={{
              position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(37,99,235,.2) 0%,transparent 65%)',
              top: '-9rem', right: '-4rem', pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#60a5fa', marginBottom: '8px' }}>
                Simulation · {date}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: '8px' }}>{s.name}</div>
              {best && (
                <>
                  <div style={{ fontSize: '52px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '6px' }}>
                    <span style={{ background: 'linear-gradient(90deg, #60a5fa, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {fmt(best.netAnnuel)}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px' }}>
                    {fmt(Math.round(best.netAnnuel / 12))}/mois · {best.forme}
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: '#93c5fd' }}>
                  TMI {s.tmi}%
                </span>
                <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                  CA {fmt(s.ca)}
                </span>
                <span style={{
                  fontSize: '11px', padding: '4px 12px', borderRadius: '999px',
                  background: bestBadge.bg, border: `1px solid ${bestBadge.border}`, color: bestBadge.color,
                }}>
                  {s.best_forme}
                </span>
                {s.gain > 500 && (
                  <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                    +{fmt(s.gain)}/an vs moins favorable
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Paramètres de simulation */}
          <div style={{
            background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
            borderRadius: '16px', padding: '20px', marginBottom: '20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
              Paramètres de simulation
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {paramPills.map(pill => (
                <div key={pill.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: '#1e293b', borderRadius: '8px', padding: '6px 12px',
                  border: '1px solid rgba(51,65,85,0.5)',
                }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{pill.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>{pill.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tableau comparaison */}
          {scored.length > 0 && (
            <div style={{
              background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: '16px', overflow: 'hidden', marginBottom: '20px',
            }}>
              <div style={{ background: 'rgba(30,41,59,0.8)', padding: '14px 20px', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Comparaison des structures
                </h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(30,41,59,0.5)' }}>
                      {['Structure', 'Net/an', 'Net/mois', 'Cotisations', 'IR', 'IS', 'Score'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                          textTransform: 'uppercase', color: '#475569', padding: '10px 14px',
                          whiteSpace: 'nowrap', borderBottom: '1px solid rgba(51,65,85,0.5)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scored.map((r, i) => {
                      const rb = structureBadge(r.forme)
                      return (
                        <tr key={r.forme} className="sim-tr" style={{
                          background: i === 0 ? 'rgba(37,99,235,0.05)' : 'transparent',
                          borderBottom: '1px solid rgba(51,65,85,0.3)',
                          transition: 'background 150ms',
                        }}>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: rb.color }}>{r.forme}</span>
                              {i === 0 && (
                                <span style={{ fontSize: '9px', fontWeight: 700, background: '#2563eb', color: '#fff', padding: '2px 7px', borderRadius: '999px' }}>
                                  ⭐ Meilleur
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 700, color: '#4ade80', whiteSpace: 'nowrap' }}>{fmt(r.netAnnuel)}</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(Math.round(r.netAnnuel / 12))}/mois</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: '#f87171', whiteSpace: 'nowrap' }}>−{fmt(r.charges)}</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: '#f87171', whiteSpace: 'nowrap' }}>−{fmt(r.ir)}</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: r.is > 0 ? '#818cf8' : '#334155', whiteSpace: 'nowrap' }}>
                            {r.is > 0 ? `−${fmt(r.is)}` : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: i === 0 ? '#60a5fa' : '#475569' }}>
                              {r.scoreTotal}/100
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analyse — mode de rémunération par structure */}
          {scored.length > 0 && (
            <div style={{
              background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: '16px', padding: '20px', marginBottom: '20px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
                Analyse — mode de rémunération
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {scored.map((r, i) => {
                  const rb = structureBadge(r.forme)
                  const desc = remDesc[r.forme] || ''
                  return (
                    <div key={r.forme} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 14px', borderRadius: '10px',
                      background: i === 0 ? 'rgba(37,99,235,0.07)' : 'rgba(30,41,59,0.4)',
                      border: `1px solid ${i === 0 ? 'rgba(37,99,235,0.2)' : 'rgba(51,65,85,0.3)'}`,
                    }}>
                      <div style={{ flexShrink: 0, marginTop: '1px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                          background: rb.bg, color: rb.color, border: `1px solid ${rb.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {r.forme}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>{desc}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                          Net {fmt(r.netAnnuel)}/an · Score {r.scoreTotal}/100
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href={`/api/simulations/${s.id}/pdf`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', borderRadius: '10px', textDecoration: 'none',
                background: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: 600,
              }}
            >
              📄 Télécharger le rapport PDF
            </a>
            <Link
              href="/simulations"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', borderRadius: '10px', textDecoration: 'none',
                background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.5)',
                color: '#94a3b8', fontSize: '14px', fontWeight: 600,
              }}
            >
              ← Retour
            </Link>
          </div>

          {/* CTA Cabinet */}
          <div style={{
            marginTop: '24px', background: 'linear-gradient(135deg, #0d1627 0%, #0d1f3c 100%)',
            borderRadius: '16px', padding: '28px', textAlign: 'center',
            border: '1px solid rgba(37,99,235,0.15)',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>
              Ces résultats vous intéressent ?
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>
              Prenons RDV pour affiner votre situation réelle.
            </p>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '12px 28px', borderRadius: '12px', textDecoration: 'none',
                background: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: 700,
              }}>
              Prendre RDV →
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
