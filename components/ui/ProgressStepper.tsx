'use client'
import { useSimulateur } from '@/hooks/useSimulateur'

const STEPS = ['Situation', 'Activité', 'Rémunération', 'Foyer', 'Résultats']

export function ProgressStepper() {
  const { step, setStep, isCalculated } = useSimulateur()

  return (
    <div className="bg-navy-2 border-b border-white/[0.06]">
      <div className="max-w-[920px] mx-auto px-6 py-4">
        <div className="flex items-start">
          {STEPS.map((label, i) => {
            const isActive = i === step
            const isDone = i < step || (isCalculated && i < 4)
            const canClick = isDone || i <= step
            const isLast = i === STEPS.length - 1

            return (
              <div key={i} className={`flex items-start ${isLast ? '' : 'flex-1'}`}>
                {/* Circle + label */}
                <button
                  onClick={() => canClick && setStep(i)}
                  disabled={!canClick}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
                  style={{ cursor: canClick ? 'pointer' : 'default' }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200
                    ${isActive
                      ? 'text-white shadow-[0_0_0_3px_rgba(59,130,246,.25)]'
                      : isDone
                        ? 'text-white'
                        : 'text-white/30'}`}
                    style={{
                      background: isActive ? '#3B82F6' : isDone ? '#1D4ED8' : 'rgba(255,255,255,.07)',
                      border: isActive ? 'none' : isDone ? 'none' : '1px solid rgba(255,255,255,.12)',
                    }}
                  >
                    {isDone && !isActive ? (
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-[10px] font-medium leading-none transition-colors hidden sm:block
                    ${isActive ? 'text-white' : isDone ? 'text-white/50 group-hover:text-white/70' : 'text-white/22'}`}>
                    {label}
                  </span>
                </button>

                {/* Connector line to next step */}
                {!isLast && (
                  <div className="flex-1 h-px mt-4 mx-2 transition-colors duration-200"
                    style={{ background: isDone && step > i ? 'rgba(59,130,246,.45)' : 'rgba(255,255,255,.10)' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
