'use client'
import { useSimulateur } from '@/hooks/useSimulateur'
import { Label } from '@/components/ui/label'
import { MICRO_PLAFONDS } from '@/lib/fiscal'

const INPUT_CLS = `px-4 py-3.5 text-sm border-[1.5px] border-surface2 rounded-xl bg-white text-ink font-medium
  focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all placeholder:text-ink4`

export function StepActivite() {
  const { params, setParam, nextStep, prevStep } = useSimulateur()

  const cfg = MICRO_PLAFONDS[params.secteur]
  const microEligible = params.ca <= cfg.plafond

  return (
    <div className="animate-stepIn">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue/10 rounded-full border border-blue/20 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-blue" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-blue">Étape 2 sur 4</span>
        </div>
        <h2 className="font-display text-3xl font-black text-ink tracking-tight mb-2">Données financières</h2>
        <p className="text-[14.5px] text-ink3 leading-relaxed max-w-md">Saisissez vos chiffres réels ou prévisionnels — nous comparons toutes les structures sur cette base.</p>
      </div>

      <div className="bg-white border border-black/[0.07] rounded-2xl p-7 mb-5 shadow-card-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="3.5" width="12" height="9" rx="1.5" stroke="#2563EB" strokeWidth="1.5"/>
              <path d="M5 3.5V2.5M10 3.5V2.5" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M4 8h7M4 10.5h4" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Résultat d&apos;activité</div>
            <div className="text-[11.5px] text-ink4">Chiffre d&apos;affaires et charges réelles ou estimées</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">CA annuel HT (€)</Label>
            <input
              type="number"
              value={params.ca}
              min={1}
              step={1000}
              onChange={e => setParam('ca', Math.max(1, parseFloat(e.target.value) || 0))}
              className={INPUT_CLS}
            />
            <p className="text-[11.5px] text-ink4 leading-relaxed">CA hors taxes — base identique pour toutes les structures</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Charges d&apos;exploitation (€)</Label>
            <input
              type="number"
              value={params.charges}
              min={0}
              step={500}
              onChange={e => setParam('charges', Math.max(0, parseFloat(e.target.value) || 0))}
              className={INPUT_CLS}
            />
            <p className="text-[11.5px] text-ink4 leading-relaxed">Loyer, matériel, assurances, sous-traitance, logiciels…</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Amortissements annuels (€)</Label>
            <input
              type="number"
              value={params.amort}
              min={0}
              step={500}
              onChange={e => setParam('amort', Math.max(0, parseFloat(e.target.value) || 0))}
              className={INPUT_CLS}
            />
          </div>
          {params.situation !== 'creation' && (
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Déficit reportable N-1 (€)</Label>
              <input
                type="number"
                value={params.deficit}
                min={0}
                step={500}
                onChange={e => setParam('deficit', Math.max(0, parseFloat(e.target.value) || 0))}
                className={INPUT_CLS}
              />
            </div>
          )}
        </div>

        {microEligible ? (
          <div className="mt-5 flex gap-3 bg-blue-bg border border-blue-border rounded-xl p-4 text-[13px] text-blue-dark">
            <span className="text-base flex-shrink-0">ℹ️</span>
            <div className="leading-relaxed">
              <strong>{cfg.label}</strong> — abattement {Math.round(cfg.abat * 100)}% sur le CA.
              Plafond : {cfg.plafond.toLocaleString('fr-FR')} €/an. Micro comparé avec le régime réel.
            </div>
          </div>
        ) : (
          <div className="mt-5 flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-[13px] text-amber-800">
            <span className="text-base flex-shrink-0">⚠</span>
            <div className="leading-relaxed">
              <strong>Plafond micro dépassé</strong> — votre CA ({params.ca.toLocaleString('fr-FR')} €)
              dépasse le plafond {cfg.label.split('—')[0].trim()} ({cfg.plafond.toLocaleString('fr-FR')} €).
              La micro-entreprise est exclue de la comparaison.
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-black/[0.07] rounded-2xl p-7 mb-5 shadow-card-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1.5v12M3.5 5.5h8M3.5 9.5h8" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Paramètres société &amp; régime</div>
            <div className="text-[11.5px] text-ink4">Capital social pour les structures IS</div>
          </div>
        </div>
        <div className="max-w-xs">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold tracking-widest uppercase text-ink3">Capital social si société IS (€)</Label>
            <input
              type="number"
              value={params.capital}
              min={1}
              step={1000}
              onChange={e => setParam('capital', Math.max(1, parseFloat(e.target.value) || 1))}
              className={INPUT_CLS}
            />
            <p className="text-[11.5px] text-ink4 leading-relaxed">En EURL : dividendes &gt; 10% du capital → cotisations TNS 45%</p>
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
