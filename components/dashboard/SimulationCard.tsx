'use client'
import Link from 'next/link'
import { fmt } from '@/lib/utils'

interface Simulation {
  id: string
  name: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  best_net_mois: number
  best_ir: number
  tmi: number
  ca: number
  situation: string
  gain: number
}

interface Props {
  sim: Simulation
  onDelete: (id: string) => void
  onPersistDelete?: (id: string) => Promise<void>
}

const situLabel: Record<string, string> = {
  creation: 'Création', existant: 'Existant', changement: 'Changement',
}

function structureBadge(forme: string) {
  const f = (forme || '').toLowerCase()
  if (f.includes('micro')) return { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
  if (f.includes('ei') && !f.includes('eurl')) return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' }
  if (f.includes('eurl') || f.includes('sarl')) return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
  return { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' }
}

export function SimulationCard({ sim, onDelete, onPersistDelete }: Props) {
  const date = new Date(sim.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const handleDelete = async () => {
    if (!confirm('Supprimer cette simulation ?')) return
    onDelete(sim.id)
    if (onPersistDelete) {
      await onPersistDelete(sim.id)
    } else {
      await fetch(`/api/simulations/${sim.id}`, { method: 'DELETE' })
    }
  }

  const badge = structureBadge(sim.best_forme)

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid rgba(51,65,85,0.5)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'border-color 150ms, box-shadow 150ms',
    }}
      onMouseOver={e => {
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = 'rgba(51,65,85,0.5)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Body — 2 colonnes */}
      <div style={{ padding: '18px 20px 14px', flex: 1 }}>
        {/* Top row : badge + delete */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
          }}>
            {sim.best_forme}
          </span>
          <button
            onClick={handleDelete}
            style={{
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '6px', border: '1px solid rgba(51,65,85,0.5)', background: 'transparent',
              color: '#475569', fontSize: '10px', cursor: 'pointer', transition: 'all 150ms',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(51,65,85,0.5)' }}
            title="Supprimer"
          >✕</button>
        </div>

        {/* 2-col layout */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          {/* Gauche */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sim.name}
            </div>
            <div style={{ fontSize: '11px', color: '#475569' }}>{date}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>CA {fmt(sim.ca)}</div>
          </div>
          {/* Droite */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {fmt(sim.best_net_annuel)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {fmt(sim.best_net_mois)}/mois
            </div>
          </div>
        </div>

        {/* Footer infos */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>TMI {sim.tmi}%</span>
          <span style={{ fontSize: '11px', color: '#334155' }}>·</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>{situLabel[sim.situation] || sim.situation}</span>
          {sim.gain > 500 && (
            <>
              <span style={{ fontSize: '11px', color: '#334155' }}>·</span>
              <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>+{fmt(sim.gain)}/an</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid rgba(51,65,85,0.4)' }}>
        <Link
          href={`/simulations/${sim.id}`}
          style={{
            flex: 1, textAlign: 'center', padding: '8px 0',
            borderRadius: '10px', textDecoration: 'none',
            background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
            color: '#60a5fa', fontSize: '12px', fontWeight: 600,
          }}
        >
          Voir le détail
        </Link>
        <a
          href={`/api/simulations/${sim.id}/pdf`}
          style={{
            flex: 1, textAlign: 'center', padding: '8px 0',
            borderRadius: '10px', textDecoration: 'none',
            background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.5)',
            color: '#94a3b8', fontSize: '12px', fontWeight: 600,
          }}
        >
          📄 PDF
        </a>
      </div>
    </div>
  )
}
