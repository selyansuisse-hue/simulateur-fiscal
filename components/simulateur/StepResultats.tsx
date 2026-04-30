'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt } from '@/lib/utils'
import { tmiRate, calcPartsTotal } from '@/lib/fiscal/ir'
import { StructureResult } from '@/lib/fiscal'
import { SimParams } from '@/lib/fiscal/types'
import { SaveSimulationModal } from '@/components/simulateur/SaveSimulationModal'

function genAnalyse(best: StructureResult, params: SimParams, tmi: number, gain: number, scored: StructureResult[]) {
  const ben = Math.max(0, params.ca - params.charges - params.amort - params.deficit)
  const parts = calcPartsTotal(params.partsBase, params.nbEnfants)
  const partsStr = parts % 1 === 0 ? parts.toString() : parts.toFixed(1).replace('.', ',')
  const situStr = params.partsBase === 2
    ? `couple${params.nbEnfants > 0 ? ` avec ${params.nbEnfants} enfant${params.nbEnfants > 1 ? 's' : ''}` : ''}`
    : 'célibataire'
  const f = best.forme
  const gainStr = gain > 500 ? ` Cet avantage représente ${fmt(gain)}/an (${fmt(Math.round(gain / 12))}/mois) de plus vs la structure la moins avantageuse.` : ''
  const second = scored.find(r => r.forme !== f)
  const vsSecond = second ? best.netAnnuel - second.netAnnuel : 0
  let pourquoi = '', attention = ''

  if (f === 'EI (réel normal)') {
    pourquoi = `Avec un CA de ${fmt(params.ca)} et un résultat avant rémunération de ${fmt(ben)}, en situation de ${situStr} (${partsStr} parts), votre TMI reste à ${tmi}%. L'EI au réel permet de déduire toutes vos charges réelles et bénéficie de cotisations SSI calculées par composante — sans surcoût lié à l'IS.${gainStr}`
    attention = `Si votre résultat avant rémunération dépasse 60 000 €/an, le passage en EURL ou SASU devient avantageux : l'IS 15% sera inférieur à votre TMI IR (${tmi}%).${vsSecond > 200 ? ` Actuellement vous êtes déjà à ${fmt(vsSecond)} au-dessus de la structure suivante.` : ''}`
  } else if (f === 'EURL / SARL (IS)') {
    const tauxIS = ben > 42500 ? `15% jusqu'à 42 500 € puis 25% au-delà` : `15% sur l'intégralité de votre résultat`
    pourquoi = `Avec un résultat avant rémunération de ${fmt(ben)} et un TMI personnel de ${tmi}%, l'IS (${tauxIS}) est moins coûteux que l'IR direct. La rémunération TNS est déductible de l'IS, et la séparation patrimoine personnel/société limite votre exposition personnelle.${gainStr}`
    const seuilDiv = Math.round(params.capital * 0.10)
    attention = `Les dividendes supérieurs à ${fmt(seuilDiv)} (10% du capital de ${fmt(params.capital)}) supportent les cotisations TNS (~45%). Augmenter le capital social ou opter pour une distribution limitée préserve l'optimisation.`
  } else if (f === 'SAS / SASU') {
    pourquoi = `Avec un CA de ${fmt(params.ca)} et un résultat avant rémunération de ${fmt(ben)}, la SASU combine salaire de président (cotisations assimilé salarié, droits chômage exclus) et dividendes sans cotisations sociales. C'est la seule structure offrant ce double avantage en France.${gainStr}`
    attention = `En tant que président de SASU, vous n'êtes pas couvert par France Travail. Un contrat GSC (assurance perte d'emploi) est fortement recommandé et déductible de l'IS.`
  } else {
    const abatPct = Math.round((params.abat || 0.5) * 100)
    const pctPlafond = Math.round(params.ca / 77700 * 100)
    pourquoi = `Avec un CA de ${fmt(params.ca)}, le régime micro offre l'abattement forfaitaire de ${abatPct}% sans comptabilité obligatoire. Vos charges réelles étant inférieures à cet abattement, ce régime maximise votre revenu net.${gainStr}`
    attention = `Votre CA représente ${pctPlafond}% du plafond micro (77 700 €). ${pctPlafond >= 80 ? `Le dépassement deux années consécutives impose le régime réel — anticipez la transition.` : `Surveillez l'évolution de votre CA pour anticiper le changement de régime le cas échéant.`}`
  }
  return { pourquoi, attention }
}

interface LevierCardDef {
  icon: string
  titre: string
  detail: string
  gainDefault: number
  explication: string
  inputLabel: string
  inputMax: number
  inputDefault: number
  calcGain: (val: number) => number
}

