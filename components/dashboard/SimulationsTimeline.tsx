import Link from 'next/link'
import { fmt } from '@/lib/utils'

interface SimRow {
  id: string
  name: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  tmi: number
  ca: number
}

interface Props { simulations: SimRow[] }

export function SimulationsTimeline({ simulations }: Props) {
  const chronological = [...simulations].reverse()
  const nets = chronological.map(s => s.best_net_annuel ?? 0)
  const minNet = Math.min(...nets)
  const maxNet = Math.max(...nets)
  const range = maxNet - minNet || 1
  const W = 400
  const H = 50
  const PAD = 8

  const points = chronological.map((_, i) => {
    const x = chronological.length === 1
      ? W / 2
      : PAD + (i / (chronological.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((nets[i] - minNet) / range) * (H - PAD * 2)
    return { x, y }
  })

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Historique de vos simulations</h3>
        <Link href="/simulations" className="text-xs text-blue-600 hover:text-blue-700 transition-colors">
          Voir tout →
        </Link>
      </div>

      {/* Sparkline */}
      {simulations.length >= 2 && (
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">
            Évolution de votre revenu net optimal
          </div>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
            <polyline
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline}
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#3B82F6" stroke="white" strokeWidth="1.5" />
            ))}
          </svg>
          <div className="flex justify-between text-[10px] text-slate-300 mt-1">
            <span>{new Date(chronological[0].created_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>
            <span className="font-semibold text-slate-400">
              +{fmt(Math.max(0, maxNet - minNet))} de progression
            </span>
            <span>{new Date(chronological[chronological.length - 1].created_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>
          </div>
        </div>
      )}

      {/* Liste */}
      {simulations.length > 0 ? (
        <div className="divide-y divide-slate-50">
          {simulations.slice(0, 5).map((sim, i) => (
            <Link key={sim.id} href={`/simulations/${sim.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: i === 0 ? '#1D4ED8' : '#F1F5F9', color: i === 0 ? '#fff' : '#64748B' }}>
                {i === 0 ? '★' : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{sim.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {new Date(sim.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}{sim.best_forme}
                  {' · CA '}{fmt(sim.ca)}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-slate-900">{fmt(sim.best_net_annuel)}</div>
                <div className="text-[10px] text-slate-400">TMI {sim.tmi}%</div>
              </div>
              <div className="text-slate-300 group-hover:text-slate-500 transition-colors text-xs">→</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <div className="text-3xl mb-3">📊</div>
          <div className="text-sm font-semibold text-slate-600 mb-1">Aucune simulation enregistrée</div>
          <div className="text-xs text-slate-400 mb-4">
            Faites votre première simulation et enregistrez-la pour la retrouver ici.
          </div>
          <Link href="/simulateur"
            className="text-xs font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">
            Lancer une simulation →
          </Link>
        </div>
      )}
    </div>
  )
}
