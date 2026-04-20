'use client'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressStepper } from '@/components/ui/ProgressStepper'
import { StepSituation } from '@/components/simulateur/StepSituation'
import { StepActivite } from '@/components/simulateur/StepActivite'
import { StepRemuneration } from '@/components/simulateur/StepRemuneration'
import { StepFoyer } from '@/components/simulateur/StepFoyer'
import { StepResultats } from '@/components/simulateur/StepResultats'
import { useSimulateur } from '@/hooks/useSimulateur'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const STEPS = [StepSituation, StepActivite, StepRemuneration, StepFoyer, StepResultats]

export default function SimulateurPage() {
  const { step } = useSimulateur()
  const [isAuth, setIsAuth] = useState(false)
  const StepComponent = STEPS[step]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsAuth(!!data.user))
  }, [])

  return (
    <>
      <PageHeader />

      {/* Hero sombre compact */}
      <div className="bg-navy relative overflow-hidden border-b border-white/[0.05]">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.18)_0%,transparent_65%)] -top-36 -right-16 pointer-events-none" />
        <div className="max-w-[920px] mx-auto px-8 py-10 relative">
          <div className="text-[10.5px] font-semibold tracking-widest uppercase text-blue-mid mb-3">Simulateur fiscal · 2025</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-3 max-w-lg">
            Quelle structure vous fait<br />
            <span className="bg-gradient-to-r from-blue-mid to-blue-light bg-clip-text text-transparent">
              vraiment économiser ?
            </span>
          </h1>
          <div className="text-sm text-white/40 max-w-sm leading-relaxed">
            4 étapes. Comparaison instantanée. Barème IR & cotisations SSI 2025.
          </div>
        </div>
      </div>

      <ProgressStepper />

      <div className="max-w-[920px] mx-auto px-4 sm:px-8 py-9 pb-24">
        <StepComponent />
      </div>

      {/* Bannière compte — visible uniquement si non connecté et sur l'étape résultats */}
      {!isAuth && step === 4 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-surface2 shadow-card-lg">
          <div className="max-w-[920px] mx-auto px-6 py-3.5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-display text-[13px] font-bold text-ink mb-0.5">Enregistrez cette simulation</div>
              <div className="text-xs text-ink3">Créez un compte gratuit pour sauvegarder, comparer et télécharger vos simulations en PDF.</div>
            </div>
            <div className="flex gap-2.5 flex-shrink-0">
              <Link href="/auth/signup" className="px-4 py-2 bg-blue text-white text-xs font-bold rounded-lg hover:bg-blue-dark transition-all whitespace-nowrap">
                Créer un compte
              </Link>
              <Link href="/auth/login" className="px-4 py-2 text-ink3 border border-surface2 text-xs font-semibold rounded-lg hover:bg-surface transition-all whitespace-nowrap">
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
