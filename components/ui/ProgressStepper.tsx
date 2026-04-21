'use client'
import { useSimulateur } from '@/hooks/useSimulateur'

const STEPS = ['Situation', 'Activité', 'Rémunération', 'Foyer', 'Résultats']

export function ProgressStepper() {
  const { step, setStep, isCalculated } = useSimulateur()

  return (
    <div className="bg-navy-2 border-b border-white/[0.06]">
      <div className="max-w-[920px] mx-auto px-6 py-5">
        <div className="flex items-start">
          {STEPS.map((label, i) => {
            const isActive = i === step
            const isDone = i < step || (isCalculated && i < 4)
            const canClick = isDone || i <= step
            const isLast = i === STEPS.length - 1

            return (
              <div key={i} className={`flex items-start ${isLast ? '' : 'flex-1'}`}>
                <button
                  onClick={() => canClick && setStep(i)}
                  disabled={!canClick}
                  className="flex flex-col items-center gap-2 flex-shrink-0 group"
                  style={{ cursor: canClick ? 'pointer' : 'default' }}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-200 ${
                      isActive
                        ? 'shadow-[0_0_0_4px_rgba(59,130,246,.22),0_4px_14px_rgba(59,130,246,.35)]'
                        : isDone
                          ? 'shadow-[0_0_0_3px_rgba(29,78,216,.15)]'
                          : ''
                    }`}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                        : isDone
                          ? '#1D4ED8'
                          : 'rgba(255,255,255,.07)',
                      border: isActive || isDone ? 'none' : '1.5px solid rgba(255,255,255,.13)',
                      color: isActive || isDone ? 'white' : 'rgba(255,255,255,.28)',
                    }}
                  >
                    {isDone && !isActive ? (
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
                        <path d="M1.5 5.5L5 9L11.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[10.5px] font-semibold leading-none transition-colors duration-150 ${
                      isActive
                        ? 'text-white'
                        : isDone
                          ? 'text-white/55 group-hover:text-white/75'
                          : 'text-white/22'
                    }`}
                  >
                    {label}
                  </span>
                </button>

                {!isLast && (
                  <div
                    className="flex-1 h-px mt-5 mx-2.5 transition-all duration-300 rounded-full"
                    style={{
                      background:
                        isDone && step > i
                          ? 'linear-gradient(90deg, rgba(29,78,216,.6) 0%, rgba(59,130,246,.4) 100%)'
                          : 'rgba(255,255,255,.09)',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
