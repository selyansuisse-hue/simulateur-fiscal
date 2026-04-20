'use client'
import Link from 'next/link'
import { fmt } from '@/lib/utils'

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

interface Props {
  sim: Simulation
  onDelete: (id: string) => void
}

const situLabel: Record<string, string> = {
  creation: 'Création', existant: 'Existant', changement: 'Changement',
}

export function SimulationCard({ sim, onDelete }: Props) {
  const date = new Date(sim.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const handleDelete = async () => {
    if (!confirm('Supprimer cette simulation ?')) return
    onDelete(sim.id)
    await fetch(`/api/simulations/${sim.id}`, { method: 'DELETE' })
  }

  return (
    <div className="bg-white border-[1.5px] border-surface2 rounded-xl overflow-hidden shadow-card hover:-translate-y-0.5 hover:shadow-card-md transition-all flex flex-col">
      <div className="bg-ink px-4 py-3.5 flex justify-between items-start gap-2">
        <div>
          <div className="font-display text-[13px] font-bold text-white leading-snug">{sim.name}</div>
          <div className="text-[10.5px] text-white/38 mt-0.5">{date}</div>
        </div>
        <button
          onClick={handleDelete}
          className="w-6 h-6 flex items-center justify-center bg-white/8 border border-white/12 rounded-md text-white/40 text-xs hover:bg-red-500/25 hover:border-red-500/40 hover:text-white transition-all flex-shrink-0"
          title="Supprimer"
        >
          ✕
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-blue text-sm">⭐</span>
          <span className="font-display text-[13px] font-bold text-blue">{sim.best_forme}</span>
        </div>
        <div className="font-display text-[26px] font-black text-ink tracking-tight leading-none">
          {fmt(sim.best_net_annuel)}
        </div>
        <div className="text-[11.5px] text-ink4">{fmt(sim.best_net_mois)}/mois · TMI {sim.tmi}%</div>

        <div className="space-y-1 mt-1">
          {[
            ['CA', fmt(sim.ca)],
            ['Situation', situLabel[sim.situation] || sim.situation],
            ['IR estimé', `−${fmt(sim.best_ir)}`],
            ...(sim.gain > 500 ? [['Gain vs défavorable', `+${fmt(sim.gain)}`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-[12px] py-1 border-b border-surface2">
              <span className="text-ink3">{k}</span>
              <span className="font-semibold text-ink">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 p-3 border-t border-surface2 bg-surface">
        <Link
          href={`/simulations/${sim.id}`}
          className="flex-1 text-center py-1.5 text-xs font-semibold bg-blue text-white rounded-lg hover:bg-blue-dark transition-all"
        >
          Voir le détail
        </Link>
        <a
          href={`/api/simulations/${sim.id}/pdf`}
          className="flex-1 text-center py-1.5 text-xs font-semibold text-ink3 border border-surface2 rounded-lg hover:bg-surface2 transition-all"
        >
          📄 PDF
        </a>
      </div>
    </div>
  )
}
