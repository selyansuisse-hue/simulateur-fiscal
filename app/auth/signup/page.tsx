'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Mot de passe minimum 8 caractères.'); return }
    if (!isSupabaseConfigured()) {
      setError('Supabase n\'est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans votre fichier .env.local (voir README).')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${location.origin}/dashboard`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
      } else if (data.user && !data.session) {
        setSuccess(true)
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Impossible de contacter Supabase. Vérifiez votre connexion et vos variables d\'environnement (.env.local).')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface flex">
      <div className="hidden lg:flex lg:w-1/2 bg-navy flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.2)_0%,transparent_65%)] -top-48 -right-24 pointer-events-none" />
        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
            <span className="text-white text-sm font-black">B</span>
          </div>
          <span className="font-display font-bold text-white">Belho Xper</span>
        </Link>
        <div className="relative z-10 space-y-5">
          {['Calculs fiscaux 2025 certifiés (barème IR, SSI par composante, IS)', 'Sauvegardez jusqu\'à 20 simulations', 'Tableau comparatif automatique', 'Export PDF de chaque rapport'].map(f => (
            <div key={f} className="flex items-start gap-3">
              <span className="text-green-400 mt-0.5">✓</span>
              <span className="text-white/60 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-mid to-blue flex items-center justify-center">
              <span className="text-white text-xs font-black">B</span>
            </div>
            <span className="font-display font-bold text-ink">Belho Xper</span>
          </Link>

          <h1 className="font-display text-2xl font-bold text-ink tracking-tight mb-1.5">Créer un compte</h1>
          <p className="text-sm text-ink3 mb-8">Gratuit, sans engagement.</p>

          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-3xl mb-3">📧</div>
              <div className="font-display font-bold text-ink mb-1">Vérifiez votre email !</div>
              <div className="text-sm text-ink3">Cliquez sur le lien envoyé à <strong>{email}</strong> pour activer votre compte.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Nom complet</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="px-3.5 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg text-ink bg-white
                    focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10"
                />
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
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold tracking-wide uppercase text-ink3">Mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="px-3.5 py-2.5 text-sm border-[1.5px] border-surface2 rounded-lg text-ink bg-white
                    focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10"
                />
              </div>

              {error && <p className="text-red-600 text-xs py-2 px-3 bg-red-50 rounded-lg border border-red-200">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue text-white font-bold text-sm rounded-lg
                  shadow-[0_2px_8px_rgba(29,78,216,.3)] hover:bg-blue-dark transition-all disabled:opacity-60 mt-2"
              >
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>

              <p className="text-xs text-ink4 text-center mt-2">
                En créant un compte, vous acceptez nos conditions d&apos;utilisation.
              </p>
              <p className="text-center text-sm text-ink3 mt-3">
                Déjà un compte ?{' '}
                <Link href="/auth/login" className="text-blue font-semibold hover:underline">Se connecter</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
