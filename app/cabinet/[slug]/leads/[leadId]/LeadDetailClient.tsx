'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lead, LeadStatut } from '@/lib/types/cabinet'

const STATUT_CONFIG: Record<LeadStatut, { label: string; bg: string; color: string; border: string }> = {
  nouveau:  { label: 'Nouveau',  bg: 'rgba(37,99,235,0.12)',   color: '#60a5fa', border: 'rgba(37,99,235,0.35)'  },
  contacté: { label: 'Contacté', bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  converti: { label: 'Converti', bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.35)' },
  perdu:    { label: 'Perdu',    bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.35)'  },
}
const STATUTS: LeadStatut[] = ['nouveau', 'contacté', 'converti', 'perdu']

interface Props {
  lead: Lead
  cabinetSlug: string
}

export function LeadDetailClient({ lead, cabinetSlug }: Props) {
  const [statut, setStatut] = useState<LeadStatut>(lead.statut)
  const [notes, setNotes] = useState<string>((lead as Lead & { notes?: string }).notes || '')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const handleStatutChange = async (newStatut: LeadStatut) => {
    setStatut(newStatut)
    const supabase = createClient()
    await supabase.from('leads').update({ statut: newStatut }).eq('id', lead.id)
  }

  const handleSaveNotes = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('leads').update({ notes }).eq('id', lead.id)
    setSavedMsg(error ? '❌ Erreur' : '✓ Sauvegardé')
    setSaving(false)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const st = STATUT_CONFIG[statut]

  return (
    <>
      {/* Statut */}
      <div style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '14px', padding: '18px 20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
          Statut du lead
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {STATUTS.map(s => {
            const cfg = STATUT_CONFIG[s]
            const isActive = statut === s
            return (
              <button
                key={s}
                onClick={() => handleStatutChange(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  background: isActive ? cfg.bg : 'rgba(30,41,59,0.5)',
                  outline: isActive ? `1px solid ${cfg.border}` : '1px solid transparent',
                  transition: 'all 150ms', textAlign: 'left', width: '100%',
                }}
              >
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: isActive ? cfg.color : '#334155',
                }} />
                <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 500, color: isActive ? cfg.color : '#64748b' }}>
                  {cfg.label}
                </span>
                {isActive && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: cfg.color }}>✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notes internes */}
      <div style={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '14px', padding: '18px 20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
          Notes internes
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ajouter des notes sur ce prospect..."
          rows={4}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            background: '#1e293b', border: '1px solid rgba(51,65,85,0.6)',
            color: '#f1f5f9', fontSize: '12px', lineHeight: 1.6,
            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.5)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(51,65,85,0.6)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          {savedMsg ? (
            <span style={{ fontSize: '11px', color: savedMsg.startsWith('✓') ? '#34d399' : '#f87171' }}>{savedMsg}</span>
          ) : <span />}
          <button
            onClick={handleSaveNotes}
            disabled={saving}
            style={{
              padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: 'rgba(37,99,235,0.2)', color: '#60a5fa',
              fontSize: '12px', fontWeight: 600, opacity: saving ? 0.6 : 1, transition: 'all 150ms',
            }}
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </>
  )
}