function LevierCard({ icon, titre, detail, gainDefault, explication, inputLabel, inputMax, inputDefault, calcGain }: LevierCardDef) {
  const [expanded, setExpanded] = useState(false)
  const [inputVal, setInputVal] = useState(Math.max(0, inputDefault))
  const gainCalcule = calcGain(inputVal)
  const step = Math.max(1, Math.round(inputMax / 50))

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="text-sm font-bold text-white">{titre}</div>
            <div className="text-xs text-white/40 mt-0.5">{detail}</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display text-lg font-black text-emerald-400">+{fmt(gainCalcule > 0 ? gainCalcule : gainDefault)}/an</div>
        </div>
      </div>
      <div className="px-5 pb-4">
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold px-3 py-2 rounded-lg transition-all w-full text-center"
          style={{
            background: expanded ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.07)',
            color: expanded ? '#34D399' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${expanded ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
          }}>
          {expanded ? '▲ Fermer le simulateur' : '▼ Simuler mon économie'}
        </button>
      </div>
      {expanded && (
        <div className="px-5 pb-5 pt-4 flex-1"
          style={{ background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-white/50 leading-relaxed mb-4">{explication}</p>
          {inputMax > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-white/40 mb-1.5">
                <label>{inputLabel}</label>
                <span className="font-bold text-white/70">{inputVal.toLocaleString('fr-FR')} €</span>
              </div>
              <input type="range" min={0} max={inputMax} step={step}
                value={inputVal} onChange={e => setInputVal(Number(e.target.value))}
                className="w-full h-1.5 accent-emerald-500" />
              <div className="flex justify-between text-[10px] text-white/20 mt-1">
                <span>0</span>
                <span>{fmt(inputMax)}</span>
              </div>
            </div>
          )}
          <div className="rounded-xl px-4 py-3 flex justify-between items-center"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <span className="text-xs text-emerald-400/70">Économie estimée</span>
            <span className="font-display text-lg font-black text-emerald-400">
              +{fmt(gainCalcule > 0 ? gainCalcule : gainDefault)}/an
            </span>
          </div>
          <p className="text-[10px] text-white/20 mt-2 text-center">
            Estimation indicative · Valider avec votre expert-comptable
          </p>
        </div>
      )}
    </div>
  )
}

