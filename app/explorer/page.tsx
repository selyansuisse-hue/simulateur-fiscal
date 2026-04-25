'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip,
} from 'chart.js'
import type { ChartOptions, TooltipItem } from 'chart.js'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { fmt } from '@/lib/utils'
import { calcMicro, calcEIReel, calcEURL, calcSASU, scoreMulti } from '@/lib/fiscal/structures'
import { calcPartsTotal, tmiRate } from '@/lib/fiscal/ir'
import { MICRO_PLAFONDS, SimParams, StructureResult, Secteur } from '@/lib/fiscal/types'
import Link from 'next/link'

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip)

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

interface Scenario {
  id: string
  name: string
  params: ExplorerParams
  best: string
  bestNet: number
  tmi: number
}

const DEFAULT: ExplorerParams = {
  ca: 80000, charges: 10000, amort: 2000, capital: 10000,
  situationFam: 'marie', nbEnfants: 0, autresRev: 0,
  prevoyance: 'min', strategie: 'max', reserveVoulue: 0, perMontant: 0,
  secteur: 'services_bic',
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
  const ei = calcEIReel(sp)
  const eurl = calcEURL(sp)
  const sasu = calcSASU(sp)
  const all: StructureResult[] = [ei, eurl, sasu, ...(micro ? [micro] : [])]
  const scored = scoreMulti(all, 'equilibre')
  scored.sort((a, b) => b.scoreTotal - a.scoreTotal)
  return scored[0]?.netAnnuel || 0
}

/* ── Presets ── */
const QUICK_DEFS: { label: string; hint: string; apply: (p: ExplorerParams) => Partial<ExplorerParams> }[] = [
  { label: 'CA × 2', hint: "Doubler le chiffre d'affaires", apply: (p) => ({ ca: p.ca * 2 }) },
  { label: 'Se marier', hint: 'Passer à 2 parts fiscales', apply: () => ({ situationFam: 'marie' as const }) },
  { label: '2 enfants', hint: 'Ajouter 2 enfants à charge', apply: () => ({ nbEnfants: 2 }) },
  { label: 'PER 3 000 €', hint: 'Verser 3 000 € au PER', apply: () => ({ perMontant: 3000 }) },
  {
    label: '30% réserve', hint: 'Conserver 30% du résultat', apply: (p) => {
      const ben = p.ca - p.charges - p.amort
      return { strategie: 'reserve' as const, reserveVoulue: Math.round(Math.max(0, ben) * 0.3) }
    },
  },
  { label: '+20% charges', hint: 'Augmenter les charges de 20%', apply: (p) => ({ charges: Math.round(p.charges * 1.2) }) },
]

/* ── SliderRow — light style ── */
function SliderRow({ label, value, min, max, step, onChange, sub, badge }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; sub?: string; badge?: React.ReactNode
}) {
  const sliderVal = Math.min(value, max)
  const pct = max > min ? Math.round((sliderVal - min) / (max - min) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'baseline' }}>
        <label style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
          {label}
          {sub && <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '6px' }}>{sub}</span>}
        </label>
        <input
          type="number" value={value} min={min} step={step}
          onChange={e => onChange(Math.max(min, parseFloat(e.target.value) || min))}
          style={{
            width: '100px', textAlign: 'right', background: '#F8FAFF',
            border: '1px solid #E2E8F0', borderRadius: '8px',
            padding: '3px 8px', color: '#0F172A', fontSize: '13px', fontWeight: 700,
            outline: 'none',
          }}
        />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={sliderVal}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
        style={{
          height: '4px', accentColor: '#3B82F6',
          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct}%, #E2E8F0 ${pct}%, #E2E8F0 100%)`,
        }}
      />
      {badge}
    </div>
  )
}

