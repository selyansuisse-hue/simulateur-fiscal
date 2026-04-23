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
        // Supabase indisponible → fallback localStorage
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
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="text-slate-400 text-sm">Chargement…</div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-surface">

        {/* Bannière douce pour utilisateurs non connectés */}
        {!isLoggedIn && sims.length > 0 && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <span>💾</span>
              <span>
                Vos simulations sont sauvegardées localement.
                Créez un compte pour les conserver définitivement et accéder au dashboard.
              </span>
            </div>
            <Link href="/auth/signup"
              className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
              Créer un compte →
            </Link>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Mes simulations</h1>
              <p className="text-sm text-ink3 mt-0.5">
                {sims.length} simulation{sims.length !== 1 ? 's' : ''} enregistrée{sims.length !== 1 ? 's' : ''}
                {!isLoggedIn && sims.length > 0 && (
                  <span className="ml-2 text-blue-500 font-medium">(sauvegardées localement)</span>
                )}
              </p>
            </div>
            <Link href="/simulateur"
              className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-dark transition-all">
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

          {/* Incitation compte si pas connecté et simulations locales */}
          {!isLoggedIn && sims.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Aucune simulation enregistrée</h2>
              <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                Lancez une simulation et cliquez sur &quot;Enregistrer&quot; pour la retrouver ici, même sans compte.
              </p>
              <Link href="/simulateur"
                className="inline-flex items-center gap-2 text-white font-bold px-7 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 6px 20px rgba(37,99,235,.35)' }}>
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
