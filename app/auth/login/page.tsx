'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

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
      setError('Supabase n\'est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans votre fichier .env.local (voir README).')
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
        if (error) setError(error.message)
        else setMagicSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message)
        else router.push('/dashboard')
      }
    } catch {
      setError('Impossible de contacter Supabase. Vérifiez votre connexion et vos variables d\'environnement (.env.local).')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Panneau gauche — sombre */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.2)_0%,transparent_65%)] -top-48 -right-24 pointer-events-none" />
        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
            <span className="text-white text-sm font-black">B</span>
          </div>
          <span className="font-display font-bold text-white">Belho Xper</span>
        </Link>
        <div className="relative z-10">
          <blockquote className="text-white/60 text-[15px] leading-relaxed italic mb-4">
            &quot;J&apos;ai économisé 8 000 €/an en passant de l&apos;EI à la SASU. Le simulateur m&apos;a convaincu en 10 minutes.&quot;
          </blockquote>
          <div className="text-white/80 text-sm font-semibold">Thomas D.</div>
          <div className="text-white/38 text-xs">Consultant freelance, Lyon</div>
        </div>
      </div>

      {/* Panneau droite — formulaire */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
              <span className="text-white text-xs font-black">B</span>
            </div>
            <span className="font-display font-bold text-ink">Belho Xper</span>
          </Link>

          <h1 className="font-display text-2xl font-bold text-ink tracking-tight mb-1.5">Connexion</h1>
          <p className="text-sm text-ink3 mb-8">Retrouvez vos simulations sauvegardées.</p>

          {magicSent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-3xl mb-3">📧</div>
              <div className="font-display font-bold text-ink mb-1">Lien envoyé !</div>
              <div className="text-sm text-ink3">Vérifiez votre boîte mail ({email}) et cliquez sur le lien pour vous connecter.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="px-3.5 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg text-ink bg-white
                    focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10"
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
                    className="px-3.5 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg text-ink bg-white
                      focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10"
                  />
                </div>
              )}

              {error && <p className="text-red-600 text-xs py-2 px-3 bg-red-50 rounded-lg border border-red-200">{error}</p>}

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
