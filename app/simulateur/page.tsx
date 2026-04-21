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
          <p className="text-[14px] text-white/42 max-w-md leading-relaxed">
            4 étapes. Comparaison Micro · EI · EURL · SASU sur vos chiffres réels. Barème IR & cotisations SSI 2025.
          </p>
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
