'use client'
import { useRouter } from 'next/navigation'
import type { Lead, LeadStatut } from '@/lib/types/cabinet'
import { calculateLeadScore, getChaleurBadge, getAlerteRelance, NEXT_STATUT } from '@/lib/cabinet-utils'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n)
}

const KANBAN_COLS: { id: LeadStatut; label: string; color: string; bg: string; border: string }[] = [
  { id: 'nouveau',      label: 'Nouveau',      color: '#60a5fa', bg: 'rgba(37,99,235,0.05)',    border: 'rgba(37,99,235,0.18)'   },
  { id: 'contacté',    label: 'Contacté',     color: '#fbbf24', bg: 'rgba(245,158,11,0.05)',   border: 'rgba(245,158,11,0.18)'  },
  { id: 'rdv_planifie', label: 'RDV planifié', color: '#a78bfa', bg: 'rgba(139,92,246,0.05)',   border: 'rgba(139,92,246,0.18)'  },
  { id: 'converti',    label: 'Client ✓',     color: '#34d399', bg: 'rgba(16,185,129,0.05)',   border: 'rgba(16,185,129,0.18)'  },
]

interface Props {
  leads: Lead[]
  cabinetSlug: string
  onStatutChange: (leadId: string, newStatut: LeadStatut) => void
}

export function KanbanView({ leads, cabinetSlug, onStatutChange }: Props) {
  const router = useRouter()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'start' }}>
      {KANBAN_COLS.map(col => {
        const colLeads = leads
          .filter(l => l.statut === col.id)
          .sort((a, b) => calculateLeadScore(b) - calculateLeadScore(a))

        return (
          <div
            key={col.id}
            style={{
              background: col.bg,
              border: `1px solid ${col.border}`,
              borderRadius: '14px',
              padding: '14px',
              minHeight: '200px',
            }}
          >
            {/* Header colonne */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: col.color }}>{col.label}</span>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px',
                background: `${col.color}20`, color: col.color,
              }}>
                {colLeads.length}
              </span>
            </div>

            {/* Cards leads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {colLeads.map(lead => {
                const score = calculateLeadScore(lead)
                const chaleur = getChaleurBadge(score)
                const alerte = getAlerteRelance(lead)
                const nextStatus = NEXT_STATUT[lead.statut]

                return (
                  <div
                    key={lead.id}
                    onClick={() => router.push(`/cabinet/${cabinetSlug}/leads/${lead.id}`)}
                    style={{
                      background: '#0f172a',
                      border: alerte ? `1px solid ${alerte.couleur === 'red' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}` : '1px solid rgba(51,65,85,0.5)',
                      borderRadius: '10px', padding: '12px', cursor: 'pointer',
                      transition: 'border-color 150ms, transform 150ms',
                    }}
                    onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
                    onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.transform = '' }}
                  >
                    {/* Alerte */}
                    {alerte && (
                      <div style={{
                        fontSize: '9px', fontWeight: 700, marginBottom: '6px', padding: '2px 6px', borderRadius: '4px',
                        background: alerte.couleur === 'red' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                        color: alerte.couleur === 'red' ? '#f87171' : '#fbbf24',
                        display: 'inline-block',
                      }}>
                        ⚠ {alerte.message}
                      </div>
                    )}

                    {/* Nom */}
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.nom || lead.email || 'Prospect'}
                    </div>

                    {/* CA + structure */}
                    {lead.ca_simule && (
                      <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 700, marginBottom: '1px' }}>
                        {fmt(lead.ca_simule)}
                      </div>
                    )}
                    {lead.structure_recommandee && (
                      <div style={{ fontSize: '10px', color: '#475569', marginBottom: '8px' }}>
                        {lead.structure_recommandee.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                      </div>
                    )}

                    {/* Chaleur + bouton avancer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px',
                        background: chaleur.bg, color: chaleur.color, border: `1px solid ${chaleur.border}`,
                        flexShrink: 0,
                      }}>
                        {chaleur.label} · {score}
                      </span>
                      {nextStatus && (
                        <button
                          onClick={e => { e.stopPropagation(); onStatutChange(lead.id, nextStatus) }}
                          style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                            background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
                            color: '#60a5fa', cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          → Avancer
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {colLeads.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: '#334155', fontSize: '12px' }}>
                  Aucun lead
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
