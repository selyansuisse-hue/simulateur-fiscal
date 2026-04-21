'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

const FEATURES = [
  'Calculs fiscaux 2025 certifiés (barème IR, SSI, IS)',
  'Sauvegardez et comparez vos simulations',
  'Tableau comparatif multi-scénarios',
  'Export PDF de chaque rapport',
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured()) {
      setError('Supabase n\'est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local (voir README).')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/dashboard` },
        })
        if (error) {
          const status = (error as { status?: number }).status
          setError(status === 503 || status === 504
            ? 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
            : error.message)
        } else setMagicSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          const status = (error as { status?: number }).status
          setError(status === 503 || status === 504
            ? 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
            : error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message)
        } else router.push('/dashboard')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('503') || msg.includes('504') || msg.toLowerCase().includes('fetch')
        ? 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
        : 'Impossible de contacter le service. Vérifiez votre connexion internet.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Panneau gauche ── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col p-12 relative overflow-hidden" style={{ backgroundColor: '#050c1a' }}>
        <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,.22) 0%, transparent 65%)', top: '-12rem', right: '-6rem' }} />
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.10) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 relative z-10 mb-auto">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
            <span className="text-white text-sm font-black">B</span>
          </div>
          <span className="font-display font-bold text-white">Belho Xper</span>
        </Link>

        {/* Central content */}
        <div className="relative z-10 my-auto">
          <div className="font-display text-4xl font-black text-white tracking-tight leading-tight mb-4">
            Retrouvez<br />
            <span style={{ color: '#3B82F6' }}>vos simulations</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.50)' }}>
            Reconnectez-vous pour accéder à votre tableau de bord et comparer vos scénarios.
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-4">
          {FEATURES.map(f => (
            <div key={f} className="flex items-start gap-3">
              <span className="mt-0.5 font-bold flex-shrink-0" style={{ color: '#4ade80' }}>✓</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,.60)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panneau droite ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
              <span className="text-white text-xs font-black">B</span>
            </div>
            <span className="font-display font-bold text-ink">Belho Xper</span>
          </Link>

          <h1 className="font-display text-[1.75rem] font-bold text-ink tracking-tight mb-1.5">Connexion</h1>
          <p className="text-sm text-ink3 mb-8">Retrouvez vos simulations sauvegardées.</p>

          {magicSent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-3xl mb-3">📧</div>
              <div className="font-display font-bold text-ink mb-1">Lien envoyé !</div>
              <div className="text-sm text-ink3">Vérifiez votre boîte mail ({email}) et cliquez sur le lien pour vous connecter.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-surface2 overflow-hidden bg-white mb-5">
                <button type="button" onClick={() => setMode('password')}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'password' ? 'bg-ink text-white' : 'text-ink3 hover:bg-surface'}`}>
                  Mot de passe
                </button>
                <button type="button" onClick={() => setMode('magic')}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${mode === 'magic' ? 'bg-ink text-white' : 'text-ink3 hover:bg-surface'}`}>
                  Magic link
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  className="px-3.5 py-3 text-sm border-[1.5px] border-surface2 rounded-lg text-ink bg-white
                    focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
                />
              </div>

              {mode === 'password' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Mot de passe</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="px-3.5 py-3 text-sm border-[1.5px] border-surface2 rounded-lg text-ink bg-white
                      focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all"
                  />
                </div>
              )}

              {error && (
                <div className="text-red-700 text-xs py-3 px-3.5 bg-red-50 rounded-lg border border-red-200 leading-relaxed">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue text-white font-bold text-sm rounded-lg
                  shadow-[0_2px_8px_rgba(29,78,216,.3)] hover:bg-blue-dark transition-all disabled:opacity-60 mt-2"
              >
                {loading ? 'Connexion…' : mode === 'magic' ? 'Envoyer le magic link' : 'Se connecter'}
              </button>

              <p className="text-center text-sm text-ink3 mt-4">
                Pas encore de compte ?{' '}
                <Link href="/auth/signup" className="text-blue font-semibold hover:underline">Créer un compte</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
