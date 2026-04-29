'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fmt } from '@/lib/utils'

const LOCAL_KEY = 'belhoxper_simulations'

interface LocalSim {
  id: string
  name: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  best_net_mois: number
  ca: number
  tmi: number
  gain: number
}

function structureColor(forme: string) {
  const f = (forme || '').toLowerCase()
  if (f.includes('micro')) return '#94a3b8'
  if (f.includes('ei') && !f.includes('eurl')) return '#fbbf24'
  if (f.includes('eurl') || f.includes('sarl')) return '#60a5fa'
  return '#a78bfa'
}

export function DashboardGuest() {
  const [sims, setSims] = useState<LocalSim[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) setSims(JSON.parse(raw))
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  if (!loaded) return null

  return (
    <div style={{ minHeight: '100vh', background: '#020617' }}>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(139,92,246,0.08))',
        borderBottom: '1px solid rgba(37,99,235,0.2)',
        padding: '14px 24px',
      }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#93c5fd', marginBottom: '2px' }}>
              💾 {sims.length > 0
                ? `${sims.length} simulation${sims.length > 1 ? 's' : ''} sauvegardée${sims.length > 1 ? 's' : ''} localement`
                : 'Tableau de bord'}
            </div>
            <div style={{ fontSize: '12px', color: '#60a5fa', opacity: 0.8 }}>
              {sims.length > 0
                ? 'Ces simulations sont stockées sur cet appareil — créez un compte pour les sauvegarder définitivement.'
                : 'Connectez-vous pour accéder à votre tableau de bord personnalisé.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <Link href="/auth/login" style={{
              fontSize: '12px', fontWeight: 600, padding: '8px 16px', borderRadius: '9px',
              border: '1px solid rgba(37,99,235,0.3)', color: '#93c5fd', textDecoration: 'none',
              background: 'rgba(37,99,235,0.08)',
            }}>
              Connexion
            </Link>
            <Link href="/auth/signup" style={{
              fontSize: '12px', fontWeight: 700, padding: '8px 16px', borderRadius: '9px',
              background: '#2563eb', color: '#fff', textDecoration: 'none',
            }}>
              Créer un compte →
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {sims.length === 0 ? (
          <div style={{
            background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
            borderRadius: '20px', padding: '64px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>
              Aucune simulation sauvegardée
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 auto 28px', maxWidth: '400px', lineHeight: 1.7 }}>
              Lancez votre première simulation et découvrez quelle structure juridique vous fait vraiment économiser.
            </p>
            <Link href="/simulateur" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: '#2563eb', color: '#fff', borderRadius: '12px',
              padding: '12px 28px', fontSize: '15px', fontWeight: 700,
              textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
            }}>
              ✦ Lancer ma première simulation
            </Link>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Simulations locales ({sims.length})
              </h2>
              <Link href="/simulateur" style={{ fontSize: '13px', color: '#60a5fa', textDecoration: 'none', fontWeight: 500 }}>
                + Nouvelle
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {sims.map(sim => (
                <div key={sim.id} style={{
                  background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
                  borderRadius: '18px', padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: structureColor(sim.best_forme) }}>
                      {sim.best_forme}
                    </span>
                    <span style={{ fontSize: '11px', color: '#475569' }}>
                      {new Date(sim.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#f1f5f9', marginBottom: '2px' }}>
                    {fmt(sim.best_net_annuel)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                    {fmt(sim.best_net_mois)}/mois
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    CA {fmt(sim.ca)} · TMI {sim.tmi}%
                    {sim.gain > 500 && <span style={{ color: '#22c55e' }}> · +{fmt(sim.gain)}/an</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Link href="/auth/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#2563eb', color: '#fff', borderRadius: '12px',
                padding: '12px 24px', fontSize: '14px', fontWeight: 700, textDecoration: 'none',
              }}>
                Créer un compte pour sauvegarder définitivement →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
