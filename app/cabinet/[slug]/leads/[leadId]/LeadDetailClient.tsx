'use client'
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Lead, LeadStatut } from '@/lib/types/cabinet'
import type { Simulation, ComparisonRow, Insight } from './types'
import { STRUCT_COLORS } from './types'

/* ─── Types ─── */
type Note = { auteur: string; date: string; texte: string }

/* ─── Helpers ─── */
function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (days  > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  return 'à l\'instant'
}

function parseNotes(raw: string | null): Note[] {
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p)) return p as Note[]
    if (raw.trim()) return [{ auteur: '—', date: new Date().toISOString(), texte: raw }]
    return []
  } catch {
    if (raw.trim()) return [{ auteur: '—', date: new Date().toISOString(), texte: raw }]
    return []
  }
}

function structColor(forme: string): string {
  return STRUCT_COLORS[forme] ?? '#64748B'
}

/* ─── Stepper config ─── */
const ETAPES: { id: LeadStatut; label: string; icon: string }[] = [
  { id: 'nouveau',      label: 'Nouveau',       icon: '👋' },
  { id: 'contacté',    label: 'Contacté',      icon: '📞' },
  { id: 'rdv_planifie', label: 'RDV planifié',  icon: '📅' },
  { id: 'converti',    label: 'Client ✅',      icon: '✅' },
  { id: 'perdu',       label: 'Perdu',          icon: '❌' },
]
const ETAPE_ORDER: Record<LeadStatut, number> = {
  nouveau: 0, contacté: 1, rdv_planifie: 2, converti: 3, perdu: 4,
}

/* ─── Sous-composants réutilisables ─── */
function SecLabel({ children }: { children: React.ReactNode }) {
  return <div className="ld-sec" style={{ marginBottom: '16px' }}>{children}</div>
}

/* ─── Props ─── */
interface Props {
  lead: Lead
  simulations: Simulation[]
  insights: Insight[]
  comparisonData: ComparisonRow[]
  cabinetSlug: string
  lastSimId: string | null
  userName: string
  userInitials: string
  heatScore: number
}

