'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function PageHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hasSimulated, setHasSimulated] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    setHasSimulated(!!localStorage.getItem('simulateurResultat'))
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const isOnSim = pathname === '/simulateur'
  const isOnExp = pathname === '/explorer'
  const isOnComp = pathname === '/simulations'

  return (
    <header className="sticky top-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 flex items-center h-16 gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
            <span className="text-white text-xs font-black">B</span>
          </div>
          <span className="font-display font-bold text-white text-sm tracking-tight">Belho Xper</span>
        </Link>

        {/* ── Navigation 3 étapes ── */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">

          {/* Étape 1 — Simuler */}
          <Link href="/simulateur"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${isOnSim ? 'bg-blue text-white' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>
            {hasSimulated ? (
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">✓</span>
            ) : (
              <span className={`w-5 h-5 rounded-full border text-[10px] flex items-center justify-center flex-shrink-0
                ${isOnSim ? 'border-white/50 text-white/70' : 'border-white/25 text-white/35'}`}>1</span>
            )}
            Simuler
          </Link>

          <span className="text-white/20 text-xs px-1">→</span>

          {/* Étape 2 — Explorer */}
          <Link href="/explorer"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${isOnExp ? 'bg-blue text-white' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>
            <span className={`w-5 h-5 rounded-full border text-[10px] flex items-center justify-center flex-shrink-0
              ${isOnExp ? 'border-white/50 text-white/70' : 'border-white/25 text-white/35'}`}>2</span>
            Explorer
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none
              ${isOnExp ? 'bg-white/20 text-white/80' : 'bg-white/8 text-white/45'}`}>BÊTA</span>
          </Link>

          <span className="text-white/20 text-xs px-1">→</span>

          {/* Étape 3 — Comparer */}
          {user ? (
            <Link href="/simulations"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${isOnComp ? 'bg-blue text-white' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>
              <span className={`w-5 h-5 rounded-full border text-[10px] flex items-center justify-center flex-shrink-0
                ${isOnComp ? 'border-white/50 text-white/70' : 'border-white/25 text-white/35'}`}>3</span>
              Comparer
            </Link>
          ) : (
            <Link href="/auth/signup"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/35 hover:text-white/55 transition-all">
              <span className="w-5 h-5 rounded-full border border-white/15 text-white/25 text-[10px] flex items-center justify-center flex-shrink-0">3</span>
              <span className="line-through decoration-white/20">Comparer</span>
              <span className="text-[9px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded-full leading-none no-underline">
                Connexion
              </span>
            </Link>
          )}
        </nav>

        {/* CTA droite */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue flex items-center justify-center text-white text-xs font-bold">
                  {(user.email || 'U')[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 bg-white rounded-xl shadow-card-lg border border-surface2 py-1.5 min-w-[160px] z-50">
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-surface transition-colors">Dashboard</Link>
                  <Link href="/simulations" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-surface transition-colors">Mes simulations</Link>
                  <Link href="/profil" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-surface transition-colors">Mon profil</Link>
                  <hr className="my-1 border-surface2" />
                  <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">Déconnexion</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login"
                className="text-sm text-white/55 font-medium hidden sm:inline transition-colors duration-150 hover:text-white px-2.5 py-1 rounded-md hover:bg-white/8">
                Connexion
              </Link>
              <a
                href="https://www.belhoxper.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1.5 px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg
                  shadow-[0_2px_6px_rgba(29,78,216,.35)] hover:bg-blue-dark transition-all duration-150"
              >
                Prendre RDV
                <span className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">→</span>
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
