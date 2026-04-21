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

  const stats = [
    {
      label: 'Simulations',
      value: count.toString(),
      sub: count === 0 ? 'Aucune encore' : count === 1 ? '1 scénario' : `${count} scénarios`,
      accent: '#3B82F6',
      bg: 'rgba(59,130,246,.07)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="5" width="14" height="10" rx="2" stroke="#3B82F6" strokeWidth="1.5"/>
          <path d="M6 5V3.5a1.5 1.5 0 013 0V5" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M5.5 10h7M5.5 13h4" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'Meilleur net / an',
      value: bestNet > 0 ? fmt(bestNet) : '—',
      sub: bestNet > 0 ? `Soit ${fmt(Math.round(bestNet / 12))}/mois` : 'Lancez une simulation',
      accent: '#16A34A',
      bg: 'rgba(22,163,74,.07)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="#16A34A" strokeWidth="1.5"/>
          <path d="M9 5.5v7M6.5 9h5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'TMI moyen',
      value: count > 0 ? `${avgTmi}%` : '—',
      sub: count > 0 ? 'Taux marginal d\'imposition' : 'Aucune donnée',
      accent: '#7C3AED',
      bg: 'rgba(124,58,237,.07)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 14L7 9l3 3 5-6" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Structure favorite',
      value: mostFreqForme,
      sub: count > 0 ? 'Structure la plus recommandée' : '—',
      accent: '#EA580C',
      bg: 'rgba(234,88,12,.07)',
      small: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2l1.854 5.708H17l-4.869 3.539L13.984 17 9 13.461 4.016 17l1.853-5.753L1 7.708h6.146L9 2z" stroke="#EA580C" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {stats.map(({ label, value, sub, accent, bg, icon, small }) => (
        <div
          key={label}
          className="bg-white border border-black/[0.07] rounded-2xl p-5 shadow-card hover:shadow-card-md transition-shadow"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 flex-shrink-0"
            style={{ background: bg }}>
            {icon}
          </div>
          <div
            className={`font-display font-black text-ink tracking-tight leading-none mb-1.5 ${small ? 'text-lg' : 'text-[1.7rem]'}`}
            style={value !== '—' && !small ? { color: accent } : {}}
          >
            {value}
          </div>
          <div className="text-[11.5px] font-bold text-ink mb-0.5">{label}</div>
          <div className="text-[11px] text-ink4 leading-relaxed">{sub}</div>
        </div>
      ))}
    </div>
  )
}
