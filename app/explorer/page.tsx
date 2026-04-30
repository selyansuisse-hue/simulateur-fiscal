'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Tooltip as ChartTooltip, Legend,
} from 'chart.js'
import type { ChartOptions, TooltipItem } from 'chart.js'
import * as RadixTabs from '@radix-ui/react-tabs'
import { fmt } from '@/lib/utils'
import { calcMicro, calcEIReel, calcEURL, calcSASU, scoreMulti } from '@/lib/fiscal/structures'
import { calcPartsTotal, tmiRate } from '@/lib/fiscal/ir'
import { MICRO_PLAFONDS, SimParams, StructureResult, Secteur } from '@/lib/fiscal/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ChartTooltip, Legend)

/* ── Types ── */
interface ExplorerParams {
  ca: number
  charges: number
  amort: number
  capital: number
  situationFam: 'celib' | 'marie' | 'pacse' | 'veuf'
  nbEnfants: number
  autresRev: number
  prevoyance: 'min' | 'moyen' | 'max'
  strategie: 'max' | 'reserve'
  reserveVoulue: number
  perMontant: number
  secteur: Secteur
}

const DEFAULT: ExplorerParams = {
  ca: 80000, charges: 10000, amort: 2000, capital: 10000,
  situationFam: 'marie', nbEnfants: 0, autresRev: 0,
  prevoyance: 'min', strategie: 'max', reserveVoulue: 0, perMontant: 0,
  secteur: 'services_bic',
}

const QUICK_DEFS: { label: string; hint: string; apply: (p: ExplorerParams) => Partial<ExplorerParams> }[] = [
  { label: 'CA × 2', hint: "Doubler le chiffre d'affaires", apply: (p) => ({ ca: p.ca * 2 }) },
  { label: 'Se marier', hint: 'Passer à 2 parts fiscales', apply: () => ({ situationFam: 'marie' as const }) },
  { label: '2 enfants', hint: 'Ajouter 2 enfants à charge', apply: () => ({ nbEnfants: 2 }) },
  { label: 'PER 3 000 €', hint: 'Verser 3 000 € au PER', apply: () => ({ perMontant: 3000 }) },
  { label: '30% réserve', hint: 'Conserver 30% du résultat', apply: (p) => {
    const ben = p.ca - p.charges - p.amort
    return { strategie: 'reserve' as const, reserveVoulue: Math.round(Math.max(0, ben) * 0.3) }
  }},
  { label: '+20% charges', hint: 'Augmenter les charges de 20%', apply: (p) => ({ charges: Math.round(p.charges * 1.2) }) },
]

const CA_BREAKEVEN = [10000, 20000, 40000, 60000, 80000, 100000, 120000, 150000, 200000]

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6',
  'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B',
  'Micro-entreprise': '#94A3B8',
}
function structColor(forme: string): string {
  return STRUCT_COLORS[forme] ?? '#64748B'
}

/* ── Conversion ── */
function buildSimParams(p: ExplorerParams): SimParams {
  const cfg = MICRO_PLAFONDS[p.secteur]
  const abat = p.ca <= cfg.plafond ? cfg.abat : 0
  const partsBase = p.situationFam !== 'celib' ? 2 : 1
  return {
    ca: p.ca, charges: p.charges, amort: p.amort, deficit: 0,
    capital: p.capital, abat,
    remNetAnn: Math.max(0, p.ca - p.charges - p.amort) * 0.6,
    partsBase, nbEnfants: p.nbEnfants,
    parts: calcPartsTotal(partsBase, p.nbEnfants),
    autresRev: p.autresRev, prevoy: p.prevoyance, priorite: 'equilibre',
    situation: 'creation', secteur: p.secteur, formeActuelle: 'none',
    reserves: 0, remActuelle: 0, stratActif: p.strategie,
    reserveVoulue: p.reserveVoulue, stratRaison: 'invest',
    perActif: p.perMontant > 0 ? 'oui' : 'non', perMontant: p.perMontant,
    mutuelleMontant: 0, prevoyanceMontant: 0,
  }
}

function calcBestNet(p: ExplorerParams): number {
  const sp = buildSimParams(p)
  const micro = calcMicro(sp)
  const all: StructureResult[] = [calcEIReel(sp), calcEURL(sp), calcSASU(sp), ...(micro ? [micro] : [])]
  const scored = scoreMulti(all, 'equilibre')
  scored.sort((a, b) => b.scoreTotal - a.scoreTotal)
  return scored[0]?.netAnnuel || 0
}

function getTMI(r: StructureResult, autresRev: number, partsBase: number, nbEnfants: number): number {
  return Math.round(tmiRate((r.baseIR ?? r.bNet ?? r.ben ?? 0) + autresRev, partsBase, nbEnfants) * 100)
}

/* ── Style helpers ── */
const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#94a3b8' }

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 28px 8px 10px', borderRadius: '9px',
  border: '1px solid #334155', background: '#1e293b',
  fontSize: '12px', fontWeight: 600, color: '#e2e8f0',
  cursor: 'pointer', outline: 'none',
  appearance: 'none', WebkitAppearance: 'none',
  colorScheme: 'dark',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  backgroundSize: '12px',
}

const cardStyle: React.CSSProperties = {
  background: '#0f172a',
  borderRadius: '16px',
  border: '1px solid rgba(51,65,85,0.6)',
  boxShadow: '0 1px 6px rgba(0,0,0,0.3)',
}