export function StepResultats() {
  const { results, params, prevStep } = useSimulateur()
  const [showSaveModal, setShowSaveModal] = useState(false)

  if (!results) return null
  const { scored, best, tmi, gain } = results

  const { pourquoi, attention } = genAnalyse(best, params, tmi, gain, scored)
  const benBrut = Math.max(0, params.ca - params.charges - params.amort - params.deficit)

  const scenarioOptimise = useMemo(() => {
    const perMax = Math.min(35194, benBrut * 0.10)
    const perGain = Math.round(perMax * tmi / 100)
    const ikGain = Math.round(8000 * 0.636 * 0.15)
    const domGain = 360
    const prevGain = Math.round(benBrut * 0.02 * 0.15)
    const gainTotal = perGain + ikGain + domGain + prevGain
    return {
      perMax: Math.round(perMax),
      perGain, ikGain, domGain, prevGain, gainTotal,
      netOptimise: Math.round(best.netAnnuel + gainTotal),
    }
  }, [benBrut, tmi, best.netAnnuel])

  const count = scored.length
  const cardsGrid =
    count >= 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
    count === 3 ? 'grid-cols-1 sm:grid-cols-3' :
    'grid-cols-1 sm:grid-cols-2'

  const hasTNS = scored.some(r => r.forme === 'EI (réel normal)' || r.forme === 'EURL / SARL (IS)')
  const explorerUrl = `/explorer?ca=${params.ca}&charges=${params.charges}&amort=${params.amort}&capital=${params.capital}&sitfam=${params.partsBase === 2 ? 'marie' : 'celib'}&enfants=${params.nbEnfants}&per=${params.perMontant}&autresrev=${params.autresRev}&secteur=${params.secteur}&source=simulation`

  return (
    <div className="animate-stepIn pb-28 space-y-6">

      {/* ── HERO RÉSULTAT ── */}
      <div className="rounded-3xl p-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d1627 0%, #0d1f3c 100%)' }}>
        <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(37,99,235,.18) 0%,transparent 65%)', top: '-9rem', right: '-6rem' }} />
        <div className="relative">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Structure recommandée
          </div>
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <div className="text-white/60 text-sm mb-1">{best.forme}</div>
              <div className="text-5xl sm:text-6xl font-bold text-white tracking-tight leading-none">
                {fmt(best.netAnnuel)}
              </div>
              <div className="text-white/50 text-base mt-2">
                {fmt(Math.round(best.netAnnuel / 12))}/mois après IR, cotisations et IS
              </div>
            </div>
            {gain > 500 && (
              <div className="text-right hidden sm:block flex-shrink-0">
                <div className="text-xs text-white/40 mb-1">Gain vs moins avantageuse</div>
                <div className="text-2xl font-bold text-emerald-400">+{fmt(gain)}</div>
                <div className="text-xs text-emerald-400/60">par an</div>
              </div>
            )}
          </div>
          <div className="border-t border-white/10 pt-5">
            <div className="text-xs text-white/40 uppercase tracking-wide mb-3">
              Décomposition de votre CA de {fmt(params.ca)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { label: 'Revenu net', val: best.netAnnuel, color: 'bg-emerald-500', pct: params.ca > 0 ? best.netAnnuel / params.ca * 100 : 0 },
                { label: 'Charges sociales', val: best.charges, color: 'bg-red-500', pct: params.ca > 0 ? best.charges / params.ca * 100 : 0 },
                { label: 'IR estimé', val: best.ir, color: 'bg-orange-400', pct: params.ca > 0 ? best.ir / params.ca * 100 : 0 },
                { label: 'IS estimé', val: best.is || 0, color: 'bg-blue-400', pct: params.ca > 0 ? (best.is || 0) / params.ca * 100 : 0 },
              ] as const).map(item => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <div className="text-xs text-white/50">{item.label}</div>
                  </div>
                  <div className="text-lg font-bold text-white">{fmt(Math.round(item.val))}</div>
                  <div className="text-xs text-white/30 mt-0.5">{item.pct.toFixed(0)}% du CA</div>
                  <div className="mt-2 h-1 bg-white/10 rounded-full">
                    <div className={`h-1 rounded-full ${item.color} opacity-60`}
                      style={{ width: `${Math.min(100, item.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/10">
            <span className={`text-xs px-3 py-1 rounded-full font-medium
              ${tmi <= 11 ? 'bg-emerald-500/20 text-emerald-400' :
                tmi <= 30 ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'}`}>
              TMI {tmi}%
            </span>
            <span className="bg-white/15 text-white text-xs px-3 py-1 rounded-full">
              Score {best.scoreTotal}/100
            </span>
            {best.scoreBreakdown && (
              <span className="text-white/30 text-xs">
                Net {best.scoreBreakdown.netScore}/{best.scoreBreakdown.netMax} · Flex. {best.scoreBreakdown.flexScore}/{best.scoreBreakdown.flexMax} · Prot. {best.scoreBreakdown.protScore}/{best.scoreBreakdown.protMax} · Admin {best.scoreBreakdown.adminScore}/{best.scoreBreakdown.adminMax}
              </span>
            )}
            {gain > 500 && (
              <span className="bg-emerald-500/15 text-emerald-400 text-xs px-3 py-1 rounded-full font-medium">
                +{fmt(gain)}/an vs la moins avantageuse
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── POURQUOI CE CHOIX ── */}
      <div>
        <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-3">
          Pourquoi ce choix ?
          <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg, #0f2a52 0%, #0d1f3c 100%)', border: '1px solid rgba(59,130,246,.2)' }}>
            <div className="text-[10px] font-bold tracking-widest uppercase text-blue-400 mb-3">Argument fiscal</div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{pourquoi}</p>
          </div>
          <div className="rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg, #3b1515 0%, #1c0a0a 100%)', border: '1px solid rgba(239,68,68,.2)' }}>
            <div className="text-[10px] font-bold tracking-widest uppercase text-red-400 mb-3">Point de vigilance</div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{attention}</p>
          </div>
          <div className="rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg, #073d28 0%, #051a10 100%)', border: '1px solid rgba(16,185,129,.2)' }}>
            <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 mb-3">Avantage décisif</div>
            <div className="font-display text-3xl font-black text-emerald-400 mb-1">
              {fmt(Math.round(best.netAnnuel / 12))}/mois
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Revenu net avec <strong className="text-white">{best.forme}</strong> — TMI {tmi}% · Score {best.scoreTotal}/100
            </p>
            {gain > 500 && (
              <div className="mt-3 pt-3 text-xs text-emerald-400/70"
                style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                +{fmt(gain)}/an vs la moins avantageuse
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── COMPARAISON DES 4 STRUCTURES ── */}
      <div className="rounded-3xl overflow-hidden relative" style={{
        background: 'linear-gradient(180deg, #060e1f 0%, #050c1a 100%)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: 0,
          transform: 'translateX(-50%)',
          width: '800px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.10) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        <div className="relative p-6 sm:p-10" style={{ zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.20)',
              borderRadius: '999px', padding: '6px 16px', marginBottom: '14px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60A5FA', display: 'inline-block' }} />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                Comparaison des 4 structures
              </span>
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
              Même CA · Même charges · Même foyer
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', margin: 0 }}>
              Triées par score multicritère selon votre priorité
            </p>
          </div>

          <div className={`grid gap-4 items-stretch ${cardsGrid}`}>
            {scored.map((r, i) => (
              <StructureCard key={r.forme} r={r} rank={i} params={params} gain={gain} />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {buildAnalysis(scored, params, tmi, gain).map(item => (
              <div key={item.title} className="rounded-2xl p-5" style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div className="text-2xl mb-3">{item.icon}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: item.color }}>
                  {item.title}
                </div>
                <div className="font-display text-2xl font-black mb-0.5" style={{ color: item.color }}>
                  {item.value}
                </div>
                <div className="text-[10px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>{item.sub}</div>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PONT VERS L'EXPLORER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #EFF6FF, #EEF2FF)',
        border: '1px solid #BFDBFE',
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap' as const,
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '4px' }}>
            🔍 Module exploration
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
            Et si votre CA augmentait ? Et si vous vous mariez ?
          </div>
          <div style={{ fontSize: '13px', color: '#64748B' }}>
            Vos chiffres sont pré-chargés dans l&apos;explorateur interactif.
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' as const }}>
            {[
              `CA × 2 → ${fmt(params.ca * 2)}`,
              'Se marier',
              '2 enfants',
              `PER max → ${fmt(Math.min(35194, Math.max(0, benBrut * 0.10)))}`,
            ].map(preset => (
              <span key={preset} style={{
                fontSize: '11px', fontWeight: 600, color: '#3B82F6',
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)',
                padding: '3px 10px', borderRadius: '999px',
              }}>
                {preset}
              </span>
            ))}
          </div>
        </div>
        <Link href={explorerUrl} style={{
          flexShrink: 0, padding: '12px 24px', borderRadius: '12px',
          fontWeight: 700, fontSize: '14px', color: '#fff',
          textDecoration: 'none',
          background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
          boxShadow: '0 4px 14px rgba(29,78,216,0.35)',
          whiteSpace: 'nowrap' as const,
        }}>
          Ouvrir l&apos;explorateur →
        </Link>
      </div>

      {/* ── SCÉNARIO OPTIMISÉ ── */}
      <div className="rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #052e16, #064e23, #065f2c)' }}>
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">✦ Scénario optimisé</div>
              <h2 className="font-display text-2xl font-black text-white mb-1">Ce que vous pourriez atteindre</h2>
              <p className="text-sm text-white/50">En activant tous les leviers disponibles pour {best.forme}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] text-white/30 mb-1">Revenu net optimisé</div>
              <div className="font-display text-4xl font-black text-emerald-400 tracking-tight">{fmt(scenarioOptimise.netOptimise)}</div>
              <div className="text-sm text-emerald-400/60 mt-0.5">+{fmt(scenarioOptimise.gainTotal)}/an supplémentaires</div>
            </div>
          </div>
        </div>
        <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LevierCard
            icon="📊" titre="PER individuel"
            detail={`Versement max : ${fmt(scenarioOptimise.perMax)}/an`}
            gainDefault={scenarioOptimise.perGain}
            explication={`À TMI ${tmi}%, chaque euro versé au PER réduit votre IR de ${tmi} centimes. C'est un double levier unique pour les TNS : économie IR + économie cotisations. Plafond 2025 : 10% du résultat, max ${fmt(35194)}/an.`}
            inputLabel="Montant PER annuel (€)" inputMax={Math.max(100, scenarioOptimise.perMax)}
            inputDefault={scenarioOptimise.perMax} calcGain={(val) => Math.round(val * tmi / 100)}
          />
          <LevierCard
            icon="🚗" titre="Indemnités kilométriques"
            detail="Barème fiscal 2025 — déductible du résultat"
            gainDefault={scenarioOptimise.ikGain}
            explication={`Les IK sont déductibles de votre résultat (IS ou BIC) selon le barème fiscal 2025. Pour un véhicule 5CV : 0,636 €/km jusqu'à 5 000 km. Sur 8 000 km, la déduction est de ${fmt(Math.round(8000 * 0.636))}, soit une économie IS d'environ ${fmt(scenarioOptimise.ikGain)}.`}
            inputLabel="Kilomètres professionnels / an" inputMax={50000}
            inputDefault={8000} calcGain={(val) => Math.round(val * 0.636 * 0.15)}
          />
          <LevierCard
            icon="🏠" titre="Domiciliation domicile"
            detail="Part bureau déductible au prorata surface"
            gainDefault={scenarioOptimise.domGain}
            explication="Si vous travaillez depuis votre domicile, une quote-part des charges (loyer, EDF, internet, assurance) est déductible au prorata de la surface bureau / surface totale. La pièce doit être dédiée à l'activité professionnelle."
            inputLabel="Charges annuelles domicile (€)" inputMax={30000}
            inputDefault={12000} calcGain={(val) => Math.round(val * 0.20 * 0.15)}
          />
          <LevierCard
            icon="🛡" titre="Prévoyance TNS"
            detail="Déductible du résultat IS ou BIC"
            gainDefault={scenarioOptimise.prevGain}
            explication={`Les primes de prévoyance (arrêt maladie, invalidité, décès) sont entièrement déductibles du résultat. Double avantage : protection renforcée ET économie fiscale immédiate. Pour ${fmt(Math.max(1000, Math.round(benBrut * 0.02)))}/an de prime, l'économie IS estimée est de ${fmt(scenarioOptimise.prevGain)}.`}
            inputLabel="Prime annuelle prévoyance (€)" inputMax={10000}
            inputDefault={Math.max(1000, Math.round(benBrut * 0.02))} calcGain={(val) => Math.round(val * 0.15)}
          />
        </div>
        <div className="px-8 pb-8">
          <div className="flex items-center justify-between pt-5 flex-wrap gap-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <div className="text-sm text-white/50">Gain potentiel total estimé</div>
              <div className="font-display text-2xl font-black text-emerald-400">+{fmt(scenarioOptimise.gainTotal)}/an</div>
              <div className="text-xs text-white/30 mt-0.5">Estimations indicatives · À valider avec un expert-comptable</div>
            </div>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.4)' }}>
              Mettre en place avec un expert →
            </a>
          </div>
        </div>
      </div>

      {/* ── PROTECTION SOCIALE ── */}
      <div>
        <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-3">
          Protection sociale
          <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
        </div>
        <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface border-b border-surface2">
                  <th className="text-left text-[10px] font-bold tracking-wide uppercase text-ink3 px-4 py-3 min-w-[140px]">Critère</th>
                  {scored.map((r, i) => (
                    <th key={r.forme} className={`text-left text-[10px] font-bold tracking-wide uppercase px-4 py-3 whitespace-nowrap ${i === 0 ? 'text-blue' : 'text-ink3'}`}>
                      {r.forme}
                      {i === 0 && <span className="ml-1.5 text-[8px] bg-blue text-white px-1.5 py-0.5 rounded-full">★</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'IJ maladie / jour', fn: (r: StructureResult) => `${r.prot.ijJ} €` },
                  { label: 'IJ maladie / mois', fn: (r: StructureResult) => `${r.prot.ijM} €` },
                  { label: 'Trimestres / an', fn: (r: StructureResult) => String(r.prot.trims) },
                  { label: 'Retraite complémentaire', fn: (r: StructureResult) => r.prot.complement },
                  { label: 'Qualité globale', fn: (r: StructureResult) => r.prot.qual },
                ] as const).map((row, ri) => (
                  <tr key={row.label} className={ri % 2 === 0 ? 'bg-white' : 'bg-surface/40'}>
                    <td className="px-4 py-3 text-[12px] font-semibold text-ink3 border-b border-surface2">{row.label}</td>
                    {scored.map((r, ci) => {
                      const val = row.fn(r)
                      const isQual = row.label === 'Qualité globale'
                      const qualColor = isQual
                        ? val === 'bon' ? 'text-green-700 font-bold' : val === 'moyen' ? 'text-amber-700 font-bold' : 'text-red-700 font-bold'
                        : ci === 0 ? 'text-blue font-bold' : 'text-ink'
                      return (
                        <td key={r.forme} className={`px-4 py-3 text-[12px] border-b border-surface2 ${qualColor}`}>{val}</td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasTNS && (
            <div className="px-4 py-3 bg-blue-bg border-t border-blue-border flex items-start gap-2.5 flex-wrap">
              <span className="flex-shrink-0 text-sm">🛡</span>
              <p className="text-xs text-blue-dark leading-relaxed flex-1">
                <strong>Prévoyance TNS déductible</strong> — les primes (arrêt maladie, invalidité, décès) sont déductibles du résultat IS ou BIC.
                Simulez l&apos;économie via le levier Prévoyance ci-dessus.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA FINAL ── */}
      <div className="rounded-3xl relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #050c1a 0%, #071428 50%, #0a1628 100%)',
        boxShadow: '0 0 60px rgba(37,99,235,0.15)',
        border: '1px solid rgba(96,165,250,0.15)',
      }}>
        <div className="absolute pointer-events-none" style={{
          right: '-4rem', top: '-4rem',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 65%)',
        }} />
        <div className="relative flex flex-wrap gap-10 p-8 sm:p-10 items-center">
          <div style={{ flex: '1 1 300px' }}>
            <div style={{
              fontSize: '10px', fontWeight: 800, color: '#60A5FA',
              textTransform: 'uppercase' as const, letterSpacing: '0.1em',
              marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60A5FA', display: 'inline-block' }} />
              Cabinet Belho Xper · Lyon &amp; Montluel
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: '1.1', margin: '0 0 12px' }}>
              Vous voulez aller plus loin ?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px', maxWidth: '440px' }}>
              Ces résultats sont des estimations certifiées barème 2025.
              Nos experts affinent votre stratégie et vous accompagnent dans la mise en œuvre concrète.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
              <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '13px 28px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  color: '#fff', textDecoration: 'none',
                  background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                  boxShadow: '0 6px 20px rgba(29,78,216,0.45)',
                }}>
                Prendre RDV gratuitement →
              </a>
              <button onClick={() => setShowSaveModal(true)}
                style={{
                  padding: '13px 28px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  color: 'rgba(255,255,255,0.70)', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                }}>
                💾 Enregistrer &amp; comparer
              </button>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '18px', padding: '24px', minWidth: '220px', textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px' }}>
              Meilleur résultat simulé
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.50)', marginBottom: '4px' }}>
              {best.forme}
            </div>
            <div style={{ fontSize: '42px', fontWeight: 900, color: '#60A5FA', letterSpacing: '-0.04em', lineHeight: '1', marginBottom: '6px' }}>
              {fmt(best.netAnnuel)}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '16px' }}>
              {fmt(Math.round(best.netAnnuel / 12))}/mois net
            </div>
            {gain > 500 && (
              <div style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.20)', borderRadius: '10px', padding: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#34D399' }}>+{fmt(gain)}/an</div>
                <div style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(52,211,153,0.60)', marginTop: '1px' }}>
                  vs structure la moins avantageuse
                </div>
              </div>
            )}
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', marginTop: '14px', lineHeight: '1.5' }}>
              Simulation indicative · Barème 2025 · À valider avec votre expert-comptable
            </div>
          </div>
        </div>
      </div>

      {/* ── Bouton retour ── */}
      <div className="flex justify-start pt-2 border-t border-surface2">
        <button onClick={prevStep}
          className="px-5 py-2.5 text-sm font-semibold text-ink3 border-[1.5px] border-surface2 rounded-lg hover:bg-surface hover:text-ink2 transition-all">
          ← Modifier les paramètres
        </button>
      </div>

      {showSaveModal && (
        <SaveSimulationModal onClose={() => setShowSaveModal(false)} results={results} params={params} tmi={tmi} />
      )}
    </div>
  )
}

function buildAnalysis(scored: StructureResult[], p: SimParams, tmi: number, gain: number) {
  const best = scored[0]
  const worst = scored[scored.length - 1]
  const coutTotal = best.charges + best.ir + (best.is || 0)
  const tauxGlobal = p.ca > 0 ? (coutTotal / p.ca * 100).toFixed(0) : '0'
  const gainMois = Math.round(gain / 12)
  return [
    {
      icon: '📊', title: 'Taux de prélèvement global',
      value: `${tauxGlobal}%`, sub: `${fmt(coutTotal)}/an prélevés`,
      desc: `Cotisations + IR + IS représentent ${tauxGlobal}% de votre CA de ${fmt(p.ca)} avec ${best.forme}. C'est le taux effectif le plus bas des 4 structures analysées.`,
      color: '#60A5FA',
    },
    {
      icon: '💶', title: 'Gain de la décision',
      value: gain > 500 ? `+${fmt(gain)}/an` : 'Structure optimale',
      sub: gain > 500 ? `+${fmt(gainMois)}/mois` : `Score ${best.scoreTotal}/100`,
      desc: gain > 500
        ? `En choisissant ${best.forme} plutôt que ${worst.forme}, vous conservez ${fmt(gain)} supplémentaires par an — soit ${fmt(gainMois)} de plus par mois nets d'impôts.`
        : `${best.forme} obtient le meilleur score multicritère sur les 4 structures analysées avec votre profil fiscal.`,
      color: '#34D399',
    },
    {
      icon: '🎯', title: 'Votre TMI & quotient familial',
      value: `${tmi}%`,
      sub: `${p.parts} part${p.parts > 1 ? 's' : ''} fiscale${p.parts > 1 ? 's' : ''}`,
      desc: `Avec ${p.parts} part${p.parts > 1 ? 's' : ''} fiscale${p.parts > 1 ? 's' : ''}, votre tranche marginale est à ${tmi}%. ${tmi <= 11 ? "Tranche basse — l'IR a un impact limité sur votre revenu net." : tmi <= 30 ? 'Tranche intermédiaire — le PER peut réduire votre IR de façon significative.' : 'Tranche haute — les leviers IS/PER/prévoyance sont très efficaces.'}`,
      color: tmi <= 11 ? '#34D399' : tmi <= 30 ? '#FBBF24' : '#F87171',
    },
  ]
}

const CARD_PALETTES = [
  {
    cardBg: 'linear-gradient(180deg, #0d1f3c 0%, #0a1628 100%)',
    headerBg: 'linear-gradient(135deg, rgba(37,99,235,0.4), rgba(29,78,216,0.2))',
    border: '2px solid rgba(96,165,250,0.5)',
    glow: '0 0 40px rgba(37,99,235,0.3), 0 0 0 2px rgba(96,165,250,0.4)',
    rankText: '★ RECOMMANDÉ',
    rankColor: '#93C5FD',
    badgeBg: 'rgba(96,165,250,0.2)',
    badgeColor: '#BFDBFE',
    netColor: '#60A5FA',
    footerBg: 'rgba(37,99,235,0.08)',
  },
  {
    cardBg: 'linear-gradient(180deg, #130d2e 0%, #0e0920 100%)',
    headerBg: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(109,40,217,0.18))',
    border: '1.5px solid rgba(167,139,250,0.35)',
    glow: '0 0 30px rgba(124,58,237,0.2), 0 0 0 1.5px rgba(167,139,250,0.3)',
    rankText: '2ÈME CHOIX',
    rankColor: '#C4B5FD',
    badgeBg: 'rgba(167,139,250,0.15)',
    badgeColor: '#DDD6FE',
    netColor: '#A78BFA',
    footerBg: 'rgba(124,58,237,0.06)',
  },
  {
    cardBg: 'linear-gradient(180deg, #1a1200 0%, #120d00 100%)',
    headerBg: 'linear-gradient(135deg, rgba(217,119,6,0.35), rgba(180,83,9,0.18))',
    border: '1.5px solid rgba(251,191,36,0.30)',
    glow: '0 0 30px rgba(217,119,6,0.15), 0 0 0 1.5px rgba(251,191,36,0.25)',
    rankText: '3ÈME CHOIX',
    rankColor: '#FCD34D',
    badgeBg: 'rgba(251,191,36,0.15)',
    badgeColor: '#FDE68A',
    netColor: '#FBBF24',
    footerBg: 'rgba(217,119,6,0.06)',
  },
  {
    cardBg: 'linear-gradient(180deg, #0f1520 0%, #0a1018 100%)',
    headerBg: 'linear-gradient(135deg, rgba(100,116,139,0.25), rgba(71,85,105,0.12))',
    border: '1.5px solid rgba(148,163,184,0.20)',
    glow: '0 0 0 1.5px rgba(148,163,184,0.18)',
    rankText: '4ÈME CHOIX',
    rankColor: '#94A3B8',
    badgeBg: 'rgba(148,163,184,0.10)',
    badgeColor: '#CBD5E1',
    netColor: '#94A3B8',
    footerBg: 'rgba(100,116,139,0.04)',
  },
]

