'use client'
import { useEffect } from 'react'
import type { Lead } from '@/lib/types/cabinet'
import { fmt } from '@/lib/utils'

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  nouveau: { bg: 'rgba(37,99,235,0.15)', color: '#60a5fa' },
  contacté: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  converti: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  perdu: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
}

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6', 'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B', 'Micro-entreprise': '#94A3B8',
}

function structColor(forme: string): string {
  return STRUCT_COLORS[forme] ?? '#64748B'
}

interface SimulationModalProps {
  lead: Lead | null
  onClose: () => void
}

export function SimulationModal({ lead, onClose }: SimulationModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!lead) return null

  const st = STATUT_COLORS[lead.statut] || STATUT_COLORS.nouveau
  const sc = lead.structure_recommandee ? structColor(lead.structure_recommandee) : '#64748B'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simData = lead.simulation_data as any
  const params = simData?.params
  const results = simData?.results

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#1e293b', borderRadius: '20px',
        border: '1px solid #334155', maxWidth: '640px', width: '100%',
        maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9' }}>
              {lead.nom || 'Prospect anonyme'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {lead.email || 'Email non renseigné'} {lead.telephone ? `· ${lead.telephone}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: st.bg, color: st.color }}>
              {lead.statut}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* KPIs principaux */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              { label: 'CA simulé', value: lead.ca_simule ? fmt(lead.ca_simule) : '—', color: '#60a5fa' },
              { label: 'Net/an', value: lead.net_annuel ? fmt(lead.net_annuel) : '—', color: sc },
              { label: 'Score', value: lead.score ? `${lead.score}/100` : '—', color: '#34d399' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: '#0f172a', borderRadius: '10px', padding: '12px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: kpi.color, letterSpacing: '-0.02em' }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Structure recommandée */}
          {lead.structure_recommandee && (
            <div style={{ background: sc + '12', border: `1px solid ${sc}30`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: sc, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                  Structure recommandée
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: sc }}>{lead.structure_recommandee}</div>
              </div>
            </div>
          )}

          {/* Paramètres simulation */}
          {params && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Paramètres
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'CA', value: fmt(params.ca ?? 0) },
                  { label: 'Charges', value: fmt(params.charges ?? 0) },
                  { label: 'Situation', value: params.situation ?? '—' },
                  { label: 'Secteur', value: params.secteur ?? '—' },
                  { label: 'Enfants', value: params.nbEnfants ?? 0 },
                  { label: 'Parts fiscales', value: params.parts ?? '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>{String(row.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Résultats par structure */}
          {results?.scored && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Comparatif
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {results.scored.map((r: any, i: number) => (
                  <div key={r.forme} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: '10px',
                    background: i === 0 ? structColor(r.forme) + '12' : '#0f172a',
                    border: `1px solid ${i === 0 ? structColor(r.forme) + '30' : '#334155'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: structColor(r.forme) }} />
                      <span style={{ fontSize: '12px', color: i === 0 ? '#f1f5f9' : '#94a3b8', fontWeight: i === 0 ? 700 : 400 }}>
                        {r.forme}
                      </span>
                      {i === 0 && <span style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 700 }}>★ Top</span>}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: i === 0 ? structColor(r.forme) : '#64748b' }}>
                      {fmt(r.netAnnuel)}/an
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date */}
          <div style={{ fontSize: '11px', color: '#475569', textAlign: 'right' }}>
            Simulation du {new Date(lead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  )
}