/* ── SliderField ── */
function SliderField({ label, value, onChange, min, max, step, hint, hintColor, fillColor }: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step: number; hint?: string; hintColor?: string; fillColor?: string
}) {
  const safeMax = Math.max(max, min + 1)
  const sliderVal = Math.min(value, safeMax)
  const pct = safeMax > min ? Math.round((sliderVal - min) / (safeMax - min) * 100) : 0
  const fill = fillColor || '#3B82F6'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={labelStyle}>{label}</label>
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
          padding: '3px 10px', fontSize: '13px', fontWeight: 700, color: '#f1f5f9',
          minWidth: '80px', textAlign: 'right',
        }}>
          {fmt(value)}
        </div>
      </div>
      <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '6px', borderRadius: '999px',
          background: `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, #1e293b ${pct}%, #1e293b 100%)`,
          border: '1px solid rgba(51,65,85,0.5)',
        }} />
        <input type="range" min={min} max={safeMax} step={step} value={sliderVal}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            height: '6px', opacity: 0, cursor: 'pointer', zIndex: 1,
          }}
        />
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 8px)`,
          width: '16px', height: '16px', borderRadius: '50%',
          background: '#fff', border: `2px solid ${fill}`,
          boxShadow: `0 2px 6px rgba(0,0,0,0.4)`,
          pointerEvents: 'none',
        }} />
      </div>
      {hint && (
        <div style={{ fontSize: '10px', marginTop: '5px', color: hintColor || '#64748b', fontWeight: 500 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', marginBottom: '12px' }}>
      <div style={{ width: '3px', borderRadius: '2px 0 0 2px', background: color, flexShrink: 0 }} />
      <span style={{
        fontSize: '10px', fontWeight: 800, color,
        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
        background: color + '18', padding: '3px 10px',
        borderRadius: '0 6px 6px 0', lineHeight: '22px',
      }}>
        {label}
      </span>
    </div>
  )
}

/* ── Page principale ── */
export default function ExplorerPage() {
  const router = useRouter()
  const [params, setParams] = useState<ExplorerParams>(DEFAULT)
  const [isPrefilledFromSim, setIsPrefilledFromSim] = useState(false)
  const [mode, setMode] = useState<'simple' | 'expert'>('simple')
  const [activeTab, setActiveTab] = useState<'activite' | 'foyer' | 'optimisation'>('activite')
  const [delta, setDelta] = useState<{ value: number; visible: boolean }>({ value: 0, visible: false })
  const [newBestAlert, setNewBestAlert] = useState(false)
  const prevBestNetRef = useRef<number>(0)
  const prevBestNameRef = useRef<string>('')
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const upd: Partial<ExplorerParams> = {}
    if (sp.get('ca')) upd.ca = Number(sp.get('ca'))
    if (sp.get('charges')) upd.charges = Number(sp.get('charges'))
    if (sp.get('amort')) upd.amort = Number(sp.get('amort'))
    if (sp.get('capital')) upd.capital = Number(sp.get('capital'))
    if (sp.get('enfants')) upd.nbEnfants = Number(sp.get('enfants'))
    if (sp.get('sitfam')) upd.situationFam = sp.get('sitfam') as ExplorerParams['situationFam']
    if (sp.get('per')) upd.perMontant = Number(sp.get('per'))
    if (sp.get('autresrev')) upd.autresRev = Number(sp.get('autresrev'))
    if (sp.get('secteur')) upd.secteur = sp.get('secteur') as Secteur
    if (Object.keys(upd).length > 0) {
      setParams(prev => ({ ...prev, ...upd }))
      setIsPrefilledFromSim(true)
    }
  }, [])

  const set = useCallback(<K extends keyof ExplorerParams>(key: K, value: ExplorerParams[K]) => {
    setParams(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'ca' && next.charges > Number(value) * 0.9) next.charges = Math.round(Number(value) * 0.4)
      if (key === 'strategie' && value === 'max') next.reserveVoulue = 0
      return next
    })
  }, [])

  /* ── Calculs live ── */
  const results = useMemo(() => {
    const p = buildSimParams(params)
    const micro = calcMicro(p)
    const ei = calcEIReel(p)
    const eurl = calcEURL(p)
    const sasu = calcSASU(p)
    const all: StructureResult[] = [ei, eurl, sasu, ...(micro ? [micro] : [])]
    const scored = scoreMulti(all, 'equilibre')
    scored.sort((a, b) => b.scoreTotal - a.scoreTotal)
    return { scored, best: scored[0], microPlafond: MICRO_PLAFONDS[params.secteur].plafond }
  }, [params])

  const partsBase = params.situationFam !== 'celib' ? 2 : 1
  const parts = calcPartsTotal(partsBase, params.nbEnfants)
  const partsStr = parts % 1 === 0 ? parts.toFixed(0) : parts.toFixed(1).replace('.', ',')
  const ben = Math.max(0, params.ca - params.charges - params.amort)
  const microExcluded = params.ca > results.microPlafond
  const seuil60k = ben > 60000
  const perPlafond = Math.max(Math.round(Math.min(35194, ben * 0.10)), 500)

  const tmi = Math.round(tmiRate(
    (results.best.baseIR ?? results.best.bNet ?? results.best.ben ?? 0) + params.autresRev,
    partsBase, params.nbEnfants
  ) * 100)

  const worst = results.scored[results.scored.length - 1]
  const gainVsWorst = results.best.netAnnuel - (worst?.netAnnuel || 0)
  const second = results.scored.find(r => r.forme !== results.best.forme)
  const sc = structColor(results.best.forme)

  /* ── Delta ── */
  useEffect(() => {
    const bestNet = results.best.netAnnuel
    const bestName = results.best.forme
    if (prevBestNetRef.current !== 0) {
      const diff = bestNet - prevBestNetRef.current
      if (Math.abs(diff) > 100) {
        setDelta({ value: diff, visible: true })
        if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current)
        deltaTimerRef.current = setTimeout(() => setDelta(d => ({ ...d, visible: false })), 2500)
      }
      if (prevBestNameRef.current && prevBestNameRef.current !== bestName) {
        setNewBestAlert(true)
        setTimeout(() => setNewBestAlert(false), 2000)
      }
    }
    prevBestNetRef.current = bestNet
    prevBestNameRef.current = bestName
  }, [results])

  /* ── "Et si..." ── */
  const quickWithImpact = useMemo(() => QUICK_DEFS.map(q => {
    const newP = { ...params, ...q.apply(params) }
    const diff = calcBestNet(newP) - results.best.netAnnuel
    return { ...q, impact: diff }
  }), [params, results.best.netAnnuel])

  /* ── Stacked horizontal bar (FIX 3) ── */
  const stackedBarData = useMemo(() => {
    const b = results.best
    const exploit = params.charges
    const cotis = b.charges
    const ir = b.ir
    const is = b.is || 0
    const net = b.netAnnuel
    return {
      labels: [''],
      datasets: [
        { label: 'Charges exploit.', data: [exploit], backgroundColor: '#dc2626', borderRadius: 0 },
        { label: 'Cotisations', data: [cotis], backgroundColor: '#f97316', borderRadius: 0 },
        { label: 'IR', data: [ir], backgroundColor: '#eab308', borderRadius: 0 },
        ...(is > 0 ? [{ label: 'IS', data: [is], backgroundColor: '#a855f7', borderRadius: 0 }] : []),
        { label: 'Net', data: [net], backgroundColor: '#10b981', borderRadius: 4 },
      ],
      raw: { exploit, cotis, ir, is, net },
    }
  }, [results.best, params.charges])

  /* ── Breakeven curve data ── */
  const breakevenData = useMemo(() => {
    return CA_BREAKEVEN.map(caVal => {
      const sp = buildSimParams({ ...params, ca: caVal })
      const ei = calcEIReel(sp)
      const eurl = calcEURL(sp)
      const sasu = calcSASU(sp)
      const micro = calcMicro(sp)
      const plafond = MICRO_PLAFONDS[params.secteur].plafond
      return {
        ca: caVal,
        ei: ei.netAnnuel,
        eurl: eurl.netAnnuel,
        sasu: sasu.netAnnuel,
        micro: caVal <= plafond ? (micro?.netAnnuel ?? null) : null,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.charges, params.amort, params.capital, params.situationFam, params.nbEnfants,
      params.autresRev, params.perMontant, params.secteur, params.strategie, params.reserveVoulue])

  /* ── Résumé automatique ── */
  const autoSummary = `Avec un CA de ${fmt(params.ca)}${params.charges > 0 ? ` et ${fmt(params.charges)} de charges` : ''}, ${results.best.forme} vous permet de conserver ${fmt(results.best.netAnnuel)}/an (${fmt(Math.round(results.best.netAnnuel / 12))}/mois)${gainVsWorst > 500 ? `, soit ${fmt(gainVsWorst)} de plus que ${worst?.forme || 'la structure la moins avantageuse'}` : ''}. TMI : ${tmi}% avec ${partsStr} part${parts > 1 ? 's' : ''} fiscale${parts > 1 ? 's' : ''}${params.perMontant > 0 ? ` · PER actif : ${fmt(params.perMontant)}/an (économie IR ≈ ${fmt(Math.round(params.perMontant * tmi / 100))})` : ''}.`

  const tmiColor = tmi <= 11 ? '#10B981' : tmi <= 30 ? '#F59E0B' : tmi <= 41 ? '#F97316' : '#EF4444'
  const kpiDeltaVal = delta.visible && Math.abs(delta.value) > 100 ? delta.value : null

  /* ── Chart.js options ── */
  const stackedBarOptions: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: { boxWidth: 10, font: { size: 10 }, color: '#64748b', padding: 14 },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        callbacks: {
          label: (item: TooltipItem<'bar'>) => {
            const val = typeof item.raw === 'number' ? item.raw : 0
            return ` ${item.dataset.label}: ${fmt(val)}`
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: 'rgba(51,65,85,0.25)' },
        ticks: {
          font: { size: 10 }, color: '#64748b',
          callback: (val) => `${Math.round(Number(val) / 1000)}k€`,
        },
        border: { color: '#334155' },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { display: false },
        border: { display: false },
      },
    },
  }

  const breakevenOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: { boxWidth: 10, font: { size: 10 }, color: '#64748b', padding: 12 },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        callbacks: {
          label: (item: TooltipItem<'line'>) => {
            if (item.parsed.y === null) return ''
            return ` ${item.dataset.label}: ${fmt(item.parsed.y)}`
          },
          title: (items) => `CA : ${fmt(items[0]?.parsed.x ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        grid: { color: 'rgba(51,65,85,0.4)' },
        ticks: {
          font: { size: 10 }, color: '#64748b',
          callback: (val) => `${Math.round(Number(val) / 1000)}k`,
        },
        border: { color: '#334155' },
        title: { display: true, text: "CA annuel HT (€)", font: { size: 10 }, color: '#64748b' },
      },
      y: {
        grid: { color: 'rgba(51,65,85,0.4)' },
        ticks: {
          font: { size: 10 }, color: '#64748b',
          callback: (val) => `${Math.round(Number(val) / 1000)}k€`,
        },
        border: { color: '#334155' },
        title: { display: true, text: 'Revenu net/an', font: { size: 10 }, color: '#64748b' },
      },
    },
  }

  const breakevenChartConfig = {
    datasets: [
      {
        label: 'EURL IS',
        data: breakevenData.map(d => ({ x: d.ca, y: d.eurl })),
        borderColor: '#3B82F6', backgroundColor: '#3B82F620',
        borderWidth: 2, pointRadius: 3, tension: 0.3,
      },
      {
        label: 'SAS/SASU',
        data: breakevenData.map(d => ({ x: d.ca, y: d.sasu })),
        borderColor: '#8B5CF6', backgroundColor: '#8B5CF620',
        borderWidth: 2, pointRadius: 3, tension: 0.3,
      },
      {
        label: 'EI réel',
        data: breakevenData.map(d => ({ x: d.ca, y: d.ei })),
        borderColor: '#F59E0B', backgroundColor: '#F59E0B20',
        borderWidth: 2, pointRadius: 3, tension: 0.3,
      },
      {
        label: 'Micro',
        data: breakevenData.map(d => d.micro !== null ? { x: d.ca, y: d.micro } : { x: d.ca, y: null }),
        borderColor: '#94A3B8', backgroundColor: '#94A3B820',
        borderWidth: 2, pointRadius: 3, tension: 0.3,
        spanGaps: false,
      },
    ],
  }

  /* ── Tab trigger style (FIX 7 — plus subtil) ── */
  const tabTriggerStyle = (val: string): React.CSSProperties => ({
    flex: 1, padding: '8px 4px', fontSize: '10px', fontWeight: 700,
    cursor: 'pointer', border: 'none',
    borderRadius: '8px',
    background: activeTab === val ? 'rgba(51,65,85,0.8)' : 'transparent',
    color: activeTab === val ? '#f1f5f9' : '#64748B',
    transition: 'all 150ms',
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: '2px',
    boxShadow: 'none',
  })

  /* ── Décomposition % pour le mini-bar du hero ── */
  const ca = Math.max(1, params.ca)
  const heroChargesPct = Math.min(45, (params.charges / ca * 100))
  const heroCotisPct = Math.min(45, (results.best.charges / ca * 100))
  const heroIrPct = Math.min(30, (results.best.ir / ca * 100))
  const heroNetPct = Math.min(100, (results.best.netAnnuel / ca * 100))

  return (
    <>
      <style>{`
        html, body { background: #020617 !important; }
        input[type=range]::-webkit-slider-thumb { opacity: 0; }
        input[type=range]::-moz-range-thumb { opacity: 0; }
      `}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>

        {/* ── PAGE SUB-HEADER ── */}
        <div style={{
          background: '#0a1628', borderBottom: '1px solid rgba(51,65,85,0.6)',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
                Explorateur de scénarios
              </h1>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0', lineHeight: 1 }}>
                Résultats mis à jour instantanément
              </p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: sc + '18',
              border: `1px solid ${sc}40`,
              borderRadius: '999px', padding: '5px 12px',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: sc }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: sc }}>
                {results.best.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 800, color: '#fff',
                background: sc,
                borderRadius: '999px', padding: '1px 7px',
              }}>
                {results.best.scoreTotal}/100
              </span>
            </div>
            {isPrefilledFromSim && (
              <span style={{
                fontSize: '11px', fontWeight: 600, color: '#60a5fa',
                background: '#1e3a5f', border: '1px solid #1d4ed880',
                padding: '4px 10px', borderRadius: '999px',
              }}>
                ✓ Pré-rempli depuis simulation
              </span>
            )}
          </div>

          {/* Mode toggle + nav */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', background: '#0f172a', borderRadius: '10px', padding: '3px', border: '1px solid #334155' }}>
              {(['simple', 'expert'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                  border: 'none', cursor: 'pointer', transition: 'all 150ms',
                  background: mode === m ? '#1e293b' : 'transparent',
                  color: mode === m ? '#f1f5f9' : '#64748b',
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}>
                  {m === 'simple' ? '📊 Simplifié' : '🔬 Expert'}
                </button>
              ))}
            </div>
            <Link href="/simulateur" style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '12px',
              fontWeight: 700, textDecoration: 'none',
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              color: '#fff', boxShadow: '0 2px 8px rgba(29,78,216,0.35)',
            }}>
              Simulateur complet →
            </Link>
          </div>
        </div>

        {/* ── KPI BAR STICKY (FIX 2) ── */}
        <div style={{
          position: 'sticky', top: '64px', zIndex: 40,
          background: 'rgba(2,6,23,0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(51,65,85,0.5)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', maxWidth: '1400px', margin: '0 auto' }}
            className="!grid-cols-2 lg:!grid-cols-4">
            {[
              {
                label: 'Revenu net annuel',
                value: fmt(results.best.netAnnuel),
                sub: `${fmt(Math.round(results.best.netAnnuel / 12))}/mois`,
                valueColor: '#60a5fa',
                accentColor: sc,
                delta: kpiDeltaVal,
              },
              {
                label: 'TMI estimé',
                value: `${tmi}%`,
                sub: tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Intermédiaire' : tmi <= 41 ? 'Haute' : 'Très haute',
                valueColor: tmiColor,
                accentColor: tmiColor,
                delta: null,
              },
              {
                label: 'Gain vs moins avantageux',
                value: `+${fmt(gainVsWorst)}`,
                sub: 'par an',
                valueColor: '#34d399',
                accentColor: '#10B981',
                delta: null,
              },
              {
                label: 'Résultat avant rémunération',
                value: fmt(ben),
                sub: 'CA − charges − amort.',
                valueColor: '#cbd5e1',
                accentColor: '#475569',
                delta: null,
              },
            ].map((kpi, i) => (
              <div key={i} style={{
                padding: '10px 18px 11px',
                borderRight: i < 3 ? '1px solid rgba(51,65,85,0.4)' : 'none',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: kpi.accentColor, opacity: 0.9 }} />
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '3px' }}>
                  {kpi.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: kpi.valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {kpi.value}
                  </div>
                  {kpi.delta !== null && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
                      background: kpi.delta >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      color: kpi.delta >= 0 ? '#34d399' : '#f87171',
                      border: `1px solid ${kpi.delta >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>
                      {kpi.delta >= 0 ? '↑ +' : '↓ '}{fmt(Math.abs(kpi.delta))}
                    </span>
                  )}
                  {newBestAlert && i === 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#2563EB', color: '#fff' }}>
                      ✦ Nouveau
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CORPS PRINCIPAL ── */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '0' }}
          className="!grid-cols-1 lg:!grid-cols-[300px_1fr]">

          {/* ════ SIDEBAR AVEC TABS ════ */}
          <div style={{ background: '#080f1e', borderRight: '1px solid rgba(51,65,85,0.5)' }}
            className="lg:sticky lg:top-[148px] lg:overflow-y-auto lg:max-h-[calc(100vh-148px)]">

            {/* FIX 7 — Tab bar plus subtil */}
            <RadixTabs.Root value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
              <RadixTabs.List style={{
                display: 'flex', borderBottom: '1px solid rgba(51,65,85,0.5)',
                background: '#020617', position: 'sticky' as const, top: 0, zIndex: 10,
                padding: '5px 6px', gap: '4px',
              }}>
                {[
                  { value: 'activite', icon: '📊', label: 'Activité' },
                  { value: 'foyer', icon: '👨‍👩‍👧', label: 'Foyer' },
                  { value: 'optimisation', icon: '🎯', label: 'Optim.' },
                ].map(tab => (
                  <RadixTabs.Trigger key={tab.value} value={tab.value} style={tabTriggerStyle(tab.value)}>
                    <span style={{
                      fontSize: '14px',
                      background: activeTab === tab.value ? 'rgba(255,255,255,0.08)' : '#0f172a',
                      borderRadius: '5px', padding: '2px 4px',
                    }}>{tab.icon}</span>
                    {tab.label}
                  </RadixTabs.Trigger>
                ))}
              </RadixTabs.List>

              {/* Tab Activité */}
              <RadixTabs.Content value="activite" style={{ padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
                <SectionTitle label="Secteur & CA" color="#3B82F6" />
                <div>
                  <label style={{ ...labelStyle, display: 'block', marginBottom: '5px' }}>Secteur d&apos;activité</label>
                  <select style={selectStyle} value={params.secteur}
                    onChange={e => set('secteur', e.target.value as Secteur)}>
                    <option value="services_bic">Services BIC — abatt. 50%</option>
                    <option value="liberal_bnc">Libéral / BNC — abatt. 34%</option>
                    <option value="commerce">Commerce — abatt. 71%</option>
                    <option value="btp">BTP/artisanat — abatt. 50%</option>
                  </select>
                </div>

                <SliderField label="CA annuel HT" value={params.ca}
                  onChange={v => set('ca', v)} min={0} max={2000000} step={5000}
                  fillColor={sc}
                  hint={microExcluded ? `⚠ Micro exclue (>${fmt(results.microPlafond)})` : `✓ Micro possible (≤ ${fmt(results.microPlafond)})`}
                  hintColor={microExcluded ? '#F59E0B' : '#10B981'}
                />

                {/* Mode expert : charges détaillées */}
                {mode === 'expert' && (
                  <>
                    <SectionTitle label="Charges & Investissements" color="#3B82F6" />
                    <SliderField label="Charges d'exploitation" value={params.charges}
                      onChange={v => set('charges', v)}
                      min={0} max={Math.max(Math.round(params.ca * 0.9), 10000)} step={1000}
                      fillColor={sc}
                      hint={params.ca > 0 ? `${(params.charges / params.ca * 100).toFixed(0)}% du CA` : undefined}
                    />
                    <SliderField label="Amortissements" value={params.amort}
                      onChange={v => set('amort', v)} min={0} max={200000} step={500}
                      fillColor={sc}
                    />
                  </>
                )}

                {/* Mode simplifié : charges résumées */}
                {mode === 'simple' && (
                  <div style={{
                    background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: '10px', padding: '10px 12px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600 }}>Charges + amort.</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#93c5fd' }}>
                      {fmt(params.charges + params.amort)}
                    </span>
                  </div>
                )}

                {/* Résultat indicator */}
                <div style={{
                  background: seuil60k ? 'rgba(245,158,11,0.1)' : 'rgba(37,99,235,0.08)',
                  border: `1px solid ${seuil60k ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.25)'}`,
                  borderRadius: '10px', padding: '10px 12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: seuil60k ? '#fbbf24' : '#60a5fa', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '2px' }}>
                      Résultat avant rémunération
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: seuil60k ? '#F59E0B' : '#3b82f6', letterSpacing: '-0.03em' }}>
                      {fmt(ben)}
                    </div>
                  </div>
                  {seuil60k && (
                    <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '4px 10px', fontSize: '10px', fontWeight: 700, color: '#fbbf24' }}>
                      ⚡ Zone IS
                    </div>
                  )}
                </div>
              </RadixTabs.Content>

              {/* Tab Foyer */}
              <RadixTabs.Content value="foyer" style={{ padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
                <SectionTitle label="Situation familiale" color="#8B5CF6" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ ...labelStyle, display: 'block', marginBottom: '5px' }}>Situation</label>
                    <select style={selectStyle} value={params.situationFam}
                      onChange={e => set('situationFam', e.target.value as ExplorerParams['situationFam'])}>
                      <option value="celib">Célibataire</option>
                      <option value="marie">Marié(e)</option>
                      <option value="pacse">Pacsé(e)</option>
                      <option value="veuf">Veuf/veuve</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, display: 'block', marginBottom: '5px' }}>Enfants</label>
                    <select style={selectStyle} value={params.nbEnfants}
                      onChange={e => set('nbEnfants', parseInt(e.target.value))}>
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n === 0 ? 'Aucun' : `${n} enfant${n > 1 ? 's' : ''}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#a78bfa' }}>Parts fiscales</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#c4b5fd' }}>{partsStr} parts</span>
                </div>

                <SectionTitle label="Autres revenus & capital" color="#8B5CF6" />

                <SliderField label="Autres revenus du foyer (€/an)" value={params.autresRev}
                  onChange={v => set('autresRev', Math.max(0, v))} min={0} max={200000} step={1000}
                  fillColor="#8B5CF6"
                  hint="Salaire conjoint, revenus fonciers..."
                />

                {mode === 'expert' && (
                  <SliderField label="Capital social (société IS)" value={params.capital}
                    onChange={v => set('capital', v)} min={1000} max={500000} step={1000}
                    fillColor="#8B5CF6"
                    hint={`Seuil dividendes TNS : ${fmt(params.capital * 0.10)}`}
                    hintColor="#64748b"
                  />
                )}
              </RadixTabs.Content>

              {/* Tab Optimisation */}
              <RadixTabs.Content value="optimisation" style={{ padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
                <SectionTitle label="Stratégie de rémunération" color="#10B981" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(['max', 'reserve'] as const).map(val => (
                    <button key={val} onClick={() => set('strategie', val)}
                      style={{
                        padding: '10px', borderRadius: '10px', cursor: 'pointer',
                        border: params.strategie === val ? '2px solid #10B981' : '1.5px solid #334155',
                        background: params.strategie === val ? 'rgba(16,185,129,0.12)' : '#0f172a',
                        color: params.strategie === val ? '#34d399' : '#64748b',
                        fontSize: '11px', fontWeight: 700, transition: 'all 150ms',
                      }}>
                      {val === 'max' ? '💰 Tout percevoir' : '🏦 Garder réserves'}
                    </button>
                  ))}
                </div>

                {params.strategie === 'reserve' && (
                  <SliderField label="Montant en réserves" value={params.reserveVoulue}
                    onChange={v => set('reserveVoulue', v)} min={0} max={Math.max(ben, 1)} step={1000}
                    fillColor="#10B981"
                  />
                )}

                <SectionTitle label="Plan d'Épargne Retraite" color="#10B981" />

                <SliderField label="Versements PER annuels" value={params.perMontant}
                  onChange={v => set('perMontant', Math.max(0, v))}
                  min={0} max={perPlafond} step={500}
                  fillColor="#10B981"
                  hint={params.perMontant > 0
                    ? `Économie IR estimée : ~${fmt(Math.round(params.perMontant * tmi / 100))}/an`
                    : `Plafond déductible : ${fmt(perPlafond)}`}
                  hintColor={params.perMontant > 0 ? '#10B981' : '#64748b'}
                />

                {params.perMontant > 0 && (
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>Impact PER sur le revenu net</div>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#10B981' }}>
                      +{fmt(Math.round(params.perMontant * tmi / 100))}/an
                    </div>
                    <div style={{ fontSize: '10px', color: '#6ee7b7', marginTop: '2px' }}>
                      Économie IR à TMI {tmi}%
                    </div>
                  </div>
                )}

                {(params.ca !== DEFAULT.ca || params.charges !== DEFAULT.charges || params.situationFam !== DEFAULT.situationFam) && (
                  <button onClick={() => { setParams(DEFAULT); setIsPrefilledFromSim(false) }}
                    style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', background: 'transparent', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', padding: '8px', textAlign: 'center' as const }}>
                    ↺ Réinitialiser les paramètres
                  </button>
                )}
              </RadixTabs.Content>
            </RadixTabs.Root>
          </div>

          {/* ════ ZONE PRINCIPALE ════ */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: '14px', background: '#020617' }}>

            {/* FIX 5 — Bloc résultat hero 3 colonnes */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(109,40,217,0.10) 100%)',
              border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: '20px', padding: '20px 24px',
              display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '24px', alignItems: 'center',
            }}
              className="!grid-cols-1 lg:!grid-cols-[1fr_auto_1fr]">

              {/* Gauche — revenu net */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: '4px' }}>
                  Revenu net estimé
                </div>
                <div style={{ fontSize: '48px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '4px' }}>
                  {fmt(results.best.netAnnuel)}
                </div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                  soit {fmt(Math.round(results.best.netAnnuel / 12))}/mois
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: sc }}>{results.best.forme}</span>
                </div>
              </div>

              {/* Centre — mini barre de décomposition */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', minWidth: '180px' }}>
                <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '10px' }}>
                  <div style={{ width: `${heroChargesPct.toFixed(0)}%`, background: '#dc2626', transition: 'width 300ms' }} />
                  <div style={{ width: `${heroCotisPct.toFixed(0)}%`, background: '#f97316', transition: 'width 300ms' }} />
                  <div style={{ width: `${heroIrPct.toFixed(0)}%`, background: '#eab308', transition: 'width 300ms' }} />
                  <div style={{ flex: 1, background: '#10b981', transition: 'flex 300ms' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                  {[
                    { dot: '#dc2626', label: 'Charges', pct: heroChargesPct },
                    { dot: '#f97316', label: 'Cotis.', pct: heroCotisPct },
                    { dot: '#eab308', label: 'IR', pct: heroIrPct },
                    { dot: '#10b981', label: 'Net', pct: heroNetPct },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: l.dot }} />
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{l.label} {l.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Droite — comparaisons */}
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '8px' }}>
                  Vs autres structures
                </div>
                {results.scored.slice(1).map(r => {
                  const diff = Math.round(results.best.netAnnuel - r.netAnnuel)
                  if (diff <= 0) return null
                  return (
                    <div key={r.forme} style={{ fontSize: '12px', color: '#34d399', fontWeight: 700, marginBottom: '4px' }}>
                      ↑ +{fmt(diff)}/an vs {r.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                    </div>
                  )
                })}
                <div style={{ marginTop: '8px', padding: '6px 12px', borderRadius: '8px', display: 'inline-block', background: sc + '20', border: `1px solid ${sc}40` }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: sc }}>Score {results.best.scoreTotal}/100</span>
                </div>
              </div>
            </div>

            {/* Boutons "Et si..." */}
            <div style={{
              ...cardStyle,
              padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'flex-start',
              overflowX: 'auto', flexWrap: 'wrap' as const,
            }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.08em', flexShrink: 0, marginRight: '4px', paddingTop: '7px' }}>
                Scénarios :
              </span>
              {quickWithImpact.map(q => (
                <button key={q.label} title={q.hint}
                  onClick={() => setParams(prev => ({ ...prev, ...q.apply(prev) }))}
                  style={{
                    flexShrink: 0, padding: '7px 12px', borderRadius: '999px',
                    cursor: 'pointer', transition: 'all 150ms', outline: 'none',
                    border: '1px solid rgba(51,65,85,0.5)', background: '#0a1628',
                    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1px',
                  }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{q.label}</div>
                  {Math.abs(q.impact) > 100 && (
                    <div style={{ fontSize: '10px', fontWeight: 800, color: q.impact > 0 ? '#34d399' : '#f87171' }}>
                      {q.impact > 0 ? '+' : ''}{fmt(Math.round(q.impact))}/an
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* ── FIX 3 — Graphique stacked horizontal bar ── */}
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Décomposition du CA</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {results.best.forme} · Comment votre CA se répartit
                </div>
              </div>

              {/* Ligne de flow CA → Net */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' as const, marginBottom: '14px', fontSize: '11px', fontWeight: 600 }}>
                <span style={{ color: '#60a5fa' }}>CA {fmt(params.ca)}</span>
                {params.charges > 0 && <>
                  <span style={{ color: '#475569' }}>→</span>
                  <span style={{ color: '#f43f5e' }}>−{fmt(params.charges)} charges</span>
                </>}
                <span style={{ color: '#475569' }}>→</span>
                <span style={{ color: '#f97316' }}>−{fmt(results.best.charges)} cotis.</span>
                <span style={{ color: '#475569' }}>→</span>
                <span style={{ color: '#eab308' }}>−{fmt(results.best.ir)} IR</span>
                {results.best.is > 0 && <>
                  <span style={{ color: '#475569' }}>→</span>
                  <span style={{ color: '#a855f7' }}>−{fmt(results.best.is)} IS</span>
                </>}
                <span style={{ color: '#475569' }}>→</span>
                <span style={{ color: '#10b981', fontWeight: 800 }}>={fmt(results.best.netAnnuel)} net</span>
              </div>

              <div style={{ height: '120px' }}>
                <Bar
                  data={{
                    labels: [''],
                    datasets: stackedBarData.datasets,
                  }}
                  options={stackedBarOptions}
                />
              </div>
            </div>

            {/* ── FIX 6 — Tableau comparatif ── */}
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid rgba(51,65,85,0.5)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(15,23,42,0.5)',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Comparatif des structures</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {mode === 'expert' ? 'Mode expert — toutes les colonnes' : 'Mode simplifié'}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15,23,42,0.8)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '0.07em', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>Structure</th>
                      {['Net/an', 'Net/mois', ...(mode === 'expert' ? ['Cotis.', 'IR'] : []), 'TMI', 'Score'].map(h => (
                        <th key={h} style={{ textAlign: 'right', padding: '10px 14px', fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '0.07em', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.scored.map((r, i) => {
                      const isBest = i === 0
                      const isExcluded = r.forme === 'Micro-entreprise' && microExcluded
                      const structTmi = getTMI(r, params.autresRev, partsBase, params.nbEnfants)
                      const tmiPillColor = structTmi <= 11 ? '#34d399' : structTmi <= 30 ? '#fbbf24' : structTmi <= 41 ? '#fb923c' : '#f87171'
                      const tmiPillBg = structTmi <= 11 ? 'rgba(16,185,129,0.12)' : structTmi <= 30 ? 'rgba(245,158,11,0.12)' : structTmi <= 41 ? 'rgba(249,115,22,0.12)' : 'rgba(239,68,68,0.12)'
                      const rsc = structColor(r.forme)
                      const scoreBadgeColor = r.scoreTotal >= 60 ? '#34d399' : r.scoreTotal >= 40 ? '#fbbf24' : '#64748b'
                      const scoreBadgeBg = r.scoreTotal >= 60 ? 'rgba(16,185,129,0.12)' : r.scoreTotal >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)'
                      return (
                        <tr key={r.forme} style={{
                          borderTop: '1px solid rgba(51,65,85,0.35)',
                          borderLeft: isBest && !isExcluded ? `3px solid ${rsc}` : '3px solid transparent',
                          background: isBest && !isExcluded ? rsc + '08' : 'transparent',
                          transition: 'background 150ms',
                        }}>
                          <td style={{ padding: '11px 20px', minWidth: '140px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isExcluded ? '#334155' : rsc, flexShrink: 0 }} />
                              <div>
                                <div style={{
                                  fontSize: '13px', fontWeight: isBest && !isExcluded ? 700 : 500,
                                  color: isExcluded ? '#475569' : isBest ? rsc : '#94a3b8',
                                  textDecoration: isExcluded ? 'line-through' : 'none',
                                }}>
                                  {r.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                                </div>
                                {isBest && !isExcluded && (
                                  <div style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 600 }}>★ Recommandée</div>
                                )}
                                {isExcluded && <div style={{ fontSize: '10px', color: '#f87171', fontWeight: 600 }}>Hors plafond</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '11px 14px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: isExcluded ? '#334155' : isBest ? rsc : '#f1f5f9' }}>
                              {isExcluded ? '—' : fmt(r.netAnnuel)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '11px 14px', fontSize: '12px', color: '#64748b' }}>
                            {isExcluded ? '—' : fmt(Math.round(r.netAnnuel / 12))}
                          </td>
                          {mode === 'expert' && (
                            <>
                              <td style={{ textAlign: 'right', padding: '11px 14px', fontSize: '12px', fontWeight: 700, color: isExcluded ? '#334155' : '#f43f5e' }}>
                                {isExcluded ? '—' : `−${fmt(r.charges)}`}
                              </td>
                              <td style={{ textAlign: 'right', padding: '11px 14px', fontSize: '12px', fontWeight: 700, color: isExcluded ? '#334155' : '#f97316' }}>
                                {isExcluded ? '—' : `−${fmt(r.ir)}`}
                              </td>
                            </>
                          )}
                          <td style={{ textAlign: 'right', padding: '11px 14px' }}>
                            {!isExcluded && (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', background: tmiPillBg, color: tmiPillColor }}>
                                {structTmi}%
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', padding: '11px 14px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: scoreBadgeBg, color: scoreBadgeColor }}>
                              {r.scoreTotal}/100
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mode expert : détail IS + IR */}
              {mode === 'expert' && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(51,65,85,0.35)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>IS barème</div>
                    <div style={{ fontSize: '12px', color: '#a78bfa' }}>15% jusqu&apos;à 42 500 € · 25% au-delà</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>IR tranche marginale</div>
                    <div style={{ fontSize: '12px', color: tmiColor }}>TMI {tmi}% · {partsStr} part{parts > 1 ? 's' : ''}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>Taux effectif global</div>
                    <div style={{ fontSize: '12px', color: '#60a5fa' }}>
                      {params.ca > 0 ? `${((results.best.charges + results.best.ir + (results.best.is || 0)) / params.ca * 100).toFixed(1)}%` : '—'} du CA
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Courbe Breakeven ── */}
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Courbe de rentabilité par CA</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Revenu net selon votre CA — même foyer et charges
                </div>
              </div>
              <div style={{ height: '220px', marginTop: '12px' }}>
                <Line data={breakevenChartConfig} options={breakevenOptions} />
              </div>
            </div>

            {/* ── Recommandation + Ce que ça change ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
              className="!grid-cols-1 lg:!grid-cols-2">

              <div style={{
                background: `linear-gradient(135deg, ${sc}30, ${sc}18)`,
                borderRadius: '16px', padding: '22px',
                boxShadow: `0 4px 20px ${sc}25`,
                border: `1px solid ${sc}40`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', right: '-4rem', top: '-4rem', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: sc, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Structure recommandée
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '3px' }}>
                    {results.best.forme}
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '5px' }}>
                    {fmt(results.best.netAnnuel)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '14px' }}>
                    {fmt(Math.round(results.best.netAnnuel / 12))}/mois net après impôts
                  </div>
                  {gainVsWorst > 500 && (
                    <div style={{ background: 'rgba(255,255,255,0.10)', borderRadius: '10px', padding: '7px 12px', marginBottom: '14px', fontSize: '12px', fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
                      +{fmt(gainVsWorst)}/an vs moins avantageuse
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => router.push('/simulateur')} style={{
                      flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer',
                      border: 'none', fontWeight: 700, fontSize: '12px',
                      background: 'rgba(255,255,255,0.15)', color: '#fff',
                    }}>
                      Analyse complète →
                    </button>
                    <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                      style={{
                        flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.2)',
                        fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.75)',
                        textDecoration: 'none', textAlign: 'center' as const,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      Prendre RDV
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle, padding: '22px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>
                  💡 Ce que ça change concrètement
                </div>
                {[
                  { label: 'Revenu mensuel net', val: fmt(Math.round(results.best.netAnnuel / 12)), color: sc, bg: sc + '18' },
                  { label: 'Charges sociales/an', val: `−${fmt(results.best.charges)}`, color: '#f43f5e', bg: 'rgba(244,63,94,0.08)' },
                  { label: 'IR estimé/an', val: `−${fmt(results.best.ir)}`, color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
                  ...(results.best.is > 0 ? [{ label: 'IS estimé', val: `−${fmt(results.best.is)}`, color: '#a78bfa', bg: 'rgba(139,92,246,0.08)' }] : []),
                  ...(gainVsWorst > 500 ? [{ label: 'Gain vs moins avantageux', val: `+${fmt(gainVsWorst)}/an`, color: '#34d399', bg: 'rgba(16,185,129,0.08)' }] : []),
                  ...(second ? [{ label: `vs ${second.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}`, val: `+${fmt(Math.round(results.best.netAnnuel - second.netAnnuel))}/an`, color: '#60a5fa', bg: 'rgba(59,130,246,0.08)' }] : []),
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 11px', borderRadius: '10px', background: row.bg, marginBottom: '6px',
                    border: '1px solid rgba(51,65,85,0.2)',
                  }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>{row.label}</span>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: row.color }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Résumé automatique ── */}
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', marginBottom: '12px' }}>
                <div style={{ width: '3px', borderRadius: '2px 0 0 2px', background: sc, flexShrink: 0 }} />
                <span style={{
                  fontSize: '11px', fontWeight: 800, color: sc,
                  textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                  background: sc + '18',
                  padding: '3px 10px', borderRadius: '0 6px 6px 0',
                }}>
                  Résumé de ce scénario
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.7', margin: 0 }}>
                {autoSummary}
              </p>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                {['Barème IR 2025', 'Estimation indicative', 'À valider avec votre expert-comptable'].map(tag => (
                  <span key={tag} style={{ fontSize: '10px', color: '#475569', background: '#0a1628', border: '1px solid rgba(51,65,85,0.4)', padding: '3px 8px', borderRadius: '6px' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
