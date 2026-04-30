'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SimParams, StructureResult } from '@/lib/fiscal'
import { fmt } from '@/lib/utils'

const LOCAL_KEY = 'belhoxper_simulations'

interface Props {
  onClose: () => void
  onSaved?: () => void
  results: { scored: StructureResult[]; best: StructureResult; tmi: number; gain: number }
  params: SimParams
  tmi: number
}

export function SaveSimulationModal({ onClose, onSaved, results, params, tmi }: Props) {
  const [name, setName] = useState(
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
        forme: r.forme, netAnnuel: Math.round(r.netAnnuel), ir: Math.round(r.ir),
        charges: Math.round(r.charges), is: Math.round(r.is), scoreTotal: r.scoreTotal,
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
          setSaved(true)
          onSaved?.()
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
    <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-md w-full p-7 shadow-[0_24px_60px_rgba(0,0,0,.2)]"
        onClick={e => e.stopPropagation()}
      >
        {saved ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-display text-lg font-bold text-ink">Simulation enregistrée !</div>
            <div className="text-sm text-ink3 mt-1">Retrouvez-la dans &quot;Mes simulations&quot;.</div>
          </div>
        ) : savedLocally ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">💾</div>
            <div className="font-display text-lg font-bold text-ink mb-1">Simulation enregistrée localement !</div>
            <p className="text-sm text-ink3 leading-relaxed mb-4">
              Retrouvez-la dans &quot;Mes simulations&quot;. Créez un compte pour la sauvegarder définitivement.
            </p>
            <Link href="/auth/signup"
              className="text-xs font-bold bg-blue text-white px-4 py-2 rounded-lg hover:bg-blue-dark transition-all">
              Créer un compte gratuitement →
            </Link>
          </div>
        ) : (
          <>
            <h3 className="font-display text-lg font-bold text-ink mb-1.5">Enregistrer cette simulation</h3>
            <p className="text-sm text-ink3 mb-5 leading-relaxed">
              Donnez un nom à cette simulation pour la retrouver facilement dans &quot;Mes simulations&quot;.
            </p>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full px-3.5 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg text-ink mb-4
                focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10"
              placeholder="Ex : Création services 120k€ — SASU"
            />
            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-ink3 border border-surface2 rounded-lg hover:bg-surface transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !name.trim()}
                className="px-5 py-2 bg-blue text-white text-sm font-bold rounded-lg
                  shadow-[0_2px_6px_rgba(29,78,216,.3)] hover:bg-blue-dark transition-all disabled:opacity-60"
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
