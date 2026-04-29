'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

function getAuthError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes('503') || msg.includes('504') || msg.toLowerCase().includes('fetch'))
      return 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
    return msg
  }
  return 'Erreur inconnue — réessayez.'
}

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: '12px',
    background: '#1e293b', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 150ms',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Mot de passe minimum 8 caractères.'); return }
    if (!isSupabaseConfigured()) {
      setError('Supabase n\'est pas configuré. Ajoutez les variables d\'environnement.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
        },
      })
      if (signUpError) {
        const status = (signUpError as { status?: number }).status
        if (status === 503 || status === 504) {
          setError('Le service est temporairement indisponible. Réessayez dans quelques instants.')
        } else if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already been registered')) {
          setError('Un compte existe déjà avec cet email. Connectez-vous à la place.')
        } else {
          setError(signUpError.message)
        }
      } else if (data.user && !data.session) {
        setSuccess(true)
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(getAuthError(err))
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#020617',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      backgroundImage: 'radial-gradient(ellipse at 40% 20%, rgba(139,92,246,0.10) 0%, transparent 60%)',
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
            Créer un compte
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px' }}>
            Gratuit, sans engagement — résultat en 4 minutes.
          </p>

          {success ? (
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '14px', padding: '24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📧</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' }}>Vérifiez votre email !</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                Cliquez sur le lien envoyé à <strong style={{ color: '#f1f5f9' }}>{email}</strong> pour activer votre compte.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                  Nom complet
                </label>
                <input
                  type="text" required value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#334155'}
                />
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

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                  Mot de passe
                </label>
                <input
                  type="password" required minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#334155'}
                />
              </div>

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
                    Création…
                  </>
                ) : 'Créer mon compte'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '11px', color: '#475569', margin: 0 }}>
                En créant un compte, vous acceptez nos conditions d&apos;utilisation.
              </p>
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', margin: 0 }}>
                Déjà un compte ?{' '}
                <Link href="/auth/login" style={{ color: '#60a5fa', fontWeight: 600, textDecoration: 'none' }}>
                  Se connecter
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