export function LeadDetailClient({
  lead, simulations, insights, comparisonData,
  cabinetSlug, lastSimId, userName, userInitials, heatScore,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'simulations' | 'notes'>('overview')
  const [statut, setStatut]       = useState<LeadStatut>(lead.statut)
  const [notes, setNotes]         = useState<Note[]>(() => parseNotes(lead.notes))
  const [newNote, setNewNote]     = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [honoraires, setHonoraires] = useState<number | null>(lead.honoraires ?? null)
  const [savingHono, setSavingHono] = useState(false)
  const [savedHonoMsg, setSavedHonoMsg] = useState('')
  const [copied, setCopied]       = useState(false)
  const supabase = createClient()

  /* ─── Handlers ─── */
  const handleStatutChange = useCallback(async (s: LeadStatut) => {
    setStatut(s)
    await supabase.from('leads').update({ statut: s }).eq('id', lead.id)
  }, [lead.id, supabase])

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    const note: Note = { auteur: userName, date: new Date().toISOString(), texte: newNote.trim() }
    const updated = [note, ...notes]
    const { error } = await supabase.from('leads').update({ notes: JSON.stringify(updated) }).eq('id', lead.id)
    if (!error) { setNotes(updated); setNewNote('') }
    setSavingNote(false)
  }

  const handleSaveHonoraires = async () => {
    setSavingHono(true)
    const { error } = await supabase.from('leads').update({ honoraires }).eq('id', lead.id)
    setSavedHonoMsg(error ? '❌ Erreur' : '✓ Sauvegardé')
    setSavingHono(false)
    setTimeout(() => setSavedHonoMsg(''), 2500)
  }

  const handleCopyEmail = () => {
    if (!lead.email) return
    navigator.clipboard.writeText(lead.email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  /* ─── Stepper logic ─── */
  const currentOrder = ETAPE_ORDER[statut]

  /* ─── Next step label ─── */
  const nextEtape = ETAPES.find(e => ETAPE_ORDER[e.id] === currentOrder + 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

      {/* ══════════ COLONNE GAUCHE ══════════ */}
      <div className="ld-card" style={{ overflow: 'hidden' }}>

        {/* Tabs header */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(148,163,184,0.10)', padding: '0 8px' }}>
          {([
            { id: 'overview' as const,    label: 'Vue d\'ensemble' },
            { id: 'simulations' as const, label: `Simulations`, count: simulations.length },
            { id: 'notes' as const,       label: 'Notes', count: notes.length || undefined },
          ] as const).map(tab => (
            <button
              key={tab.id}
              className={`ld-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {'count' in tab && tab.count !== undefined && (
                <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '6px', background: 'rgba(100,116,139,0.2)', color: '#94a3b8', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB : Vue d'ensemble ── */}
        {activeTab === 'overview' && (
          <div style={{ padding: '24px' }}>

            {/* Comparison table */}
            {comparisonData.length > 0 && (
              <>
                <SecLabel>
                  Comparaison de structures · CA {fmt(lead.ca_simule)}
                </SecLabel>
                <div style={{ borderRadius: '12px', border: '1px solid rgba(148,163,184,0.10)', overflow: 'hidden', background: '#0a0f1d', marginBottom: '24px' }}>
                  <div className="ld-cmp-row head">
                    <div>Structure</div>
                    <div>Net / an</div>
                    <div>Charges</div>
                    <div>Imposition</div>
                    <div style={{ textAlign: 'right' }}>Score</div>
                  </div>
                  {comparisonData.map((row, i) => (
                    <div
                      key={row.forme}
                      className={`ld-cmp-row${row.isRecommended ? ' recommended' : ''}${i > 0 ? '' : ''}`}
                      style={{ borderTop: i > 0 ? '1px solid rgba(148,163,184,0.08)' : undefined }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: structColor(row.forme), boxShadow: row.isRecommended ? `0 0 6px ${structColor(row.forme)}` : undefined, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontWeight: row.isRecommended ? 700 : 500, color: row.isRecommended ? '#fff' : '#e2e8f0', fontSize: '13px' }}>{row.forme}</span>
                        {row.isRecommended && <span className="ld-pill ld-pill-blue" style={{ fontSize: '10px', padding: '2px 7px' }}>★ Recommandée</span>}
                        {row.ineligible && <span className="ld-pill ld-pill-red" style={{ fontSize: '10px', padding: '2px 7px' }}>CA &gt; plafond</span>}
                      </div>
                      <div className="ld-big-num" style={{ fontSize: '13px', color: row.ineligible ? '#475569' : (row.isRecommended ? '#6ee7b7' : '#cbd5e1') }}>
                        {row.ineligible ? '— inéligible' : fmt(row.netAnnuel)}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: row.ineligible ? '#374151' : '#94a3b8' }}>
                        {row.ineligible ? '—' : `${row.charges > 0 ? Math.round(row.charges / (lead.ca_simule || 1) * 100) : 0}%`}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: row.ineligible ? '#374151' : '#94a3b8' }}>
                        {row.ineligible ? '—' : row.is > 0 ? 'IS · 15%' : `IR · ${heatScore >= 40 ? '30%' : '11%'}`}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {row.ineligible
                          ? <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#374151' }}>—</span>
                          : <><span className="ld-big-num" style={{ fontSize: '14px', color: row.isRecommended ? '#6ee7b7' : '#cbd5e1' }}>{Math.round(row.score)}</span><span style={{ color: '#475569', fontSize: '11px' }}> /100</span></>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Last sim params detail */}
            {simulations[0]?.params && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
                {[
                  { label: 'Secteur déclaré',  value: ((simulations[0].params as Record<string,unknown>).secteur as string || '—').replace(/_/g, ' '), sub: 'catégorie fiscale' },
                  { label: 'Statut actuel',    value: ((simulations[0].params as Record<string,unknown>).formeActuelle as string || '—').replace(/_/g, ' '), sub: simulations[0]?.ca && simulations[0].ca > 77_700 ? '⚠ proche du plafond' : '' },
                  { label: 'Nb simulations',   value: String(simulations.length), sub: 'effectuées au total' },
                ].map(c => (
                  <div key={c.label} style={{ borderRadius: '10px', border: '1px solid rgba(148,163,184,0.10)', padding: '14px', background: '#0a0f1d' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#475569', fontWeight: 600 }}>{c.label}</div>
                    <div style={{ marginTop: '6px', color: '#fff', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>{c.value}</div>
                    {c.sub && <div style={{ fontSize: '11px', color: c.sub.startsWith('⚠') ? '#fbbf24' : '#64748b', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{c.sub}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <>
                <SecLabel>💡 Insights automatiques</SecLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {insights.map((ins, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '14px 16px', borderRadius: '12px',
                      background: ins.couleurBg, border: `1px solid ${ins.couleurBorder}`,
                    }}>
                      <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.2 }}>{ins.icon}</span>
                      <div>
                        <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: ins.couleur, marginBottom: '4px' }}>
                          {ins.priorite}
                        </div>
                        <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>{ins.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {comparisonData.length === 0 && insights.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#475569' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
                <div style={{ fontSize: '13px' }}>Aucune simulation effectuée — aucun insight disponible.</div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB : Simulations ── */}
        {activeTab === 'simulations' && (
          <div style={{ padding: '24px' }}>
            {simulations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#475569' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
                <p style={{ fontSize: '13px', margin: 0 }}>Aucune simulation enregistrée pour ce lead.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {simulations.map((sim, idx) => {
                  const color = STRUCT_COLORS[sim.best_forme ?? ''] ?? '#64748B'
                  const isFirst = idx === 0
                  const pillStyle = sim.best_forme?.includes('EURL') ? 'ld-pill-blue' :
                    sim.best_forme?.includes('SAS') ? 'ld-pill-violet' :
                    sim.best_forme?.includes('EI') ? 'ld-pill-amber' : 'ld-pill-slate'
                  return (
                    <div key={sim.id} style={{
                      borderRadius: '14px', padding: '16px 18px',
                      background: isFirst ? 'rgba(59,130,246,0.05)' : 'rgba(148,163,184,0.03)',
                      border: `1px solid ${isFirst ? 'rgba(59,130,246,0.25)' : 'rgba(148,163,184,0.10)'}`,
                      transition: 'border-color .18s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isFirst && <span className="ld-pill ld-pill-blue" style={{ fontSize: '10px', padding: '2px 6px' }}>Dernière</span>}
                          {sim.best_forme && <span className={`ld-pill ${pillStyle}`} style={{ fontSize: '10px' }}>{sim.best_forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}</span>}
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{sim.name || 'Simulation sans titre'}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#475569', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                          {new Date(sim.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
                        {[
                          { label: 'CA', value: fmt(sim.ca), color: '#60a5fa' },
                          { label: 'Net/an', value: fmt(sim.best_net_annuel), color: '#6ee7b7' },
                          { label: 'Net/mois', value: fmt(sim.best_net_mois), color: '#6ee7b7' },
                          { label: 'Score', value: sim.score != null ? `${sim.score}/100` : '—', color: '#fbbf24' },
                        ].map(kpi => (
                          <div key={kpi.label} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.08)' }}>
                            <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{kpi.label}</div>
                            <div className="ld-big-num" style={{ fontSize: '12px', color: kpi.color }}>{kpi.value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link
                          href={`/simulations/${sim.id}`}
                          className="ld-btn ld-btn-ghost"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                          Voir le détail
                        </Link>
                        <a
                          href={`/api/simulations/${sim.id}/pdf`}
                          target="_blank" rel="noopener noreferrer"
                          className="ld-btn ld-btn-ghost"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          PDF
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB : Notes ── */}
        {activeTab === 'notes' && (
          <div style={{ padding: '24px' }}>
            {/* Existing notes */}
            {notes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {notes.map((note, i) => (
                  <div key={i} style={{ borderRadius: '12px', padding: '12px 14px', background: '#0a0f1d', border: '1px solid rgba(148,163,184,0.10)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {note.auteur.split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'EC'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{note.auteur}</span>
                      </div>
                      <span style={{ fontSize: '10.5px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{relTime(note.date)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.6 }}>{note.texte}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: '#475569', fontSize: '13px', marginBottom: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>💬</div>
                Aucune note pour l'instant.
              </div>
            )}

            {/* Add note */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.10)', paddingTop: '20px' }}>
              <textarea
                className="ld-textarea"
                rows={3}
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Ajouter une note sur ce prospect…"
                style={{ marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Visible par l'équipe cabinet
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="ld-btn ld-btn-primary"
                  style={{ fontSize: '12px', padding: '7px 14px', opacity: (savingNote || !newNote.trim()) ? 0.5 : 1, cursor: (savingNote || !newNote.trim()) ? 'not-allowed' : 'pointer' }}
                >
                  {savingNote ? 'Sauvegarde…' : 'Ajouter la note'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ COLONNE DROITE (sidebar) ══════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Statut stepper ── */}
        <div className="ld-card" style={{ padding: '20px' }}>
          <SecLabel>Statut du lead</SecLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ETAPES.map((etape, i) => {
              const order = ETAPE_ORDER[etape.id]
              const isDone    = order < currentOrder
              const isCurrent = order === currentOrder
              const isUpcoming = order > currentOrder
              const cls = `ld-stage${isDone ? ' done' : isCurrent ? ' current' : ' upcoming'}`
              const showLine = i < ETAPES.length - 1
              return (
                <div key={etape.id}>
                  <button
                    className={cls}
                    style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', border: isCurrent ? undefined : '1px solid transparent' }}
                    onClick={() => handleStatutChange(etape.id)}
                  >
                    <span className="ld-stage-dot" />
                    <span className="ld-stage-label">{etape.label}</span>
                    {isDone && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#93c5fd', fontFamily: 'JetBrains Mono, monospace' }}>en cours</span>}
                  </button>
                  {showLine && <div className={`ld-stage-line${isDone ? ' done' : ''}`} style={{ marginLeft: '23px' }} />}
                </div>
              )
            })}
          </div>
          {nextEtape && (
            <button
              onClick={() => handleStatutChange(nextEtape.id)}
              className="ld-btn ld-btn-success"
              style={{ width: '100%', justifyContent: 'center', marginTop: '14px', fontSize: '13px' }}
            >
              Avancer → {nextEtape.label}
            </button>
          )}
        </div>

        {/* ── Actions rapides ── */}
        <div className="ld-card" style={{ padding: '20px' }}>
          <SecLabel>Actions rapides</SecLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <a href={lead.email ? `mailto:${lead.email}?subject=Suite de votre simulation fiscale` : '#'} className="ld-qa">
              <span className="ld-qa-icn" style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>Email</span>
            </a>
            <a href={lead.telephone ? `tel:${lead.telephone}` : '#'} className="ld-qa">
              <span className="ld-qa-icn" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>Appeler</span>
            </a>
            <button onClick={() => setActiveTab('notes')} className="ld-qa" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span className="ld-qa-icn" style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>Note</span>
            </button>
            {lastSimId ? (
              <a href={`/api/simulations/${lastSimId}/pdf`} target="_blank" rel="noopener noreferrer" className="ld-qa">
                <span className="ld-qa-icn" style={{ background: 'rgba(245,158,11,0.12)', color: '#fcd34d' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Rapport</span>
              </a>
            ) : (
              <div className="ld-qa" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                <span className="ld-qa-icn" style={{ background: 'rgba(245,158,11,0.12)', color: '#fcd34d' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Rapport</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Honoraires (converti only) ── */}
        {statut === 'converti' && (
          <div className="ld-card" style={{ padding: '20px', borderColor: 'rgba(16,185,129,0.25)' }}>
            <SecLabel>💼 Honoraires annuels</SecLabel>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input
                type="number"
                value={honoraires ?? ''}
                onChange={e => setHonoraires(e.target.value ? Number(e.target.value) : null)}
                onBlur={handleSaveHonoraires}
                placeholder="Ex : 1 200"
                min={0}
                className="ld-input"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
              />
              <span style={{ fontSize: '13px', color: '#64748b', alignSelf: 'center', flexShrink: 0 }}>€/an</span>
            </div>
            {honoraires != null && (
              <div style={{ fontSize: '11px', color: '#6ee7b7', marginBottom: '6px' }}>
                = {fmt(honoraires / 12)}/mois
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {savedHonoMsg
                ? <span style={{ fontSize: '11px', color: savedHonoMsg.startsWith('✓') ? '#6ee7b7' : '#f87171' }}>{savedHonoMsg}</span>
                : <span style={{ fontSize: '11px', color: '#475569' }}>Sauvegarde auto à la sortie</span>
              }
              <button
                onClick={handleSaveHonoraires}
                disabled={savingHono}
                className="ld-btn"
                style={{ fontSize: '11px', padding: '5px 10px', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', opacity: savingHono ? 0.6 : 1, cursor: savingHono ? 'not-allowed' : 'pointer' }}
              >
                {savingHono ? '…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}

        {/* ── Contact ── */}
        <div className="ld-card" style={{ padding: '20px' }}>
          <SecLabel>Contact</SecLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Email */}
            {lead.email && (
              <button
                onClick={handleCopyEmail}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background .18s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                title={copied ? 'Copié !' : 'Cliquer pour copier'}
              >
                <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#475569', fontWeight: 600 }}>Email</div>
                  <div style={{ fontSize: '12px', color: copied ? '#6ee7b7' : '#fff', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {copied ? '✓ Copié !' : lead.email}
                  </div>
                </div>
              </button>
            )}

            {/* Téléphone */}
            {lead.telephone && (
              <a href={`tel:${lead.telephone}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px', textDecoration: 'none', transition: 'background .18s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6ee7b7', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#475569', fontWeight: 600 }}>Téléphone</div>
                  <div style={{ fontSize: '12px', color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>{lead.telephone}</div>
                </div>
              </a>
            )}

            {/* Dates */}
            <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(148,163,184,0.08)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#475569' }}>Inscrit le</span>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                  {new Date(lead.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
              {lead.derniere_simulation && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Dernière sim.</span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(lead.derniere_simulation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </div>
              )}
              {lead.derniere_relance && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Dernière relance</span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(lead.derniere_relance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
