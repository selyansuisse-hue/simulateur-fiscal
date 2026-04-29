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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: '12px',
    background: '#1e293b', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 150ms',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured()) {
      setError('Supabase n\'est pas configuré.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
        })
        if (error) {
          const status = (error as { status?: number }).status
          setError(status === 503 || status === 504
            ? 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
            : error.message)
        } else setMagicSent(true)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          const status = (error as { status?: number }).status
          setError(status === 503 || status === 504
            ? 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
            : error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message)
        } else if (data.user) {
          const { data: membre } = await supabase
            .from('cabinet_membres')
            .select('cabinets(slug)')
            .eq('user_id', data.user.id)
            .limit(1)
            .maybeSingle()
          const cabs = membre?.cabinets
          const slug = Array.isArray(cabs)
            ? (cabs as { slug: string }[])[0]?.slug
            : (cabs as unknown as { slug: string } | null)?.slug
          router.push(slug ? `/cabinet/${slug}` : '/dashboard')
        }
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
    <div style={{
      minHeight: '100vh', background: '#020617',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      backgroundImage: 'radial-gradient(ellipse at 60% 20%, rgba(37,99,235,0.12) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', fontWeight: 900, color: '#fff',
            }}>B</div>
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>Belho Xper</span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: '#0f172a', border: '1px solid rgba(51,65,85,0.5)',
          borderRadius: '20px', padding: '32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
            Connexion
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px' }}>
            Retrouvez vos simulations sauvegardées.
          </p>

          {magicSent ? (
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '14px', padding: '24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📧</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' }}>Lien envoyé !</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                Vérifiez votre boîte mail ({email}) et cliquez sur le lien pour vous connecter.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Mode toggle */}
              <div style={{
                display: 'flex', background: '#1e293b', borderRadius: '12px', padding: '4px', gap: '4px',
              }}>
                {(['password', 'magic'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setMode(m)} style={{
                    flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                    background: mode === m ? '#334155' : 'transparent',
                    color: mode === m ? '#f1f5f9' : '#64748b',
                    fontSize: '13px', fontWeight: mode === m ? 600 : 400,
                    transition: 'all 150ms',
                  }}>
                    {m === 'password' ? 'Mot de passe' : 'Magic link'}
                  </button>
                ))}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                  Email
                </label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#334155'}
                />
              </div>

              {mode === 'password' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                    Mot de passe
                  </label>
                  <input
                    type="password" required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={e => e.currentTarget.style.borderColor = '#334155'}
                  />
                </div>
              )}

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '12px', padding: '12px 16px',
                  fontSize: '13px', color: '#f87171', lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px', borderRadius: '12px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: '#2563eb', color: '#fff', fontSize: '15px', fontWeight: 700,
                opacity: loading ? 0.7 : 1, transition: 'all 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                {loading ? (
                  <>
                    <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Connexion…
                  </>
                ) : mode === 'magic' ? 'Envoyer le magic link' : 'Se connecter'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', margin: 0 }}>
                Pas encore de compte ?{' '}
                <Link href="/auth/signup" style={{ color: '#60a5fa', fontWeight: 600, textDecoration: 'none' }}>
                  Créer un compte
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
