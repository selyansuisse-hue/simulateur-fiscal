import { fmt } from '@/lib/utils'

interface Simulation {
  id: string
  name: string
  best_forme: string
  best_net_annuel: number
  best_net_mois: number
  tmi: number
  ca: number
  gain: number
}

interface Props {
  simulations: Simulation[]
}

export function CompareTable({ simulations }: Props) {
  if (simulations.length < 2) return null
  const best = simulations.reduce((a, b) => a.best_net_annuel > b.best_net_annuel ? a : b)

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden mb-6">
      <div className="bg-slate-800 px-5 py-4 border-b border-slate-700">
        <h3 className="font-display text-sm font-bold text-white">Comparaison de vos simulations</h3>
        <p className="text-xs text-slate-400 mt-0.5">Triées par revenu net décroissant</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-700">
              {['Simulation', 'Structure', 'Net/an', 'Net/mois', 'CA', 'TMI'].map(h => (
                <th key={h} className="text-left text-[10px] font-bold tracking-wide uppercase text-slate-400 px-3.5 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...simulations].sort((a, b) => b.best_net_annuel - a.best_net_annuel).map(sim => (
              <tr key={sim.id} className={sim.id === best.id ? 'bg-blue-500/5' : 'hover:bg-slate-800 transition-colors'}>
                <td className="px-3.5 py-3 border-b border-slate-800">
                  <span className="font-semibold text-slate-100 text-[13px]">{sim.name}</span>
                  {sim.id === best.id && <span className="ml-1.5 inline-flex items-center bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Meilleur</span>}
                </td>
                <td className="px-3.5 py-3 border-b border-slate-800 text-[13px] text-slate-400">{sim.best_forme}</td>
                <td className="px-3.5 py-3 border-b border-slate-800 font-bold text-[13px] text-emerald-400">{fmt(sim.best_net_annuel)}</td>
                <td className="px-3.5 py-3 border-b border-slate-800 text-[13px] text-slate-400">{fmt(sim.best_net_mois)}</td>
                <td className="px-3.5 py-3 border-b border-slate-800 text-[13px] text-slate-400">{fmt(sim.ca)}</td>
                <td className="px-3.5 py-3 border-b border-slate-800 text-[13px] font-semibold text-slate-200">{sim.tmi}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
