'use client'
import { useSimulateur } from '@/hooks/useSimulateur'

const STEPS = ['Situation', 'Activité', 'Rémunération', 'Foyer', 'Résultats']

export function ProgressStepper() {
  const { step, setStep, isCalculated } = useSimulateur()

  return (
    <div className="bg-navy-2 border-b border-white/[0.06]">
      <div className="max-w-[920px] mx-auto flex px-8 overflow-x-auto">
        {STEPS.map((label, i) => {
          const isActive = i === step
          const isDone = i < step || (isCalculated && i < 4)
          const canClick = isDone || i <= step
          return (
            <button
              key={i}
              onClick={() => canClick && setStep(i)}
              disabled={!canClick}
              className={`flex-1 flex items-center gap-2 py-3.5 border-b-2 transition-all text-xs font-medium tracking-wide whitespace-nowrap
                ${isActive ? 'border-blue-mid text-white' : isDone ? 'border-transparent text-white/38 hover:text-white/65' : 'border-transparent text-white/22 cursor-default'}
              `}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all
                ${isActive ? 'bg-blue-mid text-white shadow-[0_0_0_3px_rgba(59,130,246,.2)]' : isDone ? 'bg-blue-mid/18 text-blue-light text-[9px]' : 'bg-white/7 text-white/30'}`}>
                {isDone && !isActive ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
