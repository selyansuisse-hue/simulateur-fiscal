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

/* ── Dark theme style helpers ── */
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
  background: '#1e293b',
  borderRadius: '16px',
  border: '1px solid rgba(51,65,85,0.7)',
  boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
}

/* ── SliderField (dark) ── */
function SliderField({ label, value, onChange, min, max, step, hint, hintColor }: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step: number; hint?: string; hintColor?: string
}) {
  const safeMax = Math.max(max, min + 1)
  const sliderVal = Math.min(value, safeMax)
  const pct = safeMax > min ? Math.round((sliderVal - min) / (safeMax - min) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={labelStyle}>{label}</label>
        <input type="number" value={value}
          onChange={e => onChange(Math.max(min, parseFloat(e.target.value) || min))}
          style={{
            width: '100px', textAlign: 'right',
            background: '#0f172a', border: '1px solid #334155',
            borderRadius: '8px', padding: '3px 10px',
            fontSize: '13px', fontWeight: 700, color: '#f1f5f9', outline: 'none',
          }}
        />
      </div>
      <input type="range" min={min} max={safeMax} step={step} value={sliderVal}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
        style={{
          height: '4px', accentColor: '#3B82F6',
          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct}%, #334155 ${pct}%, #334155 100%)`,
        }}
      />
      {hint && (
        <div style={{ fontSize: '10px', marginTop: '4px', color: hintColor || '#64748b', fontWeight: 500 }}>
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

  /* ── Waterfall chart data (floating bars: [yMin, yMax]) ── */
  const waterfallChartData = useMemo(() => {
    const best = results.best
    const cotis = best.charges
    const ir = best.ir
    const is = best.is || 0
    const net = best.netAnnuel
    const ca = Math.max(1, params.ca)

    const rows: { label: string; min: number; max: number; color: string }[] = [
      { label: 'CA', min: 0, max: ca, color: '#3B82F6' },
      { label: '−Cotis.', min: ca - cotis, max: ca, color: '#F43F5E' },
      { label: '−IR', min: ca - cotis - ir, max: ca - cotis, color: '#F97316' },
      ...(is > 0 ? [{ label: '−IS', min: net, max: ca - cotis - ir, color: '#A855F7' }] : []),
      { label: 'Net', min: 0, max: net, color: '#10B981' },
    ]
    return {
      labels: rows.map(r => r.label),
      data: rows.map(r => [r.min, r.max] as [number, number]),
      colors: rows.map(r => r.color),
    }
  }, [results.best, params.ca])

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

  /* ── Chart.js options (dark theme) ── */
  const waterfallOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        callbacks: {
          label: (item: TooltipItem<'bar'>) => {
            const raw = item.raw as [number, number]
            const val = Array.isArray(raw) ? raw[1] - raw[0] : Number(raw)
            return ` ${fmt(Math.abs(val))}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' },
        border: { color: '#334155' },
      },
      y: {
        grid: { color: 'rgba(51,65,85,0.5)' },
        ticks: {
          font: { size: 10 }, color: '#64748b',
          callback: (val) => `${Math.round(Number(val) / 1000)}k€`,
        },
        border: { color: '#334155' },
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

  const waterfallChartConfig = {
    labels: waterfallChartData.labels,
    datasets: [{
      data: waterfallChartData.data,
      backgroundColor: waterfallChartData.colors,
      borderRadius: 4,
      borderSkipped: false as const,
    }],
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

  /* ── Tab trigger style ── */
  const tabTriggerStyle = (val: string): React.CSSProperties => ({
    flex: 1, padding: '8px 4px', fontSize: '10px', fontWeight: 700,
    cursor: 'pointer', border: 'none',
    borderRadius: '8px',
    background: activeTab === val ? '#2563EB' : 'transparent',
    color: activeTab === val ? '#ffffff' : '#64748B',
    transition: 'all 150ms',
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: '2px',
    boxShadow: activeTab === val ? '0 4px 12px rgba(37,99,235,0.35)' : 'none',
  })

  return (
    <>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>

        {/* ── PAGE SUB-HEADER ── */}
        <div style={{
          background: '#1e293b', borderBottom: '1px solid #334155',
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
            {/* Badge meilleure structure */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: structColor(results.best.forme) + '18',
              border: `1px solid ${structColor(results.best.forme)}40`,
              borderRadius: '999px', padding: '5px 12px',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: structColor(results.best.forme) }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: structColor(results.best.forme) }}>
                {results.best.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 800, color: '#fff',
                background: structColor(results.best.forme),
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

        {/* ── KPI BAR STICKY ── */}
        <div style={{
          position: 'sticky', top: '64px', zIndex: 40,
          background: 'rgba(15,23,42,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #334155',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', maxWidth: '1400px', margin: '0 auto' }}
            className="!grid-cols-2 lg:!grid-cols-4">
            {[
              {
                label: 'Revenu net annuel',
                value: fmt(results.best.netAnnuel),
                sub: `${fmt(Math.round(results.best.netAnnuel / 12))}/mois`,
                color: structColor(results.best.forme),
                accentColor: structColor(results.best.forme),
                icon: '💰', delta: kpiDeltaVal,
              },
              {
                label: 'TMI estimé',
                value: `${tmi}%`,
                sub: tmi <= 11 ? 'Tranche basse ✓' : tmi <= 30 ? 'Intermédiaire' : 'Haute ⚠',
                color: tmiColor, accentColor: tmiColor, icon: '📊', delta: null,
              },
              {
                label: 'Gain vs moins avantageux',
                value: `↑ +${fmt(gainVsWorst)}`,
                sub: 'par an',
                color: '#34d399', accentColor: '#10B981', icon: '📈', delta: null,
              },
              {
                label: 'Résultat avant rémunération',
                value: fmt(ben),
                sub: 'CA − charges − amort',
                color: '#94a3b8', accentColor: '#64748b', icon: '📋', delta: null,
              },
            ].map((kpi, i) => (
              <div key={i} style={{
                padding: '10px 16px 12px',
                borderRight: i < 3 ? '1px solid rgba(51,65,85,0.5)' : 'none',
                display: 'flex', alignItems: 'center', gap: '10px',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Top accent bar per structure */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: kpi.accentColor, opacity: 0.85 }} />
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: kpi.color + '18', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '15px', flexShrink: 0,
                  border: `1px solid ${kpi.color}25`,
                }}>
                  {kpi.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '1px' }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: kpi.color, letterSpacing: '-0.03em', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' as const }}>
                    {kpi.value}
                    {kpi.delta !== null && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
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
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {kpi.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CORPS PRINCIPAL ── */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '0' }}
          className="!grid-cols-1 lg:!grid-cols-[300px_1fr]">

          {/* ════ SIDEBAR AVEC TABS ════ */}
          <div style={{ background: '#162032', borderRight: '1px solid #334155' }}
            className="lg:sticky lg:top-[172px] lg:overflow-y-auto lg:max-h-[calc(100vh-172px)]">

            <RadixTabs.Root value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
              <RadixTabs.List style={{
                display: 'flex', borderBottom: '1px solid #334155',
                background: '#0f172a', position: 'sticky' as const, top: 0, zIndex: 10,
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
                      background: activeTab === tab.value ? 'rgba(255,255,255,0.15)' : '#1e293b',
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
                  hint={microExcluded ? `⚠ Micro exclue (>${fmt(results.microPlafond)})` : `✓ Micro possible (≤ ${fmt(results.microPlafond)})`}
                  hintColor={microExcluded ? '#F59E0B' : '#10B981'}
                />

                <SectionTitle label="Charges & Investissements" color="#3B82F6" />

                <SliderField label="Charges d'exploitation" value={params.charges}
                  onChange={v => set('charges', v)}
                  min={0} max={Math.max(Math.round(params.ca * 0.9), 10000)} step={1000}
                  hint={params.ca > 0 ? `${(params.charges / params.ca * 100).toFixed(0)}% du CA` : undefined}
                />

                <SliderField label="Amortissements" value={params.amort}
                  onChange={v => set('amort', v)} min={0} max={200000} step={500}
                />

                {/* Résultat indicator */}
                <div style={{
                  background: seuil60k ? 'rgba(245,158,11,0.1)' : 'rgba(37,99,235,0.1)',
                  border: `1px solid ${seuil60k ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}`,
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
                  hint="Salaire conjoint, revenus fonciers..."
                />

                <SliderField label="Capital social (société IS)" value={params.capital}
                  onChange={v => set('capital', v)} min={1000} max={500000} step={1000}
                  hint={`Seuil dividendes TNS : ${fmt(params.capital * 0.10)}`}
                  hintColor="#64748b"
                />
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
                        background: params.strategie === val ? 'rgba(16,185,129,0.12)' : '#1e293b',
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
                  />
                )}

                <SectionTitle label="Plan d'Épargne Retraite" color="#10B981" />

                <SliderField label="Versements PER annuels" value={params.perMontant}
                  onChange={v => set('perMontant', Math.max(0, v))}
                  min={0} max={perPlafond} step={500}
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

                {/* Réinitialiser */}
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
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>

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
                    border: '1px solid #334155', background: '#0f172a',
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

            {/* ── Graphique Waterfall ── */}
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Décomposition du CA</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {results.best.forme} · Cascade CA → Prélèvements → Net
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                  {[
                    { color: '#3B82F6', label: 'CA' },
                    { color: '#F43F5E', label: 'Cotis.' },
                    { color: '#F97316', label: 'IR' },
                    ...(results.best.is > 0 ? [{ color: '#A855F7', label: 'IS' }] : []),
                    { color: '#10B981', label: 'Net' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: '200px', marginTop: '12px' }}>
                <Bar data={waterfallChartConfig} options={waterfallOptions} />
              </div>
            </div>

            {/* ── Tableau comparatif ── */}
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Comparatif des structures</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {mode === 'expert' ? 'Mode expert — toutes les colonnes' : 'Mode simplifié'}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15,23,42,0.6)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Structure</th>
                      {['Net/an', 'Net/mois', ...(mode === 'expert' ? ['Cotis.', 'IR'] : []), 'TMI', 'Score'].map(h => (
                        <th key={h} style={{ textAlign: 'right', padding: '10px 14px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.scored.map((r, i) => {
                      const isBest = i === 0
                      const isExcluded = r.forme === 'Micro-entreprise' && microExcluded
                      const structTmi = getTMI(r, params.autresRev, partsBase, params.nbEnfants)
                      const tmiPillColor = structTmi <= 11 ? '#34d399' : structTmi <= 30 ? '#fbbf24' : structTmi <= 41 ? '#fb923c' : '#f87171'
                      const tmiPillBg = structTmi <= 11 ? 'rgba(16,185,129,0.15)' : structTmi <= 30 ? 'rgba(245,158,11,0.15)' : structTmi <= 41 ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)'
                      const sc = structColor(r.forme)
                      const scoreBadgeColor = r.scoreTotal >= 60 ? '#34d399' : r.scoreTotal >= 40 ? '#fbbf24' : '#64748b'
                      const scoreBadgeBg = r.scoreTotal >= 60 ? 'rgba(16,185,129,0.12)' : r.scoreTotal >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)'
                      return (
                        <tr key={r.forme} style={{
                          borderTop: '1px solid rgba(51,65,85,0.6)',
                          background: isBest && !isExcluded ? sc + '10' : 'transparent',
                        }}>
                          <td style={{ padding: '11px 20px', minWidth: '140px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isExcluded ? '#334155' : sc, flexShrink: 0 }} />
                              <div>
                                <div style={{
                                  fontSize: '13px', fontWeight: isBest && !isExcluded ? 700 : 500,
                                  color: isExcluded ? '#475569' : isBest ? sc : '#94a3b8',
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
                            <span style={{ fontSize: '14px', fontWeight: 800, color: isExcluded ? '#334155' : isBest ? sc : '#f1f5f9' }}>
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
                background: `linear-gradient(135deg, ${structColor(results.best.forme)}, ${structColor(results.best.forme)}CC)`,
                borderRadius: '16px', padding: '22px',
                boxShadow: `0 4px 20px ${structColor(results.best.forme)}40`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', right: '-4rem', top: '-4rem', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px' }}>
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
                    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '7px 12px', marginBottom: '14px', fontSize: '12px', fontWeight: 800, color: '#fff' }}>
                      +{fmt(gainVsWorst)}/an vs moins avantageuse
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => router.push('/simulateur')} style={{
                      flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer',
                      border: 'none', fontWeight: 700, fontSize: '12px',
                      background: 'rgba(255,255,255,0.18)', color: '#fff',
                    }}>
                      Analyse complète →
                    </button>
                    <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                      style={{
                        flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.25)',
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
                  { label: 'Revenu mensuel net', val: fmt(Math.round(results.best.netAnnuel / 12)), color: structColor(results.best.forme), bg: structColor(results.best.forme) + '18' },
                  { label: 'Charges sociales/an', val: `−${fmt(results.best.charges)}`, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
                  { label: 'IR estimé/an', val: `−${fmt(results.best.ir)}`, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
                  ...(results.best.is > 0 ? [{ label: 'IS estimé', val: `−${fmt(results.best.is)}`, color: '#a78bfa', bg: 'rgba(139,92,246,0.1)' }] : []),
                  ...(gainVsWorst > 500 ? [{ label: 'Gain vs moins avantageux', val: `+${fmt(gainVsWorst)}/an`, color: '#34d399', bg: 'rgba(16,185,129,0.1)' }] : []),
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 11px', borderRadius: '10px', background: row.bg, marginBottom: '6px',
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
                <div style={{ width: '3px', borderRadius: '2px 0 0 2px', background: structColor(results.best.forme), flexShrink: 0 }} />
                <span style={{
                  fontSize: '11px', fontWeight: 800, color: structColor(results.best.forme),
                  textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                  background: structColor(results.best.forme) + '18',
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
                  <span key={tag} style={{ fontSize: '10px', color: '#475569', background: '#0f172a', border: '1px solid #334155', padding: '3px 8px', borderRadius: '6px' }}>
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
