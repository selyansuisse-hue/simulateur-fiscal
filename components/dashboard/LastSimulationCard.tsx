import Link from 'next/link'
import { fmt } from '@/lib/utils'

interface ScoredResult {
  forme: string
  netAnnuel: number
  ir: number
  charges: number
  is: number
  scoreTotal: number
}

interface Props {
  sim: {
    id: string
    created_at: string
    best_forme: string
    best_net_annuel: number
    tmi: number
    ca: number
    gain: number
    params?: { charges?: number; amort?: number; secteur?: string }
    results?: { scored?: ScoredResult[] }
  }
}

export function LastSimulationCard({ sim }: Props) {
  const date = new Date(sim.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const scored: ScoredResult[] = sim.results?.scored ?? []
  const best = scored[0]

  const chargesExploit = (sim.params?.charges ?? 0) + (sim.params?.amort ?? 0)
  const cotisations = best?.charges ?? 0
  const taxes = (best?.ir ?? 0) + (best?.is ?? 0)
  const netAnnuel = best?.netAnnuel ?? sim.best_net_annuel

  const decompRows = [
    { label: 'Revenu net', val: netAnnuel, color: '#10B981' },
    { label: 'Cotisations', val: cotisations, color: '#EF4444' },
    { label: 'IR + IS', val: taxes, color: '#3B82F6' },
    { label: 'Charges exploit.', val: Math.max(0, sim.ca - netAnnuel - cotisations - taxes), color: '#94A3B8' },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header dark */}
      <div className="px-6 py-5 flex items-start justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #050c1a, #0d1f3c)' }}>
        <div>
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Dernière simulation · {date}
          </div>
          <div className="text-white/60 text-sm">{sim.best_forme}</div>
          <div className="text-4xl font-black text-white tracking-tight mt-1">
            {fmt(netAnnuel)}
          </div>
          <div className="text-white/40 text-sm mt-0.5">
            {fmt(Math.round(netAnnuel / 12))}/mois net
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {sim.gain > 500 && (
            <>
              <div className="text-xs text-white/30 mb-1">Gain vs moins avantageux</div>
              <div className="text-xl font-black text-emerald-400">+{fmt(sim.gain)}/an</div>
            </>
          )}
          <div className="flex gap-2 mt-3">
            <Link href={`/simulations/${sim.id}`}
              className="text-xs text-white/70 px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors"
              style={{ background: 'rgba(255,255,255,0.10)' }}>
              Voir l&apos;analyse →
            </Link>
            <Link href={`/explorer?ca=${sim.ca}`}
              className="text-xs text-white px-3 py-1.5 rounded-lg hover:bg-blue-500 transition-colors bg-blue-600">
              Explorer
            </Link>
          </div>
        </div>
      </div>

      {/* Décomposition CA */}
      {sim.ca > 0 && (
        <div className="px-6 py-4 border-b border-slate-50">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-3">
            Décomposition de votre CA de {fmt(sim.ca)}
          </div>
          <div className="space-y-2">
            {decompRows.map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-500 flex-shrink-0">{row.label}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full">
                  <div className="h-2 rounded-full" style={{
                    width: `${Math.max(1, Math.min(100, (row.val / sim.ca) * 100)).toFixed(0)}%`,
                    backgroundColor: row.color,
                  }} />
                </div>
                <div className="w-24 text-xs font-bold text-right" style={{ color: row.color }}>
                  {fmt(row.val)}
                </div>
                <div className="w-10 text-[10px] text-slate-300 text-right">
                  {Math.round((row.val / sim.ca) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparaison structures */}
      {scored.length > 0 && (
        <div className="px-6 py-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-3">
            Toutes les structures
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {scored.map((s, i) => (
              <div key={s.forme}
                className={`rounded-xl p-3 text-center border transition-all ${i === 0 ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className={`text-[10px] font-bold mb-1 ${i === 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                  {i === 0 ? '★ REC.' : `${i + 1}ème`}
                </div>
                <div className={`text-[11px] font-semibold mb-1 ${i === 0 ? 'text-blue-800' : 'text-slate-600'}`}>
                  {s.forme.replace(' / SARL (IS)', '').replace(' / SASU', '').replace('SAS', 'SASU')}
                </div>
                <div className={`text-sm font-black ${i === 0 ? 'text-blue-700' : 'text-slate-700'}`}>
                  {fmt(s.netAnnuel)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {fmt(Math.round(s.netAnnuel / 12))}/mois
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
