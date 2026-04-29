'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Step = 1 | 2 | 3 | 4
type Plan = 'starter' | 'pro' | 'cabinet_plus'

const PLANS = [
  {
    id: 'starter' as Plan, label: 'Starter', price: '149',
    color: '#64748b', features: ['1 widget', 'Jusqu\'à 50 leads/mois', 'Dashboard leads', 'Email notifications'],
  },
  {
    id: 'pro' as Plan, label: 'Pro', price: '299',
    color: '#3B82F6', features: ['3 widgets', 'Leads illimités', 'Statistiques avancées', 'Export CSV', 'Support prioritaire'],
    highlight: true,
  },
  {
    id: 'cabinet_plus' as Plan, label: 'Cabinet+', price: '499',
    color: '#8B5CF6', features: ['Widgets illimités', 'Marque blanche', 'API accès', 'Onboarding dédié', 'SLA 99.9%'],
  },
]

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // Step 2
  const [nomCabinet, setNomCabinet] = useState('')
  const [telephone, setTelephone] = useState('')
  const [slug, setSlug] = useState('')

  // Step 3
  const [plan, setPlan] = useState<Plan>('starter')

  // Step 4
  const [createdSlug, setCreatedSlug] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    background: '#1e293b', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', display: 'block' }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
      },
    })
    if (err) { setError(err.message); setLoading(false); return }
    setStep(2); setLoading(false)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!nomCabinet.trim()) { setError('Le nom du cabinet est requis'); return }
    setError('')
    setStep(3)
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/onboarding/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nomCabinet, slug, email_contact: email, plan, telephone }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erreur'); setLoading(false); return }
    setCreatedSlug(data.slug)
    setStep(4)
    setLoading(false)
  }

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://simulateur-fiscal-bkxh.vercel.app'
  const iframeCode = `<iframe src="${BASE_URL}/widget/${createdSlug}" width="100%" height="700" frameborder="0"></iframe>`

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: step === 3 ? '800px' : '480px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#f1f5f9', marginBottom: '4px' }}>
            ✦ Belho Xper
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Simulateur fiscal B2B</div>
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 800,
                  background: s < step ? '#10B981' : s === step ? '#3B82F6' : '#334155',
                  color: s <= step ? '#fff' : '#64748b',
                }}>
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && <div style={{ width: '32px', height: '1px', background: s < step ? '#10B981' : '#334155' }} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Compte */}
        {step === 1 && (
          <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>Créez votre compte</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>Étape 1 sur 3 — Accès cabinet</p>
            <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Prénom & Nom</label>
                <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jean Dupont" required />
              </div>
              <div>
                <label style={labelStyle}>Email professionnel</label>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@cabinet.fr" required />
              </div>
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum" minLength={8} required />
              </div>
              {error && <div style={{ fontSize: '12px', color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: '11px', cursor: 'pointer', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 800, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Création...' : 'Continuer →'}
              </button>
              <div style={{ textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                Déjà un compte ? <Link href="/auth/login" style={{ color: '#60a5fa' }}>Connexion</Link>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Cabinet */}
        {step === 2 && (
          <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>Votre cabinet</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>Étape 2 sur 3 — Informations</p>
            <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nom du cabinet</label>
                <input style={inputStyle} value={nomCabinet}
                  onChange={e => { setNomCabinet(e.target.value); setSlug(slugify(e.target.value)) }}
                  placeholder="Cabinet Dupont & Associés" required />
              </div>
              <div>
                <label style={labelStyle}>Identifiant URL (auto-généré)</label>
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', fontSize: '13px', fontFamily: 'monospace', color: '#60a5fa' }}>
                  /cabinet/{slug || 'votre-cabinet'}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Téléphone (optionnel)</label>
                <input style={inputStyle} type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="01 23 45 67 89" />
              </div>
              {error && <div style={{ fontSize: '12px', color: '#f87171' }}>{error}</div>}
              <button type="submit" style={{ padding: '13px', borderRadius: '11px', cursor: 'pointer', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 800 }}>
                Continuer →
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Plan */}
        {step === 3 && (
          <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>Choisissez votre plan</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>Étape 3 sur 3 — 14 jours gratuits, sans carte bancaire</p>
            <form onSubmit={handleStep3} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {PLANS.map(p => (
                  <button key={p.id} type="button" onClick={() => setPlan(p.id)} style={{
                    padding: '20px 16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                    background: plan === p.id ? p.color + '18' : '#0f172a',
                    border: `2px solid ${plan === p.id ? p.color : '#334155'}`,
                    transition: 'all 150ms', position: 'relative',
                  }}>
                    {p.highlight && (
                      <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: p.color, color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 10px', borderRadius: '999px' }}>
                        POPULAIRE
                      </div>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: 800, color: plan === p.id ? p.color : '#f1f5f9', marginBottom: '4px' }}>{p.label}</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: plan === p.id ? p.color : '#f1f5f9', marginBottom: '12px' }}>
                      {p.price}€<span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>/mois</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {p.features.map(f => (
                        <div key={f} style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '6px' }}>
                          <span style={{ color: p.color }}>✓</span> {f}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {error && <div style={{ fontSize: '12px', color: '#f87171' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ padding: '14px', borderRadius: '11px', cursor: 'pointer', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 800, boxShadow: '0 4px 16px rgba(37,99,235,0.4)', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Création de votre espace...' : '✨ Commencer 14 jours gratuits →'}
              </button>
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#475569' }}>
                Sans engagement · Sans carte bancaire · Annulable à tout moment
              </div>
            </form>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
              Votre espace est prêt !
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.6 }}>
              {nomCabinet} est configuré. Intégrez le widget sur votre site et commencez à recevoir des leads qualifiés.
            </p>
            <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', padding: '14px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Code widget à intégrer
              </div>
              <pre style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {iframeCode}
              </pre>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href={`/cabinet/${createdSlug}`} style={{
                display: 'block', padding: '13px', borderRadius: '11px', textDecoration: 'none',
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff',
                fontSize: '14px', fontWeight: 800, boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
              }}>
                Accéder à mon tableau de bord →
              </Link>
              <Link href={`/widget/${createdSlug}`} target="_blank" style={{
                display: 'block', padding: '11px', borderRadius: '11px', textDecoration: 'none',
                background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
                color: '#60a5fa', fontSize: '13px', fontWeight: 600,
              }}>
                Voir mon widget →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
