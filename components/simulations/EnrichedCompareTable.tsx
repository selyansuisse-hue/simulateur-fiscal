import React from 'react'
import { fmt } from '@/lib/utils'

interface SimRow {
  id: string
  name: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  best_net_mois: number
  best_ir: number
  tmi: number
  ca: number
  situation?: string
  gain: number
  params?: {
    perMontant?: number
    perActif?: string
    partsBase?: number
    nbEnfants?: number
  }
}

const PS_MAP: Record<string, { label: string; color: string }> = {
  'SAS / SASU': { label: '★★★ Élevée', color: '#10b981' },
  'EURL / SARL (IS)': { label: '★★ Moyenne', color: '#f59e0b' },
  'EI (réel normal)': { label: '★★ Moyenne', color: '#f59e0b' },
  'Micro-entreprise': { label: '★ Faible', color: '#ef4444' },
}

const SITUATION_LABELS: Record<string, string> = {
  creation: 'Création', existant: 'Existant', changement: 'Changement',
}

function MiniBar({ val, max, color }: { val: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (val / max) * 100) : 0
  return (
    <div style={{ width: '52px', height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 300ms ease', minWidth: pct > 0 ? '2px' : '0' }} />
    </div>
  )
}

function tmiColor(t: number): string {
  if (t <= 11) return '#10b981'
  if (t <= 30) return '#f59e0b'
  return '#ef4444'
}

interface Props { simulations: SimRow[] }

export function EnrichedCompareTable({ simulations }: Props) {
  if (simulations.length < 2) return null
  const sorted = [...simulations].sort((a, b) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))

  const maxIR = Math.max(...sorted.map(s => s.best_ir ?? 0), 1)
  const maxCost = Math.max(...sorted.map(s => (s.ca ?? 0) - (s.best_net_annuel ?? 0)), 1)

  type RowDef = {
    label: string
    render: (s: SimRow) => React.ReactNode
    best?: (s: SimRow) => number
    highlight?: boolean
  }

  type BlocDef = {
    label: string
    borderColor: string
    bgColor: string
    labelColor: string
    rows: RowDef[]
  }

  const blocs: BlocDef[] = [
    {
      label: 'Paramètres',
      borderColor: '#3b82f6',
      bgColor: 'rgba(59,130,246,0.05)',
      labelColor: '#60a5fa',
      rows: [
        {
          label: 'CA annuel',
          render: s => <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{fmt(s.ca)}</span>,
          best: s => s.ca ?? 0,
        },
        {
          label: 'Situation',
          render: s => <span style={{ color: '#64748b' }}>{SITUATION_LABELS[s.situation ?? ''] || s.situation || '—'}</span>,
        },
        {
          label: 'Parts fiscales',
          render: s => {
            const parts = (s.params?.partsBase ?? 1) + (s.params?.nbEnfants ?? 0) * 0.5
            return <span style={{ color: '#64748b' }}>{parts}</span>
          },
        },
        {
          label: 'Enregistrée le',
          render: s => (
            <span style={{ color: '#334155', fontSize: '12px' }}>
              {new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          ),
        },
      ],
    },
    {
      label: 'Résultats',
      borderColor: '#10b981',
      bgColor: 'rgba(16,185,129,0.05)',
      labelColor: '#34d399',
      rows: [
        {
          label: 'Revenu net/an',
          render: s => (
            <span style={{ fontSize: '17px', fontWeight: 900, color: '#34d399', letterSpacing: '-0.02em' }}>
              {fmt(s.best_net_annuel ?? 0)}
            </span>
          ),
          best: s => s.best_net_annuel ?? 0,
          highlight: true,
        },
        {
          label: 'Revenu net/mois',
          render: s => <span style={{ fontWeight: 600, color: '#6ee7b7' }}>{fmt(Math.round((s.best_net_annuel ?? 0) / 12))}</span>,
          best: s => s.best_net_annuel ?? 0,
        },
        {
          label: 'Gain vs moins bon',
          render: s => s.gain > 500
            ? <span style={{ color: '#34d399', fontWeight: 700 }}>+{fmt(s.gain)}</span>
            : <span style={{ color: '#1e293b' }}>—</span>,
          best: s => s.gain ?? 0,
        },
      ],
    },
    {
      label: 'Fiscalité & Coûts',
      borderColor: '#ef4444',
      bgColor: 'rgba(239,68,68,0.04)',
      labelColor: '#f87171',
      rows: [
        {
          label: 'IR estimé',
          render: s => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
              <span style={{ color: '#f87171', fontWeight: 600 }}>−{fmt(s.best_ir ?? 0)}</span>
              <MiniBar val={s.best_ir ?? 0} max={maxIR} color="#ef4444" />
            </div>
          ),
          best: s => -(s.best_ir ?? 0),
        },
        {
          label: 'Coût total estimé',
          render: s => {
            const cost = (s.ca ?? 0) - (s.best_net_annuel ?? 0)
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <span style={{ color: '#fca5a5', fontWeight: 600 }}>−{fmt(cost)}</span>
                <MiniBar val={cost} max={maxCost} color="#f87171" />
              </div>
            )
          },
          best: s => -((s.ca ?? 0) - (s.best_net_annuel ?? 0)),
        },
        {
          label: 'TMI',
          render: s => (
            <span style={{
              fontWeight: 700,
              fontSize: '12px',
              padding: '3px 10px',
              borderRadius: '999px',
              background: `${tmiColor(s.tmi)}15`,
              color: tmiColor(s.tmi),
              border: `1px solid ${tmiColor(s.tmi)}30`,
            }}>
              {s.tmi}%
            </span>
          ),
          best: s => -s.tmi,
        },
      ],
    },
    {
      label: 'Structure & Qualité',
      borderColor: '#8b5cf6',
      bgColor: 'rgba(139,92,246,0.04)',
      labelColor: '#a78bfa',
      rows: [
        {
          label: 'Structure recommandée',
          render: s => <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{s.best_forme}</span>,
        },
        {
          label: 'PER versé',
          render: s => {
            const per = s.params?.perMontant ?? 0
            return per > 0
              ? <span style={{ color: '#34d399', fontWeight: 600 }}>{fmt(per)}</span>
              : <span style={{ color: '#1e293b' }}>—</span>
          },
        },
        {
          label: 'Protection sociale',
          render: s => {
            const ps = PS_MAP[s.best_forme]
            if (!ps) return <span style={{ color: '#334155' }}>—</span>
            return <span style={{ fontWeight: 700, color: ps.color, fontSize: '12px' }}>{ps.label}</span>
          },
        },
      ],
    },
  ]

  return (
    <div style={{
      background: '#050d1a',
      border: '1px solid rgba(51,65,85,0.4)',
      borderRadius: '20px',
      overflow: 'hidden',
      marginBottom: '32px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 22px',
        borderBottom: '1px solid rgba(51,65,85,0.4)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Tableau comparatif détaillé</h3>
        <span style={{ fontSize: '12px', color: '#334155' }}>{sorted.length} scénarios</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${160 + sorted.length * 160}px` }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <th style={{
                textAlign: 'left',
                padding: '14px 22px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#1e293b',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
                width: '160px',
                borderBottom: '1px solid rgba(51,65,85,0.35)',
              }}>
                Critère
              </th>
              {sorted.map((s, i) => (
                <th key={s.id} style={{
                  textAlign: 'right',
                  padding: '14px 18px',
                  whiteSpace: 'nowrap',
                  minWidth: '160px',
                  borderBottom: '1px solid rgba(51,65,85,0.35)',
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: i === 0 ? '#60a5fa' : '#334155',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '160px',
                    marginLeft: 'auto',
                  }}>
                    {s.name}
                  </div>
                  {i === 0 && (
                    <div style={{
                      fontSize: '10px',
                      background: 'rgba(37,99,235,0.14)',
                      color: '#60a5fa',
                      border: '1px solid rgba(37,99,235,0.25)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      display: 'inline-block',
                      marginTop: '4px',
                      fontWeight: 700,
                    }}>
                      ★ Meilleur
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blocs.map(bloc => (
              <React.Fragment key={bloc.label}>
                {/* Bloc header */}
                <tr style={{ background: bloc.bgColor }}>
                  <td
                    colSpan={sorted.length + 1}
                    style={{
                      padding: '9px 22px 9px 19px',
                      borderLeft: `3px solid ${bloc.borderColor}`,
                      fontSize: '11px',
                      fontWeight: 700,
                      color: bloc.labelColor,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      borderTop: '1px solid rgba(51,65,85,0.3)',
                    }}
                  >
                    {bloc.label}
                  </td>
                </tr>
                {/* Bloc rows */}
                {bloc.rows.map(row => {
                  const bestVal = row.best ? Math.max(...sorted.map(row.best)) : null
                  return (
                    <tr
                      key={row.label}
                      style={{
                        borderTop: '1px solid rgba(51,65,85,0.18)',
                        background: row.highlight ? `${bloc.borderColor}09` : 'transparent',
                      }}
                    >
                      <td style={{
                        padding: '12px 22px',
                        fontSize: '12px',
                        color: '#475569',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        borderLeft: `3px solid ${bloc.borderColor}28`,
                      }}>
                        {row.label}
                      </td>
                      {sorted.map((s, i) => {
                        const val = row.best ? row.best(s) : null
                        const isBest = bestVal !== null && val === bestVal
                        return (
                          <td
                            key={s.id}
                            style={{
                              padding: '12px 18px',
                              textAlign: 'right',
                              fontSize: '13px',
                              position: 'relative',
                              fontWeight: row.highlight && i === 0 ? 700 : undefined,
                            }}
                          >
                            {isBest && (
                              <div style={{
                                position: 'absolute',
                                left: '6px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '3px',
                                height: '14px',
                                background: '#10b981',
                                borderRadius: '2px',
                              }} />
                            )}
                            {row.render(s)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
