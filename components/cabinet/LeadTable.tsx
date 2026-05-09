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
} from '@/lib/cabinet-utils'

/* ─────────────────────────────────────────────────────────
   Config statuts
───────────────────────────────────────────────────────── */
const STATUT_CONFIG: Record<LeadStatut, { label: string; bg: string; color: string; border: string }> = {
  nouveau:      { label: 'Nouveau',      bg: 'rgba(59,130,246,0.10)',  color: '#93c5fd', border: 'rgba(59,130,246,0.25)'  },
  contacté:    { label: 'Contacté',     bg: 'rgba(139,92,246,0.10)',  color: '#c4b5fd', border: 'rgba(139,92,246,0.25)'  },
  rdv_planifie: { label: 'RDV planifié', bg: 'rgba(245,158,11,0.10)',  color: '#fcd34d', border: 'rgba(245,158,11,0.25)'  },
  converti:    { label: 'Converti ✓',   bg: 'rgba(16,185,129,0.10)',  color: '#6ee7b7', border: 'rgba(16,185,129,0.25)'  },
  perdu:       { label: 'Perdu',        bg: 'rgba(239,68,68,0.10)',   color: '#fca5a5', border: 'rgba(239,68,68,0.25)'   },
}
const STATUTS: LeadStatut[] = ['nouveau', 'contacté', 'rdv_planifie', 'converti', 'perdu']

/* ─────────────────────────────────────────────────────────
   Struct colors
───────────────────────────────────────────────────────── */
const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6', 'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B', 'Micro-entreprise': '#94A3B8',
}
function structColor(forme: string): string { return STRUCT_COLORS[forme] ?? '#64748B' }

/* ─────────────────────────────────────────────────────────
   Avatar helpers (Claude Design)
───────────────────────────────────────────────────────── */
const AVATAR_PALETTES = [
  'linear-gradient(135deg,#3B82F6,#6366F1)',
  'linear-gradient(135deg,#8B5CF6,#EC4899)',
  'linear-gradient(135deg,#10B981,#06B6D4)',
  'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#06B6D4,#3B82F6)',
  'linear-gradient(135deg,#EC4899,#8B5CF6)',
  'linear-gradient(135deg,#84CC16,#10B981)',
  'linear-gradient(135deg,#F97316,#F59E0B)',
]
function avatarGrad(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]
}
function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

/* ─────────────────────────────────────────────────────────
   Heat badge style (Claude Design)
───────────────────────────────────────────────────────── */
function getHeatStyle(score: number) {
  if (score >= 70) return {
    badgeStyle: {
      background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
      color: '#fff',
      border: '1px solid rgba(239,68,68,0.45)',
    } as React.CSSProperties,
    barColor: 'linear-gradient(90deg,#EF4444,#F59E0B)',
    label: 'Chaud',
    flame: true,
  }
  if (score >= 40) return {
    badgeStyle: {
      background: 'rgba(245,158,11,0.10)',
      color: '#fbbf24',
      border: '1px solid rgba(245,158,11,0.30)',
    } as React.CSSProperties,
    barColor: '#F59E0B',
    label: 'Tiède',
    flame: false,
  }
  return {
    badgeStyle: {
      background: 'rgba(56,189,248,0.08)',
      color: '#7dd3fc',
      border: '1px solid rgba(56,189,248,0.22)',
    } as React.CSSProperties,
    barColor: '#38BDF8',
    label: 'Froid',
    flame: false,
  }
}

/* ─────────────────────────────────────────────────────────
   Design tokens
───────────────────────────────────────────────────────── */
const BG      = '#080d1a'
const CARD    = '#0d1425'
const LINE    = 'rgba(148,163,184,0.10)'
const LINE_S  = 'rgba(148,163,184,0.18)'
const CARD_BG = `linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)), ${CARD}`

