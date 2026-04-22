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

/* ── Conversion ExplorerParams → SimParams ── */
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

/* ── Calcul rapide du meilleur net ── */
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

/* ── SliderRow : number input libre, slider clampé ── */
function SliderRow({ label, value, min, max, step, onChange, sub, badge }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; sub?: string; badge?: React.ReactNode
}) {
  const sliderVal = Math.min(value, max)
  const pct = max > min ? Math.round((sliderVal - min) / (max - min) * 100) : 0

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-sm font-medium text-slate-700">
          {label}
          {sub && <span className="text-xs text-slate-400 ml-1.5">{sub}</span>}
        </label>
        <input
          type="number" value={value} min={min} step={step}
          onChange={e => onChange(Math.max(min, parseFloat(e.target.value) || min))}
          className="w-28 text-right text-sm font-bold text-slate-900 border-0 bg-transparent
                     focus:outline-none p-0 [appearance:textfield]
                     [&::-webkit-outer-spin-button]:appearance-none
                     [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={sliderVal}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer"
        style={{ background: `linear-gradient(to right, #2563EB 0%, #2563EB ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)` }}
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

  /* ── TMI pour la structure recommandée ── */
  const tmi = Math.round(tmiRate(
    (results.best.baseIR ?? results.best.bNet ?? results.best.ben || 0) + params.autresRev,
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

  /* ── "Et si..." avec impact ── */
  const quickWithImpact = useMemo(() => QUICK_DEFS.map(q => {
    const newParams = { ...params, ...q.apply(params) }
    const diff = calcBestNet(newParams) - results.best.netAnnuel
    return { ...q, impact: diff }
  }), [params, results.best.netAnnuel])

  const worst = results.scored[results.scored.length - 1]
  const gainVsWorst = results.best.netAnnuel - (worst?.netAnnuel || 0)

  /* ── Graphique ── */
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
        microExcluded && r.forme === 'Micro-entreprise' ? 'rgba(148,163,184,.25)' :
          r.forme === results.best.forme ? '#2563EB' : 'rgba(148,163,184,.45)'
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
        grid: { color: 'rgba(0,0,0,.04)' },
        ticks: { font: { size: 10 }, callback: (val) => `${Math.round(Number(val) / 1000)}k€` },
      },
      y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#475569' } },
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

  const SEL = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 transition-all cursor-pointer"
  const INP = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 transition-all"

  return (
    <>
      <PageHeader />

      {/* ── FLOATING DELTA BADGE ── */}
      <div className={`fixed top-20 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-bold transition-all duration-300 pointer-events-none
        ${delta.visible && Math.abs(delta.value) > 100 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        ${delta.value >= 0 ? 'bg-emerald-600' : 'bg-red-600'}`}>
        {delta.value >= 0 ? '↑ +' : '↓ '}{fmt(Math.abs(delta.value))}/an
      </div>

      {/* ── HERO ── */}
      <div className="bg-navy border-b border-white/[0.06] relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.18)_0%,transparent_65%)] -top-24 -right-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-10 relative flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-5 rounded-full bg-blue-mid" />
              <span className="text-[10.5px] font-bold tracking-[0.18em] uppercase text-blue-mid">Module exploration</span>
            </div>
            <h1 className="font-display text-3xl font-black text-white tracking-tight mb-1.5">Explorez tous vos scénarios</h1>
            <p className="text-[14px] text-white/45 max-w-md leading-relaxed">
              Ajustez vos paramètres en temps réel. Aucun bouton «&nbsp;Calculer&nbsp;».
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {scenarios.length < 3 && (
              <button onClick={captureScenario}
                className="px-4 py-2 text-sm font-semibold bg-white/10 border border-white/20 text-white rounded-xl hover:bg-white/20 transition-all whitespace-nowrap">
                📸 Capturer ce scénario
              </button>
            )}
            <Link href="/simulateur"
              className="px-4 py-2 text-sm font-bold bg-blue text-white rounded-xl hover:bg-blue-dark transition-all whitespace-nowrap">
              Simulateur complet →
            </Link>
          </div>
        </div>
      </div>

      {/* ── BANDEAU PRÉREMPLISSAGE ── */}
      {isPrefilledFromSim && (
        <div className="bg-blue-bg border-b border-blue-border">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
            <span className="text-blue flex-shrink-0">📊</span>
            <p className="text-[13px] text-blue-dark">
              <strong>Paramètres chargés depuis votre simulation.</strong> Ajustez les sliders pour explorer d&apos;autres scénarios.
            </p>
            <button onClick={() => setIsPrefilledFromSim(false)}
              className="ml-auto text-blue/60 hover:text-blue text-sm transition-colors flex-shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* ── "ET SI…" ── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex-shrink-0">Et si…</span>
          {quickWithImpact.map(q => (
            <button key={q.label} title={q.hint}
              onClick={() => setParams(prev => ({ ...prev, ...q.apply(prev) }))}
              className="inline-flex flex-col items-center px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-500
                hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50/50 transition-all whitespace-nowrap">
              <span className="text-[12px] font-semibold">{q.label}</span>
              {Math.abs(q.impact) > 100 && (
                <span className={`text-[10px] font-bold leading-tight ${q.impact > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {q.impact > 0 ? '+' : ''}{fmt(Math.round(q.impact))}/an
                </span>
              )}
            </button>
          ))}
          {(params.ca !== DEFAULT.ca || params.charges !== DEFAULT.charges || params.situationFam !== DEFAULT.situationFam) && (
            <button onClick={() => { setParams(DEFAULT); setIsPrefilledFromSim(false) }}
              className="ml-auto px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-red-600 transition-colors whitespace-nowrap">
              ↺ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="bg-slate-50/60 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">

          {/* ════ PANNEAU GAUCHE ════ */}
          <div className="lg:sticky lg:top-20 space-y-4">

            {/* Card Activité */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600">Activité</h3>
              </div>
              <div className="p-5 space-y-5">

                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Secteur</label>
                  <select value={params.secteur} onChange={e => set('secteur', e.target.value as Secteur)} className={SEL}>
                    <option value="services_bic">Services BIC — abattement 50%</option>
                    <option value="liberal_bnc">BNC libéral — abattement 34%</option>
                    <option value="commerce">Commerce/vente — abattement 71%</option>
                    <option value="btp">BTP/artisanat — abattement 50%</option>
                  </select>
                </div>

                <SliderRow label="CA annuel HT" value={params.ca} min={0} max={2000000} step={10000}
                  onChange={v => set('ca', v)}
                  badge={
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10.5px] text-slate-400">0</span>
                      {microExcluded
                        ? <span className="text-[10.5px] font-semibold text-red-500">Micro exclue (plafond {fmt(results.microPlafond)})</span>
                        : <span className="text-[10.5px] text-slate-400">Micro ≤ {fmt(results.microPlafond)}</span>
                      }
                      <span className="text-[10.5px] text-slate-400">2M€</span>
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
                    <div className="text-[10.5px] text-slate-400 mt-1">
                      Seuil dividendes TNS :{' '}
                      <span className={`font-semibold ${params.capital >= 30000 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {fmt(params.capital * 0.10)}
                      </span>
                    </div>
                  }
                />

                {/* Résultat calculé */}
                <div className="bg-slate-900 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400 mb-0.5">Résultat avant rémunération</div>
                    <div className="text-xl font-bold text-white">{fmt(ben)}</div>
                  </div>
                  {delta.visible && Math.abs(delta.value) > 100 && (
                    <div className={`text-xs font-bold px-2.5 py-1.5 rounded-lg
                      ${delta.value >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {delta.value >= 0 ? '↑ +' : '↓ '}{fmt(Math.abs(delta.value))}
                    </div>
                  )}
                </div>

                {seuil60k && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-[11.5px] text-blue-700">
                    ⚡ Résultat &gt; 60 000 € — l&apos;IS (EURL/SASU) devient généralement plus avantageux que l&apos;IR direct.
                  </div>
                )}
              </div>
            </div>

            {/* Card Foyer */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600">Foyer fiscal</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1.5">Situation</label>
                    <select value={params.situationFam}
                      onChange={e => set('situationFam', e.target.value as ExplorerParams['situationFam'])}
                      className={SEL}>
                      <option value="celib">Célibataire</option>
                      <option value="marie">Marié(e)</option>
                      <option value="pacse">Pacsé(e)</option>
                      <option value="veuf">Veuf/veuve</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1.5">Enfants</label>
                    <select value={params.nbEnfants}
                      onChange={e => set('nbEnfants', parseInt(e.target.value))}
                      className={SEL}>
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n === 0 ? 'Aucun' : `${n} enfant${n > 1 ? 's' : ''}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-blue-600">Parts fiscales</span>
                  <span className="text-sm font-bold text-blue-700">{partsStr} parts</span>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">Autres revenus du foyer (€/an)</label>
                  <input type="number" value={params.autresRev} min={0} step={1000}
                    onChange={e => set('autresRev', Math.max(0, parseFloat(e.target.value) || 0))}
                    className={INP} />
                  <p className="text-[10.5px] text-slate-400 mt-1">Salaire conjoint, revenus fonciers, etc.</p>
                </div>
              </div>
            </div>

            {/* Card Stratégie */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-slate-50">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600">Stratégie</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {([['max', '💰 Tout percevoir'], ['reserve', '🏦 Garder en réserve']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => set('strategie', val)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-center transition-all
                        ${params.strategie === val
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'}`}>
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
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="text-xs font-medium text-slate-500">PER annuel</label>
                    <span className="text-xs text-slate-400">Plafond : {fmt(perPlafond)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={perPlafond} step={500}
                      value={Math.min(params.perMontant, perPlafond)}
                      onChange={e => set('perMontant', parseInt(e.target.value))}
                      className="flex-1 h-1.5 rounded-full cursor-pointer"
                      style={{ background: `linear-gradient(to right, #2563EB 0%, #2563EB ${Math.round(Math.min(params.perMontant, perPlafond) / perPlafond * 100)}%, #e2e8f0 ${Math.round(Math.min(params.perMontant, perPlafond) / perPlafond * 100)}%, #e2e8f0 100%)` }}
                    />
                    <input type="number" value={params.perMontant} min={0} step={500}
                      onChange={e => set('perMontant', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 text-right text-xs font-bold text-slate-900 border-0 bg-transparent focus:outline-none p-0
                                 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    {params.perMontant > 0
                      ? `Économie IR estimée : ${fmt(Math.round(params.perMontant * (tmi / 100)))}`
                      : 'Non actif'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scénarios sauvegardés */}
            {scenarios.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600">Scénarios sauvegardés</h3>
                  {scenarios.length < 3 && (
                    <button onClick={captureScenario}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                      + Capturer
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  {scenarios.map(sc => (
                    <div key={sc.id}
                      className={`rounded-xl border p-3 transition-all ${activeScenarioId === sc.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-bold text-slate-800">{sc.name}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => loadScenario(sc)}
                            className="text-[10.5px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded transition-colors">
                            ↩ Charger
                          </button>
                          <button onClick={() => removeScenario(sc.id)}
                            className="text-[10.5px] font-semibold text-red-400 hover:text-red-600 px-1 py-0.5 transition-colors">✕</button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        CA {fmt(sc.params.ca)} · {sc.best.replace('EURL / SARL (IS)', 'EURL IS').replace('SAS / SASU', 'SASU').replace('EI (réel normal)', 'EI')} · {fmt(sc.bestNet)}/an
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ════ PANNEAU DROIT ════ */}
          <div className="space-y-4">

            {/* ── KPI grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 col-span-2">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Meilleur revenu net</div>
                <div className="text-3xl font-bold text-blue-600">{fmt(results.best.netAnnuel)}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {fmt(Math.round(results.best.netAnnuel / 12))}/mois ·{' '}
                  {results.best.forme.replace('EURL / SARL (IS)', 'EURL/SARL').replace('EI (réel normal)', 'EI réel')}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">TMI</div>
                <div className={`text-3xl font-bold ${tmi <= 11 ? 'text-emerald-600' : tmi <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                  {tmi}%
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {tmi <= 11 ? 'Tranche basse' : tmi <= 30 ? 'Tranche inter.' : 'Tranche haute'}
                </div>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
                <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">Gain max</div>
                <div className="text-3xl font-bold text-emerald-700">+{fmt(gainVsWorst)}</div>
                <div className="text-xs text-emerald-600 mt-0.5">vs moins favorable</div>
              </div>
            </div>

            {/* ── Comparaison de scénarios ── */}
            {scenarios.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50">
                  <h3 className="font-semibold text-slate-900">Comparaison des scénarios</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-slate-400 font-semibold"></th>
                        {scenarios.map(sc => (
                          <th key={sc.id} className="text-right px-4 py-2.5 text-xs uppercase tracking-wide text-slate-400 font-semibold">{sc.name}</th>
                        ))}
                        {scenarios.length === 2 && <th className="text-right px-4 py-2.5 text-xs uppercase tracking-wide text-slate-400 font-semibold">Écart</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'CA', getValue: (sc: Scenario) => fmt(sc.params.ca) },
                        { label: 'Structure rec.', getValue: (sc: Scenario) => sc.best.replace('EURL / SARL (IS)', 'EURL IS').replace('SAS / SASU', 'SASU').replace('EI (réel normal)', 'EI') },
                        { label: 'Net recommandé', getValue: (sc: Scenario) => fmt(sc.bestNet), numeric: true },
                      ].map(({ label, getValue, numeric }) => (
                        <tr key={label} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-500 font-medium">{label}</td>
                          {scenarios.map(sc => (
                            <td key={sc.id} className="px-4 py-3 text-right font-semibold text-slate-800">{getValue(sc)}</td>
                          ))}
                          {scenarios.length === 2 && numeric && (
                            <td className="px-4 py-3 text-right font-bold">
                              {(() => {
                                const diff = scenarios[1].bestNet - scenarios[0].bestNet
                                return <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
                              })()}
                            </td>
                          )}
                          {scenarios.length === 2 && !numeric && <td className="px-4 py-3" />}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Graphique ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Revenu net annuel</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Après IR, cotisations et IS</p>
                </div>
                {newBestAlert && (
                  <span className="animate-pulse inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[12px] font-bold rounded-full">
                    ✦ {results.best.forme.replace('EURL / SARL (IS)', 'EURL IS').replace('EI (réel normal)', 'EI')}
                  </span>
                )}
              </div>
              <div style={{ height: '200px' }}>
                <Bar data={chartData} options={chartOptions} />
              </div>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-600" />
                  <span className="text-xs text-slate-400">Recommandée</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-slate-300" />
                  <span className="text-xs text-slate-400">Autres structures</span>
                </div>
                {microExcluded && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm border border-dashed border-slate-300" />
                    <span className="text-xs text-slate-400">Micro non éligible</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Tableau comparatif ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="font-semibold text-slate-900">Comparatif détaillé</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400 bg-slate-50/60 border-b border-slate-100">
                    <th className="text-left px-5 py-3">Structure</th>
                    <th className="text-right px-4 py-3">Net/an</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Net/mois</th>
                    <th className="text-right px-4 py-3">TMI</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">IR</th>
                    <th className="text-right px-4 py-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.scored.map((r, i) => {
                    const isBest = i === 0
                    const isExcluded = r.forme === 'Micro-entreprise' && microExcluded
                    const structTmi = Math.round(tmiRate(
                      (r.baseIR ?? r.bNet ?? r.ben || 0) + params.autresRev,
                      partsBase, params.nbEnfants
                    ) * 100)
                    const tmiCls = structTmi <= 11 ? 'bg-emerald-100 text-emerald-700' : structTmi <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    return (
                      <tr key={r.forme}
                        className={`border-b border-slate-50 last:border-0 transition-colors
                          ${isBest && !isExcluded ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {isBest && !isExcluded && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                            <span className={`text-sm font-medium ${isExcluded ? 'text-slate-300 line-through' : isBest ? 'text-blue-700' : 'text-slate-700'}`}>
                              {r.forme.replace('EURL / SARL (IS)', 'EURL/SARL IS').replace('EI (réel normal)', 'EI réel')}
                            </span>
                            {isBest && !isExcluded && <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">★</span>}
                            {isExcluded && <span className="text-[9px] text-red-400 font-semibold">exclue</span>}
                          </div>
                        </td>
                        <td className={`text-right px-4 py-3.5 text-sm font-bold ${isExcluded ? 'text-slate-300' : 'text-slate-900'}`}>
                          {isExcluded ? '—' : fmt(r.netAnnuel)}
                        </td>
                        <td className="text-right px-4 py-3.5 text-sm text-slate-400 hidden sm:table-cell">
                          {isExcluded ? '—' : fmt(Math.round(r.netAnnuel / 12))}
                        </td>
                        <td className="text-right px-4 py-3.5">
                          {!isExcluded && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tmiCls}`}>{structTmi}%</span>}
                        </td>
                        <td className="text-right px-4 py-3.5 text-sm text-slate-400 hidden sm:table-cell">
                          {isExcluded ? '—' : `−${fmt(r.ir)}`}
                        </td>
                        <td className="text-right px-4 py-3.5">
                          <span className={`text-sm font-bold ${isBest && !isExcluded ? 'text-blue-600' : 'text-slate-300'}`}>
                            {r.scoreTotal}/100
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Recommandation (dark) ── */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.25)_0%,transparent_65%)] -top-24 -right-12 pointer-events-none" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1.5">✦ Structure recommandée</div>
                    <div className="text-2xl font-bold">
                      {results.best.forme.replace('EURL / SARL (IS)', 'EURL / SARL IS').replace('EI (réel normal)', 'EI réel')}
                    </div>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">{recoText}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-3xl font-bold text-blue-400">{fmt(results.best.netAnnuel)}</div>
                    <div className="text-xs text-slate-400">net / an</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-sm text-slate-300">+{fmt(gainVsWorst)}/an vs la moins avantageuse</span>
                  <div className="flex gap-2">
                    <Link href="/simulateur"
                      className="text-sm bg-blue-600 px-4 py-2 rounded-xl font-medium hover:bg-blue-500 transition-colors whitespace-nowrap">
                      Analyse complète →
                    </Link>
                    <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                      className="text-sm border border-white/20 px-4 py-2 rounded-xl font-medium text-white/70 hover:text-white hover:border-white/40 transition-colors whitespace-nowrap">
                      Prendre RDV
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Ce que ça change concrètement ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                💡 Ce que ça change concrètement
              </h3>
              <div>
                {[
                  { label: 'Revenu mensuel net', val: fmt(Math.round(results.best.netAnnuel / 12)), cls: 'text-slate-900 font-bold' },
                  { label: 'Charges sociales annuelles', val: `−${fmt(results.best.charges)}`, cls: 'text-red-600 font-bold' },
                  { label: 'IR estimé', val: `−${fmt(results.best.ir)}`, cls: 'text-slate-500 font-semibold' },
                  ...(results.best.is > 0 ? [{ label: 'IS estimé', val: `−${fmt(results.best.is)}`, cls: 'text-slate-500 font-semibold' }] : []),
                ].map(({ label, val, cls }) => (
                  <div key={label} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className={`text-sm ${cls}`}>{val}</span>
                  </div>
                ))}
                {gainVsWorst > 500 && (
                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                    <span className="text-sm font-medium text-slate-700">Gain vs moins avantageux</span>
                    <span className="text-base font-bold text-emerald-600">+{fmt(gainVsWorst)}/an</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
