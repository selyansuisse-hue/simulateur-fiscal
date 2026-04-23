import { fmt } from '@/lib/utils'

interface SimRow {
  id: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  tmi: number
  params?: { partsBase?: number; nbEnfants?: number }
}

interface Props { simulations: SimRow[] }

export function PersonalKPIs({ simulations }: Props) {
  if (!simulations.length) return null

  const last = simulations[0]
  const first = simulations[simulations.length - 1]

  const bestNet = Math.max(...simulations.map(s => s.best_net_annuel ?? 0))
  const bestSim = simulations.find(s => s.best_net_annuel === bestNet)

  const formeCounts = simulations.reduce<Record<string, number>>((acc, s) => {
    const k = s.best_forme || 'Inconnu'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const topForme = Object.entries(formeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '—'

  const gainEvol = first.id !== last.id
    ? (last.best_net_annuel ?? 0) - (first.best_net_annuel ?? 0)
    : null

  const tmi = last.tmi ?? 0
  const parts = (last.params?.partsBase ?? 1) + (last.params?.nbEnfants ?? 0) * 0.5

  const kpis = [
    {
      label: 'Meilleur revenu net simulé',
      value: fmt(bestNet),
      sub: `${fmt(Math.round(bestNet / 12))}/mois`,
      icon: '💰',
      color: '#10B981',
      detail: bestSim
        ? `Simulation du ${new Date(bestSim.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
        : '',
      small: false,
    },
    {
      label: 'Structure la plus recommandée',
      value: topForme,
      sub: `Sur ${simulations.length} simulation${simulations.length > 1 ? 's' : ''}`,
      icon: '🏆',
      color: '#3B82F6',
      detail: 'Score multicritère pondéré',
      small: true,
    },
    {
      label: gainEvol !== null && gainEvol >= 0 ? 'Progression depuis 1ère sim.' : 'Évolution revenu net',
      value: gainEvol !== null
        ? `${gainEvol >= 0 ? '+' : ''}${fmt(gainEvol)}/an`
        : '—',
      sub: gainEvol !== null
        ? `${new Date(first.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} → aujourd'hui`
        : 'Faites plusieurs simulations',
      icon: '📈',
      color: gainEvol !== null && gainEvol >= 0 ? '#10B981' : '#F59E0B',
      detail: 'Évolution de votre revenu net optimal',
      small: false,
    },
    {
      label: 'TMI actuelle',
      value: `${tmi}%`,
      sub: tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Tranche intermédiaire' : 'Tranche haute',
      icon: '📊',
      color: tmi <= 11 ? '#10B981' : tmi <= 30 ? '#F59E0B' : '#EF4444',
      detail: `${parts} part${parts > 1 ? 's' : ''} fiscale${parts > 1 ? 's' : ''}`,
      small: false,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 -mt-5 mb-6 relative z-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg">{kpi.icon}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide text-right leading-tight max-w-[90px]">
                {kpi.label}
              </span>
            </div>
            <div
              className={`font-display font-black tracking-tight leading-none mb-0.5 ${kpi.small ? 'text-lg' : 'text-2xl'}`}
              style={{ color: kpi.color }}
            >
              {kpi.value}
            </div>
            <div className="text-xs text-slate-500">{kpi.sub}</div>
            <div className="text-[10px] text-slate-300 mt-1">{kpi.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
