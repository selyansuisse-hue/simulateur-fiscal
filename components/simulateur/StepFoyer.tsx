'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Label } from '@/components/ui/label'
import { calcPartsTotal } from '@/lib/fiscal/ir'
import { fmt } from '@/lib/utils'

const SELECT_CLS = `w-full px-4 py-3.5 text-sm border-[1.5px] border-surface2 rounded-xl bg-white text-ink font-medium
  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all cursor-pointer`

const INPUT_CLS = `px-4 py-3.5 text-sm border-[1.5px] border-surface2 rounded-xl bg-white text-ink font-medium
  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all`

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
    localStorage.setItem('simulateurResultat', '1')
  }

  const revPro = Math.max(0, params.ca - params.charges - params.amort - params.deficit)
  const perPlafond = Math.round(Math.min(35194, revPro * 0.10))

  return (
    <div className="animate-stepIn">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue/10 rounded-full border border-blue/20 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-blue" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-blue">Étape 4 sur 4</span>
        </div>
        <h2 className="font-display text-3xl font-black text-ink tracking-tight mb-2">Situation du foyer fiscal</h2>
        <p className="text-[14.5px] text-ink3 leading-relaxed max-w-md">Permet de calculer précisément l&apos;IR avec le quotient familial 2025.</p>
      </div>

      {/* Situation familiale */}
      <div className="bg-white border border-black/[0.07] rounded-2xl p-7 mb-5 shadow-card-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="5" cy="4" r="2.5" stroke="#2563EB" strokeWidth="1.5"/>
              <circle cx="11" cy="5" r="2" stroke="#2563EB" strokeWidth="1.3"/>
              <path d="M1 13c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M11 13c0-1.66-1.34-3-3-3" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Situation familiale</div>
            <div className="text-[11.5px] text-ink4">Pour le calcul du quotient familial</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Situation matrimoniale</Label>
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
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Enfants à charge</Label>
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
        <div className="bg-blue-bg border border-blue-border rounded-xl p-4 flex items-center gap-4 mb-5">
          <div className="font-display text-3xl font-black text-blue flex-shrink-0">{partsStr}</div>
          <div>
            <div className="text-[13px] font-bold text-ink">parts fiscales</div>
            <div className="text-[12px] text-ink3 leading-relaxed">
              {params.partsBase === 2 ? 'Base couple : 2 parts' : 'Base célibataire : 1 part'}
              {params.nbEnfants === 1 && ' · +0,5 part (1er enfant)'}
              {params.nbEnfants === 2 && ' · +1 part (2 enfants × 0,5)'}
              {params.nbEnfants >= 3 && ` · +1 part (2 premiers) · +${params.nbEnfants - 2} part${params.nbEnfants - 2 > 1 ? 's' : ''} (à partir du 3ème)`}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Autres revenus du foyer (€/an)</Label>
          <input
            type="number"
            value={params.autresRev}
            min={0}
            step={1000}
            onChange={e => setParam('autresRev', Math.max(0, parseFloat(e.target.value) || 0))}
            className={INPUT_CLS}
          />
          <p className="text-[11.5px] text-ink4 leading-relaxed">Salaire conjoint, revenus fonciers, autres revenus imposables</p>
        </div>
      </div>

      {/* PER */}
      <div className="bg-white border border-black/[0.07] rounded-2xl p-7 mb-5 shadow-card-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1.5v4M4.5 13.5h6M7.5 13.5v-4" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3 6.5c0-2.485 2.015-4.5 4.5-4.5S12 4.015 12 6.5c0 1.5-.75 2.82-1.89 3.6L9.5 11.5h-4l-.61-1.4C3.75 9.32 3 8 3 6.5z" stroke="#2563EB" strokeWidth="1.4"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Plan d&apos;Épargne Retraite (PER)</div>
            <div className="text-[11.5px] text-ink4">Optimisation fiscale sur la retraite</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Versements PER actifs ?</Label>
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
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Montant annuel PER (€)</Label>
              <input
                type="number"
                value={params.perMontant}
                min={0}
                step={500}
                onChange={e => setParam('perMontant', Math.max(0, parseFloat(e.target.value) || 0))}
                className={INPUT_CLS}
              />
            </div>
          )}
        </div>
        <p className="text-[12px] text-ink4 mt-3 leading-relaxed">
          Plafond 2025 : 10% du revenu professionnel, max 35&nbsp;194&nbsp;€ — votre plafond estimé : <strong className="text-ink3">{fmt(perPlafond)}</strong>.
          {params.perActif === 'oui' && ' Le versement PER est déduit de la base imposable IR.'}
        </p>
      </div>

      <div className="bg-blue-bg border border-blue-border rounded-2xl p-5 mb-6">
        <div className="flex gap-3 text-[13px] text-blue-dark leading-relaxed">
          <span className="flex-shrink-0 text-base">ℹ️</span>
          <div>
            <strong>Barème IR 2025</strong> — tranches progressives avec quotient familial.
            Plafond QF : <strong>1 807 €/demi-part</strong> (revenus 2025).
            La décote (873 €) est appliquée automatiquement.
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-surface2">
        <button
          onClick={prevStep}
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-ink4 hover:text-ink3 transition-all rounded-xl hover:bg-surface"
        >
          ← Précédent
        </button>
        <button
          onClick={handleCalculate}
          className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-blue text-white font-black text-[14px] rounded-xl
            shadow-[0_6px_20px_rgba(29,78,216,.4)] hover:bg-blue-dark
            hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(29,78,216,.48)]
            transition-all duration-150"
        >
          <span>✦</span>
          Calculer ma simulation
        </button>
      </div>
    </div>
  )
}
