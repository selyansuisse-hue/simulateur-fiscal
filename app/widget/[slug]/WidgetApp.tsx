'use client'
import { useState } from 'react'
import { useSimulateur } from '@/hooks/useSimulateur'
import { StepSituation } from '@/components/simulateur/StepSituation'
import { StepActivite } from '@/components/simulateur/StepActivite'
import { StepRemuneration } from '@/components/simulateur/StepRemuneration'
import { StepFoyer } from '@/components/simulateur/StepFoyer'
import { StepResultats } from '@/components/simulateur/StepResultats'
import type { Cabinet } from '@/lib/types/cabinet'
import { fmt } from '@/lib/utils'

const STEPS = [StepSituation, StepActivite, StepRemuneration, StepFoyer, StepResultats]
const STEP_LABELS = ['Situation', 'Activité', 'Rémunération', 'Foyer', 'Résultats']

interface WidgetAppProps {
  cabinet: Cabinet
}

export function WidgetApp({ cabinet }: WidgetAppProps) {
  const { step, params, results } = useSimulateur()
  const StepComponent = STEPS[step]

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('L\'email est requis'); return }
    setSubmitting(true)
    setError('')

    const bestResult = results?.scored?.[0]
    const payload = {
      cabinet_id: cabinet.id,
      nom: nom.trim() || null,
      email: email.trim(),
      telephone: telephone.trim() || null,
      ca_simule: params.ca,
      structure_recommandee: bestResult?.forme ?? null,
      net_annuel: bestResult?.netAnnuel ?? null,
      score: bestResult?.scoreTotal ?? null,
      simulation_data: { params, results },
      statut: 'nouveau',
      source: 'widget',
    }

    const res = await fetch('/api/widget/submit-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setSubmitted(true)
    } else {
      setError('Une erreur est survenue. Réessayez.')
    }
    setSubmitting(false)
  }

  const accent = cabinet.couleur_principale

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f172a', padding: '24px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 20px',
          }}>
            ✅
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
            Simulation envoyée !
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: cabinet.couleur_principale }}>{cabinet.nom}</strong> a reçu votre simulation et vous contactera sous 48h.
          </p>
          {results?.scored?.[0] && (
            <div style={{ marginTop: '20px', background: '#1e293b', borderRadius: '14px', border: '1px solid #334155', padding: '16px 20px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Structure recommandée</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: accent }}>{results.scored[0].forme}</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#f1f5f9', marginTop: '4px' }}>
                {fmt(results.scored[0].netAnnuel)}/an
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Mini header cabinet */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        {cabinet.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cabinet.logo_url} alt={cabinet.nom} style={{ height: '28px', borderRadius: '6px' }} />
        ) : (
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
            background: accent + '25', border: `1px solid ${accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 800, color: accent,
          }}>
            {cabinet.nom.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{cabinet.nom}</span>
        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>· Simulateur fiscal 2025</span>
      </div>

      {/* Progress stepper */}
      <div style={{ background: '#162032', borderBottom: '1px solid #334155', padding: '10px 20px' }}>
        <div style={{ display: 'flex', gap: '6px', maxWidth: '600px', margin: '0 auto' }}>
          {STEP_LABELS.map((label, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', fontSize: '11px', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < step ? accent : i === step ? accent + 'CC' : '#334155',
                color: i <= step ? '#fff' : '#64748b',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '9px', color: i === step ? accent : '#64748b', fontWeight: i === step ? 700 : 400 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 16px' }}>
        <StepComponent />
      </div>

      {/* Lead capture form — shown when on step 4 (Résultats) */}
      {step === 4 && (
        <div style={{
          maxWidth: '760px', margin: '0 auto', padding: '0 16px 40px',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #162032)',
            borderRadius: '20px', border: `1px solid ${accent}30`,
            padding: '28px 28px',
            boxShadow: `0 0 40px ${accent}15`,
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>📩</div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>
                Recevez votre analyse personnalisée
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                {cabinet.nom} vous enverra une analyse détaillée et personnalisée.
              </p>
            </div>
            <form onSubmit={handleSubmitLead} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '420px', margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Prénom</label>
                  <input value={nom} onChange={e => setNom(e.target.value)}
                    placeholder="Votre prénom"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Téléphone (optionnel)</label>
                  <input value={telephone} onChange={e => setTelephone(e.target.value)}
                    placeholder="06 12 34 56 78" type="tel"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Email <span style={{ color: '#f87171' }}>*</span></label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com" type="email" required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', background: '#0f172a', border: `1px solid ${email ? accent + '60' : '#334155'}`, color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {error && <div style={{ fontSize: '12px', color: '#f87171' }}>{error}</div>}
              <button type="submit" disabled={submitting} style={{
                padding: '13px', borderRadius: '11px', cursor: 'pointer',
                background: `linear-gradient(135deg, ${accent}, ${cabinet.couleur_secondaire})`,
                border: 'none', color: '#fff', fontSize: '14px', fontWeight: 800,
                boxShadow: `0 4px 16px ${accent}40`,
                opacity: submitting ? 0.7 : 1, transition: 'all 150ms',
              }}>
                {submitting ? 'Envoi...' : `Envoyer mes résultats à ${cabinet.nom} →`}
              </button>
              <div style={{ fontSize: '10px', color: '#475569', textAlign: 'center' }}>
                Vos données ne sont utilisées que pour vous recontacter.
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
