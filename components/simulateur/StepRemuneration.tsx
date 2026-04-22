'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { fmt } from '@/lib/utils'

function calcIS(r: number): number {
  if (r <= 0) return 0
  return r <= 42500 ? r * 0.15 : 42500 * 0.15 + (r - 42500) * 0.25
}

export function StepRemuneration() {
  const { params, setParam, nextStep, prevStep } = useSimulateur()
  const benefice = Math.max(0, params.ca - params.charges - params.amort - params.deficit)
  const showPrevoyance = (params.situation === 'existant' || params.situation === 'changement') && params.formeActuelle === 'eurl_is'

  const reserveIS = calcIS(params.reserveVoulue)
  const reserveNet = params.reserveVoulue - reserveIS
  const reserveTaux = params.reserveVoulue > 42500 ? 25 : 15

  return (
    <div className="animate-stepIn">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue/10 rounded-full border border-blue/20 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-blue" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-blue">Étape 3 sur 4</span>
        </div>
        <h2 className="font-display text-3xl font-black text-ink tracking-tight mb-2">Stratégie de rémunération</h2>
        <p className="text-[14.5px] text-ink3 leading-relaxed max-w-md">Comment souhaitez-vous utiliser le bénéfice généré par votre activité ?</p>
      </div>

      {/* Résumé bénéfice */}
      <div className="bg-navy rounded-2xl p-7 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(rgba(255,255,255,.10)_1px,transparent_1px)] bg-[length:28px_28px]" />
        <div className="absolute w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,.15)_0%,transparent_70%)] -top-16 -right-12 pointer-events-none" />
        <div className="relative">
          <div className="text-[10.5px] font-bold tracking-widest uppercase text-blue-mid mb-2">Résultat avant rémunération</div>
          <div className="font-display text-5xl font-black text-white tracking-tight">{fmt(benefice)}</div>
          <div className="text-sm text-white/40 mt-2">CA {fmt(params.ca)} − charges {fmt(params.charges)} − amort. {fmt(params.amort)}</div>
        </div>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-2xl p-7 mb-5 shadow-card-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1.5C4.186 1.5 1.5 4.186 1.5 7.5S4.186 13.5 7.5 13.5 13.5 10.814 13.5 7.5 10.814 1.5 7.5 1.5z" stroke="#2563EB" strokeWidth="1.5"/>
              <path d="M7.5 4.5v3l2 1.5" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Objectif de rémunération</div>
            <div className="text-[11.5px] text-ink4">Choisissez votre stratégie pour ce bénéfice</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setParam('stratActif', 'max')}
            className={`flex flex-col gap-2 p-5 rounded-2xl border-2 text-left transition-all duration-150
              ${params.stratActif === 'max'
                ? 'border-blue bg-blue-bg shadow-[0_0_0_3px_rgba(59,130,246,.10)]'
                : 'border-surface2 bg-white hover:border-ink4/50 hover:shadow-card'}`}
          >
            <div className="text-2xl mb-0.5">💰</div>
            <div className="font-display text-[14px] font-bold text-ink">Maximiser le revenu net</div>
            <div className="text-[12.5px] text-ink3 leading-relaxed">Optimise la combinaison rémunération / dividendes pour maximiser votre revenu disponible</div>
          </button>
          <button
            onClick={() => setParam('stratActif', 'reserve')}
            className={`flex flex-col gap-2 p-5 rounded-2xl border-2 text-left transition-all duration-150
              ${params.stratActif === 'reserve'
                ? 'border-blue bg-blue-bg shadow-[0_0_0_3px_rgba(59,130,246,.10)]'
                : 'border-surface2 bg-white hover:border-ink4/50 hover:shadow-card'}`}
          >
            <div className="text-2xl mb-0.5">📈</div>
            <div className="font-display text-[14px] font-bold text-ink">Conserver des réserves</div>
            <div className="text-[12.5px] text-ink3 leading-relaxed">Laissez une partie du résultat en réserves pour investir ou constituer un capital</div>
          </button>
        </div>

        {params.stratActif === 'reserve' && (
          <div className="flex flex-col gap-4 mb-6 p-5 bg-surface rounded-2xl border border-surface2">
            <Label className="text-sm font-medium text-slate-700">Montant à conserver en réserves (brut avant IS)</Label>

            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 50].map(pct => {
                const amount = Math.round(benefice * pct / 100 / 1000) * 1000
                const isActive = params.reserveVoulue === amount
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setParam('reserveVoulue', amount)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all duration-150
                      ${isActive
                        ? 'bg-blue text-white border-blue shadow-[0_2px_8px_rgba(29,78,216,.3)]'
                        : 'bg-white border-surface2 text-ink3 hover:border-blue-mid hover:text-blue'}`}
                  >
                    {pct}% — {fmt(amount)}
                  </button>
                )
              })}
            </div>

            <input
              type="range"
              min={0}
              max={benefice || 1}
              step={1000}
              value={params.reserveVoulue}
              onChange={e => setParam('reserveVoulue', parseInt(e.target.value))}
              className="w-full accent-blue h-1.5 rounded-full cursor-pointer"
            />

            <div className="flex items-center gap-4 flex-wrap">
              <input
                type="number"
                value={params.reserveVoulue}
                min={0}
                max={benefice}
                step={1000}
                onChange={e => setParam('reserveVoulue', Math.min(benefice, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="px-4 py-3 text-sm border-[1.5px] border-surface2 rounded-xl bg-white text-ink font-medium
                  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all w-36"
              />
              {params.reserveVoulue > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ink4">→</span>
                  <span className="font-black text-ink text-base">{fmt(reserveNet)}</span>
                  <span className="text-ink4 text-xs">net après IS ({reserveTaux}%)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {showPrevoyance && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-slate-700">Niveau de prévoyance TNS</Label>
              <Select value={params.prevoy} onValueChange={v => setParam('prevoy', v as typeof params.prevoy)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="min">Minimum (2% — indispensable)</SelectItem>
                  <SelectItem value="moyen">Moyen (5% — recommandé)</SelectItem>
                  <SelectItem value="max">Maximum (10% — protection optimale)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11.5px] text-ink4 leading-relaxed">Taux de prévoyance facultative Madelin / PER sur le bénéfice</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-surface2">
        <button
          onClick={prevStep}
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-ink4 hover:text-ink3 transition-all rounded-xl hover:bg-surface"
        >
          ← Précédent
        </button>
        <button
          onClick={nextStep}
          className="group inline-flex items-center gap-2 px-7 py-3 bg-blue text-white font-bold text-sm rounded-xl
            shadow-[0_4px_14px_rgba(29,78,216,.35)] hover:bg-blue-dark
            hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(29,78,216,.42)]
            transition-all duration-150"
        >
          Continuer
          <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </div>
  )
}
