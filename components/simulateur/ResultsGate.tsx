'use client'
import Link from 'next/link'
import { useSimulateur } from '@/hooks/useSimulateur'
import { useEffect } from 'react'

export function ResultsGate() {
  const { params } = useSimulateur()

  // Sauvegarder les params pour les restaurer après connexion
  useEffect(() => {
    try {
      localStorage.setItem('sim_gate_params', JSON.stringify(params))
    } catch {}
  }, [params])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16"
      style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(37,99,235,0.08) 0%, transparent 70%)' }}>
      <div className="max-w-md mx-auto text-center">

        {/* Icône */}
        <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl" role="img" aria-label="Résultats prêts">🔓</span>
        </div>

        {/* Titre */}
        <h1 className="font-display text-3xl font-black text-white mb-3 tracking-tight">
          Vos résultats sont prêts !
        </h1>
        <p className="text-slate-400 mb-2 text-[15px] leading-relaxed">
          Créez votre compte gratuit pour découvrir quelle structure
          vous fait économiser le plus.
        </p>
        <p className="text-slate-600 text-sm mb-8">
          Gratuit · Sans CB · Résultats sauvegardés
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link href="/auth/signup?next=/simulateur"
            className="w-full block py-4 px-6 rounded-xl text-white font-bold text-[16px] text-center transition-all hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 20px rgba(37,99,235,0.45)' }}>
            Créer mon compte gratuit →
          </Link>
          <Link href="/auth/login?next=/simulateur"
            className="w-full block py-3 px-6 rounded-xl border border-slate-600 text-white font-semibold text-[14px] text-center transition-all hover:bg-slate-800 hover:border-slate-500"
            style={{ background: 'rgba(30,41,59,0.6)' }}>
            J&apos;ai déjà un compte — Se connecter
          </Link>
        </div>

        {/* Social proof */}
        <div className="mt-8 flex items-center justify-center gap-5">
          {[
            { val: '+500', label: 'dirigeants' },
            { val: '+11k€', label: 'gain moyen/an' },
            { val: '4 min', label: 'de simulation' },
          ].map(({ val, label }) => (
            <div key={label} className="text-center">
              <div className="text-sm font-black text-white">{val}</div>
              <div className="text-[11px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
