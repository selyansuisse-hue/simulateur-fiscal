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
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-ink tracking-tight mb-1">Stratégie de rémunération</h2>
        <p className="text-sm text-ink3">Comment souhaitez-vous utiliser le bénéfice généré ?</p>
      </div>

      {/* Résumé bénéfice */}
      <div className="bg-navy rounded-xl p-5 mb-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] bg-[length:24px_24px]" />
        <div className="relative">
          <div className="text-[10.5px] font-semibold tracking-widest uppercase text-blue-mid mb-1">Résultat avant rémunération</div>
          <div className="font-display text-4xl font-bold text-white tracking-tight">{fmt(benefice)}</div>
          <div className="text-sm text-white/40 mt-1">CA {fmt(params.ca)} − charges {fmt(params.charges)} − amort. {fmt(params.amort)}</div>
        </div>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-0.5 h-5 rounded-full bg-blue" />
          <span className="text-sm font-semibold text-ink2">Objectif de rémunération</span>
        </div>

        {/* Stratégie max vs réserve */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setParam('stratActif', 'max')}
            className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all
              ${params.stratActif === 'max'
                ? 'border-blue-mid bg-blue-bg shadow-[0_0_0_3px_rgba(59,130,246,.08)]'
                : 'border-surface2 bg-white hover:border-ink4'}`}
          >
            <div className="text-xl mb-1">💰</div>
            <div className="font-display text-sm font-bold text-ink">Maximiser le revenu net</div>
            <div className="text-xs text-ink3 leading-relaxed">Optimise la combinaison rémunération / dividendes pour maximiser votre revenu disponible</div>
          </button>
          <button
            onClick={() => setParam('stratActif', 'reserve')}
            className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all
              ${params.stratActif === 'reserve'
                ? 'border-blue-mid bg-blue-bg shadow-[0_0_0_3px_rgba(59,130,246,.08)]'
                : 'border-surface2 bg-white hover:border-ink4'}`}
          >
            <div className="text-xl mb-1">📈</div>
            <div className="font-display text-sm font-bold text-ink">Conserver des réserves</div>
            <div className="text-xs text-ink3 leading-relaxed">Laissez une partie du résultat en réserves dans la société pour investir ou constituer un capital</div>
          </button>
        </div>

        {params.stratActif === 'reserve' && (
          <div className="flex flex-col gap-3 mb-5 p-4 bg-surface rounded-xl border border-surface2">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Montant à conserver en réserves (brut avant IS)</Label>

            {/* Boutons rapides */}
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 50].map(pct => {
                const amount = Math.round(benefice * pct / 100 / 1000) * 1000
                const isActive = params.reserveVoulue === amount
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setParam('reserveVoulue', amount)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all
                      ${isActive
                        ? 'bg-blue text-white border-blue shadow-[0_2px_6px_rgba(29,78,216,.3)]'
                        : 'bg-white border-surface2 text-ink3 hover:border-blue-mid hover:text-blue'}`}
                  >
                    {pct}% — {fmt(amount)}
                  </button>
                )
              })}
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={benefice || 1}
              step={1000}
              value={params.reserveVoulue}
              onChange={e => setParam('reserveVoulue', parseInt(e.target.value))}
              className="w-full accent-blue h-1.5 rounded-full cursor-pointer"
            />

            {/* Input + affichage IS */}
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="number"
                value={params.reserveVoulue}
                min={0}
                max={benefice}
                step={1000}
                onChange={e => setParam('reserveVoulue', Math.min(benefice, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="px-3 py-2 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
                  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all w-36"
              />
              {params.reserveVoulue > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-ink4">→</span>
                  <span className="font-bold text-ink">{fmt(reserveNet)}</span>
                  <span className="text-ink4 text-xs">net après IS ({reserveTaux}%)</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {showPrevoyance && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Niveau de prévoyance TNS</Label>
              <Select value={params.prevoy} onValueChange={v => setParam('prevoy', v as typeof params.prevoy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="min">Minimum (2% — indispensable)</SelectItem>
                  <SelectItem value="moyen">Moyen (5% — recommandé)</SelectItem>
                  <SelectItem value="max">Maximum (10% — protection optimale)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11.5px] text-ink4">Taux de prévoyance facultative Madelin / PER sur le bénéfice</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 pt-5 border-t border-surface2">
        <button onClick={prevStep} className="px-5 py-2.5 text-sm font-semibold text-ink4 hover:text-ink3 transition-all">← Précédent</button>
        <span className="text-xs text-ink4">Étape 3 sur 5</span>
        <button onClick={nextStep} className="px-6 py-2.5 bg-blue text-white font-semibold text-sm rounded-lg shadow-[0_2px_6px_rgba(29,78,216,.3)] hover:bg-blue-dark hover:-translate-y-px transition-all">Suivant →</button>
      </div>
    </div>
  )
}
