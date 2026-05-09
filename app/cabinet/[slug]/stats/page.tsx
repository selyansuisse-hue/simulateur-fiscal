'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip as ChartTooltip, Legend,
} from 'chart.js'
import { StatCard } from '@/components/cabinet/StatCard'
import { calculateLeadScore, getTopStructure } from '@/lib/cabinet-utils'
import type { Lead } from '@/lib/types/cabinet'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, Legend)

/* ─────────────────────────────────────────────────────────
   Tokens design
───────────────────────────────────────────────────────── */
const BG    = '#080d1a'
const CARD  = '#0d1425'
const LINE  = 'rgba(148,163,184,0.10)'
const LINE_S = 'rgba(148,163,184,0.18)'
const CARD_BG = `linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0)), ${CARD}`

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6', 'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B', 'Micro-entreprise': '#94A3B8',
}

function fmtMoney(n: number) {
  if (n === 0) return '—'
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + ' k€'
  return n + ' €'
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

/* ─────────────────────────────────────────────────────────
   KPI card (Claude Design)
───────────────────────────────────────────────────────── */
function KpiCard({ label, value, accent, icon, trend }: {
  label: string; value: string | number; accent: string
  icon: React.ReactNode; trend?: string
}) {
  return (
    <div className="cabinet-kpi">
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: '2px', borderRadius: '14px 14px 0 0', background: accent }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '10.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>{label}</div>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}18`, color: accent, border: `1px solid ${accent}36`, fontSize: '13px',
        }}>{icon}</div>
      </div>
      <div className="cabinet-kpi-val" style={{ textShadow: `0 0 24px ${accent}55` }}>{value}</div>
      {trend && <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{trend}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   SVG icons
───────────────────────────────────────────────────────── */
const ico = {
  group:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  fire:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>,
  pulse:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  euro:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  net:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h6M9 15h6"/></svg>,
  trend:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  card:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="14" r="2"/></svg>,
}

/* ─────────────────────────────────────────────────────────
   Entonnoir SVG (trapèzes — Claude Design)
───────────────────────────────────────────────────────── */
function FunnelSVG({ steps }: { steps: { label: string; count: number; pct: number }[] }) {
  const [s1, s2, s3, s4] = steps
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 600 320" style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6"/>
            <stop offset="50%" stopColor="#06B6D4"/>
            <stop offset="100%" stopColor="#10B981"/>
          </linearGradient>
        </defs>
        {/* Étape 1 */}
        <g className="cabinet-funnel-step">
          <polygon points="60,10 540,10 480,68 120,68" fill="url(#funnelGrad)" opacity="0.95"/>
          <text x="300" y="44" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Inter">
            {s1?.label ?? 'Total leads'}
          </text>
          <text x="300" y="60" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="11" fontFamily="monospace">
            {s1 ? `${s1.count} (${s1.pct}%)` : '—'}
          </text>
        </g>
        {/* Étape 2 */}
        <g className="cabinet-funnel-step" transform="translate(0,82)">
          <polygon points="120,0 480,0 430,58 170,58" fill="url(#funnelGrad)" opacity="0.85"/>
          <text x="300" y="32" textAnchor="middle" fill="#fff" fontSize="12.5" fontWeight="700" fontFamily="Inter">
            {s2?.label ?? 'Contactés'}
          </text>
          <text x="300" y="48" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="11" fontFamily="monospace">
            {s2 ? `${s2.count} (${s2.pct}%)` : '—'}
          </text>
        </g>
        {/* Étape 3 */}
        <g className="cabinet-funnel-step" transform="translate(0,154)">
          <polygon points="170,0 430,0 380,58 220,58" fill="url(#funnelGrad)" opacity="0.75"/>
          <text x="300" y="32" textAnchor="middle" fill="#fff" fontSize="12.5" fontWeight="700" fontFamily="Inter">
            {s3?.label ?? 'RDV planifiés'}
          </text>
          <text x="300" y="48" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="11" fontFamily="monospace">
            {s3 ? `${s3.count} (${s3.pct}%)` : '—'}
          </text>
        </g>
        {/* Étape 4 */}
        <g className="cabinet-funnel-step" transform="translate(0,226)">
          <polygon points="220,0 380,0 340,58 260,58" fill="url(#funnelGrad)" opacity="0.95"/>
          <text x="300" y="32" textAnchor="middle" fill="#fff" fontSize="12.5" fontWeight="700" fontFamily="Inter">
            {s4?.label ?? 'Convertis ✓'}
          </text>
          <text x="300" y="48" textAnchor="middle" fill="rgba(255,255,255,0.95)" fontSize="11" fontFamily="monospace">
            {s4 ? `${s4.count} (${s4.pct}%)` : '—'}
          </text>
        </g>
      </svg>

      {/* Deltas entre étapes */}
      {steps.length >= 2 && (
        <div style={{
          position: 'absolute', right: '4px', top: 0, height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
          paddingBlock: '8px', pointerEvents: 'none', textAlign: 'right',
        }}>
          {steps.slice(1).map((step, i) => {
            const prev = steps[i]
            const ratio = prev.count > 0 ? Math.round(step.count / prev.count * 100) : 0
            const cls = ratio >= 60 ? '#6ee7b7' : ratio >= 40 ? '#fcd34d' : '#fca5a5'
            const bg  = ratio >= 60 ? 'rgba(16,185,129,0.10)' : ratio >= 40 ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)'
            const border = ratio >= 60 ? 'rgba(16,185,129,0.30)' : ratio >= 40 ? 'rgba(245,158,11,0.30)' : 'rgba(239,68,68,0.30)'
            return (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: bg, border: `1px solid ${border}`,
                color: cls, padding: '3px 8px', borderRadius: '999px',
                fontSize: '10.5px', fontWeight: 700, fontFamily: 'monospace',
              }}>
                {ratio}% → suivant
              </span>
            )
          })}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)',
            color: '#6ee7b7', padding: '3px 8px', borderRadius: '999px',
            fontSize: '10.5px', fontWeight: 700, fontFamily: 'monospace',
          }}>
            ▼ Final {steps[steps.length - 1]?.pct ?? 0}%
          </span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Score ring animé (Claude Design)
