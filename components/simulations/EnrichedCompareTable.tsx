import { fmt } from '@/lib/utils'

interface SimRow {
  id: string
  name: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  best_net_mois: number
  best_ir: number
  tmi: number
  ca: number
  gain: number
  params?: {
    perMontant?: number
    perActif?: string
    partsBase?: number
    nbEnfants?: number
  }
}

interface Props { simulations: SimRow[] }

export function EnrichedCompareTable({ simulations }: Props) {
  if (simulations.length < 2) return null
  const sorted = [...simulations].sort((a, b) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))

  const tmiColor = (t: number) =>
    t <= 11 ? { bg: 'bg-emerald-100', text: 'text-emerald-700' }
    : t <= 30 ? { bg: 'bg-amber-100', text: 'text-amber-700' }
    : { bg: 'bg-red-100', text: 'text-red-700' }

  type RowDef = {
    label: string
    render: (s: SimRow) => React.ReactNode
    best?: (s: SimRow) => number
    highlight?: boolean
  }

  const rows: RowDef[] = [
    { label: 'CA annuel', render: s => fmt(s.ca), best: s => s.ca },
    { label: 'Structure recommandée', render: s => <strong>{s.best_forme}</strong> },
    { label: 'Revenu net/an', render: s => <span className="font-bold text-base">{fmt(s.best_net_annuel ?? 0)}</span>, best: s => s.best_net_annuel ?? 0, highlight: true },
    { label: 'Revenu net/mois', render: s => fmt(Math.round((s.best_net_annuel ?? 0) / 12)), best: s => s.best_net_annuel ?? 0 },
    { label: 'IR estimé', render: s => `−${fmt(s.best_ir ?? 0)}`, best: s => -(s.best_ir ?? 0) },
    {
      label: 'TMI',
      render: s => {
        const c = tmiColor(s.tmi)
        return <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${c.bg} ${c.text}`}>{s.tmi}%</span>
      },
      best: s => -s.tmi,
    },
    {
      label: 'PER versé',
      render: s => {
        const per = s.params?.perMontant ?? 0
        return per > 0
          ? <span className="text-emerald-600 font-medium">{fmt(per)}</span>
          : <span className="text-slate-300">—</span>
      },
    },
    {
      label: 'Parts fiscales',
      render: s => {
        const parts = (s.params?.partsBase ?? 1) + (s.params?.nbEnfants ?? 0) * 0.5
        return `${parts}`
      },
    },
    {
      label: 'Gain vs moins avantageux',
      render: s => s.gain > 500
        ? <span className="text-emerald-600 font-semibold">+{fmt(s.gain)}</span>
        : <span className="text-slate-300">—</span>,
      best: s => s.gain ?? 0,
    },
    {
      label: 'Enregistrée le',
      render: s => <span className="text-slate-400">{new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>,
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between" style={{ background: '#F8FAFF' }}>
        <h3 className="font-semibold text-slate-900 text-sm">Tableau comparatif détaillé</h3>
        <span className="text-xs text-slate-400">{sorted.length} scénarios</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFF' }}>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                Critère
              </th>
              {sorted.map((s, i) => (
                <th key={s.id} className={`text-right px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${i === 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                  <div className="truncate max-w-[120px] ml-auto">{s.name}</div>
                  {i === 0 && (
                    <div className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full normal-case font-semibold mt-1 inline-block">
                      ★ Meilleur
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const bestVal = row.best ? Math.max(...sorted.map(row.best)) : null
              return (
                <tr key={row.label}
                  className={`border-t border-slate-50 ${row.highlight ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-5 py-3.5 text-sm text-slate-500 font-medium whitespace-nowrap">{row.label}</td>
                  {sorted.map((s, i) => {
                    const val = row.best ? row.best(s) : null
                    const isBest = bestVal !== null && val === bestVal
                    return (
                      <td key={s.id}
                        className={`px-4 py-3.5 text-right text-sm relative ${row.highlight && i === 0 ? 'font-bold text-blue-700' : ''}`}>
                        {isBest && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-400 rounded-full" />
                        )}
                        {row.render(s)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
