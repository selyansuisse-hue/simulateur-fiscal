'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Cabinet } from '@/lib/types/cabinet'

export default function SettingsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [cabinet, setCabinet] = useState<Cabinet | null>(null)
  const [nom, setNom] = useState('')
  const [emailContact, setEmailContact] = useState('')
  const [couleurPrincipale, setCouleurPrincipale] = useState('#3B82F6')
  const [couleurSecondaire, setCouleurSecondaire] = useState('#8B5CF6')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [membres, setMembres] = useState<{ id: string; role: string; profiles?: { full_name: string | null; email: string | null } }[]>([])
  const [inviteEmail, setInviteEmail] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: cab } = await supabase.from('cabinets').select('*').eq('slug', slug).single()
      if (cab) {
        setCabinet(cab as Cabinet)
        setNom(cab.nom)
        setEmailContact(cab.email_contact)
        setCouleurPrincipale(cab.couleur_principale)
        setCouleurSecondaire(cab.couleur_secondaire)
        const { data: mems } = await supabase
          .from('cabinet_membres')
          .select('id, role, profiles(full_name, email)')
          .eq('cabinet_id', cab.id)
        setMembres((mems || []) as unknown as typeof membres)
      }
    }
    load()
  }, [slug])

  async function handleSave() {
    if (!cabinet) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('cabinets').update({
      nom, email_contact: emailContact,
      couleur_principale: couleurPrincipale, couleur_secondaire: couleurSecondaire,
    }).eq('id', cabinet.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '9px',
    background: '#0f172a', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', display: 'block' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '640px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Paramètres</h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Gérez les informations de votre cabinet</p>
      </div>

      {/* Infos cabinet */}
      <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '24px', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '20px' }}>Informations du cabinet</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Nom du cabinet</label>
            <input style={inputStyle} value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Email de contact</label>
            <input style={inputStyle} type="email" value={emailContact} onChange={e => setEmailContact(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Couleur principale</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={couleurPrincipale} onChange={e => setCouleurPrincipale(e.target.value)}
                  style={{ width: '40px', height: '36px', borderRadius: '8px', border: '1px solid #334155', background: 'none', cursor: 'pointer' }} />
                <input style={{ ...inputStyle, flex: 1 }} value={couleurPrincipale} onChange={e => setCouleurPrincipale(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Couleur secondaire</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={couleurSecondaire} onChange={e => setCouleurSecondaire(e.target.value)}
                  style={{ width: '40px', height: '36px', borderRadius: '8px', border: '1px solid #334155', background: 'none', cursor: 'pointer' }} />
                <input style={{ ...inputStyle, flex: 1 }} value={couleurSecondaire} onChange={e => setCouleurSecondaire(e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Slug (URL)</label>
            <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#0f172a', border: '1px solid #334155', color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}>
              /cabinet/{slug}
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '11px', borderRadius: '10px', cursor: 'pointer',
            background: saved ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            border: saved ? '1px solid rgba(16,185,129,0.4)' : 'none',
            color: saved ? '#34d399' : '#fff',
            fontSize: '13px', fontWeight: 700, transition: 'all 200ms',
          }}>
            {saving ? 'Enregistrement...' : saved ? '✓ Enregistré !' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Membres */}
      <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '24px', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>Membres</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {membres.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                  {m.profiles?.full_name || m.profiles?.email || 'Membre'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{m.profiles?.email || ''}</div>
              </div>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                background: m.role === 'admin' ? 'rgba(37,99,235,0.15)' : 'rgba(100,116,139,0.15)',
                color: m.role === 'admin' ? '#60a5fa' : '#94a3b8',
              }}>
                {m.role}
              </span>
            </div>
          ))}
          {membres.length === 0 && (
            <div style={{ fontSize: '13px', color: '#475569', textAlign: 'center', padding: '16px' }}>Aucun membre</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Inviter un membre par email</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder="email@exemple.com"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <button style={{
              padding: '10px 16px', borderRadius: '9px', cursor: 'pointer',
              background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
              color: '#60a5fa', fontSize: '12px', fontWeight: 700, flexShrink: 0,
            }}>
              Inviter
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
            Un email d&apos;invitation sera envoyé (fonctionnalité à venir).
          </div>
        </div>
      </div>
    </div>
  )
}
