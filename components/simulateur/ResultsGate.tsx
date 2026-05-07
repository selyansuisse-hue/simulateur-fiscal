'use client'
import Link from 'next/link'
import { useSimulateur } from '@/hooks/useSimulateur'
import { useEffect } from 'react'

export function ResultsGate() {
  const { params } = useSimulateur()

  // Persist params so we can restore them after auth redirect
  useEffect(() => {
    try {
      localStorage.setItem('sim_gate_params', JSON.stringify(params))
    } catch {}
  }, [params])

  return (
    <div className="relative min-h-[580px] flex flex-col items-center justify-center py-12">

      {/* Blurred fake results — decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
        <div className="blur-xl opacity-30 p-8">
          {/* Fake hero card */}
          <div className="rounded-2xl p-8 mb-6 max-w-3xl mx-auto" style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)' }}>
            <div className="h-4 w-36 rounded-lg mb-4" style={{ background: '#1e3a5f' }} />
            <div className="h-14 w-56 rounded-xl mb-4" style={{ background: 'rgba(37,99,235,0.3)' }} />
            <div className="flex gap-3">
              <div className="h-3 w-28 rounded" style={{ background: '#1e293b' }} />
              <div className="h-3 w-20 rounded" style={{ background: '#1e293b' }} />
            </div>
          </div>
          {/* Fake cards row */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl p-5" style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)' }}>
                <div className="h-3 w-16 rounded mb-3" style={{ background: '#1e293b' }} />
                <div className="h-9 w-24 rounded-lg mb-2" style={{ background: i === 0 ? 'rgba(37,99,235,0.25)' : '#1e293b' }} />
                <div className="h-2.5 w-12 rounded" style={{ background: '#1e293b' }} />
              </div>
            ))}
          </div>
          {/* Fake chart bar */}
          <div className="rounded-xl p-6 max-w-3xl mx-auto" style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)' }}>
            <div className="flex gap-4 items-end h-24">
              {[85, 62, 74, 48].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-lg" style={{
                  height: `${h}%`,
                  background: i === 0 ? 'rgba(37,99,235,0.4)' : 'rgba(51,65,85,0.4)',
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gradient fade over the blurred content */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(2,6,23,0.55) 30%, rgba(2,6,23,0.92) 100%)' }} />

      {/* Gate card */}
      <div className="relative z-10 text-center max-w-[420px] mx-auto px-6">

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.35)' }}>
          <span className="text-3xl" role="img" aria-label="Résultats prêts">📊</span>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-[11px] font-bold tracking-widest uppercase"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
          ✓ Calcul terminé — résultats disponibles
        </div>

        <h2 className="font-display text-3xl sm:text-[2rem] font-black text-white mb-3 tracking-tight leading-tight">
          Vos résultats sont prêts !
        </h2>
        <p className="text-slate-400 text-[14px] leading-relaxed mb-6">
          Créez votre compte gratuit pour consulter la comparaison complète
          Micro · EI · EURL · SASU sur vos chiffres réels.
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-5 mb-7">
          {[
            { icon: '✓', label: 'Gratuit' },
            { icon: '✓', label: 'Sans CB' },
            { icon: '✓', label: '< 1 minute' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-emerald-400 font-bold">{icon}</span>
              {label}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full">
          <Link
            href="/auth/signup?next=/simulateur"
            className="w-full py-3.5 rounded-xl text-white font-bold text-[15px] text-center block transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
            }}
          >
            Voir mes résultats → Créer un compte
          </Link>
          <Link
            href="/auth/login?next=/simulateur"
            className="w-full py-3 rounded-xl text-slate-300 font-semibold text-sm text-center block transition-all hover:border-slate-500 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(51,65,85,0.7)' }}
          >
            J&apos;ai déjà un compte — Se connecter
          </Link>
        </div>

        <p className="text-[11px] text-slate-600 mt-5 leading-relaxed">
          Rejoignez +500 dirigeants qui optimisent déjà leur structure fiscale.
        </p>
      </div>
    </div>
  )
}
