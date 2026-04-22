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
import { calcPartsTotal } from '@/lib/fiscal/ir'
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

/* ── Questions rapides ── */
const QUICK: { label: string; hint: string; apply: (p: ExplorerParams) => Partial<ExplorerParams> }[] = [
  { label: 'CA × 2', hint: 'Doubler le chiffre d\'affaires', apply: (p) => ({ ca: p.ca * 2 }) },
  { label: 'Se marier', hint: 'Passer à 2 parts fiscales', apply: () => ({ situationFam: 'marie' as const }) },
  { label: '2 enfants', hint: 'Ajouter 2 enfants à charge', apply: () => ({ nbEnfants: 2 }) },
  { label: 'PER 3 000 €', hint: 'Verser 3 000 € au PER', apply: () => ({ perMontant: 3000 }) },
  { label: '30% réserve', hint: 'Conserver 30% du bénéfice', apply: (p) => {
    const ben = p.ca - p.charges - p.amort
    return { strategie: 'reserve' as const, reserveVoulue: Math.round(Math.max(0, ben) * 0.3) }
  }},
  { label: '+20% charges', hint: 'Augmenter les charges', apply: (p) => ({ charges: Math.round(p.charges * 1.2) }) },
]

/* ── Composant SliderRow ── */
function SliderRow({ label, sub, value, min, max, step, onChange, badge }: {
  label: string; sub?: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; badge?: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <div>
          <span className="text-[12px] font-semibold text-ink">{label}</span>
          {sub && <span className="text-[10.5px] text-ink4 ml-1.5">{sub}</span>}
        </div>
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || min)))}
          className="w-28 px-2 py-1 text-[12px] font-semibold text-right border border-surface2 rounded-lg bg-white text-ink
            focus:outline-none focus:border-blue-mid focus:ring-1 focus:ring-blue-mid/20 transition-all"
        />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer accent-blue"
        style={{ background: `linear-gradient(to right, #1D4ED8 0%, #1D4ED8 ${Math.round((value - min) / (max - min) * 100)}%, #e2e8f0 ${Math.round((value - min) / (max - min) * 100)}%, #e2e8f0 100%)` }}
      />
      {badge}
    </div>
  )
}

