'use client'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressStepper } from '@/components/ui/ProgressStepper'
import { StepSituation } from '@/components/simulateur/StepSituation'
import { StepActivite } from '@/components/simulateur/StepActivite'
import { StepRemuneration } from '@/components/simulateur/StepRemuneration'
import { StepFoyer } from '@/components/simulateur/StepFoyer'
import { StepResultats } from '@/components/simulateur/StepResultats'
import { ResultsGate } from '@/components/simulateur/ResultsGate'
import { useSimulateur } from '@/hooks/useSimulateur'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const STEPS = [StepSituation, StepActivite, StepRemuneration, StepFoyer, StepResultats]

export default function SimulateurPage() {
  const { step, setParams, setStep, calcul } = useSimulateur()
  const [isAuth, setIsAuth] = useState<boolean | null>(null) // null = loading
  const StepComponent = STEPS[step]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const authenticated = !!data.user
      setIsAuth(authenticated)

      // Restore pending simulation params after auth redirect
      if (authenticated) {
        try {
          const pending = localStorage.getItem('sim_gate_params')
          if (pending && step === 0) {
            const savedParams = JSON.parse(pending)
            setParams(savedParams)
            calcul()
            setStep(4)
            localStorage.removeItem('sim_gate_params')
            localStorage.setItem('simulateurResultat', '1')
          }
        } catch {}
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (step === 4) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [step])

  // Show gate when unauthenticated and on results step
  const showGate = step === 4 && isAuth === false

  return (
    <>
      <PageHeader />

      {/* Hero sombre compact */}
      <div className="bg-navy relative overflow-hidden border-b border-white/[0.05]">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.16)_0%,transparent_65%)] -top-40 -right-20 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '28px 28px',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 100% at 100% 50%, black 30%, transparent 100%)',
            maskImage: 'radial-gradient(ellipse 70% 100% at 100% 50%, black 30%, transparent 100%)' }} />
        <div className="max-w-[920px] mx-auto px-8 py-12 relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px w-6 rounded-full bg-blue-mid" />
            <span className="text-[10.5px] font-bold tracking-[0.18em] uppercase text-blue-mid">Simulateur fiscal · 2025</span>
          </div>
          <h1 className="font-display text-3xl sm:text-[2.6rem] font-black text-white tracking-tight leading-tight mb-3 max-w-xl">
            Quelle structure vous fait<br />
            <span className="bg-gradient-to-r from-blue-mid to-blue-light bg-clip-text text-transparent">
              vraiment économiser ?
            </span>
          </h1>
          <p className="text-[14px] text-white/60 max-w-md leading-relaxed">
            4 étapes. Comparaison Micro · EI · EURL · SASU sur vos chiffres réels. Barème IR & cotisations SSI 2025.
          </p>
        </div>
      </div>

      <ProgressStepper />

      <div className={step === 4 && !showGate ? 'w-full px-4 sm:px-8 py-9 pb-8' : 'max-w-[920px] mx-auto px-4 sm:px-8 py-9 pb-8'}>
        {showGate ? <ResultsGate /> : <StepComponent />}
      </div>
    </>
  )
}
