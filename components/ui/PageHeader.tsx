'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function PageHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hasSimulated, setHasSimulated] = useState(false)
  const [cabinetSlug, setCabinetSlug] = useState<string | null>(null)
  const [cabinetNom, setCabinetNom] = useState<string | null>(null)
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: membre } = await supabase
          .from('cabinet_membres')
          .select('cabinets(slug, nom)')
          .eq('user_id', data.user.id)
          .limit(1)
          .maybeSingle()
        const rawCabs = membre?.cabinets
        const cab = Array.isArray(rawCabs)
          ? (rawCabs as { slug: string; nom: string }[])[0] ?? null
          : (rawCabs as unknown as { slug: string; nom: string } | null) ?? null
        if (cab) { setCabinetSlug(cab.slug); setCabinetNom(cab.nom) }
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) { setCabinetSlug(null); setCabinetNom(null) }
    })
    setHasSimulated(!!localStorage.getItem('simulateurResultat'))
    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const isOnSim = pathname === '/simulateur'
  const isOnExp = pathname === '/explorer'
  const isOnComp = pathname === '/simulations'

  const firstName = user
    ? ((user.user_metadata?.full_name as string | undefined) || user.email || '')
        .split(user.email?.includes('@') ? '@' : ' ')[0]
    : ''
  const initial = firstName[0]?.toUpperCase() || 'U'

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

        {/* Nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          <Link href="/simulateur"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${isOnSim ? 'bg-blue text-white' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>
            {hasSimulated && pathname !== '/' ? (
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">✓</span>
            ) : (
              <span className={`w-5 h-5 rounded-full border text-[10px] flex items-center justify-center flex-shrink-0
                ${isOnSim ? 'border-white/50 text-white/70' : 'border-white/25 text-white/35'}`}>1</span>
            )}
            Simuler
          </Link>

          <span className="text-white/20 text-xs px-1">→</span>

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

          <Link href="/simulations"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${isOnComp ? 'bg-blue text-white' : 'text-white/60 hover:text-white/80 hover:bg-white/5'}`}>
            <span className={`w-5 h-5 rounded-full border text-[10px] flex items-center justify-center flex-shrink-0
              ${isOnComp ? 'border-white/50 text-white/70' : 'border-white/25 text-white/35'}`}>3</span>
            Comparer
          </Link>
        </nav>

        {/* CTA droite */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white transition-colors px-1 py-1 rounded-lg hover:bg-white/5"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {initial}
                </div>
                <span className="hidden sm:inline text-sm font-medium" style={{ color: '#cbd5e1' }}>
                  {cabinetNom || firstName}
                </span>
                <span className="text-white/30 text-xs">▾</span>
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)',
                  borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  minWidth: '200px', padding: '6px', zIndex: 50,
                }}>
                  {/* Email header */}
                  <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid rgba(51,65,85,0.5)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                  </div>

                  {/* Cabinet badge si membre */}
                  {cabinetSlug && (
                    <>
                      <DropItem href={`/cabinet/${cabinetSlug}`} onClick={() => setMenuOpen(false)} icon="🏢">
                        <span>Dashboard Cabinet</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: 'rgba(139,92,246,0.2)', color: '#a78bfa', marginLeft: 'auto' }}>
                          Cabinet
                        </span>
                      </DropItem>
                      <DropItem href={`/cabinet/${cabinetSlug}/stats`} onClick={() => setMenuOpen(false)} icon="📈">
                        Statistiques
                      </DropItem>
                      <DropItem href={`/cabinet/${cabinetSlug}/widget`} onClick={() => setMenuOpen(false)} icon="🔗">
                        Mon widget
                      </DropItem>
                    </>
                  )}

                  {/* Items standards */}
                  {!cabinetSlug && (
                    <DropItem href="/dashboard" onClick={() => setMenuOpen(false)} icon="📊">
                      Mes simulations
                    </DropItem>
                  )}
                  <DropItem href="/profil" onClick={() => setMenuOpen(false)} icon="👤">
                    Mon profil
                  </DropItem>

                  {/* Séparateur + déco */}
                  <div style={{ borderTop: '1px solid rgba(51,65,85,0.5)', margin: '4px 0' }} />
                  <button
                    onClick={handleSignOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '8px 12px', borderRadius: '9px', border: 'none',
                      background: 'transparent', cursor: 'pointer', fontSize: '13px',
                      color: '#f87171', textAlign: 'left', transition: 'background 150ms',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>⎋</span> Déconnexion
                  </button>
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

function DropItem({ href, onClick, icon, children }: {
  href: string
  onClick: () => void
  icon: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 12px', borderRadius: '9px', textDecoration: 'none',
      fontSize: '13px', color: '#cbd5e1', transition: 'background 150ms',
    }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(51,65,85,0.4)'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      <span>{icon}</span>
      {children}
    </Link>
  )
}