/* ── Page principale ── */
export default function ExplorerPage() {
  const [params, setParams] = useState<ExplorerParams>(DEFAULT)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [delta, setDelta] = useState<{ value: number; visible: boolean }>({ value: 0, visible: false })
  const [newBestAlert, setNewBestAlert] = useState(false)
  const prevBestNetRef = useRef<number>(0)
  const prevBestNameRef = useRef<string>('')
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lire les query params depuis l'URL au montage
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
    if (Object.keys(upd).length > 0) setParams(prev => ({ ...prev, ...upd }))
  }, [])

  const set = useCallback(<K extends keyof ExplorerParams>(key: K, value: ExplorerParams[K]) => {
    setParams(prev => {
      const next = { ...prev, [key]: value }
      // Ajuster les charges si elles dépassent le CA
      if (key === 'ca' && next.charges > Number(value) * 0.9) next.charges = Math.round(Number(value) * 0.4)
      // Reset réserve si stratégie change
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
    const best = scored[0]
    const microPlafond = MICRO_PLAFONDS[params.secteur].plafond
    return { micro, ei, eurl, sasu, scored, best, microPlafond }
  }, [params])

  // Delta et animation "nouvelle recommandation"
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

  const ben = Math.max(0, params.ca - params.charges - params.amort)
  const microPlafond = MICRO_PLAFONDS[params.secteur].plafond
  const microExcluded = params.ca > microPlafond
  const seuil60k = ben > 60000
  const partsBase = params.situationFam !== 'celib' ? 2 : 1
  const parts = calcPartsTotal(partsBase, params.nbEnfants)
  const partsStr = parts % 1 === 0 ? parts.toFixed(0) : parts.toFixed(1).replace('.', ',')

  /* ── Graphique barres horizontales ── */
  const STRUCT_ORDER = ['EURL / SARL (IS)', 'SAS / SASU', 'EI (réel normal)', 'Micro-entreprise']
  const displayStructures = STRUCT_ORDER
    .map(name => results.scored.find(r => r.forme === name) || results.scored.find(r => r.forme.includes(name.split(' ')[0])))
    .filter(Boolean) as StructureResult[]

  const isBestForme = (forme: string) => forme === results.best.forme

  const chartData = {
    labels: displayStructures.map(r =>
      r.forme === 'Micro-entreprise' && microExcluded ? 'Micro (exclue)' :
      r.forme === 'EI (réel normal)' ? 'EI réel' :
      r.forme === 'EURL / SARL (IS)' ? 'EURL/SARL IS' :
      r.forme === 'SAS / SASU' ? 'SAS/SASU' : r.forme
    ),
    datasets: [{
      data: displayStructures.map(r =>
        r.forme === 'Micro-entreprise' && microExcluded ? 0 : Math.max(0, r.netAnnuel)
      ),
      backgroundColor: displayStructures.map(r =>
        microExcluded && r.forme === 'Micro-entreprise' ? 'rgba(148,163,184,.25)' :
        isBestForme(r.forme) ? '#1D4ED8' : 'rgba(148,163,184,.55)'
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
    tooltip: {
      callbacks: {
        label: (tooltipItem: TooltipItem<'bar'>) => {
          const value = tooltipItem.parsed.x ?? 0
          return `${value}`
        },
      },
    },
  },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,.04)' },
        ticks: {
          font: { size: 10 },
          callback: (val: number | string) => `${Math.round(Number(val) / 1000)}k€`,
        },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#475569' },
      },
    },
  }

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
      tmi: 0,
    }
    setScenarios(prev => [...prev, sc])
    setActiveScenarioId(sc.id)
  }

  const loadScenario = (sc: Scenario) => {
    setParams({ ...sc.params })
    setActiveScenarioId(sc.id)
  }

  const removeScenario = (id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id))
    if (activeScenarioId === id) setActiveScenarioId(null)
  }

  /* ── Texte recommandation dynamique ── */
  const recoText = useMemo(() => {
    const f = results.best.forme
    const b = results.best
    if (f === 'EI (réel normal)') {
      return `Avec ${fmt(ben)} de bénéfice brut et ${partsStr} parts fiscales, votre TMI reste faible. L'EI au réel maximise votre revenu net sans la complexité d'une société.`
    } else if (f === 'EURL / SARL (IS)') {
      return `L'IS 15% sur les premiers 42 500 € de résultat est plus avantageux que votre TMI. La structure vous permet aussi de distribuer jusqu'à ${fmt(params.capital * 0.10)} en dividendes sans surcoût.`
    } else if (f === 'SAS / SASU') {
      return `Avec ${fmt(b.div || 0)} de dividendes sans cotisations sociales, la SASU est optimale. Elle offre aussi la meilleure protection sociale (AGIRC-ARRCO).`
    } else {
      return `L'abattement forfaitaire de ${Math.round((MICRO_PLAFONDS[params.secteur].abat) * 100)}% est très avantageux avec vos charges actuelles. Gestion ultra-simplifiée.`
    }
  }, [results, ben, partsStr, params])

  const worst = results.scored[results.scored.length - 1]
  const gainVsWorst = results.best.netAnnuel - (worst?.netAnnuel || 0)

  /* ── URL vers simulateur avec params ── */
  const simulateurUrl = `/simulateur`

  const SELECT_CLS = "w-full px-2.5 py-2 text-sm border border-surface2 rounded-lg bg-white text-ink focus:outline-none focus:border-blue-mid transition-all cursor-pointer"

  return (
    <>
      <PageHeader />

      {/* ── HERO ── */}
      <div className="bg-navy border-b border-white/[0.06] relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.18)_0%,transparent_65%)] -top-24 -right-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-10 relative flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[10.5px] font-semibold tracking-widest uppercase text-blue-mid mb-2">Module exploration</div>
            <h1 className="font-display text-3xl font-black text-white tracking-tight mb-1.5">
              Explorez tous vos scénarios
            </h1>
            <p className="text-sm text-white/45 max-w-md">
              Ajustez vos paramètres en temps réel et voyez l&apos;impact immédiat sur chaque structure. Aucun bouton &ldquo;Calculer&rdquo;.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {scenarios.length < 3 && (
              <button onClick={captureScenario}
                className="px-4 py-2 text-sm font-semibold bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all whitespace-nowrap">
                📸 Capturer ce scénario
              </button>
            )}
            <Link href={simulateurUrl}
              className="px-4 py-2 text-sm font-semibold bg-blue text-white rounded-lg hover:bg-blue-dark transition-all whitespace-nowrap">
              Simulateur complet →
            </Link>
          </div>
        </div>
      </div>

      {/* ── QUESTIONS RAPIDES ── */}
      <div className="bg-white border-b border-surface2">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-ink3 uppercase tracking-wide flex-shrink-0">Et si…</span>
          {QUICK.map(q => (
            <button key={q.label} title={q.hint}
              onClick={() => setParams(prev => ({ ...prev, ...q.apply(prev) }))}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-full border border-surface2 text-ink3
                hover:border-blue-mid hover:text-blue-mid hover:bg-blue-bg transition-all whitespace-nowrap">
              {q.label}
            </button>
          ))}
          {(params.ca !== DEFAULT.ca || params.charges !== DEFAULT.charges || params.situationFam !== DEFAULT.situationFam) && (
            <button onClick={() => setParams(DEFAULT)}
              className="ml-auto px-3 py-1.5 text-[11px] font-semibold text-ink4 hover:text-red-600 transition-colors whitespace-nowrap">
              ↺ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

        {/* ════ PANNEAU GAUCHE ════ */}
        <div className="lg:sticky lg:top-4 space-y-4">

          {/* Section Activité */}
          <div className="bg-white rounded-xl border border-black/[0.07] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-4 rounded-full bg-blue" />
              <span className="text-[11.5px] font-bold text-ink2 uppercase tracking-wide">Activité</span>
            </div>

            {/* Secteur */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-ink3 uppercase tracking-wide block mb-1.5">Secteur</label>
              <select value={params.secteur} onChange={e => set('secteur', e.target.value as Secteur)} className={SELECT_CLS}>
                <option value="services_bic">Services BIC — abattement 50%</option>
                <option value="liberal_bnc">BNC libéral — abattement 34%</option>
                <option value="commerce">Commerce/vente — abattement 71%</option>
                <option value="btp">BTP/artisanat — abattement 50%</option>
              </select>
            </div>

            <SliderRow label="CA annuel HT" value={params.ca} min={20000} max={500000} step={5000}
              onChange={v => set('ca', v)}
              badge={
                <div className="flex items-center gap-2 mt-1">
                  {microExcluded
                    ? <span className="text-[10.5px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        Micro exclue (plafond {fmt(microPlafond)})
                      </span>
                    : <span className="text-[10.5px] text-ink4">
                        Micro possible · plafond {fmt(microPlafond)}
                      </span>
                  }
                </div>
              }
            />

            <SliderRow label="Charges d'exploitation"
              sub={params.ca > 0 ? `(${Math.round(params.charges / params.ca * 100)}% du CA)` : ''}
              value={params.charges} min={0} max={Math.round(params.ca * 0.85)} step={1000}
              onChange={v => set('charges', v)} />

            <SliderRow label="Amortissements" value={params.amort} min={0} max={50000} step={500}
              onChange={v => set('amort', v)} />

            <SliderRow label="Capital social (si société)"
              value={params.capital} min={1000} max={100000} step={1000}
              onChange={v => set('capital', v)}
              badge={
                <div className="text-[10.5px] text-ink4 mt-1">
                  Seuil dividendes sans cotis. TNS :{' '}
                  <span className={`font-semibold ${params.capital >= 30000 ? 'text-green-700' : 'text-amber-700'}`}>
                    {fmt(params.capital * 0.10)}
                  </span>
                </div>
              }
            />

            {/* Résultat calculé */}
            <div className="mt-2 bg-navy rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-[11px] text-white/50">Résultat avant rémunération</span>
              <span className="font-display text-xl font-black text-blue-mid">{fmt(ben)}</span>
            </div>

            {seuil60k && (
              <div className="mt-2 bg-blue-bg border border-blue-border rounded-lg px-3 py-2 text-[11.5px] text-blue-dark">
                ⚡ Bénéfice &gt; 60 000 € — l&apos;IS (EURL/SASU) devient généralement plus avantageux que l&apos;IR direct.
              </div>
            )}
          </div>

          {/* Section Foyer */}
          <div className="bg-white rounded-xl border border-black/[0.07] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-4 rounded-full bg-blue" />
              <span className="text-[11.5px] font-bold text-ink2 uppercase tracking-wide">Foyer fiscal</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] font-semibold text-ink3 uppercase tracking-wide block mb-1.5">Situation</label>
                <select value={params.situationFam}
                  onChange={e => set('situationFam', e.target.value as ExplorerParams['situationFam'])}
                  className={SELECT_CLS}>
                  <option value="celib">Célibataire</option>
                  <option value="marie">Marié(e)</option>
                  <option value="pacse">Pacsé(e)</option>
                  <option value="veuf">Veuf/veuve</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-ink3 uppercase tracking-wide block mb-1.5">Enfants</label>
                <select value={params.nbEnfants}
                  onChange={e => set('nbEnfants', parseInt(e.target.value))}
                  className={SELECT_CLS}>
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n === 0 ? 'Aucun' : `${n} enfant${n > 1 ? 's' : ''}`}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-surface rounded-lg px-3 py-2 flex items-center justify-between mb-3">
              <span className="text-[11.5px] text-ink3">Parts fiscales</span>
              <span className="font-display text-lg font-bold text-blue">{partsStr} parts</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-ink3 uppercase tracking-wide block mb-1.5">
                Autres revenus du foyer (€/an)
              </label>
              <input type="number" value={params.autresRev} min={0} step={1000}
                onChange={e => set('autresRev', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 text-sm border border-surface2 rounded-lg bg-white text-ink focus:outline-none focus:border-blue-mid transition-all" />
              <p className="text-[10.5px] text-ink4 mt-1">Salaire conjoint, revenus fonciers, etc.</p>
            </div>
          </div>

          {/* Section Stratégie */}
          <div className="bg-white rounded-xl border border-black/[0.07] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-4 rounded-full bg-blue" />
              <span className="text-[11.5px] font-bold text-ink2 uppercase tracking-wide">Stratégie</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {([['max', '💰 Tout se verser'], ['reserve', '🏦 Garder en réserve']] as const).map(([val, label]) => (
                <button key={val} onClick={() => set('strategie', val)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-[12px] font-semibold text-center transition-all ${
                    params.strategie === val
                      ? 'border-blue bg-blue-bg text-blue-dark'
                      : 'border-surface2 text-ink3 hover:border-ink4'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {params.strategie === 'reserve' && (
              <SliderRow label="Montant en réserves"
                value={params.reserveVoulue} min={0} max={ben || 1} step={1000}
                onChange={v => set('reserveVoulue', v)} />
            )}

            <div>
              <label className="text-[11px] font-semibold text-ink3 uppercase tracking-wide block mb-1.5">
                Versements PER annuels (€)
              </label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={Math.round(Math.min(35194, ben * 0.10) || 3500)} step={500}
                  value={params.perMontant}
                  onChange={e => set('perMontant', parseInt(e.target.value))}
                  className="flex-1 h-1.5 rounded-full cursor-pointer accent-blue" />
                <input type="number" value={params.perMontant} min={0} step={500}
                  onChange={e => set('perMontant', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 px-2 py-1 text-[12px] text-right border border-surface2 rounded-lg bg-white text-ink focus:outline-none focus:border-blue-mid" />
              </div>
              <p className="text-[10.5px] text-ink4 mt-1">Plafond estimé : {fmt(Math.round(Math.min(35194, ben * 0.10)))}</p>
            </div>
          </div>

          {/* Scénarios sauvegardés */}
          {scenarios.length > 0 && (
            <div className="bg-white rounded-xl border border-black/[0.07] shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11.5px] font-bold text-ink2 uppercase tracking-wide">Scénarios sauvegardés</span>
                {scenarios.length < 3 && (
                  <button onClick={captureScenario}
                    className="text-[11px] font-semibold text-blue hover:text-blue-dark transition-colors">
                    + Capturer
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {scenarios.map(sc => (
                  <div key={sc.id}
                    className={`rounded-lg border p-3 transition-all ${activeScenarioId === sc.id ? 'border-blue bg-blue-bg' : 'border-surface2 bg-surface'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-bold text-ink">{sc.name}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => loadScenario(sc)}
                          className="text-[10.5px] font-semibold text-blue hover:text-blue-dark px-2 py-0.5 rounded transition-colors">
                          ↩ Charger
                        </button>
                        <button onClick={() => removeScenario(sc.id)}
                          className="text-[10.5px] font-semibold text-red-500 hover:text-red-700 px-1 py-0.5 transition-colors">
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-ink3">
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

          {/* Tableau comparaison scénarios */}
          {scenarios.length >= 2 && (
            <div className="bg-white rounded-xl border border-black/[0.07] shadow-sm overflow-hidden">
              <div className="bg-ink px-4 py-3">
                <h3 className="text-sm font-bold text-white">Comparaison des scénarios</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-surface border-b border-surface2">
                      <th className="text-left px-3 py-2 text-ink3 font-semibold"></th>
                      {scenarios.map(sc => (
                        <th key={sc.id} className="text-right px-3 py-2 text-ink3 font-semibold">{sc.name}</th>
                      ))}
                      {scenarios.length === 2 && <th className="text-right px-3 py-2 text-ink3 font-semibold">Écart</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'CA', getValue: (sc: Scenario) => fmt(sc.params.ca) },
                      { label: 'Structure rec.', getValue: (sc: Scenario) => sc.best.replace('EURL / SARL (IS)', 'EURL IS').replace('SAS / SASU', 'SASU').replace('EI (réel normal)', 'EI') },
                      { label: 'Net recommandé', getValue: (sc: Scenario) => fmt(sc.bestNet), numeric: true },
                    ].map(({ label, getValue, numeric }) => (
                      <tr key={label} className="border-b border-surface2 hover:bg-surface/50">
                        <td className="px-3 py-2 text-ink3 font-medium">{label}</td>
                        {scenarios.map(sc => (
                          <td key={sc.id} className={`px-3 py-2 text-right font-semibold text-ink`}>{getValue(sc)}</td>
                        ))}
                        {scenarios.length === 2 && numeric && (
                          <td className="px-3 py-2 text-right font-bold">
                            {(() => {
                              const a = scenarios[0].bestNet, b = scenarios[1].bestNet
                              const diff = b - a
                              return <span className={diff >= 0 ? 'text-green-700' : 'text-red-600'}>
                                {diff >= 0 ? '+' : ''}{fmt(diff)}
                              </span>
                            })()}
                          </td>
                        )}
                        {scenarios.length === 2 && !numeric && <td className="px-3 py-2"></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Graphique + delta */}
          <div className="bg-white rounded-xl border border-black/[0.07] shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-bold text-ink">Revenu net annuel</h2>
                <p className="text-[11.5px] text-ink3 mt-0.5">Après IR, cotisations et IS</p>
              </div>
              {/* Delta animé */}
              <div className={`transition-all duration-300 ${delta.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-bold ${
                  delta.value >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {delta.value >= 0 ? '↑' : '↓'} {delta.value >= 0 ? '+' : ''}{fmt(Math.abs(delta.value))}/an
                </span>
              </div>
            </div>

            {/* Animation "Nouvelle recommandation" */}
            {newBestAlert && (
              <div className="mb-3 animate-pulse">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue text-white text-[12px] font-bold rounded-full">
                  ✦ Nouvelle recommandation : {results.best.forme}
                </span>
              </div>
            )}

            <div style={{ height: '200px' }}>
              <Bar data={chartData} options={chartOptions} />
            </div>

            {/* Légende inline */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue" />
                <span className="text-[11px] text-ink3">Recommandée</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-300" />
                <span className="text-[11px] text-ink3">Autres structures</span>
              </div>
              {microExcluded && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-slate-200 border border-dashed border-slate-400" />
                  <span className="text-[11px] text-ink3">Micro non éligible</span>
                </div>
              )}
            </div>
          </div>

          {/* Tableau condensé */}
          <div className="bg-white rounded-xl border border-black/[0.07] shadow-sm overflow-hidden">
            <div className="bg-surface border-b border-surface2 px-4 py-3">
              <h3 className="font-display text-[13px] font-bold text-ink">Comparatif détaillé</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-surface2">
                    {['Structure', 'Net/an', 'Cotisations', 'IR', 'IS', 'Score'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold tracking-wide uppercase text-ink3 px-3 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.scored.map((r, i) => {
                    const isBest = i === 0
                    const isExcluded = r.forme === 'Micro-entreprise' && microExcluded
                    return (
                      <tr key={r.forme}
                        className={`border-b border-surface2 transition-colors ${isBest ? 'bg-blue-bg' : 'hover:bg-surface/50'}`}
                        style={isBest ? { borderLeft: '3px solid #1D4ED8' } : {}}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[12px] font-bold ${isExcluded ? 'text-ink4 line-through' : 'text-ink'}`}>
                              {r.forme.replace('EURL / SARL (IS)', 'EURL/SARL IS').replace('EI (réel normal)', 'EI réel')}
                            </span>
                            {isBest && !isExcluded && (
                              <span className="text-[9.5px] font-bold bg-blue text-white px-1.5 py-0.5 rounded-full">★</span>
                            )}
                            {isExcluded && (
                              <span className="text-[9.5px] text-red-500 font-semibold">exclue</span>
                            )}
                          </div>
                        </td>
                        <td className={`px-3 py-2.5 text-[12px] font-bold ${isExcluded ? 'text-ink4' : 'text-green-700'}`}>
                          {isExcluded ? '—' : fmt(r.netAnnuel)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-red-500">−{fmt(r.charges)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-ink3">−{fmt(r.ir)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-ink3">{r.is > 0 ? `−${fmt(r.is)}` : '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[12px] font-semibold ${isBest ? 'text-blue' : 'text-ink3'}`}>{r.scoreTotal}/100</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bloc recommandation */}
          <div className="bg-navy rounded-xl p-6 relative overflow-hidden">
            <div className="absolute w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.25)_0%,transparent_65%)] -top-24 -right-12 pointer-events-none" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-blue-mid mb-1.5">✦ Structure recommandée</div>
                  <div className="font-display text-2xl font-black text-white tracking-tight">
                    {results.best.forme.replace('EURL / SARL (IS)', 'EURL / SARL IS').replace('EI (réel normal)', 'EI réel')}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display text-2xl font-black text-blue-mid">{fmt(results.best.netAnnuel)}</div>
                  <div className="text-[11px] text-white/40">net / an</div>
                </div>
              </div>
              <p className="text-[12.5px] text-white/55 leading-relaxed mb-4">{recoText}</p>
              {gainVsWorst > 500 && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full mb-4"
                  style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.28)', color: '#86efac' }}>
                  💰 +{fmt(gainVsWorst)} vs la moins favorable
                </div>
              )}
              <div className="flex gap-3 flex-wrap">
                <Link href={simulateurUrl}
                  className="px-4 py-2.5 bg-blue text-white font-bold text-sm rounded-lg hover:bg-blue-dark transition-all">
                  Voir l&apos;analyse complète →
                </Link>
                <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2.5 font-semibold text-sm rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all">
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
