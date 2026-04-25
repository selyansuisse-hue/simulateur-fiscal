'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip,
} from 'chart.js'
import type { ChartOptions, TooltipItem } from 'chart.js'
import { fmt } from '@/lib/utils'
import { calcMicro, calcEIReel, calcEURL, calcSASU, scoreMulti } from '@/lib/fiscal/structures'
import { calcPartsTotal, tmiRate } from '@/lib/fiscal/ir'
import { MICRO_PLAFONDS, SimParams, StructureResult, Secteur } from '@/lib/fiscal/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'

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

function getTMI(r: StructureResult, autresRev: number, partsBase: number, nbEnfants: number): number {
  return Math.round(tmiRate(
    (r.baseIR ?? r.bNet ?? r.ben ?? 0) + autresRev,
    partsBase, nbEnfants
  ) * 100)
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

/* ── SidebarSection ── */
function SidebarSection({ title, icon, color, children }: {
  title: string; icon: string; color: string; children: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '4px', height: '16px', borderRadius: '2px', background: color }} />
        <span style={{ fontSize: '10px', fontWeight: 800, color, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
          {icon} {title}
        </span>
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
        {children}
      </div>
    </div>
  )
}

/* ── SliderField ── */
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
            background: '#F8FAFF', border: '1px solid #E2E8F0',
            borderRadius: '8px', padding: '3px 10px',
            fontSize: '13px', fontWeight: 700, color: '#0F172A', outline: 'none',
          }}
        />
      </div>
      <input type="range" min={min} max={safeMax} step={step} value={sliderVal}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
        style={{
          height: '4px', accentColor: '#3B82F6',
          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct}%, #E2E8F0 ${pct}%, #E2E8F0 100%)`,
        }}
      />
      {hint && (
        <div style={{ fontSize: '10px', marginTop: '4px', color: hintColor || '#94A3B8', fontWeight: 500 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#475569' }
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '9px',
  border: '1px solid #E2E8F0', background: '#F8FAFF',
  fontSize: '12px', fontWeight: 600, color: '#334155',
  cursor: 'pointer', outline: 'none',
}

/* ── Page principale ── */
export default function ExplorerPage() {
  const router = useRouter()
  const [params, setParams] = useState<ExplorerParams>(DEFAULT)
  const [isPrefilledFromSim, setIsPrefilledFromSim] = useState(false)
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

  /* ── "Et si..." avec impact ── */
  const quickWithImpact = useMemo(() => QUICK_DEFS.map(q => {
    const newP = { ...params, ...q.apply(params) }
    const diff = calcBestNet(newP) - results.best.netAnnuel
    return { ...q, impact: diff }
  }), [params, results.best.netAnnuel])

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

  const tmiColor = tmi <= 11 ? '#059669' : tmi <= 30 ? '#D97706' : '#DC2626'

  const kpiDeltaVal = delta.visible && Math.abs(delta.value) > 100 ? delta.value : null

  return (
    <>
      <PageHeader />
      <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

        {/* ── HEADER PAGE ── */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          padding: '16px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
              Explorateur de scénarios
            </h1>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '3px 0 0', lineHeight: 1 }}>
              Ajustez vos paramètres — les résultats se mettent à jour instantanément
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            {isPrefilledFromSim && (
              <span style={{
                fontSize: '11px', fontWeight: 600, color: '#2563EB',
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                padding: '4px 10px', borderRadius: '999px',
              }}>
                ✓ Pré-rempli depuis votre simulation
              </span>
            )}
            <Link href="/simulateur" style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '12px',
              fontWeight: 700, textDecoration: 'none',
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              color: '#fff', boxShadow: '0 2px 8px rgba(29,78,216,0.25)',
            }}>
              Simulateur complet →
            </Link>
          </div>
        </div>

        {/* ── BARRE KPIs ── */}
        <div style={{
          position: 'sticky', top: '64px', zIndex: 40,
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
            maxWidth: '1400px', margin: '0 auto',
          }} className="!grid-cols-2 lg:!grid-cols-4">
            {[
              {
                label: 'Meilleur revenu net',
                value: fmt(results.best.netAnnuel),
                sub: `${fmt(Math.round(results.best.netAnnuel / 12))}/mois · ${results.best.forme.replace('EURL / SARL (IS)', 'EURL IS').replace('EI (réel normal)', 'EI').replace('SAS / SASU', 'SASU')}`,
                color: '#2563EB', icon: '💰',
                delta: kpiDeltaVal,
              },
              {
                label: 'TMI',
                value: `${tmi}%`,
                sub: tmi <= 11 ? 'Tranche basse ✓' : tmi <= 30 ? 'Tranche intermédiaire' : 'Tranche haute ⚠',
                color: tmiColor, icon: '📊',
                delta: null,
              },
              {
                label: 'Gain vs moins avantageux',
                value: `+${fmt(gainVsWorst)}`,
                sub: 'par an',
                color: '#059669', icon: '📈',
                delta: null,
              },
              {
                label: 'Résultat avant rémunération',
                value: fmt(ben),
                sub: 'CA − charges − amortissements',
                color: '#0F172A', icon: '📋',
                delta: null,
              },
            ].map((kpi, i) => (
              <div key={i} style={{
                padding: '14px 20px',
                borderRight: i < 3 ? '1px solid #F1F5F9' : 'none',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: kpi.color + '15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', flexShrink: 0,
                }}>
                  {kpi.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: kpi.color, letterSpacing: '-0.03em', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {kpi.value}
                    {kpi.delta !== null && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                        background: kpi.delta >= 0 ? '#ECFDF5' : '#FEF2F2',
                        color: kpi.delta >= 0 ? '#059669' : '#DC2626',
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
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {kpi.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CORPS PRINCIPAL ── */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '0' }}
          className="!grid-cols-1 lg:!grid-cols-[320px_1fr]">

          {/* ════ SIDEBAR GAUCHE ════ */}
          <div style={{
            background: '#fff', borderRight: '1px solid #E2E8F0',
            padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
          }} className="lg:sticky lg:top-[196px] lg:overflow-y-auto lg:max-h-[calc(100vh-196px)]">

            {/* Section Activité */}
            <SidebarSection title="Activité" icon="📊" color="#3B82F6">
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
                hintColor={microExcluded ? '#D97706' : '#059669'}
              />

              <SliderField label="Charges d'exploitation" value={params.charges}
                onChange={v => set('charges', v)}
                min={0} max={Math.max(Math.round(params.ca * 0.9), 10000)} step={1000}
                hint={params.ca > 0 ? `${(params.charges / params.ca * 100).toFixed(0)}% du CA` : undefined}
              />

              <SliderField label="Amortissements" value={params.amort}
                onChange={v => set('amort', v)} min={0} max={200000} step={500}
              />

              <SliderField label="Capital social (société IS)" value={params.capital}
                onChange={v => set('capital', v)} min={1000} max={500000} step={1000}
                hint={`Seuil dividendes TNS : ${fmt(params.capital * 0.10)}`}
                hintColor="#64748B"
              />

              {/* Résultat avant rémun */}
              <div style={{
                background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                    Résultat avant rémunération
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#1D4ED8', letterSpacing: '-0.03em' }}>
                    {fmt(ben)}
                  </div>
                </div>
                {seuil60k && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '4px 10px', fontSize: '10px', fontWeight: 700, color: '#92400E' }}>
                    ⚡ Zone IS
                  </div>
                )}
              </div>
            </SidebarSection>

            {/* Section Foyer */}
            <SidebarSection title="Foyer fiscal" icon="👨‍👩‍👧" color="#8B5CF6">
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
              <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#7C3AED' }}>Parts fiscales</span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#6D28D9' }}>{partsStr} parts</span>
              </div>
              <SliderField label="Autres revenus du foyer (€/an)" value={params.autresRev}
                onChange={v => set('autresRev', Math.max(0, v))} min={0} max={200000} step={1000}
                hint="Salaire conjoint, revenus fonciers..."
              />
            </SidebarSection>

            {/* Section Stratégie */}
            <SidebarSection title="Stratégie & Optimisation" icon="🎯" color="#059669">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {([['max', '💰 Tout percevoir'], ['reserve', '🏦 Garder réserves']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => set('strategie', val)}
                    style={{
                      padding: '10px', borderRadius: '10px', cursor: 'pointer',
                      border: params.strategie === val ? '2px solid #059669' : '1.5px solid #E2E8F0',
                      background: params.strategie === val ? '#ECFDF5' : '#F8FAFF',
                      color: params.strategie === val ? '#065F46' : '#64748B',
                      fontSize: '11px', fontWeight: 700, transition: 'all 150ms',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {params.strategie === 'reserve' && (
                <SliderField label="Montant en réserves" value={params.reserveVoulue}
                  onChange={v => set('reserveVoulue', v)} min={0} max={Math.max(ben, 1)} step={1000}
                />
              )}

              <SliderField label="Versements PER annuels" value={params.perMontant}
                onChange={v => set('perMontant', Math.max(0, v))}
                min={0} max={perPlafond} step={500}
                hint={params.perMontant > 0
                  ? `Économie IR estimée : ~${fmt(Math.round(params.perMontant * tmi / 100))}/an`
                  : `Plafond : ${fmt(perPlafond)}`}
                hintColor={params.perMontant > 0 ? '#059669' : '#94A3B8'}
              />
            </SidebarSection>

            {/* Réinitialiser */}
            {(params.ca !== DEFAULT.ca || params.charges !== DEFAULT.charges || params.situationFam !== DEFAULT.situationFam) && (
              <button onClick={() => { setParams(DEFAULT); setIsPrefilledFromSim(false) }}
                style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', textAlign: 'left' }}>
                ↺ Réinitialiser les paramètres
              </button>
            )}
          </div>

          {/* ════ ZONE PRINCIPALE DROITE ════ */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Boutons "Et si..." */}
            <div style={{
              background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0',
              padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center',
              overflowX: 'auto', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, marginRight: '4px' }}>
                Scénarios rapides :
              </span>
              {quickWithImpact.map(q => (
                <button key={q.label} title={q.hint}
                  onClick={() => setParams(prev => ({ ...prev, ...q.apply(prev) }))}
                  style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: '999px',
                    cursor: 'pointer', transition: 'all 150ms', outline: 'none',
                    border: '1.5px solid #E2E8F0', background: '#F8FAFF',
                  }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{q.label}</div>
                  {Math.abs(q.impact) > 100 && (
                    <div style={{ fontSize: '10px', fontWeight: 800, color: q.impact > 0 ? '#059669' : '#DC2626' }}>
                      {q.impact > 0 ? '+' : ''}{fmt(Math.round(q.impact))}/an
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Graphique barres */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Revenu net annuel par structure</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[
                    { color: '#3B82F6', label: 'Recommandée' },
                    { color: '#CBD5E1', label: 'Autres' },
                    ...(microExcluded ? [{ color: '#F1F5F9', label: 'Non éligible' }] : []),
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color, border: l.color === '#F1F5F9' ? '1px solid #E2E8F0' : 'none' }} />
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: '180px' }}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Tableau comparatif */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Comparatif détaillé</span>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Même CA · mêmes charges · même foyer</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFF' }}>
                      <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Structure</th>
                      {['Net/an', 'Net/mois', 'Cotisations', 'IR', 'TMI', 'Score'].map(h => (
                        <th key={h} style={{ textAlign: 'right', padding: '10px 14px', fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.scored.map((r, i) => {
                      const isBest = i === 0
                      const isExcluded = r.forme === 'Micro-entreprise' && microExcluded
                      const structTmi = getTMI(r, params.autresRev, partsBase, params.nbEnfants)
                      const tmiPillColor = structTmi <= 11 ? '#059669' : structTmi <= 30 ? '#D97706' : '#DC2626'
                      const tmiPillBg = structTmi <= 11 ? '#ECFDF5' : structTmi <= 30 ? '#FFFBEB' : '#FEF2F2'
                      return (
                        <tr key={r.forme} style={{ borderTop: '1px solid #F1F5F9', background: isBest && !isExcluded ? '#EFF6FF' : 'transparent' }}>
                          <td style={{ padding: '12px 20px', minWidth: '140px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isBest && !isExcluded && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />}
                              <div>
                                <div style={{
                                  fontSize: '13px', fontWeight: isBest && !isExcluded ? 700 : 500,
                                  color: isExcluded ? '#94A3B8' : isBest ? '#1D4ED8' : '#334155',
                                  textDecoration: isExcluded ? 'line-through' : 'none',
                                }}>
                                  {r.forme.replace(' / SARL (IS)', '').replace(' / SASU', '')}
                                </div>
                                {isBest && !isExcluded && <div style={{ fontSize: '10px', color: '#3B82F6', fontWeight: 600 }}>★ Recommandée</div>}
                                {isExcluded && <div style={{ fontSize: '10px', color: '#DC2626', fontWeight: 600 }}>Hors plafond</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: isExcluded ? '#CBD5E1' : isBest ? '#1D4ED8' : '#0F172A' }}>
                              {isExcluded ? '—' : fmt(r.netAnnuel)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                            {isExcluded ? '—' : fmt(Math.round(r.netAnnuel / 12))}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: isExcluded ? '#CBD5E1' : '#EF4444' }}>
                            {isExcluded ? '—' : `−${fmt(r.charges)}`}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: isExcluded ? '#CBD5E1' : '#F59E0B' }}>
                            {isExcluded ? '—' : `−${fmt(r.ir)}`}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                            {!isExcluded && (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', background: tmiPillBg, color: tmiPillColor }}>
                                {structTmi}%
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: isBest && !isExcluded ? '#3B82F6' : '#94A3B8' }}>
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

            {/* Recommandation + Ce que ça change */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
              className="!grid-cols-1 lg:!grid-cols-2">

              {/* Card recommandation — bleue */}
              <div style={{
                background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                borderRadius: '16px', padding: '22px',
                boxShadow: '0 4px 20px rgba(29,78,216,0.28)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', right: '-4rem', top: '-4rem', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', opacity: 0.7, display: 'inline-block' }} />
                    Structure recommandée
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                    {results.best.forme}
                  </div>
                  <div style={{ fontSize: '34px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px' }}>
                    {fmt(results.best.netAnnuel)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                    {fmt(Math.round(results.best.netAnnuel / 12))}/mois net après impôts
                  </div>
                  {gainVsWorst > 500 && (
                    <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '8px 12px', marginBottom: '16px', fontSize: '12px', fontWeight: 800, color: '#fff' }}>
                      +{fmt(gainVsWorst)}/an vs moins avantageuse
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => router.push('/simulateur')} style={{
                      flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                      border: 'none', fontWeight: 700, fontSize: '12px',
                      background: 'rgba(255,255,255,0.18)', color: '#fff',
                    }}>
                      Analyse complète →
                    </button>
                    <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.25)',
                        fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.75)',
                        textDecoration: 'none', textAlign: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      Prendre RDV
                    </a>
                  </div>
                </div>
              </div>

              {/* Ce que ça change — colored tiles */}
              <div style={{ background: '#fff', borderRadius: '16px', padding: '22px', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
                  💡 Ce que ça change concrètement
                </div>
                {[
                  { label: 'Revenu mensuel net', val: fmt(Math.round(results.best.netAnnuel / 12)), color: '#1D4ED8', bg: '#EFF6FF' },
                  { label: 'Charges sociales/an', val: `−${fmt(results.best.charges)}`, color: '#DC2626', bg: '#FEF2F2' },
                  { label: 'IR estimé/an', val: `−${fmt(results.best.ir)}`, color: '#D97706', bg: '#FFFBEB' },
                  ...(results.best.is > 0 ? [{ label: 'IS estimé', val: `−${fmt(results.best.is)}`, color: '#6366F1', bg: '#EEF2FF' }] : []),
                  ...(gainVsWorst > 500 ? [{ label: 'Gain vs moins avantageux', val: `+${fmt(gainVsWorst)}/an`, color: '#059669', bg: '#ECFDF5' }] : []),
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 12px', borderRadius: '10px', background: row.bg, marginBottom: '6px',
                  }}>
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{row.label}</span>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: row.color }}>{row.val}</span>
                  </div>
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
