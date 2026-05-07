'use client'
import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SimulationModal } from './SimulationModal'
import { KanbanView } from './KanbanView'
import type { Lead, LeadStatut } from '@/lib/types/cabinet'
import { fmt } from '@/lib/utils'
import {
  calculateLeadScore,
  getChaleurBadge,
  getAlerteRelance,
  getTopStructure,
} from '@/lib/cabinet-utils'

/* ─────────────────────────────────────────────────────────
   Statut config (incluant rdv_planifie)
───────────────────────────────────────────────────────── */
const STATUT_CONFIG: Record<LeadStatut, { label: string; bg: string; color: string }> = {
  nouveau:      { label: 'Nouveau',      bg: 'rgba(37,99,235,0.15)',   color: '#60a5fa' },
  contacté:    { label: 'Contacté',     bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  rdv_planifie: { label: 'RDV planifié', bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  converti:    { label: 'Converti',     bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
  perdu:       { label: 'Perdu',        bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
}
const STATUTS: LeadStatut[] = ['nouveau', 'contacté', 'rdv_planifie', 'converti', 'perdu']

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6', 'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B', 'Micro-entreprise': '#94A3B8',
}
function structColor(forme: string): string { return STRUCT_COLORS[forme] ?? '#64748B' }

interface LeadTableProps {
  initialLeads: Lead[]
  cabinetId: string
  cabinetSlug?: string
}

export function LeadTable({ initialLeads, cabinetId, cabinetSlug }: LeadTableProps) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatut | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'all'>('all')
  const [chaleurFilter, setChaleurFilter] = useState<'all' | 'chaud' | 'tiede' | 'froid'>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'kanban'>('table')

  /* ── Filtrage + tri par chaleur ── */
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
    if (chaleurFilter !== 'all') {
      result = result.filter(l => {
        const s = calculateLeadScore(l)
        if (chaleurFilter === 'chaud') return s >= 70
        if (chaleurFilter === 'tiede') return s >= 40 && s < 70
        return s < 40
      })
    }
    // Tri par chaleur desc (leads les plus chauds en premier)
    return [...result].sort((a, b) => calculateLeadScore(b) - calculateLeadScore(a))
  }, [leads, search, statusFilter, dateFilter, chaleurFilter])

  /* ── Actions ── */
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
    const headers = ['Nom', 'Email', 'Téléphone', 'CA simulé', 'Structure', 'Net/an', 'Score', 'Chaleur', 'Statut', 'Source', 'Date']
    const rows = filteredLeads.map(l => [
      l.nom || '', l.email || '', l.telephone || '',
      l.ca_simule || '', l.structure_recommandee || '',
      l.net_annuel || '', l.score || '',
      getChaleurBadge(calculateLeadScore(l)).label,
      l.statut, l.source,
      new Date(l.created_at).toLocaleDateString('fr-FR'),
    ])
    const csv = '﻿' + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Stats calculées ── */
  const total = leads.length
  const leadsChauds = leads.filter(l => calculateLeadScore(l) >= 70).length
  const aRelancer = leads.filter(l => getAlerteRelance(l) !== null).length
  const convertis = leads.filter(l => l.statut === 'converti').length
  const tauxConversion = total > 0 ? Math.round(convertis / total * 100) : 0
  const caMoyen = total > 0
    ? Math.round(leads.reduce((s, l) => s + (l.ca_simule || 0), 0) / leads.filter(l => l.ca_simule).length || 0)
    : 0
  const netMoyen = total > 0
    ? Math.round(leads.reduce((s, l) => s + (l.net_annuel || 0), 0) / leads.filter(l => l.net_annuel).length || 0)
    : 0
  const totalHonoraires = leads.reduce((s, l) => s + (l.honoraires || 0), 0)
  const topStructure = getTopStructure(leads)

  return (
    <>
      <SimulationModal lead={selectedLead} onClose={() => setSelectedLead(null)} />

      {/* ── KPI grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'Total leads',       value: total,               icon: '👥', color: '#60a5fa' },
          { label: 'Leads chauds',      value: leadsChauds,         icon: '🔥', color: '#f87171' },
          { label: 'À relancer',        value: aRelancer,           icon: '⚠️', color: '#fbbf24',
            alert: aRelancer > 0 },
          { label: 'Taux conversion',   value: `${tauxConversion}%`, icon: '📈', color: '#34d399' },
          { label: 'CA moyen',          value: caMoyen > 0 ? fmt(caMoyen) : '—',  icon: '💶', color: '#a78bfa' },
          { label: 'Net moyen optimal', value: netMoyen > 0 ? fmt(netMoyen) : '—', icon: '✨', color: '#34d399' },
          { label: 'Top structure',     value: topStructure,        icon: '🏆', color: '#fbbf24' },
          { label: 'Honoraires/an',     value: totalHonoraires > 0 ? fmt(totalHonoraires) : '—', icon: '💰', color: '#34d399' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: '#1e293b', borderRadius: '12px', border: kpi.alert ? `1px solid ${kpi.color}40` : '1px solid #334155',
            padding: '12px 14px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: kpi.color }} />
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
              {kpi.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>{kpi.icon}</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerte relance banner ── */}
      {aRelancer > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fbbf24' }}>
            {aRelancer} lead{aRelancer > 1 ? 's' : ''} nécessite{aRelancer > 1 ? 'nt' : ''} une relance
          </span>
          <button
            onClick={() => { setStatusFilter('all'); setChaleurFilter('all') }}
            style={{ marginLeft: 'auto', fontSize: '11px', color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Voir tous →
          </button>
        </div>
      )}

      {/* ── Filtres + toggle vue ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Rechercher…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '140px', padding: '8px 12px', borderRadius: '9px',
            background: '#1e293b', border: '1px solid #334155',
            color: '#f1f5f9', fontSize: '13px', outline: 'none',
          }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeadStatut | 'all')}
          style={{ padding: '8px 10px', borderRadius: '9px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', outline: 'none' }}>
          <option value="all">Tous statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>)}
        </select>
        <select value={chaleurFilter} onChange={e => setChaleurFilter(e.target.value as typeof chaleurFilter)}
          style={{ padding: '8px 10px', borderRadius: '9px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', outline: 'none' }}>
          <option value="all">Toute chaleur</option>
          <option value="chaud">🔥 Chaud</option>
          <option value="tiede">🟡 Tiède</option>
          <option value="froid">🔵 Froid</option>
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
          style={{ padding: '8px 10px', borderRadius: '9px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', outline: 'none' }}>
          <option value="all">Toute période</option>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
        </select>

        {/* Toggle vue */}
        <div style={{ display: 'flex', borderRadius: '9px', overflow: 'hidden', border: '1px solid #334155', flexShrink: 0 }}>
          {([['table', '≡ Tableau'], ['kanban', '⠿ Pipeline']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: view === v ? '#2563eb' : '#1e293b',
                color: view === v ? '#fff' : '#64748b',
                transition: 'all 150ms',
              }}
            >{label}</button>
          ))}
        </div>

        <button onClick={exportCSV} style={{
          padding: '8px 12px', borderRadius: '9px', cursor: 'pointer', flexShrink: 0,
          background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
          color: '#60a5fa', fontSize: '12px', fontWeight: 700,
        }}>⬇ CSV</button>
      </div>

      {/* ══════════════════════════════════════════════
          VUE KANBAN
      ══════════════════════════════════════════════ */}
      {view === 'kanban' && cabinetSlug && (
        <KanbanView
          leads={filteredLeads}
          cabinetSlug={cabinetSlug}
          onStatutChange={updateStatut}
        />
      )}

      {/* ══════════════════════════════════════════════
          VUE TABLEAU
      ══════════════════════════════════════════════ */}
      {view === 'table' && (
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
                    {['Contact', 'Chaleur', 'CA simulé', 'Structure', 'Net/an', 'Statut', 'Alerte', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => {
                    const st = STATUT_CONFIG[lead.statut]
                    const sc = lead.structure_recommandee ? structColor(lead.structure_recommandee) : '#64748b'
                    const chaleurScore = calculateLeadScore(lead)
                    const chaleur = getChaleurBadge(chaleurScore)
                    const alerte = getAlerteRelance(lead)

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => cabinetSlug && router.push(`/cabinet/${cabinetSlug}/leads/${lead.id}`)}
                        style={{
                          borderTop: '1px solid rgba(51,65,85,0.5)',
                          transition: 'background 150ms',
                          cursor: cabinetSlug ? 'pointer' : 'default',
                          background: alerte?.urgence ? 'rgba(239,68,68,0.03)' : undefined,
                        }}
                        onMouseOver={e => { if (cabinetSlug) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(30,41,59,0.7)' }}
                        onMouseOut={e => { (e.currentTarget as HTMLTableRowElement).style.background = alerte?.urgence ? 'rgba(239,68,68,0.03)' : '' }}
                      >
                        {/* Contact */}
                        <td style={{ padding: '11px 14px', minWidth: '160px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{lead.nom || '—'}</span>
                            {lead.intention && (
                              <span style={{
                                fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '999px',
                                background: lead.intention === 'urgent' ? 'rgba(239,68,68,0.15)' : lead.intention === 'reflechis' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                                color: lead.intention === 'urgent' ? '#f87171' : lead.intention === 'reflechis' ? '#fbbf24' : '#60a5fa',
                              }}>
                                {lead.intention === 'urgent' ? '🔥' : lead.intention === 'reflechis' ? '🟡' : '🔵'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{lead.email || '—'}</div>
                        </td>

                        {/* Chaleur */}
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <div>
                            <span style={{
                              fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px',
                              background: chaleur.bg, color: chaleur.color, border: `1px solid ${chaleur.border}`,
                              display: 'inline-block',
                            }}>
                              {chaleur.label}
                            </span>
                            <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px', textAlign: 'center' }}>
                              {chaleurScore}/100
                            </div>
                          </div>
                        </td>

                        {/* CA */}
                        <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 700, color: '#60a5fa', whiteSpace: 'nowrap' }}>
                          {lead.ca_simule ? fmt(lead.ca_simule) : '—'}
                        </td>

                        {/* Structure */}
                        <td style={{ padding: '11px 14px' }}>
                          {lead.structure_recommandee ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc, flexShrink: 0 }} />
                              <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                {lead.structure_recommandee.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                              </span>
                            </div>
                          ) : '—'}
                        </td>

                        {/* Net/an */}
                        <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 700, color: '#34d399', whiteSpace: 'nowrap' }}>
                          {lead.net_annuel ? fmt(lead.net_annuel) : '—'}
                        </td>

                        {/* Statut */}
                        <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
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

                        {/* Alerte relance */}
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {alerte ? (
                            <span style={{
                              fontSize: '9px', fontWeight: 700, padding: '3px 7px', borderRadius: '6px', display: 'inline-block',
                              background: alerte.couleur === 'red' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                              color: alerte.couleur === 'red' ? '#f87171' : '#fbbf24',
                              border: `1px solid ${alerte.couleur === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                            }}>
                              ⚠ {alerte.message}
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', color: '#334155' }}>—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'nowrap' }}>
                            {cabinetSlug ? (
                              <Link href={`/cabinet/${cabinetSlug}/leads/${lead.id}`}
                                style={{
                                  padding: '4px 9px', borderRadius: '6px', cursor: 'pointer',
                                  background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
                                  color: '#60a5fa', fontSize: '11px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                                }}>
                                Fiche
                              </Link>
                            ) : (
                              <button onClick={() => setSelectedLead(lead)} style={{
                                padding: '4px 9px', borderRadius: '6px', cursor: 'pointer',
                                background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
                                color: '#60a5fa', fontSize: '11px', fontWeight: 600,
                              }}>Voir</button>
                            )}
                            {lead.email && (
                              <a href={`mailto:${lead.email}?subject=Suite de votre simulation fiscale`}
                                style={{
                                  padding: '4px 9px', borderRadius: '6px', cursor: 'pointer',
                                  background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)',
                                  color: '#34d399', fontSize: '11px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                                }}>✉</a>
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
      )}

      <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px' }}>
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} — triés par chaleur ↓
      </div>
    </>
  )
}
