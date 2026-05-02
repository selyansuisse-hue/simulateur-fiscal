'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import * as RadixTabs from '@radix-ui/react-tabs'
import { fmt } from '@/lib/utils'
import { calcMicro, calcEIReel, calcEURL, calcSASU, scoreMulti } from '@/lib/fiscal/structures'
import { calcPartsTotal, tmiRate } from '@/lib/fiscal/ir'
import { MICRO_PLAFONDS, SimParams, StructureResult, Secteur } from '@/lib/fiscal/types'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

/* ── Types ── */
interface ExplorerParams {
  ca: number; charges: number; amort: number; capital: number
  situationFam: 'celib' | 'marie' | 'pacse' | 'veuf'
  nbEnfants: number; autresRev: number
  strategie: 'max' | 'reserve'; reserveVoulue: number
  perMontant: number; secteur: Secteur
}

const DEFAULT: ExplorerParams = {
  ca: 80000, charges: 10000, amort: 2000, capital: 10000,
  situationFam: 'marie', nbEnfants: 0, autresRev: 0,
  strategie: 'max', reserveVoulue: 0, perMontant: 0, secteur: 'services_bic',
}

const QUICK_DEFS: { label: string; hint: string; apply: (p: ExplorerParams) => Partial<ExplorerParams> }[] = [
  { label: 'CA × 2', hint: "Doubler le CA", apply: (p) => ({ ca: p.ca * 2 }) },
  { label: 'Se marier', hint: '2 parts fiscales', apply: () => ({ situationFam: 'marie' as const }) },
  { label: '2 enfants', hint: '2 enfants', apply: () => ({ nbEnfants: 2 }) },
  { label: 'PER 3k€', hint: 'Verser 3 000€ PER', apply: () => ({ perMontant: 3000 }) },
  { label: '+20% charges', hint: 'Charges +20%', apply: (p) => ({ charges: Math.round(p.charges * 1.2) }) },
]

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6',
  'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B',
  'Micro-entreprise': '#94A3B8',
}
const STRUCT_REM: Record<string, string> = {
  'SAS / SASU': 'Assimilé salarié — salaire via fiche de paie. Charges patronales + salariales ~75% du brut. Pas de Madelin possible. Dividendes au PFU 30%.',
  'EURL / SARL (IS)': 'Gérant TNS — rémunération soumise aux cotisations SSI (~35-45%). Bénéfice restant imposé à l\'IS (15% jusqu\'à 42 500€, 25% au-delà). Dividendes au PFU 30%.',
  'EI (réel normal)': 'Bénéfice net (CA − charges − cotisations) imposé directement à l\'IR en BIC/BNC. Pas de séparation entre patrimoine personnel et professionnel.',
  'Micro-entreprise': 'Abattement forfaitaire 50% (BIC) ou 34% (BNC) sur CA brut. Aucune déduction de charges réelles possible. Cotisations calculées sur le CA (22%).',
}

function sc(forme: string) { return STRUCT_COLORS[forme] ?? '#64748B' }

/* ── buildSimParams ── */
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
    autresRev: p.autresRev, prevoy: 'min', priorite: 'equilibre',
    situation: 'creation', secteur: p.secteur, formeActuelle: 'none',
    reserves: 0, remActuelle: 0, stratActif: p.strategie,
    reserveVoulue: p.reserveVoulue, stratRaison: 'invest',
    perActif: p.perMontant > 0 ? 'oui' : 'non', perMontant: p.perMontant,
    mutuelleMontant: 0, prevoyanceMontant: 0,
  }
}

/* ── SliderField ── */
function SliderField({ label, value, onChange, min, max, step, hint, hintColor, fillColor }: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step: number; hint?: string; hintColor?: string; fillColor?: string
}) {
  const safeMax = Math.max(max, min + 1)
  const sv = Math.min(value, safeMax)
  const pct = safeMax > min ? ((sv - min) / (safeMax - min) * 100) : 0
  const fill = fillColor || '#3B82F6'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{label}</label>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '7px', padding: '2px 9px', fontSize: '12px', fontWeight: 700, color: '#f1f5f9', minWidth: '72px', textAlign: 'right' as const }}>
          {fmt(value)}
        </div>
      </div>
      <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '6px', borderRadius: '999px',
          background: `linear-gradient(to right,${fill} 0%,${fill} ${pct}%,#1e293b ${pct}%,#1e293b 100%)`,
          border: '1px solid rgba(51,65,85,0.4)',
        }} />
        <input type="range" min={min} max={safeMax} step={step} value={sv}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: '6px', opacity: 0, cursor: 'pointer', zIndex: 1 }} />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 8px)`, width: '16px', height: '16px',
          borderRadius: '50%', background: '#fff', border: `2px solid ${fill}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)', pointerEvents: 'none',
        }} />
      </div>
      {hint && <div style={{ fontSize: '10px', marginTop: '5px', color: hintColor || '#64748b', fontWeight: 500 }}>{hint}</div>}
    </div>
  )
}

