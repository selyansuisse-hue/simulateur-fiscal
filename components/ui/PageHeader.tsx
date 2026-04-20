'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function PageHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <header className="sticky top-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 flex items-center h-16 gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
            <span className="text-white text-xs font-black">B</span>
          </div>
          <span className="font-display font-bold text-white text-sm tracking-tight">Belho Xper</span>
        </Link>

        {/* Nav links — centre */}
        <nav className="hidden md:flex items-center gap-6 flex-1 justify-center">
          <Link href="/simulateur" className="text-sm text-white/55 hover:text-white transition-colors font-medium">
            Simulateur
          </Link>
          {user && (
            <>
              <Link href="/dashboard" className="text-sm text-white/55 hover:text-white transition-colors font-medium">
                Dashboard
              </Link>
              <Link href="/simulations" className="text-sm text-white/55 hover:text-white transition-colors font-medium">
                Mes simulations
              </Link>
            </>
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
                  <Link href="/profil" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-surface transition-colors">Mon profil</Link>
                  <Link href="/simulations" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-ink hover:bg-surface transition-colors">Mes simulations</Link>
                  <hr className="my-1 border-surface2" />
                  <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">Déconnexion</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm text-white/55 hover:text-white transition-colors font-medium hidden sm:inline">
                Connexion
              </Link>
              <a
                href="https://www.belhoxper.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg
                  shadow-[0_2px_6px_rgba(29,78,216,.35)] hover:bg-blue-dark transition-all"
              >
                Prendre RDV
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