/* ─────────────────────────────────────────────────────────
   KPI card sub-composant
───────────────────────────────────────────────────────── */
function KpiCard({ label, value, accent, icon, trend }: {
  label: string
  value: string | number
  accent: string
  icon: React.ReactNode
  trend?: string
}) {
  return (
    <div className="cabinet-kpi">
      {/* Accent line top */}
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: '2px', borderRadius: '14px 14px 0 0', background: accent }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '10.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}18`, color: accent,
          border: `1px solid ${accent}36`, fontSize: '13px', flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      <div className="cabinet-kpi-val" style={{ textShadow: `0 0 24px ${accent}55` }}>
        {value}
      </div>
      {trend && (
        <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
          {trend}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   SVG icons
───────────────────────────────────────────────────────── */
const IcoGroup = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
  </svg>
)
const IcoFire = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
)
const IcoAlert = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IcoPulse = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

/* ─────────────────────────────────────────────────────────
   Props
───────────────────────────────────────────────────────── */
interface LeadTableProps {
  initialLeads: Lead[]
  cabinetId: string
  cabinetSlug?: string
}

/* ─────────────────────────────────────────────────────────
   Composant principal
───────────────────────────────────────────────────────── */
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

  /* ── Filtrage + tri ── */
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
    return [...result].sort((a, b) => calculateLeadScore(b) - calculateLeadScore(a))
  }, [leads, search, statusFilter, dateFilter, chaleurFilter])

  /* ── Mise à jour statut ── */
  const updateStatut = useCallback(async (leadId: string, newStatut: LeadStatut) => {
    setUpdatingId(leadId)
    const supabase = createClient()
    const { error } = await supabase.from('leads').update({ statut: newStatut }).eq('id', leadId)
    if (!error) setLeads(prev => prev.map(l => l.id === leadId ? { ...l, statut: newStatut } : l))
    setUpdatingId(null)
  }, [])

  /* ── Export CSV ── */
  function exportCSV() {
    const headers = ['Nom', 'Email', 'Téléphone', 'CA simulé', 'Structure', 'Net/an', 'Statut', 'Source', 'Date']
    const rows = filteredLeads.map(l => [
      l.nom || '', l.email || '', l.telephone || '',
      l.ca_simule || '', l.structure_recommandee || '',
      l.net_annuel || '', l.statut, l.source,
      new Date(l.created_at).toLocaleDateString('fr-FR'),
    ])
    const csv = '﻿' + [headers, ...rows].map(r =>
      r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  /* ── KPI (4 seulement sur la page Leads) ── */
  const total = leads.length
  const leadsChauds = leads.filter(l => calculateLeadScore(l) >= 70).length
  const aRelancer = leads.filter(l => getAlerteRelance(l) !== null).length
  const convertis = leads.filter(l => l.statut === 'converti').length
  const tauxConversion = total > 0 ? Math.round(convertis / total * 100) : 0

  /* ── Grid columns ── */
  const GRID = '36px 1.6fr 1fr 1fr 1fr 1fr 1.1fr 1fr 0.6fr'

  return (
    <>
      <SimulationModal lead={selectedLead} onClose={() => setSelectedLead(null)} />

      {/* ══ 4 KPI CARDS ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
        <KpiCard label="Total leads"      value={total}               accent="#3B82F6" icon={IcoGroup} />
        <KpiCard label="Leads chauds 🔥"  value={leadsChauds}         accent="#EF4444" icon={IcoFire}  />
        <KpiCard label="À relancer"       value={aRelancer}           accent="#F59E0B" icon={IcoAlert} />
        <KpiCard label="Taux conversion"  value={`${tauxConversion}%`} accent="#10B981" icon={IcoPulse} />
      </div>

      {/* ══ ALERTE RELANCE ══ */}
      {aRelancer > 0 && (
        <div
          className="cabinet-pulse-ring"
          style={{
            position: 'relative', borderRadius: '16px', marginBottom: '16px', overflow: 'hidden',
            border: '1px solid rgba(245,158,11,0.45)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(239,68,68,0.06))',
          }}
        >
          {/* Radial glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(420px 120px at 0% 50%, rgba(245,158,11,0.18), transparent 60%)',
          }} />
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '16px 20px', gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', fontSize: '20px',
              }}>
                <span className="cabinet-pulse-dot">⚠️</span>
              </div>
              <div>
                <div style={{ color: '#fde68a', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'monospace', color: '#fcd34d' }}>{aRelancer}</span>
                  {' '}lead{aRelancer > 1 ? 's' : ''} nécessite{aRelancer > 1 ? 'nt' : ''} une relance
                  {aRelancer > 2 && (
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px',
                      background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
                      fontSize: '10.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                    }}>Urgent</span>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', color: 'rgba(253,230,138,0.70)', marginTop: '2px', fontFamily: 'monospace' }}>
                  Aucun contact depuis 3+ jours · valeur potentielle élevée
                </div>
              </div>
            </div>
            <button
              onClick={() => setChaleurFilter('all')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                padding: '9px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
                color: '#fff', boxShadow: '0 6px 20px rgba(245,158,11,0.30)',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              Voir les leads à relancer
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ══ FILTRES + TOGGLE ══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {/* Recherche */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            placeholder="Rechercher un lead, un email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px',
              background: CARD, border: `1px solid ${LINE}`, color: '#e2e8f0', fontSize: '13px', outline: 'none',
            }}
          />
        </div>

        {/* Selects */}
        {([
          {
            value: statusFilter,
            onChange: (v: string) => setStatusFilter(v as LeadStatut | 'all'),
            options: [['all', 'Tous statuts'], ...STATUTS.map(s => [s, STATUT_CONFIG[s].label])],
          },
          {
            value: chaleurFilter,
            onChange: (v: string) => setChaleurFilter(v as 'all' | 'chaud' | 'tiede' | 'froid'),
            options: [['all', 'Toute chaleur'], ['chaud', '🔥 Chaud'], ['tiede', '🌤 Tiède'], ['froid', '❄ Froid']],
          },
          {
            value: dateFilter,
            onChange: (v: string) => setDateFilter(v as '7d' | '30d' | 'all'),
            options: [['all', 'Toute période'], ['7d', '7 derniers jours'], ['30d', '30 derniers jours']],
          },
        ] as const).map((sel, i) => (
          <select
            key={i}
            value={sel.value}
            onChange={e => sel.onChange(e.target.value)}
            style={{
              background: CARD, border: `1px solid ${LINE}`, color: '#cbd5e1',
              borderRadius: '10px', padding: '9px 32px 9px 12px', fontSize: '13px',
              outline: 'none', cursor: 'pointer',
              appearance: 'none',
              backgroundImage: 'linear-gradient(45deg, transparent 50%, #64748b 50%), linear-gradient(135deg, #64748b 50%, transparent 50%)',
              backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
              backgroundSize: '5px 5px', backgroundRepeat: 'no-repeat',
            }}
          >
            {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}

        {/* Toggle table / kanban */}
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2px',
          padding: '4px', borderRadius: '12px',
          border: '1px solid rgba(51,65,85,0.4)', background: CARD,
        }}>
          {([['table', '≡ Tableau'], ['kanban', '⠿ Pipeline']] as const).map(([v, label]) => (
            <button
              key={v}
              className={`cabinet-toggle${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Export CSV */}
        <button onClick={exportCSV} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '9px', cursor: 'pointer',
          background: 'rgba(148,163,184,0.06)', color: '#cbd5e1', border: `1px solid ${LINE}`,
          fontSize: '12.5px', fontWeight: 600,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exporter CSV
        </button>
      </div>

      {/* ══ KANBAN ══ */}
      {view === 'kanban' && cabinetSlug && (
        <KanbanView leads={filteredLeads} cabinetSlug={cabinetSlug} onStatutChange={updateStatut} />
      )}

      {/* ══ TABLE ══ */}
      {view === 'table' && (
        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: '16px', overflow: 'hidden' }}>

          {/* En-tête colonnes */}
          <div style={{
            display: 'grid', gridTemplateColumns: GRID, gap: '16px',
            padding: '12px 20px',
            fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.18em',
            color: '#475569', fontWeight: 600,
            borderBottom: `1px solid ${LINE_S}`,
            background: 'rgba(8,13,26,0.6)',
          }}>
            <div />
            <div>Contact</div>
            <div>Chaleur</div>
            <div>CA simulé</div>
            <div>Structure</div>
            <div>Net / an</div>
            <div>Statut</div>
            <div>Alerte</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {filteredLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: '#475569' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>Aucun lead pour ces critères</div>
            </div>
          ) : (
            <div>
              {filteredLeads.map(lead => {
                const score   = calculateLeadScore(lead)
                const heat    = getHeatStyle(score)
                const alerte  = getAlerteRelance(lead)
                const st      = STATUT_CONFIG[lead.statut]
                const sc      = lead.structure_recommandee ? structColor(lead.structure_recommandee) : '#64748b'
                const name    = lead.nom || lead.email || 'Prospect'

                return (
                  <div
                    key={lead.id}
                    className="cabinet-lead-row"
                    onClick={() => cabinetSlug && router.push(`/cabinet/${cabinetSlug}/leads/${lead.id}`)}
                    style={{
                      display: 'grid', gridTemplateColumns: GRID, gap: '16px',
                      padding: '14px 20px', alignItems: 'center',
                      cursor: cabinetSlug ? 'pointer' : 'default',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '13px', color: '#fff',
                      background: avatarGrad(name),
                    }}>
                      {initials(name)}
                    </div>

                    {/* Contact */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.nom || '—'}
                        </span>
                        {lead.intention === 'urgent' && <span style={{ fontSize: '10px', flexShrink: 0 }}>🔥</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.email || '—'}
                      </div>
                    </div>

                    {/* Chaleur + score bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 9px', borderRadius: '999px',
                        fontSize: '11.5px', fontWeight: 600, letterSpacing: '.01em',
                        ...heat.badgeStyle,
                      }}>
                        {heat.flame
                          ? <><span className="cabinet-flame">🔥</span> Chaud</>
                          : <>{heat.label === 'Tiède' ? '🌤' : '❄'} {heat.label}</>
                        }
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '10.5px', color: '#64748b' }}>{score}/100</span>
                      </div>
                      {/* Heat bar */}
                      <div style={{ width: '88px', height: '3px', borderRadius: '2px', background: 'rgba(148,163,184,0.10)', position: 'relative', overflow: 'hidden', marginTop: '-2px' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${score}%`, borderRadius: '2px', background: heat.barColor }} />
                      </div>
                    </div>

                    {/* CA simulé */}
                    <div>
                      <div style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '15px',
                        color: !lead.ca_simule ? '#64748b'
                          : lead.ca_simule >= 150000 ? '#10B981'
                          : lead.ca_simule >= 90000  ? '#3B82F6'
                          : '#cbd5e1',
                      }}>
                        {lead.ca_simule ? fmt(lead.ca_simule) : '—'}
                      </div>
                      {lead.ca_simule && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {lead.ca_simule >= 150000 ? 'CA élevé' : lead.ca_simule >= 90000 ? 'CA moyen' : 'Petit CA'}
                        </div>
                      )}
                    </div>

                    {/* Structure */}
                    <div>
                      {lead.structure_recommandee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc, boxShadow: `0 0 6px ${sc}`, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '13px', color: sc }}>
                            {lead.structure_recommandee.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                          </span>
                        </div>
                      ) : <span style={{ color: '#475569' }}>—</span>}
                    </div>

                    {/* Net / an */}
                    <div>
                      <div style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '15px',
                        color: !lead.net_annuel ? '#64748b' : lead.net_annuel >= 35000 ? '#10B981' : '#cbd5e1',
                      }}>
                        {lead.net_annuel ? fmt(lead.net_annuel) : '—'}
                      </div>
                      {lead.net_annuel && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {lead.net_annuel >= 35000 ? 'Optimisé' : 'À optimiser'}
                        </div>
                      )}
                    </div>

                    {/* Statut select */}
                    <div onClick={e => e.stopPropagation()}>
                      <select
                        value={lead.statut}
                        onChange={e => updateStatut(lead.id, e.target.value as LeadStatut)}
                        disabled={updatingId === lead.id}
                        className="cabinet-select-status"
                        style={{
                          background: st.bg, border: `1px solid ${st.border}`,
                          color: st.color, borderRadius: '8px',
                          padding: '5px 26px 5px 10px', fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer', outline: 'none',
                          opacity: updatingId === lead.id ? 0.5 : 1,
                        }}
                      >
                        {STATUTS.map(s => (
                          <option key={s} value={s} style={{ background: CARD, color: '#f1f5f9' }}>
                            {STATUT_CONFIG[s].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Alerte */}
                    <div>
                      {alerte ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                          background: alerte.couleur === 'red' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
                          color: alerte.couleur === 'red' ? '#fca5a5' : '#fcd34d',
                          border: `1px solid ${alerte.couleur === 'red' ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)'}`,
                          whiteSpace: 'nowrap',
                        }}>
                          <span className="cabinet-pulse-dot">⚠</span>
                          {alerte.message}
                        </span>
                      ) : (
                        <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: '12px' }}>—</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {cabinetSlug ? (
                        <Link href={`/cabinet/${cabinetSlug}/leads/${lead.id}`} style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '5px 10px', borderRadius: '7px',
                          background: 'rgba(148,163,184,0.06)', color: '#cbd5e1',
                          border: `1px solid ${LINE}`, fontSize: '11.5px', fontWeight: 600,
                          textDecoration: 'none', whiteSpace: 'nowrap',
                        }}>Fiche</Link>
                      ) : (
                        <button onClick={() => setSelectedLead(lead)} style={{
                          padding: '5px 10px', borderRadius: '7px', cursor: 'pointer',
                          background: 'rgba(148,163,184,0.06)', color: '#cbd5e1',
                          border: `1px solid ${LINE}`, fontSize: '11.5px', fontWeight: 600,
                        }}>Voir</button>
                      )}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}?subject=Suite de votre simulation fiscale`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: '5px 8px', borderRadius: '7px',
                            background: 'rgba(148,163,184,0.06)', color: '#cbd5e1',
                            border: `1px solid ${LINE}`, fontSize: '13px', textDecoration: 'none',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                        </a>
                      )}
                      <span className="cabinet-row-arrow">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: '12px 20px', borderTop: `1px solid ${LINE_S}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
              {filteredLeads.length} leads — triés par chaleur ↓
            </span>
            <span style={{ fontSize: '12px', color: '#475569' }}>Cliquez sur une ligne pour ouvrir la fiche</span>
          </div>
        </div>
      )}
    </>
  )
}
