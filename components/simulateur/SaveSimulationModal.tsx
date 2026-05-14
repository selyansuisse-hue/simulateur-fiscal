'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SimParams, StructureResult } from '@/lib/fiscal'
import { fmt } from '@/lib/utils'

const LOCAL_KEY = 'belhoxper_simulations'

interface Props {
  onClose: () => void
  onSaved?: (simId?: string) => void
  results: { scored: StructureResult[]; best: StructureResult; tmi: number; gain: number }
  params: SimParams
  tmi: number
  initialName?: string
}

export function SaveSimulationModal({ onClose, onSaved, results, params, tmi, initialName }: Props) {
  const [name, setName] = useState(
    initialName ||
    `${params.situation === 'creation' ? 'Création' : params.situation === 'existant' ? 'Existant' : 'Changement'} ${Math.round(params.ca / 1000)}k€ — ${results.best.forme}`
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedLocally, setSavedLocally] = useState(false)

  const buildPayload = (name: string) => ({
    name: name.trim(),
    params,
    results: {
      scored: results.scored.map(r => ({
        // Champs de base
        forme: r.forme,
        netAnnuel: Math.round(r.netAnnuel),
        ir: Math.round(r.ir),
        charges: Math.round(r.charges),
        is: Math.round(r.is || 0),
        scoreTotal: r.scoreTotal,
        // Champs étendus — pour la fiche détail /simulations/[id]
        strat: r.strat,
        ben:   r.ben   != null ? Math.round(r.ben)   : undefined,
        bNet:  r.bNet  != null ? Math.round(r.bNet)  : undefined,
        baseIR: r.baseIR != null ? Math.round(r.baseIR) : undefined,
        div:    r.div   != null ? Math.round(r.div)   : undefined,
        divNet: r.divNet != null ? Math.round(r.divNet) : undefined,
        remBrute: r.remBrute != null ? Math.round(r.remBrute) : undefined,
        remNet:   r.remNet   != null ? Math.round(r.remNet)   : undefined,
        remMois:  r.remMois  != null ? Math.round(r.remMois)  : undefined,
        netMois:  r.netMois  != null ? Math.round(r.netMois)  : undefined,
        ratioDivPct: r.ratioDivPct,
        methDiv:     r.methDiv,
        tauxCotis:   r.tauxCotis,
        scoreBreakdown: r.scoreBreakdown,
        cotisPatronales: r.cotisPatronales != null ? Math.round(r.cotisPatronales) : undefined,
        cotisSalariales: r.cotisSalariales != null ? Math.round(r.cotisSalariales) : undefined,
      })),
    },
    best_forme: results.best.forme,
    best_net_annuel: Math.round(results.best.netAnnuel),
    best_net_mois: Math.round(results.best.netAnnuel / 12),
    best_ir: Math.round(results.best.ir),
    tmi,
    ca: params.ca,
    situation: params.situation,
    parts: params.parts,
    per_montant: params.perMontant,
    gain: Math.round(results.gain),
  })

  const saveLocally = (name: string) => {
    const payload = {
      ...buildPayload(name),
      id: `local_${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
      existing.unshift(payload)
      if (existing.length > 10) existing.splice(10)
      localStorage.setItem(LOCAL_KEY, JSON.stringify(existing))
    } catch {
      // ignore localStorage errors
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Utilisateur connecté → sauvegarder en base
        const res = await fetch('/api/simulations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, ...buildPayload(name) }),
        })
        if (!res.ok) {
          const data = await res.json()
          console.error('[SaveSimulation] API error:', data)
          setError(data.error || 'Erreur lors de la sauvegarde.')
        } else {
          const saved = await res.json()
          setSaved(true)
          onSaved?.(saved?.id)
          setTimeout(onClose, 1800)
        }
      } else {
        // Non connecté → sauvegarder en localStorage
        saveLocally(name)
        setSavedLocally(true)
        onSaved?.()
        setTimeout(onClose, 2200)
      }
    } catch (err) {
      console.error('[SaveSimulation] Network error:', err)
      saveLocally(name)
      setSavedLocally(true)
      onSaved?.()
      setTimeout(onClose, 2200)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={onClose}>
      <div
        className="rounded-2xl max-w-md w-full p-7 border border-slate-700 shadow-[0_24px_60px_rgba(0,0,0,.6)]"
        style={{ background: '#0f172a' }}
        onClick={e => e.stopPropagation()}
      >
        {saved ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-display text-lg font-bold text-slate-100">Simulation enregistrée !</div>
            <div className="text-sm text-slate-400 mt-1">Retrouvez-la dans &quot;Mes simulations&quot;.</div>
          </div>
        ) : savedLocally ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">💾</div>
            <div className="font-display text-lg font-bold text-slate-100 mb-1">Simulation enregistrée localement !</div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Retrouvez-la dans &quot;Mes simulations&quot;. Créez un compte pour la sauvegarder définitivement.
            </p>
            <Link href="/auth/signup"
              className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all">
              Créer un compte gratuitement →
            </Link>
          </div>
        ) : (
          <>
            <h3 className="font-display text-lg font-bold text-slate-100 mb-1.5">Enregistrer cette simulation</h3>
            <p className="text-sm text-slate-400 mb-5 leading-relaxed">
              Donnez un nom à cette simulation pour la retrouver facilement dans &quot;Mes simulations&quot;.
            </p>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full px-3.5 py-2.5 text-sm border-[1.5px] border-slate-600 rounded-lg bg-slate-800 text-slate-100 mb-4
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
              placeholder="Ex : Création services 120k€ — SASU"
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !name.trim()}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg
                  shadow-[0_2px_6px_rgba(29,78,216,.3)] hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                {loading ? 'Enregistrement…' : '💾 Enregistrer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
