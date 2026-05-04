'use client'
import { useSimulateur } from '@/hooks/useSimulateur'

const STEPS = ['Situation', 'Activité', 'Rémunération', 'Foyer', 'Résultats']

const PROGRESS_DATA = [
  { pct: 25, time: '~3 minutes restantes' },
  { pct: 50, time: '~2 minutes restantes' },
  { pct: 75, time: '~1 minute restante' },
  { pct: 90, time: '~30 secondes restantes' },
  { pct: 100, time: 'Résultats calculés' },
]

export function ProgressStepper() {
  const { step, setStep, isCalculated } = useSimulateur()
  const progress = PROGRESS_DATA[step] ?? PROGRESS_DATA[4]

  return (
    <div className="bg-navy-2 border-b border-white/[0.06]">
      <div className="max-w-[920px] mx-auto px-6 pt-5 pb-4">

        {/* ── Step circles ── */}
        <div className="flex items-start mb-4">
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
                        : ''
                    }`}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                        : isDone
                          ? 'rgba(37,99,235,0.22)'
                          : 'rgba(51,65,85,0.6)',
                      border: isActive
                        ? 'none'
                        : isDone
                          ? '1.5px solid rgba(59,130,246,0.35)'
                          : '1.5px solid rgba(255,255,255,.10)',
                      color: isActive
                        ? 'white'
                        : isDone
                          ? '#60a5fa'
                          : 'rgba(100,116,139,1)',
                    }}
                  >
                    {isDone && !isActive ? (
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
                        <path d="M1.5 5.5L5 9L11.5 1.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
                          ? 'text-slate-400 group-hover:text-slate-300'
                          : 'text-slate-500'
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
                          ? 'linear-gradient(90deg, rgba(37,99,235,.5) 0%, rgba(59,130,246,.3) 100%)'
                          : 'rgba(255,255,255,.07)',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Progress bar + metadata ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            {step < 4 ? (
              <span style={{
                fontSize: '11px', fontWeight: 700,
                padding: '2px 10px', borderRadius: '999px',
                background: 'rgba(59,130,246,0.12)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.2)',
              }}>
                ● ÉTAPE {step + 1} SUR 4
              </span>
            ) : (
              <span style={{
                fontSize: '11px', fontWeight: 700,
                padding: '2px 10px', borderRadius: '999px',
                background: 'rgba(16,185,129,0.12)',
                color: '#34d399',
                border: '1px solid rgba(16,185,129,0.2)',
              }}>
                ✓ RÉSULTATS
              </span>
            )}
            {step < 4 && (
              <span className="text-xs text-slate-500">
                ⏱ {progress.time}
              </span>
            )}
            <span className="text-xs text-slate-500 ml-auto">
              {progress.pct}%
            </span>
          </div>

          {/* Thin progress bar */}
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress.pct}%`,
              background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
              borderRadius: '999px',
              transition: 'width 500ms ease',
            }} />
          </div>
        </div>

      </div>
    </div>
  )
}
