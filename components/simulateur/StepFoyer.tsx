'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { calcPartsTotal } from '@/lib/fiscal/ir'

export function StepFoyer() {
  const { params, setParam, setParams, calcul, nextStep, prevStep } = useSimulateur()

  const situFam = params.partsBase === 2 ? (params.nbEnfants > 0 ? 'marie' : 'marie') : 'celibataire'
  const partsTotal = calcPartsTotal(params.partsBase, params.nbEnfants)
  const partsStr = partsTotal % 1 === 0 ? partsTotal.toString() : partsTotal.toString().replace('.', ',')

  const handleSituFam = (val: string) => {
    setParam('partsBase', val === 'marie' || val === 'pacse' || val === 'veuf' ? 2 : 1)
  }

  const handleCalculate = () => {
    calcul()
    nextStep()
  }

  return (
    <div className="animate-stepIn">
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-ink tracking-tight mb-1">Situation du foyer fiscal</h2>
        <p className="text-sm text-ink3">Permet de calculer précisément l&apos;IR avec le quotient familial 2025.</p>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-4 shadow-card">
        <div className="text-[10.5px] font-bold tracking-widest uppercase text-ink4 mb-4 pb-3 border-b border-surface2">
          Situation familiale
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Situation matrimoniale</Label>
            <Select
              value={params.partsBase === 2 ? 'marie' : 'celibataire'}
              onValueChange={handleSituFam}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="celibataire">Célibataire / divorcé</SelectItem>
                <SelectItem value="marie">Marié(e) / pacsé(e)</SelectItem>
                <SelectItem value="veuf">Veuf / veuve</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Enfants à charge</Label>
            <Select value={params.nbEnfants.toString()} onValueChange={v => setParam('nbEnfants', parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4,5].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n === 0 ? 'Aucun' : n === 1 ? '1 enfant' : `${n} enfants`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Affichage parts */}
        <div className="bg-surface rounded-lg p-3 flex items-center gap-3 mb-4">
          <div className="font-display text-xl font-bold text-blue">{partsStr}</div>
          <div>
            <div className="text-sm font-semibold text-ink">parts fiscales</div>
            <div className="text-[11.5px] text-ink4">
              {params.partsBase === 2 ? 'Base couple : 2 parts' : 'Base célibataire : 1 part'}
              {params.nbEnfants === 1 && ' · +0,5 part (1er enfant)'}
              {params.nbEnfants === 2 && ' · +1 part (2 enfants × 0,5)'}
              {params.nbEnfants >= 3 && ` · +1 part (2 premiers × 0,5) · +${params.nbEnfants - 2} part${params.nbEnfants - 2 > 1 ? 's' : ''} (${params.nbEnfants - 2} enfant${params.nbEnfants - 2 > 1 ? 's' : ''} à partir du 3ème)`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <p className="text-[11.5px] text-ink4">Salaire conjoint, revenus fonciers, autres</p>
          </div>
        </div>
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

      <div className="flex justify-between mt-6 pt-5 border-t border-surface2">
        <button onClick={prevStep} className="px-5 py-2.5 text-sm font-semibold text-ink3 border-[1.5px] border-surface2 rounded-lg hover:bg-surface hover:text-ink2 transition-all">← Précédent</button>
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
