'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

const LOCAL_KEY = 'belhoxper_simulations'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimRow = any

function getLocalSims(): SimRow[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

function formatEur(n: number): string {
  if (!n && n !== 0) return '—'
  return Math.round(n).toLocaleString('fr-FR') + ' €'
}

export default function SimulationsListPage() {
  const router = useRouter()
  const [sims, setSims]         = useState<SimRow[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setIsLoggedIn(true)
          const { data } = await supabase
            .from('simulations')
            .select('id, name, created_at, best_forme, best_net_annuel, ca, tmi, situation')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50)
          setSims(data || [])
        } else {
          setIsLoggedIn(false)
          setSims(getLocalSims())
        }
      } catch { setSims(getLocalSims()) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const mono = { fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontVariantNumeric: 'tabular-nums' as const }

  if (loading) {
    return (
      <>
        <style>{`html, body { background: #080d1a !important; }`}</style>
        <PageHeader />
        <div style={{ minHeight: '100vh', background: '#080d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>Chargement…</div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <style>{`html, body { background: #080d1a !important; }`}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#080d1a' }}>

        {/* Banner non-connecté */}
        {!isLoggedIn && sims.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.09),rgba(139,92,246,0.06))', borderBottom: '1px solid rgba(37,99,235,0.18)', padding: '12px 24px' }}>
            <div className="max-w-4xl mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: '#60a5fa' }}>
                💾 Simulations sauvegardées localement — créez un compte pour les conserver définitivement.
              </div>
              <Link href="/auth/signup" style={{ fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '8px', background: '#2563eb', color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
                Créer un compte →
              </Link>
            </div>
          </div>
        )}

        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px 80px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* En-tête */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.025em', color: '#f1f5f9', margin: 0 }}>
                Mes simulations
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '8px 0 0', lineHeight: 1.55 }}>
                Retrouvez toutes vos analyses fiscales sauvegardées
              </p>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link href="/simulateur" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '10px', fontWeight: 700,
                fontSize: '13px', textDecoration: 'none',
                background: 'linear-gradient(135deg,#3B82F6,#2563eb)', color: '#fff',
                boxShadow: '0 8px 24px -8px rgba(59,130,246,0.55)',
                border: '1px solid rgba(59,130,246,0.5)',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px' }}>
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Nouvelle simulation
              </Link>

              {sims.length >= 2 && (
                <Link href="/simulations/comparer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '10px 18px', borderRadius: '10px', fontWeight: 700,
                  fontSize: '13px', textDecoration: 'none',
                  background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
                  border: '1px solid rgba(139,92,246,0.35)',
                  transition: 'background 150ms',
                }}>
                  ⇄ Comparer des scénarios
                </Link>
              )}
            </div>
          </div>

          {/* Liste des simulations */}
          {sims.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sims.map((sim: SimRow) => (
                <div
                  key={sim.id}
                  onClick={() => router.push(`/simulations/${sim.id}`)}
                  style={{
                    background: '#0d1628',
                    border: '1px solid rgba(51,65,85,0.45)',
                    borderRadius: '16px', padding: '20px 22px',
                    cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(100,130,200,0.50)'
                    ;(e.currentTarget as HTMLDivElement).style.background = '#0f1a2f'
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(51,65,85,0.45)'
                    ;(e.currentTarget as HTMLDivElement).style.background = '#0d1628'
                  }}
                >
                  {/* Header de la card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sim.name || 'Sans titre'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                        {formatDate(sim.created_at)}
                      </div>
                    </div>
                    {/* Bouton PDF — stopPropagation pour ne pas déclencher le onClick de la card */}
                    <a
                      href={`/api/simulations/${sim.id}/pdf`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '8px',
                        background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.55)',
                        color: '#94a3b8', textDecoration: 'none', transition: 'background 150ms',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(51,65,85,0.5)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'rgba(15,23,42,0.8)')}
                    >
                      📄 PDF
                    </a>
                  </div>

                  {/* Données clés — 3 colonnes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>CA simulé</div>
                      <div style={{ ...mono, fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>
                        {formatEur(sim.ca)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Structure</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>
                        {sim.best_forme || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Net / an</div>
                      <div style={{ ...mono, fontSize: '14px', fontWeight: 700, color: '#6ee7b7' }}>
                        {formatEur(sim.best_net_annuel)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {sims.length === 0 && (
            <div style={{
              background: 'rgba(8,13,26,0.8)',
              border: '1px solid rgba(51,65,85,0.55)',
              borderRadius: '20px', padding: '72px 24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 10px' }}>
                Aucune simulation sauvegardée
              </h2>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 auto 28px', maxWidth: '380px', lineHeight: 1.7 }}>
                Lancez votre première simulation pour voir vos résultats ici
              </p>
              <Link href="/simulateur" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'linear-gradient(135deg,#3B82F6,#2563eb)', color: '#fff',
                borderRadius: '12px', padding: '12px 28px', fontSize: '14px',
                fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}>
                ✦ Lancer une simulation
              </Link>
            </div>
          )}

        </div>
      </div>
      <Footer />
    </>
  )
}