───────────────────────────────────────────────────────── */
function ScoreRing({ score, distrib }: {
  score: number
  distrib: { chauds: number; tiedesP: number; froidsP: number }
}) {
  const ringRef = useRef<SVGCircleElement>(null)
  const numRef  = useRef<SVGTextElement>(null)
  const CIRC = 2 * Math.PI * 92 // 578.05

  useEffect(() => {
    const ring = ringRef.current
    const num  = numRef.current
    if (!ring || !num) return
    ring.setAttribute('stroke-dasharray', String(CIRC))
    ring.setAttribute('stroke-dashoffset', String(CIRC))
    let animId: number
    const start = performance.now()
    function tick(t: number) {
      const p = Math.min(1, (t - start) / 1100)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = score * eased
      num!.textContent = String(Math.round(v))
      ring!.setAttribute('stroke-dashoffset', String(CIRC - CIRC * (v / 100)))
      if (p < 1) animId = requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => { animId = requestAnimationFrame(tick) }, 350)
    return () => { clearTimeout(timer); cancelAnimationFrame(animId) }
  }, [score, CIRC])

  const label = score >= 70 ? 'Excellent' : score >= 50 ? 'Bon niveau' : score >= 30 ? 'Moyen' : 'À améliorer'

  return (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', marginBlock: '12px' }}>
      <div style={{ position: 'relative', filter: 'drop-shadow(0 0 14px rgba(16,185,129,0.45))' }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10B981"/>
              <stop offset="100%" stopColor="#06B6D4"/>
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="110" cy="110" r="92" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="14"/>
          {/* Progress */}
          <circle
            ref={ringRef}
            cx="110" cy="110" r="92" fill="none"
            stroke="url(#scoreGrad)" strokeWidth="14"
            strokeLinecap="round"
            transform="rotate(-90 110 110)"
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <text ref={numRef} />
          </svg>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            fontSize: '58px', lineHeight: 1, color: '#fff',
            textShadow: '0 0 24px rgba(16,185,129,0.45)',
          }} id="scoreNumDisplay">0</div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(110,231,183,0.80)', marginTop: '4px' }}>/&nbsp;100</div>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.22em', color: '#64748b', marginTop: '12px' }}>{label}</div>
        </div>
      </div>
    </div>
  )
}

