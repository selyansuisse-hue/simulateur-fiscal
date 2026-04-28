'use client'
import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SimulationModal } from './SimulationModal'
import type { Lead, LeadStatut } from '@/lib/types/cabinet'
import { fmt } from '@/lib/utils'

const STATUT_CONFIG: Record<LeadStatut, { label: string; bg: string; color: string }> = {
  nouveau: { label: 'Nouveau', bg: 'rgba(37,99,235,0.15)', color: '#60a5fa' },
  contacté: { label: 'Contacté', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  converti: { label: 'Converti', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  perdu: { label: 'Perdu', bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
}

const STATUTS: LeadStatut[] = ['nouveau', 'contacté', 'converti', 'perdu']

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6', 'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B', 'Micro-entreprise': '#94A3B8',
}
function structColor(forme: string): string { return STRUCT_COLORS[forme] ?? '#64748B' }

interface LeadTableProps {
  initialLeads: Lead[]
  cabinetId: string
}

export function LeadTable({ initialLeads, cabinetId }: LeadTableProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatut | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'all'>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filteredLeads = useMemo(() => {
    let result = leads
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        (l.nom?.toLowerCase().includes(q)) ||
        (l.email?.toLowerCase().includes(q)) ||
        (l.structure_recommandee?.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== 'all') result = result.filter(l => l.statut === statusFilter)
    if (dateFilter !== 'all') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - (dateFilter === '7d' ? 7 : 30))
      result = result.filter(l => new Date(l.created_at) >= cutoff)
    }
    return result
  }, [leads, search, statusFilter, dateFilter])

  const updateStatut = useCallback(async (leadId: string, newStatut: LeadStatut) => {
    setUpdatingId(leadId)
    const supabase = createClient()
    const { error } = await supabase.from('leads').update({ statut: newStatut }).eq('id', leadId)
    if (!error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: newStatut } : l))
    }
    setUpdatingId(null)
  }, [])

  function exportCSV() {
    const headers = ['Nom', 'Email', 'Téléphone', 'CA simulé', 'Structure', 'Net/an', 'Score', 'Statut', 'Source', 'Date']
    const rows = filteredLeads.map(l => [
      l.nom || '', l.email || '', l.telephone || '',
      l.ca_simule || '', l.structure_recommandee || '',
      l.net_annuel || '', l.score || '',
      l.statut, l.source,
      new Date(l.created_at).toLocaleDateString('fr-FR'),
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const total = leads.length
  const nouveaux = leads.filter(l => new Date(l.created_at) >= new Date(Date.now() - 7 * 86400 * 1000)).length
  const convertis = leads.filter(l => l.statut === 'converti').length
  const tauxConversion = total > 0 ? Math.round(convertis / total * 100) : 0

  return (
    <>
      <SimulationModal lead={selectedLead} onClose={() => setSelectedLead(null)} />

      {/* Compteurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total leads', value: total, icon: '👥', color: '#60a5fa' },
          { label: 'Nouveaux (7j)', value: nouveaux, icon: '✨', color: '#a78bfa' },
          { label: 'Convertis', value: convertis, icon: '✅', color: '#34d399' },
          { label: 'Taux conversion', value: `${tauxConversion}%`, icon: '📈', color: '#fbbf24' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: kpi.color }} />
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{kpi.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{kpi.icon}</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: kpi.color, letterSpacing: '-0.03em' }}>{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres + Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Rechercher..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '160px', padding: '8px 12px', borderRadius: '9px',
            background: '#1e293b', border: '1px solid #334155',
            color: '#f1f5f9', fontSize: '13px', outline: 'none',
          }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeadStatut | 'all')}
          style={{ padding: '8px 12px', borderRadius: '9px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', outline: 'none' }}>
          <option value="all">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>)}
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
          style={{ padding: '8px 12px', borderRadius: '9px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', outline: 'none' }}>
          <option value="all">Toute période</option>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
        </select>
        <button onClick={exportCSV} style={{
          padding: '8px 14px', borderRadius: '9px', cursor: 'pointer', flexShrink: 0,
          background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
          color: '#60a5fa', fontSize: '12px', fontWeight: 700,
        }}>
          ⬇ CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#1e293b', borderRadius: '14px', border: '1px solid #334155', overflow: 'hidden' }}>
        {filteredLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Aucun lead pour ces critères</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.5)' }}>
                  {['Contact', 'CA simulé', 'Structure', 'Net/an', 'Score', 'Statut', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => {
                  const st = STATUT_CONFIG[lead.statut]
                  const sc = lead.structure_recommandee ? structColor(lead.structure_recommandee) : '#64748b'
                  return (
                    <tr key={lead.id} style={{ borderTop: '1px solid rgba(51,65,85,0.5)', transition: 'background 150ms' }}>
                      {/* Contact */}
                      <td style={{ padding: '12px 14px', minWidth: '160px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{lead.nom || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{lead.email || '—'}</div>
                      </td>
                      {/* CA */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#60a5fa', whiteSpace: 'nowrap' }}>
                        {lead.ca_simule ? fmt(lead.ca_simule) : '—'}
                      </td>
                      {/* Structure */}
                      <td style={{ padding: '12px 14px' }}>
                        {lead.structure_recommandee ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc, flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {lead.structure_recommandee.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      {/* Net/an */}
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                        {lead.net_annuel ? fmt(lead.net_annuel) : '—'}
                      </td>
                      {/* Score */}
                      <td style={{ padding: '12px 14px' }}>
                        {lead.score !== null && lead.score !== undefined ? (
                          <span style={{
                            fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                            background: lead.score >= 60 ? 'rgba(16,185,129,0.12)' : lead.score >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
                            color: lead.score >= 60 ? '#34d399' : lead.score >= 40 ? '#fbbf24' : '#64748b',
                          }}>
                            {lead.score}/100
                          </span>
                        ) : '—'}
                      </td>
                      {/* Statut */}
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={lead.statut}
                          onChange={e => updateStatut(lead.id, e.target.value as LeadStatut)}
                          disabled={updatingId === lead.id}
                          style={{
                            padding: '4px 8px', borderRadius: '7px', cursor: 'pointer',
                            background: st.bg, border: `1px solid ${st.color}40`,
                            color: st.color, fontSize: '11px', fontWeight: 700, outline: 'none',
                            opacity: updatingId === lead.id ? 0.5 : 1,
                          }}>
                          {STATUTS.map(s => (
                            <option key={s} value={s} style={{ background: '#1e293b', color: '#f1f5f9' }}>
                              {STATUT_CONFIG[s].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* Date */}
                      <td style={{ padding: '12px 14px', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(lead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setSelectedLead(lead)} style={{
                            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                            background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
                            color: '#60a5fa', fontSize: '11px', fontWeight: 600,
                          }}>
                            Voir
                          </button>
                          {lead.email && (
                            <a href={`mailto:${lead.email}?subject=Suite de votre simulation fiscale`}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                                color: '#34d399', fontSize: '11px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                              }}>
                              Email
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px' }}>
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} affiché{filteredLeads.length !== 1 ? 's' : ''}
      </div>
    </>
  )
}