/* ── Page principale ── */
export default function ExplorerPage() {
  const [params, setParams] = useState<ExplorerParams>(DEFAULT)
  const [isPrefilledFromSim, setIsPrefilledFromSim] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
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
    return { micro, ei, eurl, sasu, scored, best: scored[0], microPlafond: MICRO_PLAFONDS[params.secteur].plafond }
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

  /* ── Scénario optimisé ── */
  const optimise = useMemo(() => {
    const tmiVal = tmi / 100
    const perMax = Math.min(35194, ben * 0.10)
    const perGain = Math.round(perMax * tmiVal)
    const ikGain = Math.round(8000 * 0.636 * 0.15)
    const domGain = 360
    const prevGain = Math.round(ben * 0.02 * 0.15)
    const total = perGain + ikGain + domGain + prevGain
    return { perGain, ikGain, domGain, prevGain, total, netOptimise: Math.round((results.best.netAnnuel || 0) + total) }
  }, [results.best.netAnnuel, tmi, ben])

  /* ── "Et si..." avec impact ── */
  const quickWithImpact = useMemo(() => QUICK_DEFS.map(q => {
    const newParams = { ...params, ...q.apply(params) }
    const diff = calcBestNet(newParams) - results.best.netAnnuel
    return { ...q, impact: diff }
  }), [params, results.best.netAnnuel])

  const worst = results.scored[results.scored.length - 1]
  const gainVsWorst = results.best.netAnnuel - (worst?.netAnnuel || 0)

  /* ── Graphique — light ── */
  const STRUCT_ORDER = ['EURL / SARL (IS)', 'SAS / SASU', 'EI (réel normal)', 'Micro-entreprise']
  const displayStructures = STRUCT_ORDER
    .map(name => results.scored.find(r => r.forme === name) || results.scored.find(r => r.forme.includes(name.split(' ')[0])))
    .filter(Boolean) as StructureResult[]

  const chartData = {
    labels: displayStructures.map(r =>
      r.forme === 'Micro-entreprise' && microExcluded ? 'Micro (exclue)' :
        r.forme === 'EI (réel normal)' ? 'EI réel' :
          r.forme === 'EURL / SARL (IS)' ? 'EURL/SARL IS' :
            r.forme === 'SAS / SASU' ? 'SAS/SASU' : r.forme
    ),
    datasets: [{
      data: displayStructures.map(r => r.forme === 'Micro-entreprise' && microExcluded ? 0 : Math.max(0, r.netAnnuel)),
      backgroundColor: displayStructures.map(r =>
        microExcluded && r.forme === 'Micro-entreprise' ? '#F1F5F9' :
          r.forme === results.best.forme ? '#3B82F6' : '#CBD5E1'
      ),
      borderRadius: 5,
      borderSkipped: false,
    }],
  }

  const chartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 220 },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (item: TooltipItem<'bar'>) => fmt(item.parsed.x ?? 0) } },
    },
    scales: {
      x: {
        grid: { color: '#F1F5F9' },
        ticks: { font: { size: 10 }, color: '#94A3B8', callback: (val) => `${Math.round(Number(val) / 1000)}k€` },
        border: { color: '#E2E8F0' },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#475569' },
        border: { color: '#E2E8F0' },
      },
    },
  }

  /* ── Texte recommandation ── */
  const recoText = useMemo(() => {
    const f = results.best.forme
    if (f === 'EI (réel normal)')
      return `Avec ${fmt(ben)} de résultat et ${partsStr} parts fiscales, votre TMI reste à ${tmi}%. L'EI maximise votre revenu sans la complexité d'une société.`
    if (f === 'EURL / SARL (IS)')
      return `L'IS 15% sur les premiers 42 500 € est plus avantageux que votre TMI (${tmi}%). Séparation patrimoniale et dividendes optimisés.`
    if (f === 'SAS / SASU')
      return `La SASU combine salaire de président et dividendes sans cotisations sociales. Avec ${fmt(ben)} de résultat, c'est la structure la plus efficace.`
    return `L'abattement forfaitaire de ${Math.round((MICRO_PLAFONDS[params.secteur].abat) * 100)}% est optimal avec vos charges actuelles. Gestion ultra-simplifiée.`
  }, [results.best.forme, ben, partsStr, tmi, params.secteur])

  /* ── Scénarios ── */
  const captureScenario = () => {
    if (scenarios.length >= 3) return
    const labels = ['A', 'B', 'C']
    const sc: Scenario = {
      id: Date.now().toString(),
      name: `Scénario ${labels[scenarios.length]}`,
      params: { ...params },
      best: results.best.forme,
      bestNet: results.best.netAnnuel,
      tmi,
    }
    setScenarios(prev => [...prev, sc])
    setActiveScenarioId(sc.id)
  }

  const loadScenario = (sc: Scenario) => { setParams({ ...sc.params }); setActiveScenarioId(sc.id) }
  const removeScenario = (id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id))
    if (activeScenarioId === id) setActiveScenarioId(null)
  }

  /* ── Styles light réutilisables ── */
  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  }
  const cardHeaderStyle: React.CSSProperties = {
    padding: '12px 16px 10px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#FAFAFA',
  }
  const SEL: React.CSSProperties = {
    width: '100%', fontSize: '13px',
    background: '#F8FAFF', border: '1px solid #E2E8F0',
    borderRadius: '10px', padding: '8px 12px', color: '#0F172A', outline: 'none', cursor: 'pointer',
  }
  const INP: React.CSSProperties = {
    width: '100%', fontSize: '13px',
    background: '#F8FAFF', border: '1px solid #E2E8F0',
    borderRadius: '10px', padding: '8px 12px', color: '#0F172A', outline: 'none',
  }

  const tmiColor = tmi <= 11 ? '#059669' : tmi <= 30 ? '#D97706' : '#DC2626'
  const tmiLabel = tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Tranche inter.' : 'Tranche haute'

  return (
    <>
      <PageHeader />

      {/* ══ STICKY RÉSULTATS — blanc/glass ══ */}
      <div style={{
        position: 'sticky', top: '64px', zIndex: 40,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0', alignItems: 'center',
          }}>
            {/* Meilleur revenu */}
            <div style={{ paddingRight: '24px' }}>
              <div style={{ fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
                Meilleur revenu
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#1D4ED8', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {fmt(results.best.netAnnuel)}
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fmt(Math.round(results.best.netAnnuel / 12))}/mois · {results.best.forme.replace('EURL / SARL (IS)', 'EURL IS').replace('EI (réel normal)', 'EI').replace('SAS / SASU', 'SASU')}
              </div>
            </div>
            {/* TMI */}
            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '24px', paddingRight: '24px' }}>
              <div style={{ fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>TMI</div>
              <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em', color: tmiColor }}>
                {tmi}%
              </div>
              <div style={{ fontSize: '10px', color: tmiColor, marginTop: '2px' }}>{tmiLabel}</div>
            </div>
            {/* Gain */}
            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '24px', paddingRight: '24px' }}>
              <div style={{ fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Gain vs moins avantageux</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }}>
                +{fmt(gainVsWorst)}
              </div>
              <div style={{ fontSize: '10px', color: '#16A34A', marginTop: '2px' }}>par an</div>
            </div>
            {/* Résultat avant rémun */}
            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '24px', paddingRight: '24px' }}>
              <div style={{ fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Résultat avant rémun.</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#1E293B', letterSpacing: '-0.02em' }}>
                {fmt(ben)}
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>CA − charges − amort.</div>
            </div>
            {/* Delta badge */}
            {delta.visible && Math.abs(delta.value) > 100 && (
              <div style={{
                padding: '8px 14px', borderRadius: '12px', fontWeight: 800, fontSize: '13px',
                background: delta.value >= 0 ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${delta.value >= 0 ? '#6EE7B7' : '#FECACA'}`,
                color: delta.value >= 0 ? '#059669' : '#DC2626',
                whiteSpace: 'nowrap', justifySelf: 'end',
              }}>
                {delta.value >= 0 ? '↑ +' : '↓ '}{fmt(Math.abs(delta.value))}/an
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ FOND GLOBAL CLAIR ══ */}
      <div style={{ background: 'linear-gradient(180deg, #EEF2FF 0%, #F0F4FF 50%, #F8FAFF 100%)', position: 'relative' }}>
        {/* Orbe lumineuse subtile */}
        <div style={{
          position: 'fixed', right: '-8rem', top: '8rem',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
        {/* Grille de points légère */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.025) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* ── HERO ── */}
        <div style={{ position: 'relative', zIndex: 1, borderBottom: '1px solid #E2E8F0', background: 'rgba(255,255,255,0.6)' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 24px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ height: '1px', width: '20px', background: '#3B82F6', borderRadius: '999px' }} />
                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#3B82F6' }}>Module exploration</span>
              </div>
              <h1 style={{ fontWeight: 900, fontSize: '26px', color: '#0F172A', letterSpacing: '-0.03em', marginBottom: '6px', lineHeight: 1.2 }}>
                Explorez tous vos scénarios
              </h1>
              <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '400px', lineHeight: 1.6 }}>
                Ajustez vos paramètres en temps réel. Aucun bouton «&nbsp;Calculer&nbsp;».
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {scenarios.length < 3 && (
                <button onClick={captureScenario} style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                  background: '#F8FAFF', border: '1px solid #E2E8F0',
                  color: '#475569', borderRadius: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  📸 Capturer ce scénario
                </button>
              )}
              <Link href="/simulateur" style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: 700,
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff',
                borderRadius: '12px', textDecoration: 'none', whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(29,78,216,0.25)',
              }}>
                Simulateur complet →
              </Link>
            </div>
          </div>
        </div>

        {/* ── PILL PRÉREMPLISSAGE ── */}
        {isPrefilledFromSim && (
          <div style={{ position: 'relative', zIndex: 1, borderBottom: '1px solid #BFDBFE', background: '#EFF6FF' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: '12px', color: '#2563EB', fontWeight: 500 }}>Pré-rempli depuis votre simulation</span>
              <button onClick={() => setIsPrefilledFromSim(false)} style={{ marginLeft: 'auto', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>
          </div>
        )}

        {/* ── "ET SI…" — sticky, fond blanc ── */}
        <div style={{
          position: 'sticky', top: '132px', zIndex: 30,
          background: '#ffffff',
          borderBottom: '1px solid #E2E8F0',
          borderTop: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            maxWidth: '1400px', margin: '0 auto', padding: '10px 24px',
            display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto',
          }}>
            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
              Et si…
            </span>
            {quickWithImpact.map(q => (
              <button key={q.label} title={q.hint}
                onClick={() => setParams(prev => ({ ...prev, ...q.apply(prev) }))}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                  border: '1.5px solid #E2E8F0',
                  background: '#F8FAFF',
                  transition: 'all 150ms', textAlign: 'center',
                }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{q.label}</div>
                {Math.abs(q.impact) > 100 && (
                  <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '1px', color: q.impact > 0 ? '#059669' : '#DC2626' }}>
                    {q.impact > 0 ? '+' : ''}{fmt(Math.round(q.impact))}/an
                  </div>
                )}
              </button>
            ))}
            {(params.ca !== DEFAULT.ca || params.charges !== DEFAULT.charges || params.situationFam !== DEFAULT.situationFam) && (
              <button onClick={() => { setParams(DEFAULT); setIsPrefilledFromSim(false) }}
                style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '11px', fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ↺ Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto', padding: '24px 16px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'min(400px, 100%) 1fr', gap: '24px', alignItems: 'start' }}
            className="!grid-cols-1 lg:!grid-cols-[400px_1fr]">

            {/* ════ PANNEAU GAUCHE — sticky ════ */}
            <div className="lg:sticky lg:top-[232px] space-y-3">

              {/* Card Activité */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: '#3B82F6' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Activité</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Secteur</label>
                    <select value={params.secteur} onChange={e => set('secteur', e.target.value as Secteur)} style={SEL}>
                      <option value="services_bic">Services BIC — abattement 50%</option>
                      <option value="liberal_bnc">BNC libéral — abattement 34%</option>
                      <option value="commerce">Commerce/vente — abattement 71%</option>
                      <option value="btp">BTP/artisanat — abattement 50%</option>
                    </select>
                  </div>

                  <SliderRow label="CA annuel HT" value={params.ca} min={0} max={2000000} step={10000}
                    onChange={v => set('ca', v)}
                    badge={
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#CBD5E1' }}>0</span>
                        {microExcluded
                          ? <span style={{ fontSize: '10px', fontWeight: 600, color: '#DC2626' }}>Micro exclue ({fmt(results.microPlafond)})</span>
                          : <span style={{ fontSize: '10px', color: '#94A3B8' }}>Micro ≤ {fmt(results.microPlafond)}</span>
                        }
                        <span style={{ fontSize: '10px', color: '#CBD5E1' }}>2M€</span>
                      </div>
                    }
                  />

                  <SliderRow label="Charges d'exploitation"
                    sub={params.ca > 0 ? `(${Math.round(params.charges / params.ca * 100)}% du CA)` : ''}
                    value={params.charges} min={0} max={Math.max(Math.round(params.ca * 0.9), 10000)} step={5000}
                    onChange={v => set('charges', v)} />

                  <SliderRow label="Amortissements" value={params.amort} min={0} max={200000} step={1000}
                    onChange={v => set('amort', v)} />

                  <SliderRow label="Capital social" value={params.capital} min={1000} max={500000} step={5000}
                    onChange={v => set('capital', v)}
                    badge={
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                        Seuil dividendes TNS :{' '}
                        <span style={{ fontWeight: 600, color: params.capital >= 30000 ? '#059669' : '#D97706' }}>
                          {fmt(params.capital * 0.10)}
                        </span>
                      </div>
                    }
                  />

                  {/* Résultat avant rémunération */}
                  <div style={{
                    background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                    border: '1px solid #BFDBFE',
                    borderRadius: '14px', padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', fontWeight: 700 }}>
                        Résultat avant rémunération
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#1D4ED8', letterSpacing: '-0.03em' }}>{fmt(ben)}</div>
                    </div>
                    {seuil60k && (
                      <div style={{
                        fontSize: '10px', background: '#FFFBEB',
                        border: '1px solid #FDE68A', color: '#B45309',
                        padding: '4px 10px', borderRadius: '8px', fontWeight: 700,
                      }}>⚡ Zone IS</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Foyer */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: '#7C3AED' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Foyer fiscal</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Situation</label>
                      <select value={params.situationFam}
                        onChange={e => set('situationFam', e.target.value as ExplorerParams['situationFam'])}
                        style={SEL}>
                        <option value="celib">Célibataire</option>
                        <option value="marie">Marié(e)</option>
                        <option value="pacse">Pacsé(e)</option>
                        <option value="veuf">Veuf/veuve</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Enfants</label>
                      <select value={params.nbEnfants}
                        onChange={e => set('nbEnfants', parseInt(e.target.value))}
                        style={SEL}>
                        {[0, 1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n === 0 ? 'Aucun' : `${n} enfant${n > 1 ? 's' : ''}`}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{
                    background: '#F5F3FF', border: '1px solid #DDD6FE',
                    borderRadius: '10px', padding: '8px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '12px', color: '#6D28D9', fontWeight: 500 }}>Parts fiscales</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#7C3AED' }}>{partsStr} parts</span>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Autres revenus du foyer (€/an)</label>
                    <input type="number" value={params.autresRev} min={0} step={1000}
                      onChange={e => set('autresRev', Math.max(0, parseFloat(e.target.value) || 0))}
                      style={INP} />
                    <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>Salaire conjoint, revenus fonciers, etc.</p>
                  </div>
                </div>
              </div>

              {/* Card Stratégie */}
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: '#059669' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stratégie</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {([['max', '💰 Tout percevoir'], ['reserve', '🏦 Garder en réserve']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => set('strategie', val)}
                        style={{
                          padding: '10px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer', transition: 'all 150ms', textAlign: 'center',
                          background: params.strategie === val ? '#EFF6FF' : '#F8FAFF',
                          border: params.strategie === val ? '1.5px solid #BFDBFE' : '1px solid #E2E8F0',
                          color: params.strategie === val ? '#1D4ED8' : '#94A3B8',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {params.strategie === 'reserve' && (
                    <SliderRow label="Montant en réserves" value={params.reserveVoulue}
                      min={0} max={Math.max(ben, 1)} step={1000}
                      onChange={v => set('reserveVoulue', v)} />
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <label style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>PER annuel</label>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>Plafond : {fmt(perPlafond)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="range" min={0} max={perPlafond} step={500}
                        value={Math.min(params.perMontant, perPlafond)}
                        onChange={e => set('perMontant', parseInt(e.target.value))}
                        className="flex-1 cursor-pointer"
                        style={{
                          height: '4px', accentColor: '#3B82F6', flex: 1,
                          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${Math.round(Math.min(params.perMontant, perPlafond) / perPlafond * 100)}%, #E2E8F0 ${Math.round(Math.min(params.perMontant, perPlafond) / perPlafond * 100)}%, #E2E8F0 100%)`,
                        }}
                      />
                      <input type="number" value={params.perMontant} min={0} step={500}
                        onChange={e => set('perMontant', Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '72px', textAlign: 'right', background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '3px 6px', color: '#0F172A', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                      />
                    </div>
                    <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                      {params.perMontant > 0
                        ? <span style={{ color: '#059669', fontWeight: 600 }}>Économie IR estimée : {fmt(Math.round(params.perMontant * (tmi / 100)))}</span>
                        : 'Non actif'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scénarios sauvegardés */}
              {scenarios.length > 0 && (
                <div style={cardStyle}>
                  <div style={{ ...cardHeaderStyle, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: '#D97706' }} />
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scénarios sauvegardés</span>
                    </div>
                    {scenarios.length < 3 && (
                      <button onClick={captureScenario} style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', background: 'none', border: 'none', cursor: 'pointer' }}>+ Capturer</button>
                    )}
                  </div>
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {scenarios.map(sc => (
                      <div key={sc.id} style={{
                        borderRadius: '12px', padding: '10px 12px',
                        background: activeScenarioId === sc.id ? '#FFFBEB' : '#F8FAFF',
                        border: activeScenarioId === sc.id ? '1px solid #FDE68A' : '1px solid #E2E8F0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>{sc.name}</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => loadScenario(sc)} style={{ fontSize: '10px', fontWeight: 600, color: '#D97706', background: 'none', border: 'none', cursor: 'pointer' }}>↩ Charger</button>
                            <button onClick={() => removeScenario(sc.id)} style={{ fontSize: '10px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          CA {fmt(sc.params.ca)} · {sc.best.replace('EURL / SARL (IS)', 'EURL IS').replace('SAS / SASU', 'SASU').replace('EI (réel normal)', 'EI')} · {fmt(sc.bestNet)}/an
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ════ PANNEAU DROIT ════ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Comparaison de scénarios */}
              {scenarios.length >= 2 && (
                <div style={{ ...cardStyle, marginBottom: 0 }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Comparaison des scénarios</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                          <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}></th>
                          {scenarios.map(sc => (
                            <th key={sc.id} style={{ textAlign: 'right', padding: '10px 12px', fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>{sc.name}</th>
                          ))}
                          {scenarios.length === 2 && <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>Écart</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'CA', getValue: (sc: Scenario) => fmt(sc.params.ca) },
                          { label: 'Structure rec.', getValue: (sc: Scenario) => sc.best.replace('EURL / SARL (IS)', 'EURL IS').replace('SAS / SASU', 'SASU').replace('EI (réel normal)', 'EI') },
                          { label: 'Net recommandé', getValue: (sc: Scenario) => fmt(sc.bestNet), numeric: true },
                        ].map(({ label, getValue, numeric }) => (
                          <tr key={label} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 16px', color: '#64748B', fontWeight: 500 }}>{label}</td>
                            {scenarios.map(sc => (
                              <td key={sc.id} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#1E293B' }}>{getValue(sc)}</td>
                            ))}
                            {scenarios.length === 2 && numeric && (
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                                {(() => {
                                  const diff = scenarios[1].bestNet - scenarios[0].bestNet
                                  return <span style={{ color: diff >= 0 ? '#059669' : '#DC2626' }}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
                                })()}
                              </td>
                            )}
                            {scenarios.length === 2 && !numeric && <td style={{ padding: '10px 12px' }} />}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Graphique */}
              <div style={{ ...cardStyle, padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>Revenu net annuel</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Après IR, cotisations et IS</div>
                  </div>
                  {newBestAlert && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '6px 12px', background: '#2563EB', color: '#fff',
                      fontSize: '11px', fontWeight: 700, borderRadius: '999px',
                    }}>✦ {results.best.forme.replace('EURL / SARL (IS)', 'EURL IS').replace('EI (réel normal)', 'EI')}</span>
                  )}
                </div>
                <div style={{ height: '180px' }}>
                  <Bar data={chartData} options={chartOptions} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3B82F6' }} />
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Recommandée</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#CBD5E1' }} />
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Autres structures</span>
                  </div>
                  {microExcluded && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px dashed #E2E8F0' }} />
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Micro non éligible</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tableau comparatif */}
              <div style={{ ...cardStyle }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Comparatif détaillé
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                      <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Structure</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>NET/AN</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>TMI</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.scored.map((r, i) => {
                      const isBest = i === 0
                      const isExcluded = r.forme === 'Micro-entreprise' && microExcluded
                      const structTmi = Math.round(tmiRate(
                        (r.baseIR ?? r.bNet ?? r.ben ?? 0) + params.autresRev,
                        partsBase, params.nbEnfants
                      ) * 100)
                      const tmiPillColor = structTmi <= 11 ? '#059669' : structTmi <= 30 ? '#D97706' : '#DC2626'
                      const tmiPillBg = structTmi <= 11 ? '#ECFDF5' : structTmi <= 30 ? '#FFFBEB' : '#FEF2F2'
                      return (
                        <tr key={r.forme} style={{
                          borderTop: '1px solid #F1F5F9',
                          background: isBest && !isExcluded ? '#EFF6FF' : 'transparent',
                        }}>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isBest && !isExcluded && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />}
                              <span style={{
                                fontSize: '12px', fontWeight: isBest && !isExcluded ? 700 : 500,
                                color: isExcluded ? '#94A3B8' : isBest ? '#1D4ED8' : '#475569',
                                textDecoration: isExcluded ? 'line-through' : 'none',
                              }}>
                                {r.forme.replace('EURL / SARL (IS)', 'EURL/SARL IS').replace('EI (réel normal)', 'EI réel')}
                              </span>
                              {isBest && !isExcluded && <span style={{ fontSize: '9px', fontWeight: 700, background: '#2563EB', color: '#fff', padding: '1px 6px', borderRadius: '999px' }}>★</span>}
                              {isExcluded && <span style={{ fontSize: '9px', color: '#DC2626', fontWeight: 600 }}>exclue</span>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: '13px', fontWeight: 800, color: isExcluded ? '#CBD5E1' : isBest ? '#1D4ED8' : '#475569' }}>
                            {isExcluded ? '—' : fmt(r.netAnnuel)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                            {!isExcluded && (
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: tmiPillBg, color: tmiPillColor }}>
                                {structTmi}%
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: isBest && !isExcluded ? '#3B82F6' : '#CBD5E1' }}>
                            {r.scoreTotal}/100
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bloc recommandation — dégradé bleu */}
              <div style={{
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(29,78,216,0.3)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', right: '-4rem', top: '-4rem',
                  width: '300px', height: '300px', borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%)',
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.70)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.7)', display: 'inline-block' }} />
                    Structure recommandée
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                        {results.best.forme.replace('EURL / SARL (IS)', 'EURL / SARL IS').replace('EI (réel normal)', 'EI réel')}
                      </div>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.6, maxWidth: '320px' }}>{recoText}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '30px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {fmt(results.best.netAnnuel)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '3px' }}>
                        {fmt(Math.round(results.best.netAnnuel / 12))}/mois net
                      </div>
                    </div>
                  </div>
                  {gainVsWorst > 500 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: '10px', padding: '8px 12px', marginBottom: '14px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                        +{fmt(gainVsWorst)}/an vs moins avantageuse
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link href="/simulateur" style={{
                      flex: 1, padding: '10px', borderRadius: '12px', fontWeight: 700, fontSize: '12px',
                      background: 'rgba(255,255,255,0.20)', color: '#fff',
                      textDecoration: 'none', textAlign: 'center',
                    }}>
                      Analyse complète →
                    </Link>
                    <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, padding: '10px', borderRadius: '12px', fontWeight: 700, fontSize: '12px',
                      border: '1px solid rgba(255,255,255,0.30)', color: 'rgba(255,255,255,0.80)',
                      textDecoration: 'none', textAlign: 'center',
                    }}>
                      Prendre RDV
                    </a>
                  </div>
                </div>
              </div>

              {/* Ce que ça change */}
              <div style={{ ...cardStyle, padding: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '14px' }}>
                  💡 Ce que ça change concrètement
                </div>
                <div>
                  {[
                    { label: 'Revenu mensuel net', val: fmt(Math.round(results.best.netAnnuel / 12)), color: '#1D4ED8', bold: true },
                    { label: 'Charges sociales annuelles', val: `−${fmt(results.best.charges)}`, color: '#DC2626', bold: true },
                    { label: 'IR estimé', val: `−${fmt(results.best.ir)}`, color: '#D97706', bold: false },
                    ...(results.best.is > 0 ? [{ label: 'IS estimé', val: `−${fmt(results.best.is)}`, color: '#6366F1', bold: false }] : []),
                  ].map(({ label, val, color, bold }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '13px', color: '#64748B' }}>{label}</span>
                      <span style={{ fontSize: '13px', fontWeight: bold ? 700 : 600, color }}>{val}</span>
                    </div>
                  ))}
                  {gainVsWorst > 500 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', marginTop: '4px', borderTop: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Gain vs moins avantageux</span>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>+{fmt(gainVsWorst)}/an</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Potentiel optimisé */}
              <div style={{ ...cardStyle, overflow: 'hidden' }}>
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #BBF7D0',
                  background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Potentiel optimisé</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Avec tous les leviers activés</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }}>{fmt(optimise.netOptimise)}</div>
                    <div style={{ fontSize: '10px', color: '#16A34A' }}>+{fmt(optimise.total)}/an</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {([
                    { ico: '📊', label: 'PER max', val: optimise.perGain },
                    { ico: '🚗', label: 'IK 8 000km', val: optimise.ikGain },
                    { ico: '🏠', label: 'Domiciliation', val: optimise.domGain },
                    { ico: '🛡', label: 'Prévoyance', val: optimise.prevGain },
                  ] as const).map(lev => (
                    <div key={lev.label} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#F0FDF4', borderRadius: '12px', padding: '10px 12px',
                      border: '1px solid #BBF7D0',
                    }}>
                      <span style={{ fontSize: '16px' }}>{lev.ico}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lev.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>+{fmt(lev.val)}/an</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '0 20px 16px' }}>
                  <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer" style={{
                    display: 'block', textAlign: 'center', padding: '10px',
                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                    color: '#fff', fontSize: '13px', fontWeight: 700, borderRadius: '12px',
                    textDecoration: 'none', boxShadow: '0 4px 12px rgba(22,163,74,0.25)',
                  }}>
                    Mettre tout en place avec un expert →
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
