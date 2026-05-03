'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { SimulationsGrid } from '../dashboard/SimulationsGrid'
import { NarrativeAnalysis } from '@/components/simulations/NarrativeAnalysis'
import { EnrichedCompareTable } from '@/components/simulations/EnrichedCompareTable'
import { fmt } from '@/lib/utils'

const LOCAL_KEY = 'belhoxper_simulations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimRow = any

function getLocalSims(): SimRow[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
  } catch {
    return []
  }
}

async function deleteLocalSim(id: string) {
  const updated = getLocalSims().filter((s: SimRow) => s.id !== id)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(updated))
}

const HORIZONS = [
  { label: '1 an', mult: 1 },
  { label: '3 ans', mult: 3 },
  { label: '5 ans', mult: 5 },
  { label: '10 ans', mult: 10, highlight: true },
]

export default function SimulationsPage() {
  const [sims, setSims] = useState<SimRow[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          setIsLoggedIn(true)
          const { data } = await supabase
            .from('simulations')
            .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, best_ir, tmi, ca, situation, gain, params')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)
          setSims(data || [])
        } else {
          setIsLoggedIn(false)
          setSims(getLocalSims())
        }
      } catch {
        setSims(getLocalSims())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Default select 2 most recent sims once loaded
  useEffect(() => {
    if (sims.length >= 2 && selectedIds.length === 0) {
      setSelectedIds(sims.slice(0, 2).map((s: SimRow) => s.id))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sims])

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev // keep at least 2
        return prev.filter(x => x !== id)
      }
      return [...prev, id]
    })
  }

  const selectedSims = sims.filter((s: SimRow) => selectedIds.includes(s.id))

  // For projection: top 2 selected sims by net annuel
  const projSims = [...selectedSims]
    .sort((a: SimRow, b: SimRow) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))
    .slice(0, 2)

  if (loading) {
    return (
      <>
        <PageHeader />
        <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#1e293b', fontSize: '14px' }}>Chargement…</div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`
        html, body { background: #020617 !important; }
      `}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>

        {/* Bannière non-connecté */}
        {!isLoggedIn && sims.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.09), rgba(139,92,246,0.06))',
            borderBottom: '1px solid rgba(37,99,235,0.18)',
            padding: '12px 24px',
          }}>
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <div style={{ fontSize: '13px', color: '#60a5fa' }}>
                💾 Simulations sauvegardées localement — créez un compte pour les conserver définitivement.
              </div>
              <Link href="/auth/signup" style={{
                fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '8px',
                background: '#2563eb', color: '#fff', textDecoration: 'none', flexShrink: 0,
              }}>
                Créer un compte →
              </Link>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-6 py-10">

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Mes simulations</h1>
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '2px 10px', borderRadius: '999px',
                  background: 'rgba(37,99,235,0.14)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)',
                }}>
                  {sims.length}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#334155', margin: '4px 0 0' }}>
                {sims.length} simulation{sims.length !== 1 ? 's' : ''} enregistrée{sims.length !== 1 ? 's' : ''}
                {!isLoggedIn && sims.length > 0 && (
                  <span style={{ marginLeft: '8px', color: '#60a5fa', fontWeight: 500 }}>(locales)</span>
                )}
              </p>
            </div>
            <Link href="/simulateur" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#2563eb', color: '#fff', borderRadius: '12px',
              padding: '10px 20px', fontSize: '14px', fontWeight: 600,
              textDecoration: 'none',
            }}>
              + Nouvelle simulation
            </Link>
          </div>

          {/* ── Selector pills (only when >2 sims) ── */}
          {sims.length > 2 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '24px',
              padding: '14px 18px',
              background: '#070f1e',
              border: '1px solid rgba(51,65,85,0.4)',
              borderRadius: '14px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', flexShrink: 0 }}>Comparer :</span>
              {sims.map((s: SimRow) => {
                const active = selectedIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleId(s.id)}
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '5px 14px',
                      borderRadius: '999px',
                      border: active ? '1px solid rgba(37,99,235,0.5)' : '1px solid rgba(51,65,85,0.5)',
                      background: active ? '#2563eb' : 'rgba(15,23,42,0.8)',
                      color: active ? '#fff' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      maxWidth: '160px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </button>
                )
              })}
              {selectedIds.length > 2 && (
                <span style={{ fontSize: '11px', color: '#334155', marginLeft: '4px' }}>
                  {selectedIds.length} sélectionnés
                </span>
              )}
            </div>
          )}

          {/* ── Analysis + Table ── */}
          {selectedSims.length >= 2 && (
            <>
              <NarrativeAnalysis simulations={selectedSims} />
              <EnrichedCompareTable simulations={selectedSims} />
            </>
          )}

          {/* ── Projection 1/3/5/10 ans ── */}
          {projSims.length >= 2 && (
            <div style={{
              background: '#050d1a',
              border: '1px solid rgba(51,65,85,0.4)',
              borderRadius: '20px',
              overflow: 'hidden',
              marginBottom: '40px',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid rgba(51,65,85,0.4)',
                background: 'rgba(255,255,255,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{ fontSize: '16px' }}>📅</span>
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Projection pluriannuelle</h3>
                  <p style={{ fontSize: '11px', color: '#334155', margin: '2px 0 0' }}>
                    Projection linéaire basée sur le revenu net annuel — hors revalorisation
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 22px', fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
                        Horizon
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#60a5fa', borderBottom: '1px solid rgba(51,65,85,0.3)', maxWidth: '160px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px', marginLeft: 'auto' }}>
                          {projSims[0].name}
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.22)', borderRadius: '999px', padding: '1px 7px', display: 'inline-block', marginTop: '3px' }}>
                          ★ Meilleur
                        </div>
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#475569', borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px', marginLeft: 'auto' }}>
                          {projSims[1].name}
                        </div>
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(51,65,85,0.3)', whiteSpace: 'nowrap' }}>
                        Différence
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {HORIZONS.map(h => {
                      const a = Math.round((projSims[0].best_net_annuel ?? 0) * h.mult)
                      const b = Math.round((projSims[1].best_net_annuel ?? 0) * h.mult)
                      const diff = a - b
                      return (
                        <tr
                          key={h.label}
                          style={{
                            borderTop: '1px solid rgba(51,65,85,0.22)',
                            background: h.highlight ? 'rgba(251,191,36,0.07)' : 'transparent',
                          }}
                        >
                          <td style={{
                            padding: '13px 22px',
                            fontSize: '13px',
                            fontWeight: h.highlight ? 700 : 500,
                            color: h.highlight ? '#fbbf24' : '#475569',
                          }}>
                            {h.label}
                            {h.highlight && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '6px', padding: '1px 6px' }}>
                                Long terme
              </span>
                            )}
                          </td>
                          <td style={{ padding: '13px 18px', textAlign: 'right', fontSize: h.highlight ? '16px' : '13px', fontWeight: h.highlight ? 900 : 600, color: '#34d399', letterSpacing: h.highlight ? '-0.02em' : undefined }}>
                            {fmt(a)}
                          </td>
                          <td style={{ padding: '13px 18px', textAlign: 'right', fontSize: h.highlight ? '15px' : '13px', fontWeight: h.highlight ? 700 : 500, color: h.highlight ? '#94a3b8' : '#475569' }}>
                            {fmt(b)}
                          </td>
                          <td style={{
                            padding: '13px 18px',
                            textAlign: 'right',
                            fontSize: h.highlight ? '16px' : '13px',
                            fontWeight: h.highlight ? 900 : 700,
                            color: h.highlight ? '#fbbf24' : '#34d399',
                            letterSpacing: h.highlight ? '-0.02em' : undefined,
                          }}>
                            +{fmt(diff)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Cards grid ── */}
          <SimulationsGrid
            initialSimulations={sims}
            onPersistDelete={!isLoggedIn ? deleteLocalSim : undefined}
          />

          {/* ── Empty state ── */}
          {sims.length === 0 && (
            <div style={{
              background: '#0a1628',
              border: '1px solid rgba(51,65,85,0.4)',
              borderRadius: '20px',
              padding: '64px 24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>
                Aucune simulation enregistrée
              </h2>
              <p style={{ fontSize: '14px', color: '#334155', margin: '0 auto 28px', maxWidth: '400px', lineHeight: 1.7 }}>
                Lancez une simulation et cliquez sur &quot;Enregistrer&quot; pour la retrouver ici, même sans compte.
              </p>
              <Link href="/simulateur" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#2563eb', color: '#fff', borderRadius: '12px',
                padding: '12px 28px', fontSize: '15px', fontWeight: 700,
                textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}>
                ✦ Lancer une simulation
              </Link>
            </div>
          )}
        </div>

        {/* ── CTA Cabinet ── */}
        {sims.length >= 1 && (
          <div style={{ padding: '0 24px 56px' }}>
            <div style={{
              maxWidth: '1152px',
              margin: '0 auto',
              background: 'linear-gradient(135deg, rgba(30,58,138,0.35) 0%, rgba(109,40,217,0.28) 100%)',
              border: '1px solid rgba(37,99,235,0.22)',
              borderRadius: '20px',
              padding: '40px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '24px',
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Conseil personnalisé
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                  Validez votre optimisation avec un expert
                </h3>
                <p style={{ fontSize: '13px', color: '#475569', margin: 0, maxWidth: '480px', lineHeight: 1.7 }}>
                  Nos simulations sont une base solide. Un expert-comptable ou conseiller fiscal peut confirmer la stratégie, sécuriser la mise en place et identifier des leviers additionnels.
                </p>
              </div>
              <a
                href="mailto:contact@belhoxper.fr"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: '14px',
                  padding: '14px 28px',
                  fontSize: '15px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                📅 Prendre RDV — Consultation gratuite
              </a>
            </div>
          </div>
        )}

      </div>
      <Footer />
    </>
  )
}
