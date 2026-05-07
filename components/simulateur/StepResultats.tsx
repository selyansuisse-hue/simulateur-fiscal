'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt } from '@/lib/utils'
import { tmiRate, calcPartsTotal } from '@/lib/fiscal/ir'
import { StructureResult } from '@/lib/fiscal'
import { SimParams } from '@/lib/fiscal/types'
import { SaveSimulationModal } from '@/components/simulateur/SaveSimulationModal'

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
function structureAccent(forme: string): string {
  if (forme.includes('SAS')) return '#8b5cf6'
  if (forme.includes('EURL') || forme.includes('SARL')) return '#3b82f6'
  if (forme.includes('Micro')) return '#94a3b8'
  return '#f59e0b'
}

const DOT_SCORES: Record<string, { maladie: number; retraite: number; prevoyance: number }> = {
  'SAS / SASU':       { maladie: 4, retraite: 5, prevoyance: 4 },
  'EURL / SARL (IS)': { maladie: 3, retraite: 4, prevoyance: 2 },
  'EI (réel normal)': { maladie: 3, retraite: 3, prevoyance: 1 },
  'Micro-entreprise': { maladie: 1, retraite: 1, prevoyance: 1 },
}

/* ─────────────────────────────────────────────────────────
   CircularScore — matches Step5Results.html ScoreRing
───────────────────────────────────────────────────────── */
function CircularScore({
  score,
  color = '#3b82f6',
  size = 112,
  strokeWidth = 10,
}: {
  score: number
  color?: string
  size?: number
  strokeWidth?: number
}) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(51,65,85,0.5)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(1)} ${(c - dash).toFixed(1)}`}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: 'stroke-dasharray 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-bold leading-none" style={{ fontSize: size >= 110 ? '30px' : size > 80 ? '22px' : '16px', color }}>
          {score}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">/ 100</div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   DotRating — matches Step5Results.html DotMeter
───────────────────────────────────────────────────────── */
function DotRating({ filled, color }: { filled: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{
            background: i < filled ? color : 'rgba(51,65,85,0.6)',
            boxShadow: i < filled ? `0 0 6px ${color}80` : 'none',
          }}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   ScoreDimBar — matches Step5Results.html ScoreBar
───────────────────────────────────────────────────────── */
function ScoreDimBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</span>
        <span className="text-[12px] font-mono text-slate-300 tabular-nums">
          {score}<span className="text-slate-600">/{max}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   SectionHeader — matches Step5Results.html SectionHeader
───────────────────────────────────────────────────────── */
function SectionHeader({
  eyebrow,
  title,
  subtitle,
  eyebrowColor = '#93c5fd',
}: {
  eyebrow: string
  title: string
  subtitle?: string
  eyebrowColor?: string
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-8">
      <div
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold"
        style={{ color: eyebrowColor }}
      >
        <span className="h-px w-6" style={{ background: `${eyebrowColor}99` }} />
        {eyebrow}
        <span className="h-px w-6" style={{ background: `${eyebrowColor}99` }} />
      </div>
      <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-2.5 text-slate-400 text-[14px] leading-relaxed">{subtitle}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   genAnalyse — inchangé
───────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────
   LevierCard — redesigné avec le design system
───────────────────────────────────────────────────────── */
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
    <div className="rounded-2xl overflow-hidden flex flex-col border border-slate-700/50 bg-slate-900">
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="text-sm font-bold text-white">{titre}</div>
            <div className="text-xs text-slate-500 mt-0.5">{detail}</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-black text-emerald-400">+{fmt(gainCalcule > 0 ? gainCalcule : gainDefault)}/an</div>
        </div>
      </div>
      <div className="px-5 pb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold px-3 py-2 rounded-lg transition-all w-full text-center"
          style={{
            background: expanded ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.07)',
            color: expanded ? '#34D399' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${expanded ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          {expanded ? '▲ Fermer le simulateur' : '▼ Simuler mon économie'}
        </button>
      </div>
      {expanded && (
        <div
          className="px-5 pb-5 pt-4 flex-1 border-t border-slate-800"
          style={{ background: 'rgba(2,6,23,0.5)' }}
        >
          <p className="text-xs text-slate-400 leading-relaxed mb-4">{explication}</p>
          {inputMax > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <label>{inputLabel}</label>
                <span className="font-bold text-slate-300">{inputVal.toLocaleString('fr-FR')} €</span>
              </div>
              <input
                type="range" min={0} max={inputMax} step={step}
                value={inputVal} onChange={e => setInputVal(Number(e.target.value))}
                className="w-full h-1.5 accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>0</span>
                <span>{fmt(inputMax)}</span>
              </div>
            </div>
          )}
          <div
            className="rounded-xl px-4 py-3 flex justify-between items-center"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)' }}
          >
            <span className="text-xs text-emerald-400/70">Économie estimée</span>
            <span className="text-lg font-black text-emerald-400">
              +{fmt(gainCalcule > 0 ? gainCalcule : gainDefault)}/an
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            Estimation indicative · Valider avec votre expert-comptable
          </p>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   getStructureDesc — description dynamique pour le hero
───────────────────────────────────────────────────────── */
function getStructureDesc(forme: string): { regime: string; bullets: string[]; protBadge: string } {
  if (forme === 'SAS / SASU') return {
    regime: 'Président assimilé-salarié + dividendes',
    bullets: [
      '✓ Cotisations salariales (~75% sur rémunération)',
      '✓ IS 15% jusqu\'à 42 500 € de bénéfice',
      '✓ Dividendes au PFU 30% sans cotisations sociales',
    ],
    protBadge: 'Régime général — meilleure couverture',
  }
  if (forme === 'EURL / SARL (IS)') return {
    regime: 'Gérant TNS + dividendes IS',
    bullets: [
      '✓ Cotisations TNS (~35% sur rémunération)',
      '✓ IS 15% jusqu\'à 42 500 € de bénéfice',
      '✓ Dividendes > 10% capital soumis TNS',
    ],
    protBadge: 'Régime SSI — Niveau moyen',
  }
  if (forme === 'EI (réel normal)') return {
    regime: 'Entrepreneur individuel au réel',
    bullets: [
      '✓ Cotisations SSI sur résultat net (~40%)',
      '✓ IR progressif avec quotient familial',
      '✓ Déduction totale des charges réelles',
    ],
    protBadge: 'Régime SSI — Niveau moyen',
  }
  return {
    regime: 'Auto-entrepreneur — régime simplifié',
    bullets: [
      '✓ Cotisations sur CA (~22% services BIC)',
      '✓ Abattement forfaitaire — comptabilité allégée',
      '✓ Franchise TVA si sous les seuils',
    ],
    protBadge: 'Régime SSI simplifié — Protection minimale',
  }
}

/* ─────────────────────────────────────────────────────────
   getProtProfile — inchangé
───────────────────────────────────────────────────────── */
function getProtProfile(forme: string) {
  const f = (forme || '').toLowerCase()
  if (f.includes('sas')) return {
    badge: 'Régime général — Sécurité sociale', icon: '⭐',
    accentColor: '#a78bfa', fillColor: '#7c3aed',
    bars: [
      { label: 'Maladie',    score: 70, desc: 'Remboursements identiques au salarié — 70% SS' },
      { label: 'Retraite',   score: 80, desc: 'Retraite de base + complémentaire AGIRC-ARRCO' },
      { label: 'Prévoyance', score: 65, desc: 'Pas de Madelin — contrat Article 83 possible' },
    ],
    mention: { icon: '✅', text: 'Meilleure protection maladie/retraite de base', color: '#4ade80' },
  }
  if (f.includes('eurl') || f.includes('sarl')) return {
    badge: 'Régime TNS — SSI', icon: '🛡️',
    accentColor: '#60a5fa', fillColor: '#2563eb',
    bars: [
      { label: 'Maladie',    score: 55, desc: '70% des frais remboursés — niveau sécurité sociale' },
      { label: 'Retraite',   score: 65, desc: 'Points retraite sur rémunération + PER déductible IS' },
      { label: 'Prévoyance', score: 75, desc: 'Contrat Madelin possible — déductible IR' },
    ],
    mention: { icon: '💡', text: 'Complément mutuelle fortement recommandé', color: '#fbbf24' },
  }
  if (f.includes('micro')) return {
    badge: 'Régime TNS simplifié', icon: '⚡',
    accentColor: '#94a3b8', fillColor: '#64748b',
    bars: [
      { label: 'Maladie',    score: 35, desc: 'Cotisations faibles sur CA — IJ très réduits' },
      { label: 'Retraite',   score: 30, desc: 'Trimestres limités — retraite insuffisante à long terme' },
      { label: 'Prévoyance', score: 40, desc: 'Protection minimale — pas de Madelin possible' },
    ],
    mention: { icon: '❌', text: 'Protection minimale — à éviter pour activité principale', color: '#f87171' },
  }
  return {
    badge: 'Régime TNS — SSI', icon: '🛡️',
    accentColor: '#fbbf24', fillColor: '#d97706',
    bars: [
      { label: 'Maladie',    score: 50, desc: '70% des frais remboursés — IJ calculés sur le résultat' },
      { label: 'Retraite',   score: 55, desc: 'Points retraite sur résultat net — PER déductible' },
      { label: 'Prévoyance', score: 65, desc: 'Contrat Madelin possible — déductible BIC/BNC' },
    ],
    mention: { icon: '⚠️', text: 'Pas de séparation patrimoine — risque personnel', color: '#fbbf24' },
  }
}

/* ─────────────────────────────────────────────────────────
   ProtectionCard — matches Step5Results.html ProtectionRow
───────────────────────────────────────────────────────── */
function ProtectionCard({ r, rank }: { r: StructureResult; rank: number }) {
  const prof = getProtProfile(r.forme)
  const dots = DOT_SCORES[r.forme] ?? { maladie: 2, retraite: 2, prevoyance: 2 }
  const accent = structureAccent(r.forme)
  const isReco = rank === 0

  return (
    <div
      className="rounded-xl bg-slate-900 p-4"
      style={{
        border: '1px solid rgba(51,65,85,0.5)',
        borderTopColor: accent + 'aa',
        borderTopWidth: 2,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <span className="font-bold text-sm tracking-tight" style={{ color: accent }}>{r.forme}</span>
        </div>
        {isReco && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}
          >
            Recommandé
          </span>
        )}
      </div>

      <div className="space-y-2.5 mb-3">
        {[
          { label: 'Maladie', val: dots.maladie },
          { label: 'Retraite', val: dots.retraite },
          { label: 'Prévoyance', val: dots.prevoyance },
        ].map(p => (
          <div key={p.label} className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{p.label}</span>
            <DotRating filled={p.val} color={accent} />
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-800 text-[11px] leading-snug" style={{ color: prof.mention.color }}>
        {prof.mention.icon} {prof.mention.text}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   buildAnalysis — inchangé
───────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────
   StructureCard — matches Step5Results.html StructureCard
───────────────────────────────────────────────────────── */
function StructureCard({ r, rank, params, gain, bestNetAnnuel }: {
  r: StructureResult
  rank: number
  params: SimParams
  gain: number
  bestNetAnnuel: number
}) {
  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(tmiRate((cardTmiBase || 0) + params.autresRev, params.partsBase, params.nbEnfants) * 100)
  const ca = Math.max(1, params.ca)
  const netPct = Math.min(100, r.netAnnuel / ca * 100)
  const chargesPct = Math.min(100, r.charges / ca * 100)
  const irPct = Math.min(100, r.ir / ca * 100)
  const isPct = Math.min(100, (r.is || 0) / ca * 100)
  const coutTotal = r.charges + r.ir + (r.is || 0)
  const coutPct = (coutTotal / ca * 100).toFixed(0)
  const revBrut = Math.max(1, r.netAnnuel + coutTotal)
  const tauxEff = (r.ir / revBrut * 100).toFixed(1)

  const accent = structureAccent(r.forme)
  const isReco = rank === 0
  const diff = Math.round(bestNetAnnuel - r.netAnnuel)
  const rankLabels = ['★ Recommandée', '2ᵉ choix', '3ᵉ choix', '4ᵉ choix']
  const rankLabel = rankLabels[Math.min(rank, 3)]

  return (
    <div
      className={[
        'card-hover relative rounded-2xl border bg-slate-900 overflow-hidden flex flex-col',
        isReco ? 'lg:scale-[1.04] lg:-translate-y-1 shadow-2xl' : 'border-slate-700/50',
      ].join(' ')}
      style={{
        borderColor: isReco ? `${accent}aa` : undefined,
        boxShadow: isReco ? `0 20px 60px -20px ${accent}55, 0 0 0 1px ${accent}30` : undefined,
      }}
    >
      {/* Top accent strip */}
      <div className="h-1 w-full" style={{ background: accent }} />

      {/* Rank + Score row */}
      <div className="px-5 pt-4 flex items-center justify-between">
        {isReco ? (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ background: `${accent}26`, color: accent, border: `1px solid ${accent}55` }}
          >
            {rankLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {rankLabel}
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-[11px] font-mono tabular-nums"
          style={{ color: accent }}
        >
          {r.scoreTotal}<span className="text-slate-500">/100</span>
        </span>
      </div>

      {/* Structure name + desc */}
      <div className="px-5 pt-3 pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <h3 className="text-base font-bold tracking-tight" style={{ color: accent }}>{r.forme}</h3>
        </div>
        <p className="mt-1.5 text-[12px] text-slate-400 leading-relaxed min-h-[34px]">
          {r.forme === 'SAS / SASU' ? 'Salaire assimilé-salarié + dividendes sans CS' :
           r.forme === 'EURL / SARL (IS)' ? 'Rémunération TNS + dividendes · régime IS' :
           r.forme === 'EI (réel normal)' ? 'Revenu BIC/BNC · cotisations SSI sur résultat' :
           'Cotisations sur CA · abattement forfaitaire'}
        </p>
        {r.strat && <p className="text-[11px] text-slate-500 truncate">{r.strat}</p>}
      </div>

      <div className="border-t border-slate-800" />

      {/* Net amount */}
      <div className="px-5 py-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Net après impôts</div>
        <div className="mt-1.5">
          <span className="text-3xl font-black text-white tabular-nums tracking-tight" style={{ whiteSpace: 'nowrap' }}>
            {fmt(r.netAnnuel)}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums" style={{ whiteSpace: 'nowrap' }}>
          {fmt(Math.round(r.netAnnuel / 12))}/mois
        </div>
        {isReco && gain > 500 && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 text-[11px] text-emerald-300 font-mono tabular-nums"
            style={{ whiteSpace: 'nowrap' }}
          >
            +{fmt(gain)}/an vs pire
          </div>
        )}
        {!isReco && diff > 500 && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 border border-rose-500/25 px-2 py-1 text-[11px] text-rose-300 font-mono tabular-nums"
            style={{ whiteSpace: 'nowrap' }}
          >
            −{fmt(diff)}/an vs recommandée
          </div>
        )}
      </div>

      {/* Proportional CA bar */}
      <div className="px-5 pb-4">
        <div className="flex rounded overflow-hidden h-1.5 mb-2 bg-slate-800">
          <div style={{ width: `${netPct.toFixed(0)}%`, background: accent, transition: 'width 400ms' }} />
          <div style={{ width: `${chargesPct.toFixed(0)}%`, background: '#f87171', transition: 'width 400ms' }} />
          <div style={{ width: `${irPct.toFixed(0)}%`, background: '#fb923c', transition: 'width 400ms' }} />
          {r.is > 0 && <div style={{ width: `${isPct.toFixed(0)}%`, background: '#818cf8', transition: 'width 400ms' }} />}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { dot: accent, label: 'Net' },
            { dot: '#f87171', label: 'Cotis.' },
            { dot: '#fb923c', label: 'IR' },
            ...(r.is > 0 ? [{ dot: '#818cf8', label: 'IS' }] : []),
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1 text-[9px] text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.dot }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* Breakdown rows */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-slate-400">Cotisations sociales</div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">
              {r.forme.includes('SAS') ? 'Charges sal. + patronales' : 'SSI (TNS) — maladie, retraite'}
            </div>
          </div>
          <div className="text-sm font-mono tabular-nums text-rose-300 shrink-0" style={{ whiteSpace: 'nowrap' }}>
            −{fmt(r.charges)}
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-slate-400">Impôt sur le revenu</div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">TMI {cardTmi}% · {params.parts} parts</div>
          </div>
          <div className="text-sm font-mono tabular-nums text-rose-300 shrink-0" style={{ whiteSpace: 'nowrap' }}>
            −{fmt(r.ir)}
          </div>
        </div>
        {r.is > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] text-slate-400">IS société</div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">15% jusqu&apos;à 42 500 €</div>
            </div>
            <div className="text-sm font-mono tabular-nums text-rose-300 shrink-0" style={{ whiteSpace: 'nowrap' }}>
              −{fmt(r.is)}
            </div>
          </div>
        )}
        {r.div > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] text-slate-400">Dividendes perçus</div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{r.methDiv || 'PFU 30%'}</div>
            </div>
            <div className="text-sm font-mono tabular-nums text-emerald-300 shrink-0" style={{ whiteSpace: 'nowrap' }}>
              +{fmt(r.div)}
            </div>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="text-[12px] text-slate-200 font-semibold">Coût total</div>
          <div className="text-sm font-mono font-bold text-white shrink-0" style={{ whiteSpace: 'nowrap' }}>
            −{fmt(coutTotal)} <span className="text-slate-500 text-[10px]">{coutPct}% CA</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* Score dimension bars */}
      <div className="px-5 py-4 space-y-2.5">
        {r.scoreBreakdown ? (
          <>
            <ScoreDimBar label="NET"   score={r.scoreBreakdown.netScore}   max={r.scoreBreakdown.netMax}   color={accent} />
            <ScoreDimBar label="FLEX"  score={r.scoreBreakdown.flexScore}  max={r.scoreBreakdown.flexMax}  color={accent} />
            <ScoreDimBar label="PROT"  score={r.scoreBreakdown.protScore}  max={r.scoreBreakdown.protMax}  color={accent} />
            <ScoreDimBar label="ADMIN" score={r.scoreBreakdown.adminScore} max={r.scoreBreakdown.adminMax} color={accent} />
          </>
        ) : (
          <div className="text-[12px] text-slate-500 font-mono">
            Score {r.scoreTotal}/100 · TMI {cardTmi}% · Eff. {tauxEff}%
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   StepResultats — redesigné avec le design system
───────────────────────────────────────────────────────── */
export function StepResultats() {
  const { results, params, prevStep } = useSimulateur()
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

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
    count === 3 ? 'grid-cols-1 md:grid-cols-3 max-w-4xl mx-auto' :
    'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'

  const hasTNS = scored.some(r => r.forme === 'EI (réel normal)' || r.forme === 'EURL / SARL (IS)')
  const explorerUrl = `/explorer?ca=${params.ca}&charges=${params.charges}&amort=${params.amort}&capital=${params.capital}&sitfam=${params.partsBase === 2 ? 'marie' : 'celib'}&enfants=${params.nbEnfants}&per=${params.perMontant}&autresrev=${params.autresRev}&secteur=${params.secteur}&source=simulation`
  const tauxEffBest = params.ca > 0 ? Math.round((best.ir + best.charges) / params.ca * 100) : 0
  const bestAccent = structureAccent(best.forme)

  return (
    <div className="animate-stepIn pb-8 space-y-6">

      {/* ══════════════════════════════════════════════
          1. HERO — recommend-bg style
      ══════════════════════════════════════════════ */}
      <div
        className="rounded-3xl border border-slate-700/60 relative overflow-hidden"
        style={{
          background: `
            radial-gradient(700px 280px at 80% 0%, rgba(59,130,246,0.18), transparent 70%),
            radial-gradient(600px 240px at 0% 100%, rgba(34,197,94,0.10), transparent 70%),
            linear-gradient(180deg, #0f172a, #0b1426)
          `,
        }}
      >
        {/* Color top accent strip */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, transparent, ${bestAccent}, transparent)` }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 p-8 sm:p-10 items-start">

          {/* Left: amount + gain */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ background: `${bestAccent}26`, color: bestAccent, border: `1px solid ${bestAccent}55` }}
              >
                ★ Structure recommandée
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-400 text-xs">Rang #1 sur {count}</span>
            </div>

            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-2xl font-bold text-white tracking-tight">{best.forme}</span>
            </div>

            {/* Type de rémunération + bullets dynamiques */}
            {(() => {
              const desc = getStructureDesc(best.forme)
              return (
                <div className="mt-2 mb-5">
                  <p className="text-[13px] text-slate-400 mb-3">{desc.regime}</p>
                  <div className="flex flex-col gap-1.5 mb-3">
                    {desc.bullets.map((b, i) => (
                      <div key={i} className="text-[12px] text-slate-400 flex items-center gap-2">
                        <span style={{ color: bestAccent }}>{b.slice(0, 1)}</span>
                        <span>{b.slice(2)}</span>
                      </div>
                    ))}
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${bestAccent}15`, border: `1px solid ${bestAccent}40`, color: bestAccent }}
                  >
                    🛡 {desc.protBadge}
                  </span>
                </div>
              )
            })()}

            <div className="mt-2 mb-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1.5 font-semibold">
                Revenu net après tout
              </div>
              <div
                className="text-6xl sm:text-7xl font-black text-white tabular-nums tracking-tighter leading-none"
                style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              >
                {fmt(best.netAnnuel)}
              </div>
              <div className="mt-2 text-sm text-slate-400 font-mono">
                {fmt(Math.round(best.netAnnuel / 12))}/mois · après IR, cotisations &amp; IS
              </div>
            </div>

            {gain > 500 && (
              <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 pl-3 pr-4 py-2.5">
                <div className="flex flex-col">
                  <span className="text-emerald-300 font-bold text-lg leading-none tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                    +{fmt(gain)}/an
                  </span>
                  <span className="text-emerald-400/70 text-[11px] uppercase tracking-wider mt-0.5">
                    vs structure la moins avantageuse
                  </span>
                </div>
                <span className="hidden sm:flex items-center text-emerald-400/60 text-xs font-mono ml-2 pl-3 border-l border-emerald-500/20">
                  +{fmt(Math.round(gain / 12))}/mois
                </span>
              </div>
            )}

            {/* CA decomposition pills */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Revenu net', val: best.netAnnuel, color: bestAccent },
                { label: 'Charges soc.', val: best.charges, color: '#f87171' },
                { label: 'IR estimé', val: best.ir, color: '#fb923c' },
                { label: 'IS estimé', val: best.is || 0, color: '#818cf8' },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                    <div className="text-[10px] text-slate-500">{item.label}</div>
                  </div>
                  <div className="text-sm font-bold text-slate-200" style={{ whiteSpace: 'nowrap' }}>
                    {fmt(Math.round(item.val))}
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, params.ca > 0 ? item.val / params.ca * 100 : 0)}%`,
                        background: item.color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: score ring + bars + KPI */}
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 backdrop-blur">
              <div className="flex items-start gap-5">
                <CircularScore score={best.scoreTotal} color={bestAccent} size={112} strokeWidth={10} />
                <div className="flex-1 min-w-0 space-y-2.5">
                  {best.scoreBreakdown ? (
                    <>
                      <ScoreDimBar label="NET"   score={best.scoreBreakdown.netScore}   max={best.scoreBreakdown.netMax}   color={bestAccent} />
                      <ScoreDimBar label="FLEX"  score={best.scoreBreakdown.flexScore}  max={best.scoreBreakdown.flexMax}  color={bestAccent} />
                      <ScoreDimBar label="PROT"  score={best.scoreBreakdown.protScore}  max={best.scoreBreakdown.protMax}  color={bestAccent} />
                      <ScoreDimBar label="ADMIN" score={best.scoreBreakdown.adminScore} max={best.scoreBreakdown.adminMax} color={bestAccent} />
                    </>
                  ) : (
                    <div className="text-sm text-slate-400">Score {best.scoreTotal}/100</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">TMI</div>
                <div
                  className="text-lg font-bold mt-1 tabular-nums"
                  style={{ color: tmi <= 11 ? '#34d399' : tmi <= 30 ? '#fbbf24' : '#f87171' }}
                >
                  {tmi}%
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Taux eff.</div>
                <div className="text-lg font-bold text-white mt-1 tabular-nums">{tauxEffBest}%</div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Net/mois</div>
                <div className="text-sm font-bold text-white mt-1 tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                  {fmt(Math.round(best.netAnnuel / 12))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          2. COMPARAISON 4 STRUCTURES
      ══════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-slate-700/50 bg-slate-950 p-8">
        <SectionHeader
          eyebrow="Comparaison des 4 structures"
          title="Même CA · Même charges · Même foyer"
          subtitle="Triées par score multicritère selon votre priorité"
        />

        <div className={`grid gap-5 lg:gap-6 items-stretch ${cardsGrid}`}>
          {scored.map((r, i) => (
            <StructureCard key={r.forme} r={r} rank={i} params={params} gain={gain} bestNetAnnuel={scored[0].netAnnuel} />
          ))}
        </div>

        {/* Insights analytiques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {buildAnalysis(scored, params, tmi, gain).map(item => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-700/50 bg-slate-900 p-5"
            >
              <div className="text-xl mb-3">{item.icon}</div>
              <div
                className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5"
                style={{ color: item.color }}
              >
                {item.title}
              </div>
              <div className="text-2xl font-black mb-1" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[10px] text-slate-500 mb-3">{item.sub}</div>
              <p className="text-[12px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          3. SCORE MULTICRITÈRE
      ══════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-slate-700/50 bg-slate-950 p-8">
        <SectionHeader
          eyebrow="Score multicritère"
          title="Analyse des 4 dimensions clés"
          subtitle={`Net /60 · Flexibilité /20 · Protection /12 · Admin /8`}
          eyebrowColor="#c4b5fd"
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">

          {/* Big ring + summary */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
            <div className="flex items-center gap-6">
              <CircularScore score={best.scoreTotal} color={bestAccent} size={144} strokeWidth={10} />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[11px] uppercase tracking-[0.18em] font-semibold mb-1.5"
                  style={{ color: bestAccent }}
                >
                  {best.forme} · #1
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">Score {best.scoreTotal}/100</div>
                <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
                  Le meilleur compromis sur les 4 axes. Net élevé, flexibilité de rémunération,
                  bonne protection sociale et administratif maîtrisable.
                </p>
              </div>
            </div>

            {best.scoreBreakdown && (
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
                <ScoreDimBar label="NET"   score={best.scoreBreakdown.netScore}   max={best.scoreBreakdown.netMax}   color={bestAccent} />
                <ScoreDimBar label="FLEX"  score={best.scoreBreakdown.flexScore}  max={best.scoreBreakdown.flexMax}  color={bestAccent} />
                <ScoreDimBar label="PROT"  score={best.scoreBreakdown.protScore}  max={best.scoreBreakdown.protMax}  color={bestAccent} />
                <ScoreDimBar label="ADMIN" score={best.scoreBreakdown.adminScore} max={best.scoreBreakdown.adminMax} color={bestAccent} />
              </div>
            )}
          </div>

          {/* Compare table */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <div className="text-sm font-semibold text-white">Détail des {count} structures</div>
              <div className="text-[12px] text-slate-400 mt-0.5">Score par axe — sur 100</div>
            </div>
            <div className="divide-y divide-slate-800">
              {scored.map((r, i) => {
                const sb = r.scoreBreakdown
                const accent = structureAccent(r.forme)
                const total = r.scoreTotal
                const isFirst = i === 0
                return (
                  <div key={r.forme} className="px-6 py-3.5 flex items-center gap-4">
                    <div className="w-36 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: accent }} />
                        <span
                          className="text-[13px] font-semibold truncate"
                          style={{ color: accent }}
                        >
                          {r.forme.includes('EURL') ? 'EURL/SARL IS' :
                           r.forme.includes('SAS') ? 'SAS/SASU' :
                           r.forme.includes('Micro') ? 'Micro' : 'EI réel'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="h-2 rounded-full bg-slate-800 flex-1 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${total}%`, background: accent, boxShadow: `0 0 10px ${accent}66` }}
                        />
                      </div>
                      <span
                        className="text-[13px] font-mono tabular-nums shrink-0 w-14 text-right"
                        style={{ color: accent }}
                      >
                        {total}<span className="text-slate-600">/100</span>
                      </span>
                    </div>
                    {sb && (
                      <div className="hidden sm:flex items-center gap-2 shrink-0 text-[10px] font-mono text-slate-500 w-40 justify-end">
                        <span>{sb.netScore}</span><span className="text-slate-700">·</span>
                        <span>{sb.flexScore}</span><span className="text-slate-700">·</span>
                        <span>{sb.protScore}</span><span className="text-slate-700">·</span>
                        <span>{sb.adminScore}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-end gap-2 text-[10px] font-mono text-slate-500">
              <span>Net</span><span className="text-slate-700">·</span>
              <span>Flex</span><span className="text-slate-700">·</span>
              <span>Prot</span><span className="text-slate-700">·</span>
              <span>Admin</span>
            </div>
          </div>
        </div>

        {/* Légende dimensions */}
        <div className="mt-5 flex gap-4 flex-wrap justify-center">
          {[
            { label: 'NET — Revenu net optimisé', color: '#60a5fa' },
            { label: 'FLEX — Flexibilité capitaux', color: '#a78bfa' },
            { label: 'PROT — Protection sociale', color: '#34d399' },
            { label: 'ADMIN — Simplicité admin.', color: '#fbbf24' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          4. PROTECTION SOCIALE
      ══════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-slate-700/50 bg-slate-950 p-8">
        <SectionHeader
          eyebrow="Protection sociale"
          title="Maladie · Retraite · Prévoyance par structure"
          subtitle="Niveau de couverture de base — hors complémentaires souscrites individuellement"
          eyebrowColor="#6ee7b7"
        />

        <div className={`grid gap-4 ${cardsGrid}`}>
          {scored.map((r, i) => (
            <ProtectionCard key={r.forme} r={r} rank={i} />
          ))}
        </div>

        {hasTNS && (
          <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-4 py-3 flex items-start gap-3">
            <span
              className="h-7 w-7 rounded-md border border-violet-500/30 text-violet-300 flex items-center justify-center shrink-0 text-base"
              style={{ background: 'rgba(139,92,246,0.15)' }}
            >
              🛡
            </span>
            <div className="text-[13px] text-slate-300 leading-relaxed">
              <span className="font-semibold text-violet-200">Prévoyance TNS déductible —</span>{' '}
              les primes (arrêt maladie, invalidité, décès) sont déductibles du résultat IS ou BIC.
              Simulez l&apos;économie via le levier <span className="font-mono text-violet-200">Prévoyance</span> ci-dessous.
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════
          5. POURQUOI CE CHOIX
      ══════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-slate-700/50 bg-slate-950 p-8">
        <SectionHeader
          eyebrow="Pourquoi ce choix ?"
          title="Analyse de votre situation"
          eyebrowColor="#93c5fd"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-blue-500/20 bg-slate-900 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-400 mb-3">
              Argument fiscal
            </div>
            <p className="text-[13px] leading-relaxed text-slate-300">{pourquoi}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-slate-900 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-rose-400 mb-3">
              Point de vigilance
            </div>
            <p className="text-[13px] leading-relaxed text-slate-300">{attention}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400 mb-3">
              Avantage décisif
            </div>
            <div className="text-3xl font-black text-emerald-400 mb-1 tracking-tight">
              {fmt(Math.round(best.netAnnuel / 12))}/mois
            </div>
            <p className="text-[13px] leading-relaxed text-slate-300">
              Revenu net avec <strong className="text-white">{best.forme}</strong> — TMI {tmi}% · Score {best.scoreTotal}/100
            </p>
            {gain > 500 && (
              <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-emerald-400/70">
                +{fmt(gain)}/an vs la moins avantageuse
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          6. SCÉNARIO OPTIMISÉ — leviers
      ══════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-emerald-500/20 bg-slate-950 overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b border-slate-800">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300/90 font-semibold mb-3">
                <span className="h-px w-6 bg-emerald-400/60" />
                Scénario optimisé
                <span className="h-px w-6 bg-emerald-400/60" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-1">
                Ce que vous laissez sur la table
              </h2>
              <p className="text-sm text-slate-400">Sans optimisation, vous passez à côté de :</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] text-slate-500 mb-1">Revenu net optimisé</div>
              <div
                className="text-5xl font-black tracking-tight leading-none"
                style={{ color: '#34d399', filter: 'drop-shadow(0 0 20px rgba(52,211,153,0.5))' }}
              >
                {fmt(scenarioOptimise.netOptimise)}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
                style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399', boxShadow: '0 0 16px rgba(52,211,153,0.25)' }}>
                +{fmt(scenarioOptimise.gainTotal)}/an disponibles
              </div>
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
          <div className="flex items-center justify-between pt-5 flex-wrap gap-4 border-t border-slate-800">
            <div>
              <div className="text-sm text-slate-400">Gain potentiel total estimé</div>
              <div className="text-2xl font-black text-emerald-400">+{fmt(scenarioOptimise.gainTotal)}/an</div>
              <div className="text-xs text-slate-600 mt-0.5">Estimations indicatives · À valider avec un expert-comptable</div>
            </div>
            <a
              href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 16px rgba(5,150,105,0.4)' }}
            >
              Mettre en place avec un expert →
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          7. PONT VERS L'EXPLORER
      ══════════════════════════════════════════════ */}
      <div
        className="rounded-2xl border border-blue-500/20 bg-slate-950 p-6 flex justify-between items-center gap-6 flex-wrap"
      >
        <div>
          <div className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.08em] mb-1.5">
            🔍 Module exploration
          </div>
          <div className="text-[15px] font-bold text-slate-100 mb-1">
            Et si votre CA augmentait ? Et si vous vous mariez ?
          </div>
          <div className="text-[13px] text-slate-500 mb-3">
            Vos chiffres sont pré-chargés dans l&apos;explorateur interactif.
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              `CA × 2 → ${fmt(params.ca * 2)}`,
              'Se marier',
              '2 enfants',
              `PER max → ${fmt(Math.min(35194, Math.max(0, benBrut * 0.10)))}`,
            ].map(preset => (
              <span
                key={preset}
                className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full"
              >
                {preset}
              </span>
            ))}
          </div>
        </div>
        <Link
          href={explorerUrl}
          className="shrink-0 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-px"
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 14px rgba(29,78,216,0.35)', textDecoration: 'none' }}
        >
          Ouvrir l&apos;explorateur →
        </Link>
      </div>

      {/* ══════════════════════════════════════════════
          8. CTA — 2 colonnes : Sauvegarder + Prendre RDV
      ══════════════════════════════════════════════ */}
      <div
        className="rounded-3xl border border-slate-700/60 overflow-hidden relative"
        style={{
          background: 'radial-gradient(900px 320px at 100% 0%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(700px 280px at 0% 100%, rgba(139,92,246,0.14), transparent 60%), #0f172a',
        }}
      >
        <div className="relative p-8 sm:p-10">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-blue-300/90 font-semibold mb-6">
            <span className="h-px w-6 bg-blue-400/60" />
            Étape suivante
            <span className="h-px w-6 bg-blue-400/60" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gauche : Sauvegarder */}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 backdrop-blur p-6 flex flex-col gap-4">
              <div className="text-2xl">💾</div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Sauvegarder cette simulation</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  Retrouvez vos résultats et comparez plusieurs scénarios dans &quot;Mes simulations&quot;. Gratuit, sans engagement.
                </p>
              </div>
              <button
                onClick={() => setShowSaveModal(true)}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 hover:border-slate-400 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 font-semibold text-sm transition-all hover:-translate-y-px"
              >
                💾 Enregistrer cette simulation
              </button>
            </div>

            {/* Droite : Prendre RDV + social proof */}
            <div
              className="rounded-2xl border overflow-hidden flex flex-col"
              style={{ borderColor: 'rgba(59,130,246,0.35)', background: 'linear-gradient(135deg, rgba(29,78,216,0.15), rgba(17,24,39,0.8))' }}
            >
              <div className="p-6 flex flex-col gap-4 flex-1">
                <div className="text-2xl">📅</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Affiner avec un expert</h3>
                  <p className="text-[13px] text-slate-300 leading-relaxed">
                    Nos experts Belho Xper analysent votre situation réelle et mettent en place les leviers identifiés.
                  </p>
                </div>

                {/* Social proof */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex flex-col gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1">
                    +500 dirigeants déjà optimisés
                  </div>
                  {[
                    { init: 'T.M.', role: 'Consultant', gain: '+14 200€/an' },
                    { init: 'A.L.', role: 'Dev indépendante', gain: '+8 900€/an' },
                    { init: 'M.C.', role: 'Gain moyen client', gain: '+11 400€/an' },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: `${bestAccent}30`, color: bestAccent }}
                        >
                          {t.init.split('.')[0]}
                        </div>
                        <span className="text-[11px] text-slate-400">{t.init} · {t.role}</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400 flex-shrink-0">{t.gain}</span>
                    </div>
                  ))}
                </div>

                <a
                  href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 px-6 py-3 font-bold text-sm transition-all hover:-translate-y-px shadow-lg"
                  style={{ textDecoration: 'none', boxShadow: '0 6px 20px rgba(255,255,255,0.2)' }}
                >
                  Rejoindre les 500+ dirigeants optimisés →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          9. Bouton retour
      ══════════════════════════════════════════════ */}
      <div className="flex justify-start pt-2 border-t border-slate-800">
        <button
          onClick={prevStep}
          className="px-5 py-2.5 text-[13px] font-semibold text-slate-500 hover:text-slate-300 bg-transparent hover:bg-slate-800/50 border border-slate-700/60 hover:border-slate-600 rounded-xl cursor-pointer transition-all"
        >
          ← Modifier les paramètres
        </button>
      </div>

      <style>{`
        .card-hover { transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
        .card-hover:hover { transform: translateY(-2px); }
      `}</style>

      {showSaveModal && (
        <SaveSimulationModal onClose={() => setShowSaveModal(false)} onSaved={() => setIsSaved(true)} results={results} params={params} tmi={tmi} />
      )}
    </div>
  )
}
