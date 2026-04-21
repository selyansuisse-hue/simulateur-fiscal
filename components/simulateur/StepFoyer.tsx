'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Label } from '@/components/ui/label'
import { calcPartsTotal } from '@/lib/fiscal/ir'
import { fmt } from '@/lib/utils'

const SELECT_CLS = `w-full px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all cursor-pointer`

export function StepFoyer() {
  const { params, setParam, calcul, nextStep, prevStep } = useSimulateur()

  const partsTotal = calcPartsTotal(params.partsBase, params.nbEnfants)
  const partsStr = partsTotal % 1 === 0 ? partsTotal.toString() : partsTotal.toFixed(1).replace('.', ',')

  const handleSituFam = (val: string) => {
    setParam('partsBase', val === 'marie' || val === 'pacse' || val === 'veuf' ? 2 : 1)
  }

  const handleCalculate = () => {
    calcul()
    nextStep()
  }

  const revPro = Math.max(0, params.ca - params.charges - params.amort - params.deficit)
  const perPlafond = Math.round(Math.min(35194, revPro * 0.10))

  return (
    <div className="animate-stepIn">
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-ink tracking-tight mb-1">Situation du foyer fiscal</h2>
        <p className="text-sm text-ink3">Permet de calculer précisément l&apos;IR avec le quotient familial 2025.</p>
      </div>

      {/* Situation familiale */}
      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-0.5 h-5 rounded-full bg-blue" />
          <span className="text-sm font-semibold text-ink2">Situation familiale</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Situation matrimoniale</Label>
            <select
              value={params.partsBase === 2 ? 'marie' : 'celibataire'}
              onChange={e => handleSituFam(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="celibataire">Célibataire / divorcé(e)</option>
              <option value="marie">Marié(e) / pacsé(e)</option>
              <option value="veuf">Veuf / veuve</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Enfants à charge</Label>
            <select
              value={params.nbEnfants.toString()}
              onChange={e => setParam('nbEnfants', parseInt(e.target.value))}
              className={SELECT_CLS}
            >
              <option value="0">Aucun enfant</option>
              <option value="1">1 enfant</option>
              <option value="2">2 enfants</option>
              <option value="3">3 enfants</option>
              <option value="4">4 enfants</option>
              <option value="5">5 enfants ou plus</option>
            </select>
          </div>
        </div>

        {/* Récap parts */}
        <div className="bg-surface rounded-lg p-3 flex items-center gap-3 mb-4">
          <div className="font-display text-xl font-bold text-blue">{partsStr}</div>
          <div>
            <div className="text-sm font-semibold text-ink">parts fiscales</div>
            <div className="text-[11.5px] text-ink4">
              {params.partsBase === 2 ? 'Base couple : 2 parts' : 'Base célibataire : 1 part'}
              {params.nbEnfants === 1 && ' · +0,5 part (1er enfant)'}
              {params.nbEnfants === 2 && ' · +1 part (2 enfants × 0,5)'}
              {params.nbEnfants >= 3 && ` · +1 part (2 premiers) · +${params.nbEnfants - 2} part${params.nbEnfants - 2 > 1 ? 's' : ''} (à partir du 3ème)`}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Autres revenus du foyer (€/an)</Label>
          <input
            type="number"
            value={params.autresRev}
            min={0}
            step={1000}
            onChange={e => setParam('autresRev', Math.max(0, parseFloat(e.target.value) || 0))}
            className="px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
              focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
          />
          <p className="text-[11.5px] text-ink4">Salaire conjoint, revenus fonciers, autres revenus imposables</p>
        </div>
      </div>

      {/* PER */}
      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-0.5 h-5 rounded-full bg-blue" />
          <span className="text-sm font-semibold text-ink2">Plan d&apos;Épargne Retraite (PER)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Versements PER actifs ?</Label>
            <select
              value={params.perActif}
              onChange={e => setParam('perActif', e.target.value as 'oui' | 'non')}
              className={SELECT_CLS}
            >
              <option value="non">Non — pas de versements PER</option>
              <option value="oui">Oui — je verse au PER</option>
            </select>
          </div>
          {params.perActif === 'oui' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Montant annuel PER (€)</Label>
              <input
                type="number"
                value={params.perMontant}
                min={0}
                max={perPlafond}
                step={500}
                onChange={e => setParam('perMontant', Math.min(perPlafond, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
                  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
              />
            </div>
          )}
        </div>
        <p className="text-[11.5px] text-ink4 mt-2.5">
          Plafond 2025 : 10% du revenu professionnel, max 35&nbsp;194&nbsp;€ (votre plafond estimé : {fmt(perPlafond)}).
          {params.perActif === 'oui' && ' Le versement PER est déduit de la base imposable IR.'}
        </p>
      </div>

      <div className="bg-blue-bg border border-blue-border rounded-xl p-4 mb-5">
        <div className="flex gap-2.5 text-sm text-blue-dark">
          <span className="flex-shrink-0">ℹ️</span>
          <div>
            <strong>Barème IR 2025</strong> — tranches progressives avec quotient familial.
            Plafond QF : <strong>1 807 €/demi-part</strong> (revenus 2025).
            La décote (873 €) est appliquée automatiquement.
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 pt-5 border-t border-surface2">
        <button onClick={prevStep} className="px-5 py-2.5 text-sm font-semibold text-ink4 hover:text-ink3 transition-all">← Précédent</button>
        <span className="text-xs text-ink4">Étape 4 sur 5</span>
        <button
          onClick={handleCalculate}
          className="px-8 py-2.5 bg-blue text-white font-bold text-sm rounded-lg
            shadow-[0_4px_16px_rgba(29,78,216,.4)] hover:bg-blue-dark hover:-translate-y-0.5
            hover:shadow-[0_8px_28px_rgba(29,78,216,.45)] transition-all duration-150"
        >
          ✦ Calculer ma simulation
        </button>
      </div>
    </div>
  )
}
