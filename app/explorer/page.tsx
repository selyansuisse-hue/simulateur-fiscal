'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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
  { label: 'CA × 2', hint: 'Doubler le CA', apply: (p) => ({ ca: p.ca * 2 }) },
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
  'SAS / SASU': 'Assimilé salarié — salaire via fiche de paie. Charges patronales + salariales ~75% du brut. Pas de contrat Madelin possible. Dividendes soumis au PFU 30%.',
  'EURL / SARL (IS)': 'Gérant TNS — rémunération soumise aux cotisations SSI (~35-45%). Bénéfice restant imposé à l\'IS (15% jusqu\'à 42 500€, 25% au-delà). Dividendes au PFU 30%.',
  'EI (réel normal)': 'Bénéfice net (CA − charges − cotisations) imposé directement à l\'IR en BIC/BNC. Pas de séparation entre patrimoine personnel et professionnel.',
  'Micro-entreprise': 'Abattement forfaitaire 50% (BIC) ou 34% (BNC) sur CA brut. Aucune déduction de charges réelles possible. Cotisations calculées sur le CA (22%).',
}
const STRUCT_TYPE: Record<string, string> = {
  'SAS / SASU': 'Assimilé salarié',
  'EURL / SARL (IS)': 'TNS — SSI',
  'EI (réel normal)': 'TNS — IR direct',
  'Micro-entreprise': 'Micro-BIC / BNC',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{label}</label>
        <div style={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, color: '#f1f5f9', minWidth: '80px', textAlign: 'right' as const }}>
          {fmt(value)}
        </div>
      </div>
      <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '8px', borderRadius: '999px',
          background: `linear-gradient(to right,${fill} 0%,${fill} ${pct}%,#1e293b ${pct}%,#1e293b 100%)`,
        }} />
        <input type="range" min={min} max={safeMax} step={step} value={sv}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: '8px', opacity: 0, cursor: 'pointer', zIndex: 1 }} />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 10px)`, width: '20px', height: '20px',
          borderRadius: '50%', background: '#fff', border: `2.5px solid ${fill}`,
          boxShadow: `0 2px 8px rgba(0,0,0,0.4), 0 0 0 3px ${fill}20`, pointerEvents: 'none',
        }} />
      </div>
      {hint && <div style={{ fontSize: '11px', marginTop: '6px', color: hintColor || '#64748b', fontWeight: 500 }}>{hint}</div>}
    </div>
  )
}

function SectionLabel({ label, color = '#3B82F6' }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
      <div style={{ width: '3px', height: '14px', background: color, borderRadius: '2px', marginRight: '10px', flexShrink: 0 }} />
      <span style={{ fontSize: '11px', fontWeight: 800, color, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{label}</span>
    </div>
  )
}

/* ── WaterfallBar — CSS stacked bar ── */
function WaterfallBar({ ca, chargesE, cotis, ir, is: isV, net, h = 24 }: {
  ca: number; chargesE: number; cotis: number; ir: number; is: number; net: number; h?: number
}) {
  const total = Math.max(ca, 1)
  const p = (v: number) => `${Math.max(0, Math.min(72, v / total * 100)).toFixed(1)}%`
  return (
    <div style={{ display: 'flex', height: `${h}px`, borderRadius: '6px', overflow: 'hidden', gap: '1px' }}>
      {chargesE > 0 && <div style={{ width: p(chargesE), background: '#64748b', minWidth: '2px' }} />}
      <div style={{ width: p(cotis), background: '#f97316', minWidth: '2px' }} />
      <div style={{ width: p(ir), background: '#eab308', minWidth: '2px' }} />
      {isV > 0 && <div style={{ width: p(isV), background: '#a855f7', minWidth: '2px' }} />}
      <div style={{ flex: 1, background: '#10b981', minWidth: '4px' }} />
    </div>
  )
}

/* ── TmiTranchesBar — 5 segments + indicator ── */
function TmiTranchesBar({ tmi }: { tmi: number }) {
  const segments = [
    { label: '0%', w: 8, color: '#10b981' },
    { label: '11%', w: 22, color: '#84cc16' },
    { label: '30%', w: 32, color: '#f59e0b' },
    { label: '41%', w: 24, color: '#f97316' },
    { label: '45%', w: 14, color: '#ef4444' },
  ]
  const pos = tmi === 0 ? 3 : tmi <= 11 ? 16 : tmi <= 30 ? 44 : tmi <= 41 ? 74 : 92
  const dotColor = tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : tmi <= 41 ? '#f97316' : '#ef4444'
  return (
    <div style={{ position: 'relative', marginTop: '10px', paddingBottom: '18px' }}>
      <div style={{ display: 'flex', height: '8px', borderRadius: '6px', overflow: 'hidden', gap: '1px' }}>
        {segments.map(s => (
          <div key={s.label} style={{ flex: s.w, background: s.color, opacity: 0.45 }} />
        ))}
      </div>
      <div style={{
        position: 'absolute', top: '-4px', left: `calc(${pos}% - 8px)`,
        width: '16px', height: '16px', borderRadius: '50%',
        background: dotColor, border: '2px solid #020617',
        boxShadow: `0 0 8px ${dotColor}80`, transition: 'left 300ms ease',
      }} />
      <div style={{ display: 'flex', marginTop: '6px' }}>
        {segments.map(s => (
          <div key={s.label} style={{ flex: s.w, fontSize: '8px', textAlign: 'center' as const, color: '#334155', fontWeight: 500 }}>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Toggle ── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: '44px', height: '26px', borderRadius: '999px', cursor: 'pointer', border: 'none',
      position: 'relative' as const, background: on ? '#10b981' : '#334155', transition: 'background 200ms', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: '3px', left: on ? '21px' : '3px',
        width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
        transition: 'left 200ms', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

/* ═══════════════════════════════════════════ PAGE ══ */
export default function ExplorerPage() {
  const [params, setParams] = useState<ExplorerParams>(DEFAULT)
  const [isPrefilledFromSim, setIsPrefilledFromSim] = useState(false)
  const [leftTab, setLeftTab] = useState<'activite' | 'foyer' | 'optim' | 'leviers'>('activite')
  const [rightTab, setRightTab] = useState<'decomp' | 'compare'>('decomp')
  const [selectedForme, setSelectedForme] = useState<string | null>(null)
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
  const activeRank = results.scored.findIndex(r => r.forme === activeResult.forme) + 1

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
    width: '100%', padding: '9px 28px 9px 12px', borderRadius: '10px',
    border: '1px solid #1e3a5f', background: '#0a1628',
    fontSize: '13px', fontWeight: 600, color: '#e2e8f0',
    cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', colorScheme: 'dark',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '12px',
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 6px', fontSize: '12px', fontWeight: active ? 600 : 400,
    color: active ? '#fff' : '#64748b',
    background: active ? 'rgba(51,65,85,0.9)' : 'transparent',
    border: 'none', borderRadius: '9px', cursor: 'pointer',
    transition: 'all 150ms', whiteSpace: 'nowrap' as const,
  })

  const kpiCard: React.CSSProperties = {
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(51,65,85,0.4)',
    borderRadius: '16px', padding: '20px',
    position: 'relative', overflow: 'hidden',
  }

  const leverCard: React.CSSProperties = {
    background: '#080f1e', border: '1px solid rgba(51,65,85,0.4)',
    borderRadius: '14px', padding: '16px',
  }

  const wfRows = useMemo(() => [
    { label: 'CA total', val: params.ca, color: '#3b82f6' },
    ...(params.charges > 0 ? [{ label: 'Charges exploit.', val: params.charges, color: '#64748b' }] : []),
    { label: 'Cotisations soc.', val: activeResult.charges, color: '#f97316' },
    { label: 'Impôt sur le revenu', val: activeResult.ir, color: '#eab308' },
    ...(activeResult.is > 0 ? [{ label: 'IS société', val: activeResult.is, color: '#a855f7' }] : []),
    { label: 'Revenu net', val: activeResult.netAnnuel, color: '#10b981' },
  ], [params.ca, params.charges, activeResult])

  /* ── STRUCT CARD BG ── */
  const structBg: Record<string, { bg: string; border: string }> = {
    'EURL / SARL (IS)': { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)' },
    'SAS / SASU': { bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.30)' },
    'EI (réel normal)': { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
    'Micro-entreprise': { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)' },
  }
  const cs4 = structBg[activeResult.forme] || { bg: 'rgba(15,23,42,0.8)', border: 'rgba(51,65,85,0.4)' }
  const tmiColor = tmi <= 11 ? '#10b981' : tmi <= 30 ? '#f59e0b' : tmi <= 41 ? '#f97316' : '#ef4444'
  const tmiLabel = tmi <= 11 ? 'Tranche basse ✓' : tmi <= 30 ? 'Tranche intermédiaire' : tmi <= 41 ? 'Tranche haute ⚠' : 'Tranche max ⚠'

  return (
    <>
      <style>{`
        html, body { background: #020617 !important; }
        input[type=range]::-webkit-slider-thumb { opacity: 0; }
        input[type=range]::-moz-range-thumb { opacity: 0; }
        @keyframes kpiFlash { 0%,100%{} 40%{color:#4ade80;} }
        .kpi-flash { animation: kpiFlash 700ms ease; }

        .exp-layout {
          display: flex;
          align-items: flex-start;
          max-width: 1400px;
          margin: 0 auto;
        }
        .exp-left {
          width: 42%;
          border-right: 1px solid rgba(51,65,85,0.35);
          min-height: 100vh;
          background: #040b17;
        }
        .exp-right {
          width: 58%;
          position: sticky;
          top: 64px;
          max-height: calc(100vh - 64px);
          overflow-y: auto;
          background: #020617;
          scrollbar-width: thin;
          scrollbar-color: #1e293b transparent;
        }
        .exp-right::-webkit-scrollbar { width: 4px; }
        .exp-right::-webkit-scrollbar-track { background: transparent; }
        .exp-right::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 99px; }

        @media (max-width: 1024px) {
          .exp-layout { flex-direction: column; }
          .exp-left { width: 100%; order: 2; border-right: none; border-top: 1px solid rgba(51,65,85,0.35); min-height: auto; }
          .exp-right { width: 100%; position: static; max-height: none; order: 1; }
        }
      `}</style>

      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#020617' }}>

        {/* ── SUB-HEADER ── */}
        <div style={{ background: '#070f1f', borderBottom: '1px solid rgba(51,65,85,0.5)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' as const }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>Explorateur de scénarios fiscaux</h1>
            <p style={{ fontSize: '11px', color: '#475569', margin: '2px 0 0' }}>Résultats mis à jour en temps réel · Barème IR 2025</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
            {isPrefilledFromSim && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#60a5fa', background: 'rgba(29,78,216,0.15)', border: '1px solid rgba(37,99,235,0.3)', padding: '4px 10px', borderRadius: '999px' }}>
                ✓ Pré-rempli depuis simulation
              </span>
            )}
            <Link href="/simulateur" style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff', display: 'block' }}>
              Simulateur complet →
            </Link>
          </div>
        </div>

        {/* ── STRUCTURE PILLS ── */}
        <div style={{ background: '#060d1b', borderBottom: '1px solid rgba(51,65,85,0.35)', padding: '10px 20px', overflowX: 'auto' as const }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 'max-content' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.07em', flexShrink: 0, marginRight: '6px' }}>Analyser :</span>
            {results.scored.map((r, i) => {
              const rsc = sc(r.forme)
              const isActive = selectedForme === null ? i === 0 : selectedForme === r.forme
              const isExcl = r.forme === 'Micro-entreprise' && microExcluded
              return (
                <button key={r.forme} disabled={isExcl}
                  onClick={() => setSelectedForme(isActive ? null : r.forme)}
                  style={{
                    padding: '8px 16px', borderRadius: '12px', cursor: isExcl ? 'not-allowed' : 'pointer',
                    border: `1.5px solid ${isActive ? rsc + '80' : 'rgba(51,65,85,0.5)'}`,
                    background: isActive ? rsc + '18' : 'rgba(10,22,40,0.7)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    opacity: isExcl ? 0.4 : 1, transition: 'all 200ms',
                    boxShadow: isActive ? `0 0 16px ${rsc}30, 0 2px 8px rgba(0,0,0,0.3)` : 'none',
                  }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isExcl ? '#334155' : rsc, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 500, color: isActive ? '#f1f5f9' : '#64748b', whiteSpace: 'nowrap' as const }}>
                    {r.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', background: isActive ? rsc : 'rgba(51,65,85,0.4)', color: isActive ? '#fff' : '#64748b' }}>
                    {r.scoreTotal}/100
                  </span>
                  {i === 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#fbbf24' }}>★ Recommandée</span>
                  )}
                  {isExcl && <span style={{ fontSize: '9px', color: '#f87171' }}>hors plafond</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ══════ 2-COLUMN LAYOUT ══════ */}
        <div className="exp-layout">

          {/* ═══ LEFT COLUMN — PARAMS ═══ */}
          <div className="exp-left">

            {/* Left tab bar */}
            <div style={{ padding: '12px 16px', background: '#060d1b', borderBottom: '1px solid rgba(51,65,85,0.3)', position: 'sticky' as const, top: '64px', zIndex: 20 }}>
              <div style={{ display: 'flex', background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(51,65,85,0.2)', borderRadius: '12px', padding: '4px', gap: '3px' }}>
                {([
                  { value: 'activite', label: 'Activité' },
                  { value: 'foyer', label: 'Foyer' },
                  { value: 'optim', label: 'Optimisation' },
                  { value: 'leviers', label: 'Leviers' },
                ] as const).map(t => (
                  <button key={t.value} onClick={() => setLeftTab(t.value)} style={tabBtn(leftTab === t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content area */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column' as const, gap: '20px' }}>

              {/* ── ACTIVITÉ ── */}
              {leftTab === 'activite' && (
                <>
                  <SectionLabel label="Secteur & Chiffre d'affaires" color={activeColor} />
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '7px' }}>Secteur d&apos;activité</label>
                    <select style={selectStyle} value={params.secteur} onChange={e => set('secteur', e.target.value as Secteur)}>
                      <option value="services_bic">Services BIC — abattement 50%</option>
                      <option value="liberal_bnc">Libéral / BNC — abattement 34%</option>
                      <option value="commerce">Commerce — abattement 71%</option>
                      <option value="btp">BTP / artisanat — abattement 50%</option>
                    </select>
                  </div>
                  <SliderField label="CA annuel HT" value={params.ca} onChange={v => set('ca', v)}
                    min={0} max={2000000} step={5000} fillColor={activeColor}
                    hint={microExcluded ? `⚠ Micro exclue (plafond ${fmt(results.microPlafond)})` : `✓ Micro possible (CA ≤ ${fmt(results.microPlafond)})`}
                    hintColor={microExcluded ? '#F59E0B' : '#10B981'}
                  />
                  <SliderField label="Charges d'exploitation" value={params.charges} onChange={v => set('charges', v)}
                    min={0} max={Math.max(Math.round(params.ca * 0.9), 10000)} step={1000} fillColor="#64748b"
                    hint={params.ca > 0 ? `${(params.charges / params.ca * 100).toFixed(0)}% du CA` : undefined}
                  />
                  <SliderField label="Amortissements" value={params.amort} onChange={v => set('amort', v)}
                    min={0} max={200000} step={500} fillColor="#f97316"
                  />
                  {/* Ben indicator */}
                  <div style={{
                    background: seuil60k ? 'rgba(245,158,11,0.07)' : 'rgba(37,99,235,0.06)',
                    border: `1px solid ${seuil60k ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.2)'}`,
                    borderRadius: '12px', padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: seuil60k ? '#fbbf24' : '#60a5fa', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '4px' }}>
                        Résultat avant rémunération
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: seuil60k ? '#F59E0B' : '#3b82f6', letterSpacing: '-0.03em' }}>{fmt(ben)}</div>
                    </div>
                    {seuil60k && (
                      <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>
                        ⚡ Zone IS favorable
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── FOYER ── */}
              {leftTab === 'foyer' && (
                <>
                  <SectionLabel label="Situation familiale" color="#8B5CF6" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '7px' }}>Situation</label>
                      <select style={selectStyle} value={params.situationFam} onChange={e => set('situationFam', e.target.value as ExplorerParams['situationFam'])}>
                        <option value="celib">Célibataire</option>
                        <option value="marie">Marié(e)</option>
                        <option value="pacse">Pacsé(e)</option>
                        <option value="veuf">Veuf/veuve</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '7px' }}>Enfants à charge</label>
                      <select style={selectStyle} value={params.nbEnfants} onChange={e => set('nbEnfants', parseInt(e.target.value))}>
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? 'Aucun' : `${n} enfant${n>1?'s':''}`}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa' }}>Parts fiscales calculées</span>
                    <span style={{ fontSize: '26px', fontWeight: 900, color: '#c4b5fd', letterSpacing: '-0.03em' }}>{partsStr}</span>
                  </div>
                  <SliderField label="Autres revenus du foyer (€/an)" value={params.autresRev} onChange={v => set('autresRev', Math.max(0,v))}
                    min={0} max={200000} step={1000} fillColor="#8B5CF6"
                    hint="Salaire conjoint, revenus fonciers, pensions..."
                  />
                </>
              )}

              {/* ── OPTIMISATION ── */}
              {leftTab === 'optim' && (
                <>
                  <SectionLabel label="Stratégie de rémunération" color="#10B981" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {(['max', 'reserve'] as const).map(val => (
                      <button key={val} onClick={() => set('strategie', val)} style={{
                        padding: '13px', borderRadius: '12px', cursor: 'pointer',
                        border: params.strategie === val ? '2px solid #10B981' : '1.5px solid rgba(51,65,85,0.5)',
                        background: params.strategie === val ? 'rgba(16,185,129,0.10)' : 'rgba(10,22,40,0.7)',
                        color: params.strategie === val ? '#34d399' : '#475569',
                        fontSize: '12px', fontWeight: 700, transition: 'all 150ms',
                      }}>
                        {val === 'max' ? '💰 Tout percevoir' : '🏦 Garder réserves'}
                      </button>
                    ))}
                  </div>
                  {params.strategie === 'reserve' && (
                    <SliderField label="Montant en réserves (société)" value={params.reserveVoulue} onChange={v => set('reserveVoulue', v)}
                      min={0} max={Math.max(ben,1)} step={1000} fillColor="#10B981"
                    />
                  )}

                  <div style={{ borderTop: '1px solid rgba(51,65,85,0.3)', paddingTop: '20px' }}>
                    <SectionLabel label="Plan d'épargne retraite (calcul réel)" color="#3B82F6" />
                    <SliderField label="Versement PER annuel" value={params.perMontant} onChange={v => set('perMontant', v)}
                      min={0} max={Math.min(15000, perPlafond)} step={500} fillColor="#3B82F6"
                      hint={`Impact direct sur les calculs. Plafond estimé : ${fmt(perPlafond)}/an`}
                    />
                  </div>

                  <div style={{ borderTop: '1px solid rgba(51,65,85,0.3)', paddingTop: '20px' }}>
                    <SectionLabel label="Scénarios « Et si… »" color="#F59E0B" />
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                      {quickWithImpact.map(q => (
                        <button key={q.label} title={q.hint}
                          onClick={() => setParams(prev => ({ ...prev, ...q.apply(prev) }))}
                          style={{ padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', border: '1px solid rgba(51,65,85,0.4)', background: '#080f1e', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '2px', transition: 'all 150ms' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{q.label}</div>
                          {Math.abs(q.impact) > 100 && (
                            <div style={{ fontSize: '11px', fontWeight: 800, color: q.impact > 0 ? '#34d399' : '#f87171' }}>
                              {q.impact > 0 ? '+' : ''}{fmt(Math.round(q.impact))}/an
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(params.ca !== DEFAULT.ca || params.charges !== DEFAULT.charges || params.situationFam !== DEFAULT.situationFam) && (
                    <button onClick={() => { setParams(DEFAULT); setIsPrefilledFromSim(false) }}
                      style={{ fontSize: '12px', fontWeight: 600, color: '#475569', background: 'transparent', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '10px', cursor: 'pointer', padding: '10px', textAlign: 'center' as const }}>
                      ↺ Réinitialiser les paramètres
                    </button>
                  )}
                </>
              )}

              {/* ── LEVIERS ── */}
              {leftTab === 'leviers' && (
                <>
                  <SectionLabel label="Leviers d'optimisation fiscale" color="#10B981" />

                  {leverImpact > 0 && (
                    <div style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '3px' }}>Gain estimé total</div>
                        <div style={{ fontSize: '11px', color: '#4ade80' }}>Impact combiné des leviers actifs</div>
                      </div>
                      <span style={{ fontSize: '26px', fontWeight: 900, color: '#4ade80', letterSpacing: '-0.03em' }}>+{fmt(leverImpact)}/an</span>
                    </div>
                  )}

                  {/* PER */}
                  <div style={leverCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '3px' }}>Plan d&apos;Épargne Retraite</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Déductible du revenu imposable</div>
                      </div>
                      {tmi >= 30 && <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 8px', borderRadius: '999px', flexShrink: 0 }}>TMI {tmi}% → très efficace</span>}
                    </div>
                    <SliderField label="Versement annuel (estimation)" value={leverPer} onChange={setLeverPer} min={0} max={Math.min(10000, perPlafond)} step={500} fillColor="#10B981" />
                    {leverPer > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.08)', borderRadius: '9px', padding: '8px 12px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Économie IR estimée</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>→ +{fmt(Math.round(leverPer * tmi / 100))}/an net</span>
                      </div>
                    )}
                    <p style={{ fontSize: '10px', color: '#475569', marginTop: '8px', lineHeight: 1.6, marginBottom: 0 }}>Réduit votre revenu imposable. Plafond env. {fmt(perPlafond)}/an.</p>
                  </div>

                  {/* IK */}
                  <div style={leverCard}>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '3px' }}>Indemnités kilométriques</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Barème 2025 — déductible EI et EURL</div>
                    </div>
                    <SliderField label="km professionnels/an" value={leverKm} onChange={setLeverKm} min={0} max={20000} step={500} fillColor="#3B82F6" />
                    {leverKm > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.08)', borderRadius: '9px', padding: '8px 12px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Déductible {fmt(Math.round(leverKm * 0.636))}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>→ +{fmt(Math.round(leverKm * 0.636 * (isTNS ? tmi / 100 + 0.12 : tmi / 100)))}/an net</span>
                      </div>
                    )}
                    <p style={{ fontSize: '10px', color: '#475569', marginTop: '8px', lineHeight: 1.6, marginBottom: 0 }}>0,636€/km (5CV, 5k–20k km). Déductible du résultat imposable.</p>
                  </div>

                  {/* Domiciliation */}
                  <div style={leverCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '3px' }}>Domiciliation bureau à domicile</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Quote-part charges si bureau dédié</div>
                      </div>
                      <Toggle on={leverDomicile} onChange={setLeverDomicile} />
                    </div>
                    {leverDomicile && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.08)', borderRadius: '9px', padding: '8px 12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Économie estimée</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>→ +{fmt(Math.round(600 * (isTNS ? tmi / 100 + 0.10 : tmi / 100)))}/an net</span>
                      </div>
                    )}
                    <p style={{ fontSize: '10px', color: '#475569', lineHeight: 1.6, marginBottom: 0 }}>~20% de vos charges domicile (loyer, EDF, internet). Env. 600€ déductibles/an.</p>
                  </div>

                  {/* Madelin */}
                  {isTNS ? (
                    <div style={leverCard}>
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '3px' }}>Contrat Madelin prévoyance</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Déductible BIC/BNC — TNS uniquement</div>
                      </div>
                      <SliderField label="Prime annuelle" value={leverMadelin} onChange={setLeverMadelin} min={0} max={3000} step={100} fillColor="#8B5CF6" />
                      {leverMadelin > 0 && (
                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139,92,246,0.08)', borderRadius: '9px', padding: '8px 12px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Déduction IR estimée</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>→ +{fmt(Math.round(leverMadelin * tmi / 100))}/an net</span>
                        </div>
                      )}
                      <p style={{ fontSize: '10px', color: '#475569', marginTop: '8px', lineHeight: 1.6, marginBottom: 0 }}>Arrêt maladie, invalidité, décès — déductible du résultat fiscal.</p>
                    </div>
                  ) : (
                    <div style={{ ...leverCard, opacity: 0.45 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>Contrat Madelin</div>
                      <div style={{ fontSize: '11px', color: '#334155' }}>Non disponible en SAS/SASU — président assimilé salarié.</div>
                    </div>
                  )}

                  <p style={{ fontSize: '10px', color: '#1e3a5f', textAlign: 'center' as const, lineHeight: 1.6, marginBottom: 0 }}>
                    Estimations indicatives · Barème 2025<br/>À valider avec votre expert-comptable
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN — RESULTS ═══ */}
          <div className="exp-right">

            {/* ── KPI CARDS 2×2 ── */}
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

              {/* KPI 1 — Revenu net */}
              <div style={{ ...kpiCard, borderTop: `3px solid ${activeColor}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '10px' }}>Revenu net annuel</div>
                <div className={flashKpi ? 'kpi-flash' : ''} style={{ fontSize: '36px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '5px' }}>
                  {fmt(leverNet)}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>{fmt(Math.round(leverNet / 12))} €/mois</div>
                {gainVsWorst > 500 && (
                  <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 10px', display: 'inline-block' }}>
                    +{fmt(gainVsWorst)}/an vs moins avantageux
                  </span>
                )}
                {leverImpact > 0 && (
                  <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '6px', fontWeight: 600 }}>⚡ +{fmt(leverImpact)} leviers actifs</div>
                )}
              </div>

              {/* KPI 2 — TMI */}
              <div style={{ ...kpiCard, borderTop: `3px solid ${tmiColor}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '10px' }}>Tranche marginale</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: tmiColor, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '5px' }}>
                  {tmi}%
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{tmiLabel}</div>
                <TmiTranchesBar tmi={tmi} />
              </div>

              {/* KPI 3 — Prélèvements */}
              <div style={{ ...kpiCard, borderTop: '3px solid #f43f5e' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '10px' }}>Prélèvements totaux</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: '#f87171', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '5px' }}>
                  {fmt(coutTotal)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>{coutPct}% du CA</div>
                <div style={{ fontSize: '11px', color: '#475569', display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                  <span>Cotis. {fmt(activeResult.charges)}</span>
                  <span style={{ color: '#1e3a5f' }}>·</span>
                  <span>IR {fmt(activeResult.ir)}</span>
                  {activeResult.is > 0 && <><span style={{ color: '#1e3a5f' }}>·</span><span>IS {fmt(activeResult.is)}</span></>}
                </div>
              </div>

              {/* KPI 4 — Structure */}
              <div style={{ ...kpiCard, background: cs4.bg, borderColor: cs4.border, borderTop: `3px solid ${activeColor}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '10px' }}>Structure analysée</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: activeColor, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '10px' }}>
                  {activeResult.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '7px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, padding: '3px 10px', borderRadius: '8px', background: 'rgba(51,65,85,0.5)', color: '#fff' }}>
                    {activeResult.scoreTotal}/100
                  </span>
                  {activeRank === 1
                    ? <span style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24' }}>1er choix recommandé ★</span>
                    : <span style={{ fontSize: '11px', color: '#475569' }}>{activeRank}ème choix</span>
                  }
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {STRUCT_TYPE[activeResult.forme] || ''}
                </div>
              </div>
            </div>

            {/* ── RESULT TABS ── */}
            <div style={{ padding: '0 16px 20px' }}>
              <div style={{ display: 'flex', background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(51,65,85,0.2)', borderRadius: '12px', padding: '4px', gap: '3px', marginBottom: '16px' }}>
                {([
                  { value: 'decomp', label: 'Décomposition' },
                  { value: 'compare', label: 'Comparaison' },
                ] as const).map(t => (
                  <button key={t.value} onClick={() => setRightTab(t.value)} style={tabBtn(rightTab === t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── DÉCOMPOSITION ── */}
              {rightTab === 'decomp' && (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
                  {/* Bars */}
                  <div style={{ background: '#070f1f', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '14px', padding: '20px' }}>
                    {wfRows.map((row, ri) => {
                      const pct = (row.val / Math.max(params.ca, 1) * 100)
                      const isLast = ri === wfRows.length - 1
                      return (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: ri < wfRows.length - 1 ? '12px' : 0 }}>
                          <div style={{ width: '130px', flexShrink: 0, fontSize: '11px', color: '#64748b', textAlign: 'right' as const, fontWeight: 500 }}>{row.label}</div>
                          <div style={{ flex: 1, height: isLast ? '14px' : '12px', background: '#0a1628', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, pct)}%`, height: '100%',
                              background: row.color, borderRadius: '999px',
                              transition: 'width 300ms ease',
                              minWidth: row.val > 0 ? '4px' : '0',
                            }} />
                          </div>
                          <div style={{ width: '74px', flexShrink: 0, textAlign: 'right' as const, fontSize: '12px', fontWeight: isLast ? 800 : 600, color: row.color }}>
                            {fmt(row.val)}
                          </div>
                          <div style={{ width: '30px', flexShrink: 0, textAlign: 'right' as const, fontSize: '10px', color: '#334155' }}>
                            {pct.toFixed(0)}%
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Stacked bar + legend */}
                  <div style={{ background: '#070f1f', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '14px', padding: '16px' }}>
                    <WaterfallBar ca={params.ca} chargesE={params.charges} cotis={activeResult.charges}
                      ir={activeResult.ir} is={activeResult.is || 0} net={activeResult.netAnnuel} h={20} />
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginTop: '12px' }}>
                      {[
                        ...(params.charges > 0 ? [{ dot: '#64748b', label: 'Charges', val: params.charges }] : []),
                        { dot: '#f97316', label: 'Cotisations', val: activeResult.charges },
                        { dot: '#eab308', label: 'IR', val: activeResult.ir },
                        ...(activeResult.is > 0 ? [{ dot: '#a855f7', label: 'IS', val: activeResult.is }] : []),
                        { dot: '#10b981', label: 'Net', val: activeResult.netAnnuel },
                      ].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: '10px', color: '#64748b' }}>{l.label}</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{fmt(l.val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mode de rémunération */}
                  <div style={{ background: `${activeColor}08`, border: `1px solid ${activeColor}20`, borderRadius: '14px', padding: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: activeColor, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '10px' }}>
                      Mode de rémunération — {activeResult.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                    </div>
                    <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.8, margin: 0 }}>
                      {STRUCT_REM[activeResult.forme] || ''}
                    </p>
                  </div>
                </div>
              )}

              {/* ── COMPARAISON ── */}
              {rightTab === 'compare' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {results.scored.map((r, i) => {
                    const rsc = sc(r.forme)
                    const isActive = r.forme === activeResult.forme
                    const isExcl = r.forme === 'Micro-entreprise' && microExcluded
                    const diff = r.netAnnuel - activeResult.netAnnuel
                    return (
                      <div key={r.forme} style={{
                        background: isActive ? rsc + '0d' : 'rgba(8,15,30,0.9)',
                        border: `${isActive ? '2px' : '1px'} solid ${isActive ? rsc + '50' : 'rgba(51,65,85,0.4)'}`,
                        borderRadius: '14px', padding: '16px', opacity: isExcl ? 0.5 : 1, transition: 'all 200ms',
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: rsc, flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: rsc }}>
                              {r.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                            </span>
                            {i === 0 && <span style={{ fontSize: '10px', color: '#fbbf24' }}>★</span>}
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: r.scoreTotal >= 60 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: r.scoreTotal >= 60 ? '#34d399' : '#fbbf24' }}>
                            {r.scoreTotal}/100
                          </span>
                        </div>

                        {isExcl ? (
                          <div style={{ fontSize: '11px', color: '#f87171' }}>Hors plafond ({fmt(results.microPlafond)})</div>
                        ) : (
                          <>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: rsc, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '3px' }}>
                              {fmt(r.netAnnuel)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '10px' }}>
                              {fmt(Math.round(r.netAnnuel / 12))}/mois
                            </div>
                            <WaterfallBar ca={params.ca} chargesE={params.charges} cotis={r.charges} ir={r.ir} is={r.is || 0} net={r.netAnnuel} h={10} />

                            {/* Type badge */}
                            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: 'rgba(51,65,85,0.4)', color: '#94a3b8' }}>
                                {STRUCT_TYPE[r.forme] || ''}
                              </span>
                            </div>

                            {/* Delta */}
                            {!isActive && Math.abs(diff) > 100 ? (
                              <div style={{
                                fontSize: '12px', fontWeight: 700, padding: '5px 10px', borderRadius: '8px',
                                background: diff > 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                                color: diff > 0 ? '#4ade80' : '#f87171',
                                border: `1px solid ${diff > 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                                display: 'inline-block',
                              }}>
                                {diff > 0 ? '+' : ''}{fmt(diff)}/an
                              </div>
                            ) : isActive ? (
                              <div style={{ fontSize: '10px', fontWeight: 600, color: rsc, background: rsc + '18', borderRadius: '8px', padding: '4px 10px', display: 'inline-block' }}>
                                Structure active
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── CTA ── */}
            <div style={{ margin: '0 16px 20px', background: `linear-gradient(135deg,${activeColor}1a,${activeColor}0d)`, border: `1px solid ${activeColor}30`, borderRadius: '16px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: activeColor, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '5px' }}>Analyse complète disponible</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '3px' }}>{results.best.forme} — {fmt(results.best.netAnnuel)}/an</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Protection sociale détaillée · Rapport PDF · Simulation sauvegardée</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                <Link href="/simulateur" style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', background: `linear-gradient(135deg,${activeColor},${activeColor}bb)`, color: '#fff', textDecoration: 'none', display: 'block' }}>
                  Analyse complète →
                </Link>
                <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                  style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'block' }}>
                  Prendre RDV
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