/* Need to use vanilla refs for the animated text */
function ScoreRingFull({ score }: { score: number }) {
  const ringRef = useRef<SVGCircleElement>(null)
  const dispRef = useRef<HTMLDivElement>(null)
  const CIRC = 2 * Math.PI * 92

  useEffect(() => {
    const ring = ringRef.current
    const disp = dispRef.current
    if (!ring || !disp) return
    ring.setAttribute('stroke-dasharray', String(CIRC))
    ring.setAttribute('stroke-dashoffset', String(CIRC))
    let animId: number
    const start = performance.now()
    function tick(t: number) {
      const p = Math.min(1, (t - start) / 1100)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = score * eased
      disp!.textContent = String(Math.round(v))
      ring!.setAttribute('stroke-dashoffset', String(CIRC - CIRC * (v / 100)))
      if (p < 1) animId = requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => { animId = requestAnimationFrame(tick) }, 350)
    return () => { clearTimeout(timer); cancelAnimationFrame(animId) }
  }, [score, CIRC])

  const label = score >= 70 ? 'Excellent' : score >= 50 ? 'Bon niveau' : score >= 30 ? 'Moyen' : 'À améliorer'

  return (
    <div style={{ position: 'relative', filter: 'drop-shadow(0 0 14px rgba(16,185,129,0.45))' }}>
      <svg width="220" height="220" viewBox="0 0 220 220">
        <defs>
          <linearGradient id="scoreGrad2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10B981"/>
            <stop offset="100%" stopColor="#06B6D4"/>
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r="92" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="14"/>
        <circle ref={ringRef} cx="110" cy="110" r="92" fill="none"
          stroke="url(#scoreGrad2)" strokeWidth="14" strokeLinecap="round"
          transform="rotate(-90 110 110)"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div ref={dispRef} style={{
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
          fontSize: '58px', lineHeight: 1, color: '#fff',
          textShadow: '0 0 24px rgba(16,185,129,0.45)',
        }}>0</div>
        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(110,231,183,0.80)', marginTop: '4px' }}>/ 100</div>
        <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.22em', color: '#64748b', marginTop: '12px' }}>{label}</div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────── */
export default function StatsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: cabinet } = await supabase.from('cabinets').select('id').eq('slug', slug).single()
      if (!cabinet) { setLoading(false); return }
      const { data } = await supabase.from('leads').select('*').eq('cabinet_id', cabinet.id).order('created_at', { ascending: false })
      setLeads((data || []) as Lead[])
      setLoading(false)
    }
    load()
  }, [slug])

  const stats = useMemo(() => {
    if (!leads.length) return null
    const now = new Date()

    /* Leads par semaine */
    const weeksData = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(now); end.setDate(end.getDate() - i * 7)
      const start = new Date(end); start.setDate(start.getDate() - 7)
      const count = leads.filter(l => { const d = new Date(l.created_at); return d >= start && d < end }).length
      return { label: `S-${i === 0 ? '0' : i}`, count }
    }).reverse()

    /* Structures */
    const structMap: Record<string, number> = {}
    leads.forEach(l => { const k = l.structure_recommandee || 'Autre'; structMap[k] = (structMap[k] || 0) + 1 })

    /* KPIs de base */
    const withCA   = leads.filter(l => l.ca_simule)
    const withNet  = leads.filter(l => l.net_annuel)
    const withScore = leads.filter(l => l.score)
    const avgCA    = withCA.length   ? Math.round(withCA.reduce((s, l)   => s + (l.ca_simule   || 0), 0) / withCA.length)   : 0
    const avgNet   = withNet.length  ? Math.round(withNet.reduce((s, l)  => s + (l.net_annuel  || 0), 0) / withNet.length)  : 0
    const avgScore = withScore.length ? Math.round(withScore.reduce((s, l) => s + (l.score || 0), 0) / withScore.length) : 0
    const convertis = leads.filter(l => l.statut === 'converti').length
    const taux = leads.length > 0 ? Math.round(convertis / leads.length * 100) : 0

    /* Nouveaux KPIs */
    const leadsChauds = leads.filter(l => calculateLeadScore(l) >= 70).length
    const withGain = leads.filter(l => (l.gain_vs_pire ?? 0) > 0)
    const avgGain  = withGain.length ? Math.round(withGain.reduce((s, l) => s + (l.gain_vs_pire || 0), 0) / withGain.length) : 0
    const topStructure = getTopStructure(leads)
    const totalHonoraires = leads.filter(l => l.statut === 'converti' && (l.honoraires ?? 0) > 0).reduce((s, l) => s + (l.honoraires || 0), 0)

    /* Distribution chaleur */
    const chaudsP = Math.round(leadsChauds / leads.length * 100)
    const tiedeCount = leads.filter(l => { const s = calculateLeadScore(l); return s >= 40 && s < 70 }).length
    const froidCount = leads.filter(l => calculateLeadScore(l) < 40).length
    const tiedesP = Math.round(tiedeCount / leads.length * 100)
    const froidsP = Math.round(froidCount / leads.length * 100)

    /* Funnel (4 étapes) */
    const total = leads.length
    const contactes   = leads.filter(l => ['contacté', 'rdv_planifie', 'converti'].includes(l.statut)).length
    const rdvPlanifies = leads.filter(l => ['rdv_planifie', 'converti'].includes(l.statut)).length
    const funnel = [
      { label: 'Total leads',   count: total,        pct: 100 },
      { label: 'Contactés',     count: contactes,    pct: total > 0 ? Math.round(contactes    / total * 100) : 0 },
      { label: 'RDV planifiés', count: rdvPlanifies, pct: total > 0 ? Math.round(rdvPlanifies / total * 100) : 0 },
      { label: 'Convertis ✓',   count: convertis,    pct: taux },
    ]

    return {
      weeksData, structMap, avgCA, avgNet, avgScore, taux, funnel,
      total: leads.length, leadsChauds, avgGain, topStructure,
      totalHonoraires, convertis, chaudsP, tiedesP, froidsP,
    }
  }, [leads])

  if (loading) return (
    <div style={{ padding: '28px 32px', color: '#64748b', fontSize: '14px' }}>Chargement…</div>
  )

  if (!stats || stats.total === 0) return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ textAlign: 'center', padding: '64px 20px', background: CARD, borderRadius: '16px', border: `1px solid ${LINE}` }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>Aucun lead encore</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>Intégrez le widget pour commencer à recevoir des leads.</div>
      </div>
    </div>
  )

  const topStructShort = stats.topStructure.replace(' / SARL (IS)', '').replace(' / SASU', '')
  const topStructColor = STRUCT_COLORS[stats.topStructure] ?? '#3B82F6'
  const topStructPct   = stats.topStructure !== '—'
    ? Math.round((Object.values(stats.structMap)[0] ?? 0) / stats.total * 100)
    : 0

  return (
    <div style={{ padding: '28px 32px', background: BG, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.22em', color: 'rgba(167,139,250,0.80)', marginBottom: '8px' }}>
            Performance · 30 derniers jours
          </div>
          <h1 style={{ fontSize: '34px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>Statistiques</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' }}>Vue d&apos;ensemble de votre activité commerciale</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── KPI row 1 : Pipeline ── */}
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '.22em', textTransform: 'uppercase', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            Indicateurs · Activité
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(148,163,184,0.18), transparent)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <KpiCard label="Total leads"     value={stats.total}           accent="#3B82F6" icon={ico.group} />
            <KpiCard label="Leads chauds 🔥" value={stats.leadsChauds}     accent="#EF4444" icon={ico.fire}  />
            <KpiCard label="Convertis"       value={stats.convertis}       accent="#10B981" icon={ico.check} />
            <KpiCard label="Taux conversion" value={`${stats.taux}%`}      accent="#06B6D4" icon={ico.pulse} />
          </div>
        </div>

        {/* ── KPI row 2 : Financier ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <KpiCard label="CA moyen simulé"      value={stats.avgCA > 0 ? fmtMoney(stats.avgCA) : '—'}       accent="#8B5CF6" icon={ico.euro} />
          <KpiCard label="Net moyen / an"       value={stats.avgNet > 0 ? fmtMoney(stats.avgNet) : '—'}     accent="#F59E0B" icon={ico.net}  />
          <KpiCard label="Gain moyen identifié" value={stats.avgGain > 0 ? `+${fmtMoney(stats.avgGain)}` : '—'} accent="#10B981" icon={ico.trend} />
          <KpiCard label="Honoraires annuels"   value={stats.totalHonoraires > 0 ? fmtMoney(stats.totalHonoraires) : '—'} accent="#F59E0B" icon={ico.card} />
        </div>

        {/* ── Bandeau top structure ── */}
        {stats.topStructure !== '—' && (
          <div style={{
            position: 'relative', background: CARD, border: `1px solid ${LINE}`,
            borderRadius: '16px', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(500px 160px at 0% 50%, rgba(59,130,246,0.10), transparent 60%)',
            }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18))',
                  border: '1px solid rgba(59,130,246,0.30)',
                }}>🏆</div>
                <div>
                  <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.22em', color: '#64748b', fontWeight: 600 }}>
                    Structure la plus recommandée
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <span style={{
                      fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em',
                      background: `linear-gradient(90deg, ${topStructColor}, #A78BFA)`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>{topStructShort || stats.topStructure}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                      {topStructPct}% des recommandations
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.18em', color: '#64748b', fontFamily: 'monospace' }}>Sur</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fff', fontSize: '18px' }}>{stats.total} simulations</div>
                </div>
                {stats.avgNet > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.18em', color: '#64748b', fontFamily: 'monospace' }}>Net moyen</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6ee7b7', fontSize: '18px' }}>{fmtFull(stats.avgNet)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Charts row ── */}
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '.22em', textTransform: 'uppercase', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            Activité · Tendances
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(148,163,184,0.18), transparent)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            {/* Bar chart leads par semaine */}
            <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>Leads par semaine</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>8 dernières semaines · tendance</div>
              <div style={{ height: '180px' }}>
                <Bar
                  data={{
                    labels: stats.weeksData.map(w => w.label),
                    datasets: [{
                      data: stats.weeksData.map(w => w.count),
                      backgroundColor: 'rgba(59,130,246,0.50)',
                      borderColor: '#3B82F6',
                      borderWidth: 1, borderRadius: 4,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: '#0d1425', borderColor: LINE_S, borderWidth: 1, titleColor: '#94a3b8', bodyColor: '#f1f5f9' },
                    },
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } }, border: { color: LINE } },
                      y: { grid: { color: 'rgba(51,65,85,0.4)' }, ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 }, border: { color: LINE } },
                    },
                  }}
                />
              </div>
            </div>

            {/* Donut structures */}
            <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>Structures</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Répartition recommandées</div>
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={{
                    labels: Object.keys(stats.structMap).map(k => k.replace(' / SARL (IS)', '').replace(' / SASU', '')),
                    datasets: [{
                      data: Object.values(stats.structMap),
                      backgroundColor: Object.keys(stats.structMap).map(k => (STRUCT_COLORS[k] ?? '#64748B') + 'CC'),
                      borderColor: Object.keys(stats.structMap).map(k => STRUCT_COLORS[k] ?? '#64748B'),
                      borderWidth: 1,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: {
                      legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 10 }, boxWidth: 10, padding: 8 } },
                      tooltip: { backgroundColor: '#0d1425', borderColor: LINE_S, borderWidth: 1, titleColor: '#94a3b8', bodyColor: '#f1f5f9' },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Funnel + Score ring ── */}
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '.22em', textTransform: 'uppercase', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            Conversion · Qualité
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(148,163,184,0.18), transparent)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            {/* Funnel */}
            <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Entonnoir de conversion</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Du simulateur au client signé</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.18em', color: '#64748b', fontFamily: 'monospace' }}>Conversion globale</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6ee7b7', fontSize: '18px' }}>{stats.taux}%</div>
                </div>
              </div>
              <FunnelSVG steps={stats.funnel} />
            </div>

            {/* Score qualité */}
            <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Score qualité moyen</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Score moyen de vos prospects</div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBlock: '12px' }}>
                <ScoreRingFull score={stats.avgScore} />
              </div>

              {/* Distribution */}
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: '16px', marginTop: '4px' }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.18em', color: '#64748b', fontWeight: 600, marginBottom: '12px' }}>Distribution</div>
                {[
                  { label: '🔥 Chauds', pct: stats.chaudsP, bg: 'linear-gradient(90deg,#EF4444,#F59E0B)' },
                  { label: '🌤 Tièdes', pct: stats.tiedesP, bg: '#F59E0B' },
                  { label: '❄ Froids',  pct: stats.froidsP, bg: '#38BDF8' },
                ].map(d => (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '10px' }}>
                    <span style={{ width: '64px', color: '#94a3b8', flexShrink: 0 }}>{d.label}</span>
                    <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'rgba(51,65,85,0.6)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${d.pct}%`, background: d.bg, borderRadius: '999px' }} />
                    </div>
                    <span style={{ fontFamily: 'monospace', color: '#e2e8f0', width: '36px', textAlign: 'right', flexShrink: 0 }}>{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