function SectionLabel({ label, color = '#3B82F6' }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
      <div style={{ width: '3px', height: '14px', background: color, borderRadius: '2px', marginRight: '9px', flexShrink: 0 }} />
      <span style={{ fontSize: '10px', fontWeight: 800, color, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{label}</span>
    </div>
  )
}

/* ── WaterfallBar — barre horizontale empilée CSS ── */
function WaterfallBar({ ca, chargesE, cotis, ir, is: isV, net, h = 28 }: {
  ca: number; chargesE: number; cotis: number; ir: number; is: number; net: number; h?: number
}) {
  const total = Math.max(ca, 1)
  const p = (v: number) => `${Math.max(0, Math.min(70, v / total * 100)).toFixed(1)}%`
  return (
    <div style={{ display: 'flex', height: `${h}px`, borderRadius: '6px', overflow: 'hidden', gap: '1px' }}>
      {chargesE > 0 && <div style={{ width: p(chargesE), background: '#dc2626', minWidth: '2px' }} />}
      <div style={{ width: p(cotis), background: '#f97316', minWidth: '2px' }} />
      <div style={{ width: p(ir), background: '#eab308', minWidth: '2px' }} />
      {isV > 0 && <div style={{ width: p(isV), background: '#a855f7', minWidth: '2px' }} />}
      <div style={{ flex: 1, background: '#10b981', minWidth: '4px' }} />
    </div>
  )
}

function TmiBar({ tmi }: { tmi: number }) {
  const pct = tmi === 0 ? 2 : tmi <= 11 ? 18 : tmi <= 30 ? 44 : tmi <= 41 ? 72 : 92
  const color = tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : tmi <= 41 ? '#f97316' : '#ef4444'
  return (
    <div style={{ height: '5px', borderRadius: '999px', background: '#1e293b', overflow: 'hidden', marginTop: '5px' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: `linear-gradient(to right,#10b981,${color})` }} />
    </div>
  )
}

/* ── Toggle ── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: '38px', height: '21px', borderRadius: '999px', cursor: 'pointer', border: 'none',
      position: 'relative' as const, background: on ? '#10b981' : '#334155', transition: 'background 200ms', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: '2px', left: on ? '18px' : '2px',
        width: '17px', height: '17px', borderRadius: '50%', background: '#fff', transition: 'left 200ms',
      }} />
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════ PAGE ══ */
export default function ExplorerPage() {
  const [params, setParams] = useState<ExplorerParams>(DEFAULT)
  const [isPrefilledFromSim, setIsPrefilledFromSim] = useState(false)
  const [activeTab, setActiveTab] = useState<'params' | 'decomp' | 'compare' | 'leviers'>('params')
  const [selectedForme, setSelectedForme] = useState<string | null>(null)
  /* leviers */
  const [leverPer, setLeverPer] = useState(0)
  const [leverKm, setLeverKm] = useState(0)
  const [leverDomicile, setLeverDomicile] = useState(false)
  const [leverMadelin, setLeverMadelin] = useState(0)
  const [flashKpi, setFlashKpi] = useState(false)
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (Object.keys(upd).length > 0) { setParams(prev => ({ ...prev, ...upd })); setIsPrefilledFromSim(true) }
  }, [])

  const set = useCallback(<K extends keyof ExplorerParams>(key: K, value: ExplorerParams[K]) => {
    setParams(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'ca' && next.charges > Number(value) * 0.9) next.charges = Math.round(Number(value) * 0.4)
      if (key === 'strategie' && value === 'max') next.reserveVoulue = 0
      return next
    })
  }, [])

  const results = useMemo(() => {
    const p = buildSimParams(params)
    const micro = calcMicro(p)
    const all: StructureResult[] = [calcEIReel(p), calcEURL(p), calcSASU(p), ...(micro ? [micro] : [])]
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

  const activeResult: StructureResult = useMemo(() =>
    results.scored.find(r => r.forme === selectedForme) || results.best,
    [selectedForme, results])

  const tmi = Math.round(tmiRate(
    (activeResult.baseIR ?? activeResult.bNet ?? activeResult.ben ?? 0) + params.autresRev,
    partsBase, params.nbEnfants
  ) * 100)

  const worst = results.scored[results.scored.length - 1]
  const gainVsWorst = results.best.netAnnuel - (worst?.netAnnuel || 0)
  const activeColor = sc(activeResult.forme)
  const isTNS = activeResult.forme !== 'SAS / SASU'

  const leverImpact = useMemo(() => {
    let x = 0
    x += Math.round(leverPer * tmi / 100)
    const ikDed = Math.round(leverKm * 0.636)
    x += Math.round(ikDed * (isTNS ? (tmi / 100 + 0.12) : tmi / 100))
    if (leverDomicile) x += Math.round(600 * (isTNS ? (tmi / 100 + 0.10) : tmi / 100))
    if (isTNS && leverMadelin > 0) x += Math.round(leverMadelin * tmi / 100)
    return x
  }, [leverPer, leverKm, leverDomicile, leverMadelin, tmi, isTNS])

  const leverNet = activeResult.netAnnuel + leverImpact

  useEffect(() => {
    if (leverImpact > 0) {
      setFlashKpi(true)
      if (flashRef.current) clearTimeout(flashRef.current)
      flashRef.current = setTimeout(() => setFlashKpi(false), 700)
    }
  }, [leverImpact])

  const quickWithImpact = useMemo(() => QUICK_DEFS.map(q => {
    const np = { ...params, ...q.apply(params) }
    const sp2 = buildSimParams(np)
    const micro2 = calcMicro(sp2)
    const all2: StructureResult[] = [calcEIReel(sp2), calcEURL(sp2), calcSASU(sp2), ...(micro2 ? [micro2] : [])]
    const sc2 = scoreMulti(all2, 'equilibre'); sc2.sort((a, b) => b.scoreTotal - a.scoreTotal)
    return { ...q, impact: (sc2[0]?.netAnnuel || 0) - results.best.netAnnuel }
  }), [params, results.best.netAnnuel])

  const coutTotal = activeResult.charges + activeResult.ir + (activeResult.is || 0)
  const coutPct = params.ca > 0 ? (coutTotal / params.ca * 100).toFixed(0) : '0'

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 28px 8px 10px', borderRadius: '9px',
    border: '1px solid #334155', background: '#0f172a',
    fontSize: '12px', fontWeight: 600, color: '#e2e8f0',
    cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', colorScheme: 'dark',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px',
  }

  const cardBg: React.CSSProperties = { background: '#0c1525', border: '1px solid rgba(51,65,85,0.5)', borderRadius: '14px' }

  const tabStyle = (val: string): React.CSSProperties => ({
    flex: 1, padding: '8px 2px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', border: 'none',
    borderRadius: '7px', background: activeTab === val ? 'rgba(51,65,85,0.9)' : 'transparent',
    color: activeTab === val ? '#f1f5f9' : '#64748B', transition: 'all 150ms',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '2px',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  })

  /* waterfall rows for decomp */
  const wfRows = useMemo(() => [
    { label: 'CA total', val: params.ca, color: '#60a5fa', barColor: 'rgba(29,78,216,0.35)', sign: '' },
    ...(params.charges > 0 ? [{ label: 'Charges exploit.', val: params.charges, color: '#f87171', barColor: 'rgba(220,38,38,0.25)', sign: '−' }] : []),
    { label: 'Cotisations', val: activeResult.charges, color: '#fb923c', barColor: 'rgba(249,115,22,0.25)', sign: '−' },
    { label: 'IR', val: activeResult.ir, color: '#fbbf24', barColor: 'rgba(234,179,8,0.2)', sign: '−' },
    ...(activeResult.is > 0 ? [{ label: 'IS société', val: activeResult.is, color: '#c084fc', barColor: 'rgba(168,85,247,0.2)', sign: '−' }] : []),
    { label: 'Revenu net', val: activeResult.netAnnuel, color: '#34d399', barColor: 'rgba(16,185,129,0.2)', sign: '=' },
  ], [params.ca, params.charges, activeResult])

  return (
    <>
      <style>{`
        html, body { background: #020617 !important; }
        input[type=range]::-webkit-slider-thumb { opacity: 0; }
        input[type=range]::-moz-range-thumb { opacity: 0; }
        @keyframes kpiFlash { 0%,100%{} 40%{color:#4ade80;} }
        .kpi-flash { animation: kpiFlash 700ms ease; }
      `}</style>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>

        {/* ── SUB-HEADER ── */}
        <div style={{ background: '#0a1628', borderBottom: '1px solid rgba(51,65,85,0.5)', padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Explorateur de scénarios</h1>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>Résultats mis à jour instantanément</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isPrefilledFromSim && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#60a5fa', background: '#1e3a5f', border: '1px solid #1d4ed880', padding: '4px 10px', borderRadius: '999px' }}>
                ✓ Pré-rempli depuis simulation
              </span>
            )}
            <Link href="/simulateur" style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff' }}>
              Simulateur complet →
            </Link>
          </div>
        </div>

        {/* ── STRUCTURE PILLS ── */}
        <div style={{ background: '#080f1e', borderBottom: '1px solid rgba(51,65,85,0.4)', padding: '10px 24px', overflowX: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '8px', alignItems: 'center', minWidth: 'max-content' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.07em', flexShrink: 0, marginRight: '4px' }}>Analyser :</span>
            {results.scored.map((r, i) => {
              const rsc = sc(r.forme)
              const isActive = selectedForme === null ? i === 0 : selectedForme === r.forme
              const isExcl = r.forme === 'Micro-entreprise' && microExcluded
              return (
                <button key={r.forme} disabled={isExcl}
                  onClick={() => setSelectedForme(isActive ? null : r.forme)}
                  style={{
                    padding: '6px 14px', borderRadius: '12px', cursor: isExcl ? 'not-allowed' : 'pointer',
                    border: `1.5px solid ${isActive ? rsc : 'rgba(51,65,85,0.5)'}`,
                    background: isActive ? rsc + '22' : 'rgba(15,23,42,0.5)',
                    display: 'flex', alignItems: 'center', gap: '7px',
                    opacity: isExcl ? 0.4 : 1, transition: 'all 150ms',
                    boxShadow: isActive ? `0 0 12px ${rsc}30` : 'none',
                  }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isExcl ? '#334155' : rsc, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 500, color: isActive ? rsc : '#94a3b8', whiteSpace: 'nowrap' as const }}>
                    {r.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 7px', borderRadius: '999px', background: isActive ? rsc : 'rgba(51,65,85,0.4)', color: isActive ? '#fff' : '#64748b' }}>
                    {r.scoreTotal}/100
                  </span>
                  {i === 0 && <span style={{ fontSize: '9px', color: '#fbbf24' }}>★</span>}
                  {isExcl && <span style={{ fontSize: '9px', color: '#f87171' }}>hors plafond</span>}
                </button>
              )
            })}
            <span style={{ fontSize: '10px', color: '#2d3f55', whiteSpace: 'nowrap' as const }}>· Triées par score</span>
          </div>
        </div>

        {/* ── KPI GRID STICKY ── */}
        <div style={{ position: 'sticky', top: '64px', zIndex: 40, background: 'rgba(2,6,23,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', maxWidth: '1400px', margin: '0 auto' }}
            className="!grid-cols-2 lg:!grid-cols-4">

            {/* KPI 1 — Revenu net */}
            <div style={{ padding: '11px 18px 13px', borderRight: '1px solid rgba(51,65,85,0.3)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: activeColor }} />
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: '3px' }}>Revenu net annuel</div>
              <div className={flashKpi ? 'kpi-flash' : ''} style={{ fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '2px' }}>
                {fmt(leverNet)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{fmt(Math.round(leverNet / 12))}/mois</div>
              {gainVsWorst > 500 && <div style={{ fontSize: '10px', fontWeight: 700, color: '#4ade80', marginTop: '3px' }}>+{fmt(gainVsWorst)}/an vs moins avantageux</div>}
              {leverImpact > 0 && <div style={{ fontSize: '10px', color: '#34d399', marginTop: '2px' }}>⚡ +{fmt(leverImpact)} leviers</div>}
            </div>

            {/* KPI 2 — TMI */}
            <div style={{ padding: '11px 18px 13px', borderRight: '1px solid rgba(51,65,85,0.3)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : tmi <= 41 ? '#f97316' : '#ef4444' }} />
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: '3px' }}>Tranche marginale</div>
              <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '2px', color: tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : tmi <= 41 ? '#f97316' : '#ef4444' }}>
                {tmi}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {tmi <= 11 ? 'Tranche basse ✓' : tmi <= 30 ? 'Intermédiaire' : tmi <= 41 ? 'Haute ⚠' : 'Très haute ⚠'}
              </div>
              <TmiBar tmi={tmi} />
            </div>

            {/* KPI 3 — Coût total */}
            <div style={{ padding: '11px 18px 13px', borderRight: '1px solid rgba(51,65,85,0.3)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#f43f5e' }} />
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: '3px' }}>Prélèvements totaux</div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#f87171', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '2px' }}>{fmt(coutTotal)}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>{coutPct}% du CA</div>
              <div style={{ fontSize: '10px', color: '#475569' }}>
                Cotis.&nbsp;{fmt(activeResult.charges)}&nbsp;·&nbsp;IR&nbsp;{fmt(activeResult.ir)}{activeResult.is > 0 ? `·IS ${fmt(activeResult.is)}` : ''}
              </div>
            </div>

            {/* KPI 4 — Structure */}
            <div style={{ padding: '11px 18px 13px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: activeColor }} />
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: '3px' }}>Structure analysée</div>
              <div style={{ fontSize: '17px', fontWeight: 900, color: activeColor, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: '4px' }}>
                {activeResult.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: activeColor + '22', color: activeColor }}>
                  {activeResult.scoreTotal}/100
                </span>
                <span style={{ fontSize: '10px', color: '#475569' }}>
                  {(results.scored.findIndex(r => r.forme === activeResult.forme) + 1)}ème choix
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── CORPS ── */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '300px 1fr' }}
          className="!grid-cols-1 lg:!grid-cols-[300px_1fr]">

          {/* ═══ SIDEBAR 4 ONGLETS ═══ */}
          <div style={{ background: '#060d1b', borderRight: '1px solid rgba(51,65,85,0.4)' }}
            className="lg:sticky lg:top-[178px] lg:overflow-y-auto lg:max-h-[calc(100vh-178px)]">

            <RadixTabs.Root value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
              <RadixTabs.List style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                borderBottom: '1px solid rgba(51,65,85,0.4)',
                background: '#020617', padding: '4px', position: 'sticky' as const, top: 0, zIndex: 10,
              }}>
                {[
                  { value: 'params', label: 'Params' },
                  { value: 'decomp', label: 'Décomp.' },
                  { value: 'compare', label: 'Compar.' },
                  { value: 'leviers', label: 'Leviers' },
                ].map(t => (
                  <RadixTabs.Trigger key={t.value} value={t.value} style={tabStyle(t.value)}>
                    {t.label}
                  </RadixTabs.Trigger>
                ))}
              </RadixTabs.List>

              {/* ── Paramètres ── */}
              <RadixTabs.Content value="params" style={{ padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
                <SectionLabel label="Secteur & CA" color="#3B82F6" />
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Secteur d&apos;activité</label>
                  <select style={selectStyle} value={params.secteur} onChange={e => set('secteur', e.target.value as Secteur)}>
                    <option value="services_bic">Services BIC — abatt. 50%</option>
                    <option value="liberal_bnc">Libéral / BNC — abatt. 34%</option>
                    <option value="commerce">Commerce — abatt. 71%</option>
                    <option value="btp">BTP/artisanat — abatt. 50%</option>
                  </select>
                </div>
                <SliderField label="CA annuel HT" value={params.ca} onChange={v => set('ca', v)}
                  min={0} max={2000000} step={5000} fillColor={activeColor}
                  hint={microExcluded ? `⚠ Micro exclue (>${fmt(results.microPlafond)})` : `✓ Micro possible (≤${fmt(results.microPlafond)})`}
                  hintColor={microExcluded ? '#F59E0B' : '#10B981'}
                />
                <SliderField label="Charges d'exploitation" value={params.charges} onChange={v => set('charges', v)}
                  min={0} max={Math.max(Math.round(params.ca * 0.9), 10000)} step={1000} fillColor="#f43f5e"
                  hint={params.ca > 0 ? `${(params.charges / params.ca * 100).toFixed(0)}% du CA` : undefined}
                />
                <SliderField label="Amortissements" value={params.amort} onChange={v => set('amort', v)}
                  min={0} max={200000} step={500} fillColor="#f97316"
                />
                <div style={{
                  background: seuil60k ? 'rgba(245,158,11,0.08)' : 'rgba(37,99,235,0.07)',
                  border: `1px solid ${seuil60k ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.2)'}`,
                  borderRadius: '10px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: seuil60k ? '#fbbf24' : '#60a5fa', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '2px' }}>
                      Résultat avant rémunération
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 900, color: seuil60k ? '#F59E0B' : '#3b82f6' }}>{fmt(ben)}</div>
                  </div>
                  {seuil60k && <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '3px 9px', fontSize: '10px', fontWeight: 700, color: '#fbbf24' }}>⚡ Zone IS</div>}
                </div>

                <SectionLabel label="Situation familiale" color="#8B5CF6" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Situation</label>
                    <select style={selectStyle} value={params.situationFam} onChange={e => set('situationFam', e.target.value as ExplorerParams['situationFam'])}>
                      <option value="celib">Célibataire</option>
                      <option value="marie">Marié(e)</option>
                      <option value="pacse">Pacsé(e)</option>
                      <option value="veuf">Veuf/veuve</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Enfants</label>
                    <select style={selectStyle} value={params.nbEnfants} onChange={e => set('nbEnfants', parseInt(e.target.value))}>
                      {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? 'Aucun' : `${n} enfant${n>1?'s':''}`}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#a78bfa' }}>Parts fiscales</span>
                  <span style={{ fontSize: '17px', fontWeight: 900, color: '#c4b5fd' }}>{partsStr} parts</span>
                </div>
                <SliderField label="Autres revenus (€/an)" value={params.autresRev} onChange={v => set('autresRev', Math.max(0,v))}
                  min={0} max={200000} step={1000} fillColor="#8B5CF6" hint="Salaire conjoint, revenus fonciers..." />

                <SectionLabel label="Stratégie" color="#10B981" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(['max', 'reserve'] as const).map(val => (
                    <button key={val} onClick={() => set('strategie', val)} style={{
                      padding: '9px', borderRadius: '10px', cursor: 'pointer',
                      border: params.strategie === val ? '2px solid #10B981' : '1.5px solid #334155',
                      background: params.strategie === val ? 'rgba(16,185,129,0.1)' : '#0f172a',
                      color: params.strategie === val ? '#34d399' : '#64748b', fontSize: '11px', fontWeight: 700, transition: 'all 150ms',
                    }}>{val === 'max' ? '💰 Tout percevoir' : '🏦 Garder réserves'}</button>
                  ))}
                </div>
                {params.strategie === 'reserve' && (
                  <SliderField label="Montant en réserves" value={params.reserveVoulue} onChange={v => set('reserveVoulue', v)}
                    min={0} max={Math.max(ben,1)} step={1000} fillColor="#10B981" />
                )}
                {(params.ca !== DEFAULT.ca || params.charges !== DEFAULT.charges || params.situationFam !== DEFAULT.situationFam) && (
                  <button onClick={() => { setParams(DEFAULT); setIsPrefilledFromSim(false) }}
                    style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', background: 'transparent', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', padding: '8px', textAlign: 'center' as const }}>
                    ↺ Réinitialiser
                  </button>
                )}
              </RadixTabs.Content>

              {/* ── Décomposition ── */}
              <RadixTabs.Content value="decomp" style={{ padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
                <SectionLabel label={`Décomposition — ${activeResult.forme.replace(' / SARL (IS)','').replace(' / SASU','')}`} color={activeColor} />

                <div style={{ ...cardBg, padding: '14px' }}>
                  {wfRows.map((row, ri) => {
                    const pct = (row.val / Math.max(params.ca, 1) * 100)
                    const isLast = ri === wfRows.length - 1
                    return (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: ri < wfRows.length - 1 ? '7px' : 0 }}>
                        <div style={{ width: '85px', flexShrink: 0, fontSize: '9px', color: '#64748b', textAlign: 'right' as const, fontWeight: 600 }}>{row.label}</div>
                        <div style={{ flex: 1, height: isLast ? '24px' : '18px', background: '#0a1628', borderRadius: '4px', overflow: 'hidden', position: 'relative' as const }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: row.barColor, borderRight: `2px solid ${row.color}`, transition: 'width 250ms', minWidth: '3px' }} />
                        </div>
                        <div style={{ width: '64px', flexShrink: 0, textAlign: 'right' as const, fontSize: '11px', fontWeight: isLast ? 900 : 700, color: row.color }}>
                          {row.sign}{fmt(row.val)}
                        </div>
                        <div style={{ width: '28px', flexShrink: 0, textAlign: 'right' as const, fontSize: '9px', color: '#334155' }}>
                          {pct.toFixed(0)}%
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Barre empilée récap */}
                <WaterfallBar ca={params.ca} chargesE={params.charges} cotis={activeResult.charges}
                  ir={activeResult.ir} is={activeResult.is||0} net={activeResult.netAnnuel} h={32} />
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                  {[
                    ...(params.charges>0?[{dot:'#dc2626',label:'Charges',val:params.charges}]:[]),
                    {dot:'#f97316',label:'Cotis.',val:activeResult.charges},
                    {dot:'#eab308',label:'IR',val:activeResult.ir},
                    ...(activeResult.is>0?[{dot:'#a855f7',label:'IS',val:activeResult.is}]:[]),
                    {dot:'#10b981',label:'Net',val:activeResult.netAnnuel},
                  ].map(l=>(
                    <div key={l.label} style={{ display:'flex',alignItems:'center',gap:'3px' }}>
                      <div style={{ width:'8px',height:'8px',borderRadius:'2px',background:l.dot,flexShrink:0 }} />
                      <span style={{ fontSize:'9px',color:'#64748b' }}>{l.label}</span>
                      <span style={{ fontSize:'9px',fontWeight:700,color:'#94a3b8' }}>{fmt(l.val)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ ...cardBg, padding: '14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: activeColor, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Mode de rémunération
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
                    {STRUCT_REM[activeResult.forme] || ''}
                  </p>
                </div>
              </RadixTabs.Content>

              {/* ── Comparaison ── */}
              <RadixTabs.Content value="compare" style={{ padding: '12px', display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                <SectionLabel label="Toutes les structures" color="#60a5fa" />
                {results.scored.map((r, i) => {
                  const rsc = sc(r.forme)
                  const isActive = r.forme === activeResult.forme
                  const isExcl = r.forme === 'Micro-entreprise' && microExcluded
                  const diff = r.netAnnuel - activeResult.netAnnuel
                  const rCout = r.charges + r.ir + (r.is||0)
                  return (
                    <div key={r.forme} style={{
                      ...cardBg, padding: '12px',
                      borderLeftWidth: isActive ? '3px' : '1px',
                      borderLeftColor: isActive ? rsc : 'rgba(51,65,85,0.4)',
                      background: isActive ? rsc + '0a' : '#0c1525',
                      opacity: isExcl ? 0.5 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: rsc }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: rsc }}>
                            {r.forme.replace(' / SARL (IS)','').replace(' / SASU','')}
                          </span>
                          {i === 0 && <span style={{ fontSize: '9px', color: '#fbbf24' }}>★</span>}
                          {isActive && <span style={{ fontSize: '9px', fontWeight: 700, background: rsc+'30', color: rsc, padding: '1px 5px', borderRadius: '999px' }}>actif</span>}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: r.scoreTotal>=60?'rgba(16,185,129,0.12)':'rgba(245,158,11,0.12)', color: r.scoreTotal>=60?'#34d399':'#fbbf24' }}>
                          {r.scoreTotal}/100
                        </span>
                      </div>
                      {isExcl ? (
                        <div style={{ fontSize: '10px', color: '#f87171' }}>Hors plafond ({fmt(results.microPlafond)})</div>
                      ) : (
                        <>
                          <div style={{ fontSize: '20px', fontWeight: 900, color: rsc, letterSpacing: '-0.02em', marginBottom: '5px' }}>
                            {fmt(r.netAnnuel)}
                            <span style={{ fontSize: '11px', fontWeight: 500, color: '#475569', marginLeft: '5px' }}>{fmt(Math.round(r.netAnnuel/12))}/mois</span>
                          </div>
                          <WaterfallBar ca={params.ca} chargesE={params.charges} cotis={r.charges} ir={r.ir} is={r.is||0} net={r.netAnnuel} h={16} />
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' as const }}>
                            <span style={{ fontSize: '9px', color: '#f87171' }}>Cotis. −{fmt(r.charges)}</span>
                            <span style={{ fontSize: '9px', color: '#fbbf24' }}>IR −{fmt(r.ir)}</span>
                            {r.is>0&&<span style={{ fontSize: '9px', color: '#c084fc' }}>IS −{fmt(r.is)}</span>}
                            <span style={{ fontSize: '9px', color: '#64748b' }}>Total −{fmt(rCout)}</span>
                          </div>
                          {!isActive && Math.abs(diff) > 100 && (
                            <div style={{
                              marginTop: '7px', fontSize: '11px', fontWeight: 700,
                              color: diff>0?'#4ade80':'#f87171',
                              background: diff>0?'rgba(74,222,128,0.08)':'rgba(248,113,113,0.08)',
                              border: `1px solid ${diff>0?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'}`,
                              borderRadius: '7px', padding: '4px 9px',
                            }}>
                              {diff>0?'+':''}{fmt(diff)}/an vs {activeResult.forme.replace(' / SARL (IS)','').replace(' / SASU','')}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </RadixTabs.Content>

              {/* ── Leviers ── */}
              <RadixTabs.Content value="leviers" style={{ padding: '16px', display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
                <SectionLabel label="Leviers d'optimisation" color="#10B981" />
                {leverImpact > 0 && (
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', padding: '9px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>Gain estimé actif</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#4ade80' }}>+{fmt(leverImpact)}/an</span>
                  </div>
                )}

                {/* PER */}
                <div style={{ ...cardBg, padding: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '9px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>Plan d&apos;Épargne Retraite</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Déductible du revenu imposable</div>
                    </div>
                    {tmi >= 30 && <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 6px', borderRadius: '999px', flexShrink: 0 }}>💡 TMI {tmi}%</span>}
                  </div>
                  <SliderField label="Versement annuel" value={leverPer} onChange={setLeverPer} min={0} max={Math.min(10000,perPlafond)} step={500} fillColor="#10B981" />
                  {leverPer>0 && <div style={{ marginTop: '7px', fontSize: '11px', fontWeight: 700, color: '#34d399' }}>Économie IR : −{fmt(Math.round(leverPer*tmi/100))}/an</div>}
                  <p style={{ fontSize: '10px', color: '#475569', marginTop: '5px', lineHeight: 1.6, marginBottom: 0 }}>Réduit votre revenu imposable. Plafond {fmt(perPlafond)}/an.</p>
                </div>

                {/* IK */}
                <div style={{ ...cardBg, padding: '13px' }}>
                  <div style={{ marginBottom: '9px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>Indemnités kilométriques</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Barème 2025 — déductible EI et EURL</div>
                  </div>
                  <SliderField label="km pro/an" value={leverKm} onChange={setLeverKm} min={0} max={20000} step={500} fillColor="#3B82F6" />
                  {leverKm>0 && <div style={{ marginTop: '7px', fontSize: '11px', fontWeight: 700, color: '#60a5fa' }}>Déductible : {fmt(Math.round(leverKm*0.636))} · Éco. ≈{fmt(Math.round(leverKm*0.636*(isTNS?tmi/100+0.12:tmi/100)))}/an</div>}
                  <p style={{ fontSize: '10px', color: '#475569', marginTop: '5px', lineHeight: 1.6, marginBottom: 0 }}>0,636€/km (5CV, 5k–20k km). Déductible du résultat.</p>
                </div>

                {/* Domiciliation */}
                <div style={{ ...cardBg, padding: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>Domiciliation domicile</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Quote-part charges si bureau dédié</div>
                    </div>
                    <Toggle on={leverDomicile} onChange={setLeverDomicile} />
                  </div>
                  {leverDomicile && <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>Économie ≈ +{fmt(Math.round(600*(isTNS?tmi/100+0.10:tmi/100)))}/an</div>}
                  <p style={{ fontSize: '10px', color: '#475569', lineHeight: 1.6, marginBottom: 0 }}>~20% de vos charges domicile (loyer, EDF, internet).</p>
                </div>

                {/* Madelin — TNS uniquement */}
                {isTNS ? (
                  <div style={{ ...cardBg, padding: '13px' }}>
                    <div style={{ marginBottom: '9px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>Contrat Madelin prévoyance</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Déductible BIC/BNC — TNS uniquement</div>
                    </div>
                    <SliderField label="Prime annuelle" value={leverMadelin} onChange={setLeverMadelin} min={0} max={3000} step={100} fillColor="#8B5CF6" />
                    {leverMadelin>0 && <div style={{ marginTop: '7px', fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>Déduction IR : −{fmt(Math.round(leverMadelin*tmi/100))}/an</div>}
                    <p style={{ fontSize: '10px', color: '#475569', marginTop: '5px', lineHeight: 1.6, marginBottom: 0 }}>Arrêt maladie, invalidité, décès — déductible du résultat.</p>
                  </div>
                ) : (
                  <div style={{ ...cardBg, padding: '13px', opacity: 0.45 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Contrat Madelin</div>
                    <div style={{ fontSize: '10px', color: '#475569' }}>Non disponible en SAS/SASU — président assimilé salarié.</div>
                  </div>
                )}

                <p style={{ fontSize: '10px', color: '#2d3f55', textAlign: 'center' as const, lineHeight: 1.5, marginBottom: 0 }}>
                  Estimations indicatives · Barème 2025<br/>À valider avec votre expert-comptable
                </p>
              </RadixTabs.Content>
            </RadixTabs.Root>
          </div>

          {/* ═══ ZONE PRINCIPALE ═══ */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: '14px', background: '#020617' }}>

            {/* Scénarios Et si */}
            <div style={{ background: '#080f1e', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '14px', padding: '11px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginRight: '4px', flexShrink: 0 }}>Et si… :</span>
              {quickWithImpact.map(q => (
                <button key={q.label} title={q.hint}
                  onClick={() => setParams(prev => ({ ...prev, ...q.apply(prev) }))}
                  style={{ padding: '6px 11px', borderRadius: '999px', cursor: 'pointer', border: '1px solid rgba(51,65,85,0.4)', background: '#0a1628', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1px', transition: 'all 150ms' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{q.label}</div>
                  {Math.abs(q.impact) > 100 && (
                    <div style={{ fontSize: '10px', fontWeight: 800, color: q.impact>0?'#34d399':'#f87171' }}>
                      {q.impact>0?'+':''}{fmt(Math.round(q.impact))}/an
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* 2 col — Recommandation + Résumé chiffres */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }} className="!grid-cols-1 lg:!grid-cols-2">

              <div style={{
                background: `linear-gradient(135deg,${activeColor}28,${activeColor}14)`,
                border: `1px solid ${activeColor}40`, borderRadius: '18px', padding: '22px',
                boxShadow: `0 4px 24px ${activeColor}18`, position: 'relative' as const, overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', right: '-3rem', top: '-3rem', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.04) 0%,transparent 65%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' as const }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: activeColor, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '7px' }}>Structure recommandée</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '3px' }}>{results.best.forme}</div>
                  <div style={{ fontSize: '30px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '4px' }}>{fmt(results.best.netAnnuel)}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>{fmt(Math.round(results.best.netAnnuel/12))}/mois net</div>
                  {gainVsWorst > 500 && (
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 10px', marginBottom: '12px', fontSize: '11px', fontWeight: 700, color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                      +{fmt(gainVsWorst)}/an vs moins avantageuse
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link href="/simulateur" style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '12px', background: 'rgba(255,255,255,0.15)', color: '#fff', textDecoration: 'none', textAlign: 'center' as const, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Analyse complète →
                    </Link>
                    <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', textAlign: 'center' as const, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Prendre RDV
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ background: '#0c1525', border: '1px solid rgba(51,65,85,0.5)', borderRadius: '18px', padding: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ width: '3px', height: '14px', background: activeColor, borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: activeColor, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Ce que ça représente</span>
                </div>
                {[
                  { label: 'Revenu mensuel', val: fmt(Math.round(activeResult.netAnnuel/12)), color: activeColor },
                  { label: 'Charges sociales/an', val: `−${fmt(activeResult.charges)}`, color: '#f87171' },
                  { label: 'IR estimé/an', val: `−${fmt(activeResult.ir)}`, color: '#fbbf24' },
                  ...(activeResult.is>0?[{label:'IS estimé',val:`−${fmt(activeResult.is)}`,color:'#c084fc'}]:[]),
                  ...(gainVsWorst>500?[{label:'Gain optimal',val:`+${fmt(gainVsWorst)}/an`,color:'#34d399'}]:[]),
                  ...(leverImpact>0?[{label:'⚡ Leviers estimés',val:`+${fmt(leverImpact)}/an`,color:'#4ade80'}]:[]),
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '8px', marginBottom: '5px', background: 'rgba(51,65,85,0.12)', border: '1px solid rgba(51,65,85,0.15)' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{row.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: row.color }}>{row.val}</span>
                  </div>
                ))}
                <p style={{ fontSize: '10px', color: '#2d3f55', textAlign: 'center' as const, marginTop: '10px', marginBottom: 0, lineHeight: 1.5 }}>
                  Barème IR 2025 · Estimation indicative<br/>À valider avec votre expert-comptable
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