function StructureCard({ r, rank, params, gain }: {
  r: StructureResult
  rank: number
  params: SimParams
  gain: number
}) {
  const pal = CARD_PALETTES[Math.min(rank, CARD_PALETTES.length - 1)]
  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(tmiRate((cardTmiBase || 0) + params.autresRev, params.partsBase, params.nbEnfants) * 100)
  const revBrut = Math.max(1, r.netAnnuel + r.charges + r.ir + (r.is || 0))
  const tauxEff = (r.ir / revBrut * 100).toFixed(1)
  const ca = Math.max(1, params.ca)
  const netPct = Math.min(100, r.netAnnuel / ca * 100)
  const chargesPct = Math.min(100, r.charges / ca * 100)
  const irPct = Math.min(100, r.ir / ca * 100)
  const isPct = Math.min(100, (r.is || 0) / ca * 100)
  const coutTotal = r.charges + r.ir + (r.is || 0)
  const coutPct = (coutTotal / ca * 100).toFixed(0)

  return (
    <div style={{
      background: pal.cardBg,
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: pal.glow,
      border: pal.border,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', background: pal.headerBg, borderBottom: `1px solid ${pal.rankColor}20` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: pal.rankColor }}>
            {pal.rankText}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, background: pal.badgeBg, color: pal.badgeColor, padding: '3px 10px', borderRadius: '999px' }}>
            {r.scoreTotal}/100
          </span>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '2px' }}>{r.forme}</div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: pal.rankColor, opacity: 0.8, marginBottom: '3px' }}>
          {r.forme === 'SAS / SASU' ? 'Salaire assimilé salarié + dividendes sans CS' :
           r.forme === 'EURL / SARL (IS)' ? 'Rémunération TNS + dividendes · régime IS' :
           r.forme === 'EI (réel normal)' ? 'Revenu BIC/BNC · cotisations SSI sur résultat' :
           'Cotisations sur CA · abattement forfaitaire'}
        </div>
        {r.scoreBreakdown && (
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.22)', marginBottom: '4px' }}>
            Net {r.scoreBreakdown.netScore}/{r.scoreBreakdown.netMax} · Flex. {r.scoreBreakdown.flexScore}/{r.scoreBreakdown.flexMax} · Prot. {r.scoreBreakdown.protScore}/{r.scoreBreakdown.protMax} · Admin {r.scoreBreakdown.adminScore}/{r.scoreBreakdown.adminMax}
          </div>
        )}
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {r.strat}
        </div>
      </div>

      {/* Revenu net */}
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px' }}>
          Revenu net après impôts
        </div>
        <div style={{ fontSize: rank === 0 ? '42px' : '36px', fontWeight: 900, color: pal.netColor, letterSpacing: '-0.03em', lineHeight: '1', marginBottom: '4px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
          {fmt(r.netAnnuel)}
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>{fmt(Math.round(r.netAnnuel / 12))}/mois</div>
        {rank === 0 && gain > 500 && (
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '10px', padding: '6px 12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#34D399' }}>+{fmt(gain)}/an vs moins avantageuse</span>
          </div>
        )}
      </div>

      {/* Barre proportionnelle */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '6px', marginBottom: '4px' }}>
          <div style={{ width: `${netPct.toFixed(0)}%`, background: pal.netColor, transition: 'width 400ms' }} />
          <div style={{ width: `${chargesPct.toFixed(0)}%`, background: '#F87171', transition: 'width 400ms' }} />
          <div style={{ width: `${irPct.toFixed(0)}%`, background: '#FB923C', transition: 'width 400ms' }} />
          {r.is > 0 && <div style={{ width: `${isPct.toFixed(0)}%`, background: '#818CF8', transition: 'width 400ms' }} />}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, marginBottom: '12px' }}>
          {[
            { dot: pal.netColor, label: 'Net' },
            { dot: '#F87171', label: 'Cotis.' },
            { dot: '#FB923C', label: 'IR' },
            ...(r.is > 0 ? [{ dot: '#818CF8', label: 'IS' }] : []),
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'rgba(255,255,255,0.30)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: l.dot, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Décomposition */}
      <div style={{ padding: '0 20px 16px', flex: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label: 'Cotisations sociales', hint: r.forme.includes('SAS') ? 'Charges sal. + patronales' : 'SSI (TNS) — maladie, retraite', val: r.charges, color: '#F87171', sign: '−' },
          { label: 'Impôt sur le revenu', hint: `TMI ${cardTmi}% · ${params.parts} parts`, val: r.ir, color: '#FB923C', sign: '−' },
          ...(r.is > 0 ? [{ label: 'IS société', hint: "15% jusqu'à 42 500 € · 25% au-delà", val: r.is, color: '#818CF8', sign: '−' }] : []),
          ...(r.div > 0 ? [{ label: 'Dividendes perçus', hint: r.methDiv || 'PFU 30%', val: r.div, color: '#34D399', sign: '+' }] : []),
        ].map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.70)' }}>{row.label}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '1px' }}>{row.hint}</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: row.color, flexShrink: 0 }}>{row.sign}{fmt(row.val)}</div>
          </div>
        ))}
        <div style={{ paddingTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.30)' }}>Coût total (cotis. + impôts)</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: 'rgba(248,113,113,0.75)' }}>−{fmt(coutTotal)}</div>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', marginTop: '2px' }}>{coutPct}% du CA de {fmt(params.ca)}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', background: pal.footerBg }}>
        {[
          { label: 'TMI', val: `${cardTmi}%`, color: cardTmi <= 11 ? '#34D399' : cardTmi <= 30 ? '#FBBF24' : '#F87171', hint: cardTmi <= 11 ? 'Basse' : cardTmi <= 30 ? 'Interméd.' : 'Haute' },
          { label: 'IR total', val: fmt(r.ir), color: 'rgba(255,255,255,0.75)', hint: `${fmt(Math.round(r.ir / 12))}/mois` },
          { label: 'Taux eff.', val: `${tauxEff}%`, color: 'rgba(255,255,255,0.55)', hint: 'Sur CA total' },
        ].map((f, fi) => (
          <div key={fi} style={{ textAlign: 'center' as const, padding: '12px 6px', borderRight: fi < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: f.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.val}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.20)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
