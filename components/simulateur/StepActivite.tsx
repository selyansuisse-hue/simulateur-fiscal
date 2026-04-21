'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Label } from '@/components/ui/label'
import { MICRO_PLAFONDS } from '@/lib/fiscal'

export function StepActivite() {
  const { params, setParam, nextStep, prevStep } = useSimulateur()

  const cfg = MICRO_PLAFONDS[params.secteur]
  const microEligible = params.ca <= cfg.plafond

  return (
    <div className="animate-stepIn">
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-ink tracking-tight mb-1">Données financières</h2>
        <p className="text-sm text-ink3">Saisissez vos chiffres réels ou prévisionnels.</p>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-0.5 h-5 rounded-full bg-blue" />
          <span className="text-sm font-semibold text-ink2">Résultat d&apos;activité</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">CA annuel HT (€)</Label>
            <input
              type="number"
              value={params.ca}
              min={1}
              step={1000}
              onChange={e => setParam('ca', Math.max(1, parseFloat(e.target.value) || 0))}
              className="px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
                focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
            />
            <p className="text-[11.5px] text-ink4">CA hors taxes — base identique pour toutes les structures</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Charges d&apos;exploitation hors rémunération (€)</Label>
            <input
              type="number"
              value={params.charges}
              min={0}
              step={500}
              onChange={e => setParam('charges', Math.max(0, parseFloat(e.target.value) || 0))}
              className="px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
                focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
            />
            <p className="text-[11.5px] text-ink4">Loyer, matériel, assurances, sous-traitance, logiciels, honoraires EC…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Amortissements annuels (€)</Label>
            <input
              type="number"
              value={params.amort}
              min={0}
              step={500}
              onChange={e => setParam('amort', Math.max(0, parseFloat(e.target.value) || 0))}
              className="px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
                focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
            />
          </div>
          {params.situation !== 'creation' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Déficit reportable N-1 (€)</Label>
              <input
                type="number"
                value={params.deficit}
                min={0}
                step={500}
                onChange={e => setParam('deficit', Math.max(0, parseFloat(e.target.value) || 0))}
                className="px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
                  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
              />
            </div>
          )}
        </div>

        {/* Micro status */}
        {microEligible ? (
          <div className="mt-4 flex gap-2.5 bg-blue-bg border border-blue-border rounded-lg p-3 text-[12.5px] text-blue-dark">
            <span>ℹ️</span>
            <div>
              <strong>{cfg.label}</strong> — abattement {Math.round(cfg.abat * 100)}% sur le CA.
              Plafond : {cfg.plafond.toLocaleString('fr-FR')} €/an. Micro comparé avec le régime réel.
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12.5px] text-amber-800">
            <span>⚠</span>
            <div>
              <strong>Plafond micro dépassé</strong> — votre CA ({params.ca.toLocaleString('fr-FR')} €)
              dépasse le plafond {cfg.label.split('—')[0].trim()} ({cfg.plafond.toLocaleString('fr-FR')} €).
              La micro-entreprise est exclue de la comparaison.
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-0.5 h-5 rounded-full bg-blue" />
          <span className="text-sm font-semibold text-ink2">Paramètres société &amp; régime</span>
        </div>
        <div className="max-w-xs">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Capital social si société IS (€)</Label>
            <input
              type="number"
              value={params.capital}
              min={1}
              step={1000}
              onChange={e => setParam('capital', Math.max(1, parseFloat(e.target.value) || 1))}
              className="px-3 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink
                focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
            />
            <p className="text-[11.5px] text-ink4">En EURL : dividendes &gt; 10% du capital → cotisations TNS 45%</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 pt-5 border-t border-surface2">
        <button onClick={prevStep} className="px-5 py-2.5 text-sm font-semibold text-ink4 hover:text-ink3 transition-all">← Précédent</button>
        <span className="text-xs text-ink4">Étape 2 sur 5</span>
        <button onClick={nextStep} className="px-6 py-2.5 bg-blue text-white font-semibold text-sm rounded-lg shadow-[0_2px_6px_rgba(29,78,216,.3)] hover:bg-blue-dark hover:-translate-y-px transition-all">Suivant →</button>
      </div>
    </div>
  )
}
