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

const FORME_COLOR: Record<string, { dot: string; bg: string; text: string }> = {
  'SASU': { dot: '#7C3AED', bg: 'rgba(124,58,237,.08)', text: '#6D28D9' },
  'EURL': { dot: '#2563EB', bg: 'rgba(37,99,235,.08)', text: '#1D4ED8' },
  'EI': { dot: '#16A34A', bg: 'rgba(22,163,74,.08)', text: '#15803D' },
  'Micro': { dot: '#EA580C', bg: 'rgba(234,88,12,.08)', text: '#C2410C' },
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

  const forme = sim.best_forme
  const formeStyle = FORME_COLOR[forme] || { dot: '#3B82F6', bg: 'rgba(59,130,246,.08)', text: '#2563EB' }

  return (
    <div className="bg-white border border-black/[0.07] rounded-2xl overflow-hidden shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface2 flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="font-display text-[13.5px] font-bold text-ink truncate leading-snug">{sim.name}</div>
          <div className="text-[11px] text-ink4 mt-0.5">{date} · CA {fmt(sim.ca)}</div>
        </div>
        <button
          onClick={handleDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-surface2 text-ink4 text-xs
            hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all flex-shrink-0"
          title="Supprimer"
        >
          ✕
        </button>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {/* Badge structure */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit mb-4"
          style={{ background: formeStyle.bg }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: formeStyle.dot }} />
          <span className="text-[12px] font-bold" style={{ color: formeStyle.text }}>
            {forme} recommandée
          </span>
        </div>

        {/* Key metric */}
        <div className="mb-1">
          <div className="font-display text-[2rem] font-black text-ink tracking-tight leading-none">
            {fmt(sim.best_net_annuel)}
          </div>
          <div className="text-[12px] text-ink4 mt-1">
            {fmt(sim.best_net_mois)}<span className="text-ink4">/mois</span>
            <span className="mx-2 text-surface2">·</span>
            TMI <span className="font-semibold text-ink3">{sim.tmi}%</span>
          </div>
        </div>

        {/* Metadata rows */}
        <div className="mt-4 space-y-0 flex-1">
          {[
            ['Situation', situLabel[sim.situation] || sim.situation],
            ['IR estimé', `−${fmt(sim.best_ir)}`],
            ...(sim.gain > 500 ? [['Gain vs défavorable', `+${fmt(sim.gain)}`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center py-2 border-b border-surface last:border-0">
              <span className="text-[12px] text-ink4">{k}</span>
              <span className={`text-[12px] font-semibold ${k === 'Gain vs défavorable' ? 'text-green-600' : 'text-ink'}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2.5 p-4 pt-0">
        <Link
          href={`/simulations/${sim.id}`}
          className="flex-1 text-center py-2.5 text-[12.5px] font-bold bg-blue text-white rounded-xl hover:bg-blue-dark transition-all shadow-[0_2px_6px_rgba(29,78,216,.25)]"
        >
          Voir le détail
        </Link>
        <a
          href={`/api/simulations/${sim.id}/pdf`}
          className="flex-1 text-center py-2.5 text-[12.5px] font-semibold text-ink3 border border-surface2 rounded-xl hover:bg-surface transition-all"
        >
          📄 PDF
        </a>
      </div>
    </div>
  )
}
