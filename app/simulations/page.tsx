'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { SimulationsGrid } from '../dashboard/SimulationsGrid'
import { NarrativeAnalysis } from '@/components/simulations/NarrativeAnalysis'
import { EnrichedCompareTable } from '@/components/simulations/EnrichedCompareTable'

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

export default function SimulationsPage() {
  const [sims, setSims] = useState<SimRow[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <>
        <PageHeader />
        <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#475569', fontSize: '14px' }}>Chargement…</div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>

        {/* Bannière non-connecté */}
        {!isLoggedIn && sims.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(139,92,246,0.07))',
            borderBottom: '1px solid rgba(37,99,235,0.2)',
            padding: '12px 24px',
          }}>
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <div style={{ fontSize: '13px', color: '#93c5fd' }}>
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
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Mes simulations</h1>
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '2px 10px', borderRadius: '999px',
                  background: 'rgba(37,99,235,0.15)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)',
                }}>
                  {sims.length}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0' }}>
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

          {sims.length >= 2 && (
            <>
              <NarrativeAnalysis simulations={sims} />
              <EnrichedCompareTable simulations={sims} />
            </>
          )}

          <SimulationsGrid
            initialSimulations={sims}
            onPersistDelete={!isLoggedIn ? deleteLocalSim : undefined}
          />

          {/* Empty state */}
          {sims.length === 0 && (
            <div style={{
              background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: '20px', padding: '64px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>
                Aucune simulation enregistrée
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 auto 28px', maxWidth: '400px', lineHeight: 1.7 }}>
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
      </div>
      <Footer />
    </>
  )
}
