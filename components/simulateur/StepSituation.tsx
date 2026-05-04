'use client'
import { useSimulateur } from '@/hooks/useSimulateur'

/* ── Inline SVG icons ── */
function IconUser({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color, flexShrink: 0 }}>
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconBriefcase({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color, flexShrink: 0 }}>
      <rect x="1.5" y="5.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M1.5 10h13" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
function IconTarget({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color, flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  )
}
function IconUsers({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color, flexShrink: 0 }}>
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15.5 13.5c0-2.071-1.343-3.75-3-3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconBuilding({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color, flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 14V9.5h5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="5" y="4" width="2" height="2" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="4" width="2" height="2" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Select wrapper with icon ── */
function SelectField({
  label,
  icon,
  hint,
  value,
  onChange,
  children,
}: {
  label: string
  icon: React.ReactNode
  hint?: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '13px', fontWeight: 500, color: '#cbd5e1' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {/* Left icon */}
        <div style={{
          position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', zIndex: 1, display: 'flex', alignItems: 'center',
        }}>
          {icon}
        </div>
        {/* Native select */}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '12px',
            padding: '12px 40px 12px 44px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 150ms',
          }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)' }}
          onBlur={e => { e.target.style.borderColor = '#475569'; e.target.style.boxShadow = 'none' }}
          onMouseOver={e => { if (document.activeElement !== e.target) e.currentTarget.style.borderColor = '#64748b' }}
          onMouseOut={e => { if (document.activeElement !== e.target) e.currentTarget.style.borderColor = '#475569' }}
        >
          {children}
        </select>
        {/* Right chevron */}
        <div style={{
          position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: '#64748b',
        }}>
          <IconChevron />
        </div>
      </div>
      {hint && <p style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.55, margin: 0 }}>{hint}</p>}
    </div>
  )
}

/* ── Step 1 — Situation ── */
export function StepSituation() {
  const { params, setParam, nextStep } = useSimulateur()

  return (
    <div className="animate-stepIn">
      {/* Top badge */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '4px 14px', borderRadius: '999px',
          background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.22)',
          marginBottom: '14px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#60a5fa' }}>
            Étape 1 sur 4
          </span>
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.15 }}>
          Votre situation
        </h2>
        <p style={{ fontSize: '14.5px', color: '#64748b', lineHeight: 1.6, maxWidth: '440px', margin: 0 }}>
          Ces informations adaptent le questionnaire et déterminent les structures applicables à votre profil.
        </p>
      </div>

      {/* ── Dark card ── */}
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(51,65,85,0.6)',
        borderRadius: '20px',
        padding: '28px',
        marginBottom: '16px',
      }}>
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.5" stroke="#60a5fa" strokeWidth="1.6" />
              <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#f1f5f9', marginBottom: '3px' }}>Votre situation</div>
            <div style={{ fontSize: '13px', color: '#475569' }}>Ces informations déterminent les structures applicables</div>
          </div>
        </div>

        {/* Row 1: Situation + Secteur */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <SelectField
            label="Situation"
            icon={<IconUser color="#60a5fa" />}
            value={params.situation}
            onChange={v => setParam('situation', v as typeof params.situation)}
          >
            <option value="creation">Création d&apos;entreprise</option>
            <option value="existant">Structure existante — optimisation</option>
            <option value="changement">Changement de forme juridique</option>
          </SelectField>

          <SelectField
            label="Secteur d'activité"
            icon={<IconBriefcase color="#a78bfa" />}
            hint="Détermine le régime micro applicable et le taux d'abattement"
            value={params.secteur}
            onChange={v => setParam('secteur', v as typeof params.secteur)}
          >
            <option value="services_bic">Prestations de services BIC</option>
            <option value="liberal_bnc">Professions libérales / BNC</option>
            <option value="commerce">Commerce / négoce / e-commerce</option>
            <option value="btp">BTP / artisanat / restauration</option>
          </SelectField>
        </div>

        {/* Forme juridique actuelle — conditionnel */}
        {params.situation !== 'creation' && (
          <div style={{ marginBottom: '20px' }}>
            <SelectField
              label="Forme juridique actuelle"
              icon={<IconBuilding color="#94a3b8" />}
              value={params.formeActuelle}
              onChange={v => setParam('formeActuelle', v as typeof params.formeActuelle)}
            >
              <option value="none">Non précisé</option>
              <option value="micro">Micro-entreprise</option>
              <option value="ei">EI (régime réel)</option>
              <option value="eurl_is">EURL / SARL IS</option>
              <option value="sas_sasu">SAS / SASU</option>
            </SelectField>
          </div>
        )}

        {/* Row 2: Priorité + Associés */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <SelectField
            label="Priorité principale"
            icon={<IconTarget color="#fbbf24" />}
            hint="Influence le score multicritère et la recommandation finale"
            value={params.priorite}
            onChange={v => setParam('priorite', v as typeof params.priorite)}
          >
            <option value="equilibre">Équilibre revenu / protection sociale</option>
            <option value="net">Maximiser le revenu net immédiat</option>
            <option value="protection">Priorité protection sociale (retraite, IJ)</option>
            <option value="simplicite">Simplicité administrative (coûts réduits)</option>
            <option value="croissance">Croissance / levée de fonds future</option>
          </SelectField>

          <SelectField
            label="Nombre d'associés"
            icon={<IconUsers color="#34d399" />}
            hint="EURL et SASU sont réservées à l'associé unique"
            value="1"
            onChange={() => {}}
          >
            <option value="1">1 — Dirigeant seul</option>
            <option value="2">2 associés</option>
            <option value="3p">3 ou plus</option>
          </SelectField>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        marginTop: '28px', paddingTop: '20px',
        borderTop: '1px solid rgba(51,65,85,0.4)',
      }}>
        <button
          onClick={nextStep}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '12px 32px',
            background: '#2563eb',
            color: 'white',
            fontSize: '14px', fontWeight: 700,
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
            transition: 'all 150ms',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#3b82f6'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.45)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = '#2563eb'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.35)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          Continuer
          <span style={{ transition: 'transform 150ms' }}>→</span>
        </button>
      </div>
    </div>
  )
}
