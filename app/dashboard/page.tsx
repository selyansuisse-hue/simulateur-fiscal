import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { DashboardGuest } from './DashboardGuest'
import { fmt } from '@/lib/utils'

function structureBadge(forme: string) {
  const f = (forme || '').toLowerCase()
  if (f.includes('micro')) return { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
  if (f.includes('ei') && !f.includes('eurl')) return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' }
  if (f.includes('eurl') || f.includes('sarl')) return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
  return { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <PageHeader />
        <DashboardGuest />
        <Footer />
      </>
    )
  }

  const { data: rawSims = [] } = await supabase
    .from('simulations')
    .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, best_ir, tmi, ca, situation, gain, params, results')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const simulations = (rawSims || []) as Record<string, unknown>[]

  const rawName = (user.user_metadata?.full_name as string | undefined) || user.email || ''
  const firstName = rawName.includes('@')
    ? rawName.split('@')[0]
    : rawName.split(' ')[0]

  const initial = firstName[0]?.toUpperCase() || 'U'

  return (
    <>
      <style>{`
        .sim-card:hover { border-color: rgba(71,85,105,0.8) !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important; }
        .dash-btn-new:hover { background: #1d4ed8 !important; }
      `}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>

        {/* ── HERO ── */}
        <div style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
          borderBottom: '1px solid #1e293b',
          padding: '32px 24px',
        }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {initial}
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
                  Bonjour {firstName} 👋
                </h1>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>
                  Retrouvez et gérez vos simulations fiscales
                </p>
              </div>
            </div>
            <Link href="/simulateur" className="dash-btn-new" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#2563eb', color: '#fff', borderRadius: '12px',
              padding: '10px 20px', fontSize: '14px', fontWeight: 600,
              textDecoration: 'none', transition: 'background 150ms',
            }}>
              Nouvelle simulation →
            </Link>
          </div>
        </div>

        {/* ── SECTION SIMULATIONS ── */}
        <div className="max-w-5xl mx-auto px-6 py-10">

          {simulations.length === 0 ? (
            /* Empty state */
            <div style={{
              background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: '20px', padding: '64px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>
                Aucune simulation pour l&apos;instant
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 auto 28px', maxWidth: '420px', lineHeight: 1.7 }}>
                Lancez votre première simulation en 4 minutes et découvrez quelle structure juridique vous fait vraiment économiser.
              </p>
              <Link href="/simulateur" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#2563eb', color: '#fff', borderRadius: '12px',
                padding: '12px 28px', fontSize: '15px', fontWeight: 700,
                textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}>
                Lancer ma simulation →
              </Link>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
                {['Résultats instantanés', 'Sauvegarde automatique', 'Gratuit'].map(t => (
                  <span key={t} style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: '#22c55e' }}>✓</span> {t}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Mes simulations ({simulations.length})
                </h2>
                <Link href="/simulations" style={{ fontSize: '13px', color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>
                  Comparer →
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                {simulations.map(sim => {
                  const badge = structureBadge(sim.best_forme as string)
                  const dateStr = new Date(sim.created_at as string).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })
                  return (
                    <div key={sim.id as string} className="sim-card" style={{
                      background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
                      borderRadius: '18px', padding: '20px',
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                        }}>
                          {sim.best_forme as string}
                        </span>
                        <span style={{ fontSize: '11px', color: '#475569' }}>{dateStr}</span>
                      </div>

                      {/* Montant */}
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ fontSize: '30px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                          {fmt(sim.best_net_annuel as number)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
                        {fmt(Math.round((sim.best_net_annuel as number) / 12))}/mois
                      </div>

                      {/* Infos */}
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#475569' }}>CA : {fmt(sim.ca as number)}</span>
                        <span style={{ fontSize: '11px', color: '#334155' }}>·</span>
                        <span style={{ fontSize: '11px', color: '#475569' }}>TMI : {sim.tmi as number}%</span>
                        {(sim.gain as number) > 500 && (
                          <>
                            <span style={{ fontSize: '11px', color: '#334155' }}>·</span>
                            <span style={{ fontSize: '11px', color: '#22c55e' }}>+{fmt(sim.gain as number)}/an</span>
                          </>
                        )}
                      </div>

                      {/* Footer boutons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href={`/simulations/${sim.id}`} style={{
                          flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: '9px',
                          background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
                          color: '#60a5fa', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                        }}>
                          Voir résultats
                        </Link>
                        <Link href="/explorer" style={{
                          flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: '9px',
                          background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.5)',
                          color: '#94a3b8', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                        }}>
                          Explorer
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  )
}
