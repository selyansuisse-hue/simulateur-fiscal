import { fmt } from '@/lib/utils'

interface Simulation {
  id: string
  best_net_annuel: number
  tmi: number
  best_forme: string
}

interface Props {
  simulations: Simulation[]
}

export function DashboardStats({ simulations }: Props) {
  const count = simulations.length
  const bestNet = count > 0 ? Math.max(...simulations.map(s => s.best_net_annuel)) : 0
  const avgTmi = count > 0 ? Math.round(simulations.reduce((a, s) => a + s.tmi, 0) / count) : 0
  const mostFreqForme = count > 0
    ? Object.entries(simulations.reduce((acc, s) => { acc[s.best_forme] = (acc[s.best_forme] || 0) + 1; return acc }, {} as Record<string, number>))
        .sort(([,a],[,b]) => b - a)[0]?.[0] || '—'
    : '—'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {[
        { label: 'Simulations', value: count.toString(), icon: '📊' },
        { label: 'Meilleur net/an', value: bestNet > 0 ? fmt(bestNet) : '—', icon: '💰' },
        { label: 'TMI moyen', value: count > 0 ? `${avgTmi}%` : '—', icon: '📈' },
        { label: 'Structure fav.', value: mostFreqForme, icon: '⭐', small: true },
      ].map(({ label, value, icon, small }) => (
        <div key={label} className="bg-white border border-black/[0.07] rounded-xl p-4 shadow-card">
          <div className="text-xl mb-2">{icon}</div>
          <div className={`font-display font-bold text-ink tracking-tight ${small ? 'text-base' : 'text-xl'}`}>{value}</div>
          <div className="text-[11px] text-ink4 mt-0.5 font-medium">{label}</div>
        </div>
      ))}
    </div>
  )
}
