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
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>

      {/* Banner localStorage */}
      <div style={{
        background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
        borderBottom: '1px solid #BFDBFE',
        padding: '14px 24px',
      }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-bold text-blue-800 mb-0.5">
              💾 {sims.length > 0 ? `${sims.length} simulation${sims.length > 1 ? 's' : ''} sauvegardée${sims.length > 1 ? 's' : ''} localement` : 'Tableau de bord'}
            </div>
            <div className="text-xs text-blue-600">
              {sims.length > 0
                ? 'Ces simulations sont stockées sur cet appareil — créez un compte pour les sauvegarder définitivement.'
                : 'Connectez-vous pour accéder à votre tableau de bord personnalisé.'}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/auth/login"
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">
              Connexion
            </Link>
            <Link href="/auth/signup"
              className="text-xs font-bold px-4 py-2 rounded-lg text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 2px 8px rgba(29,78,216,0.3)' }}>
              Créer un compte →
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {sims.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-5xl mb-5">📊</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Aucune simulation sauvegardée</h2>
            <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto">
              Lancez votre première simulation pour voir vos résultats ici.
            </p>
            <Link href="/simulateur"
              className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}>
              ✦ Lancer ma première simulation
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Mes simulations locales</h2>
              <Link href="/simulateur"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                + Nouvelle simulation
              </Link>
            </div>
            {sims.map(sim => (
              <div key={sim.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{sim.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(sim.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black text-blue-600">{fmt(sim.best_net_annuel)}</div>
                    <div className="text-xs text-slate-400">{fmt(sim.best_net_mois)}/mois</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                    {sim.best_forme}
                  </span>
                  <span className="text-xs text-slate-400">CA {fmt(sim.ca)}</span>
                  <span className="text-xs text-slate-400">TMI {sim.tmi}%</span>
                  {sim.gain > 500 && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      +{fmt(sim.gain)}/an vs moins avantageuse
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div className="text-center pt-4">
              <Link href="/auth/signup"
                className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                Créer un compte pour sauvegarder définitivement →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
