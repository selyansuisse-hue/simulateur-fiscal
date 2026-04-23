'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SimulationCard } from '@/components/dashboard/SimulationCard'
import { CompareTable } from '@/components/dashboard/CompareTable'

interface Simulation {
  id: string
  name: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  best_net_mois: number
  best_ir: number
  tmi: number
  ca: number
  situation: string
  gain: number
}

interface SimulationsGridProps {
  initialSimulations: Simulation[]
  onPersistDelete?: (id: string) => Promise<void>
}

export function SimulationsGrid({ initialSimulations, onPersistDelete }: SimulationsGridProps) {
  const [sims, setSims] = useState(initialSimulations)

  const handleDelete = (id: string) => {
    setSims(prev => prev.filter(s => s.id !== id))
  }

  if (sims.length === 0) {
    return (
      <div className="text-center py-14 bg-white border-2 border-dashed border-surface2 rounded-xl text-ink3">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-[14px] leading-relaxed mb-6">
          Aucune simulation enregistrée.<br />
          Lancez votre première simulation pour commencer !
        </p>
        <Link href="/simulateur" className="px-6 py-3 bg-blue text-white font-semibold text-sm rounded-lg hover:bg-blue-dark transition-all">
          ✦ Lancer une simulation
        </Link>
      </div>
    )
  }

  return (
    <>
      {sims.length >= 2 && <CompareTable simulations={sims} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sims.map(sim => (
          <SimulationCard key={sim.id} sim={sim} onDelete={handleDelete} onPersistDelete={onPersistDelete} />
        ))}
      </div>
    </>
  )
}
