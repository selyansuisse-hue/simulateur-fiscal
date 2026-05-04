'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt } from '@/lib/utils'
import { tmiRate, calcPartsTotal } from '@/lib/fiscal/ir'
import { StructureResult } from '@/lib/fiscal'
import { SimParams } from '@/lib/fiscal/types'
import { SaveSimulationModal } from '@/components/simulateur/SaveSimulationModal'
import { createClient } from '@/lib/supabase/client'

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
function structureAccent(forme: string): string {
  if (forme.includes('SAS')) return '#8b5cf6'
  if (forme.includes('EURL') || forme.includes('SARL')) return '#3b82f6'
  if (forme.includes('Micro')) return '#64748b'
  return '#f59e0b'
}

const DOT_SCORES: Record<string, { maladie: number; retraite: number; prevoyance: number }> = {
  'SAS / SASU':       { maladie: 4, retraite: 5, prevoyance: 4 },
  'EURL / SARL (IS)': { maladie: 3, retraite: 4, prevoyance: 2 },
  'EI (réel normal)': { maladie: 3, retraite: 3, prevoyance: 1 },
  'Micro-entreprise': { maladie: 1, retraite: 1, prevoyance: 1 },
}

/* ─────────────────────────────────────────────────────────
   CircularScore
───────────────────────────────────────────────────────── */
function CircularScore({ score, size = 90, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(51,65,85,0.4)" strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size >= 110 ? '30px' : size > 80 ? '22px' : '16px', fontWeight: 900, color: '#60a5fa', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>/ 100</div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   DotRating
───────────────────────────────────────────────────────── */
function DotRating({ filled, color }: { filled: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '5px' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: i < filled ? color : 'rgba(51,65,85,0.5)',
          flexShrink: 0,
        }} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   ScoreBar (mini bar for score dimensions)
───────────────────────────────────────────────────────── */
function ScoreDimBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.30)', width: '32px', flexShrink: 0, textTransform: 'uppercase' }}>{label}</span>
      <div style={{ flex: 1, height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '999px', transition: 'width 500ms ease', position: 'relative', overflow: 'hidden' }}>
          <span className="bar-shimmer" />
        </div>
      </div>
      <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.40)', width: '18px', textAlign: 'right', flexShrink: 0 }}>{score}</span>
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
   LevierCard — inchangé
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
   ProtectionCard — redesigné avec DotRating
───────────────────────────────────────────────────────── */
function ProtectionCard({ r, rank }: { r: StructureResult; rank: number }) {
  const prof = getProtProfile(r.forme)
  const dots = DOT_SCORES[r.forme] ?? { maladie: 2, retraite: 2, prevoyance: 2 }
  const accent = structureAccent(r.forme)
  const isBest = rank === 0
  return (
    <div style={{
      background: '#0d1425',
      border: `1px solid ${isBest ? `${accent}30` : 'rgba(51,65,85,0.3)'}`,
      borderTop: isBest ? `3px solid ${accent}` : '1px solid rgba(51,65,85,0.3)',
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      boxShadow: isBest ? `0 0 30px ${accent}12` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: `${accent}18`, border: `1px solid ${accent}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px',
        }}>
          {prof.icon}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9' }}>{r.forme}</div>
          <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>{prof.badge}</div>
        </div>
        {isBest && (
          <div style={{
            marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: accent,
            background: `${accent}15`, border: `1px solid ${accent}30`,
            borderRadius: '999px', padding: '2px 10px', flexShrink: 0,
          }}>
            Recommandé
          </div>
        )}
      </div>

      {/* Dot rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
        {[
          { label: 'Maladie', filled: dots.maladie, color: accent, desc: prof.bars[0].desc },
          { label: 'Retraite', filled: dots.retraite, color: accent, desc: prof.bars[1].desc },
          { label: 'Prévoyance', filled: dots.prevoyance, color: accent, desc: prof.bars[2].desc },
        ].map(row => (
          <div key={row.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.60)' }}>{row.label}</span>
              <DotRating filled={row.filled} color={row.color} />
            </div>
            <div style={{ fontSize: '10px', color: '#334155', lineHeight: 1.4 }}>{row.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer mention */}
      <div style={{
        paddingTop: '14px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: '11px', color: prof.mention.color, lineHeight: 1.5,
      }}>
        {prof.mention.icon} {prof.mention.text}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   CARD_PALETTES — inchangé
───────────────────────────────────────────────────────── */
const CARD_PALETTES = [
  {
    cardBg: '#0d1425',
    headerBg: 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(29,78,216,0.12))',
    rankText: '★ RECOMMANDÉ',
    rankColor: '#93C5FD',
    badgeBg: 'rgba(96,165,250,0.2)',
    badgeColor: '#BFDBFE',
    netColor: '#60A5FA',
    footerBg: 'rgba(37,99,235,0.06)',
  },
  {
    cardBg: '#0d1425',
    headerBg: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(109,40,217,0.10))',
    rankText: '2ÈME CHOIX',
    rankColor: '#C4B5FD',
    badgeBg: 'rgba(167,139,250,0.15)',
    badgeColor: '#DDD6FE',
    netColor: '#A78BFA',
    footerBg: 'rgba(124,58,237,0.04)',
  },
  {
    cardBg: '#0d1425',
    headerBg: 'linear-gradient(135deg, rgba(217,119,6,0.25), rgba(180,83,9,0.10))',
    rankText: '3ÈME CHOIX',
    rankColor: '#FCD34D',
    badgeBg: 'rgba(251,191,36,0.15)',
    badgeColor: '#FDE68A',
    netColor: '#FBBF24',
    footerBg: 'rgba(217,119,6,0.04)',
  },
  {
    cardBg: '#0d1425',
    headerBg: 'linear-gradient(135deg, rgba(100,116,139,0.20), rgba(71,85,105,0.08))',
    rankText: '4ÈME CHOIX',
    rankColor: '#94A3B8',
    badgeBg: 'rgba(148,163,184,0.10)',
    badgeColor: '#CBD5E1',
    netColor: '#94A3B8',
    footerBg: 'rgba(100,116,139,0.04)',
  },
]

/* ─────────────────────────────────────────────────────────
   StructureCard — redesigné (footer = score dimension bars)
───────────────────────────────────────────────────────── */
function StructureCard({ r, rank, params, gain, bestNetAnnuel }: {
  r: StructureResult
  rank: number
  params: SimParams
  gain: number
  bestNetAnnuel: number
}) {
  const pal = CARD_PALETTES[Math.min(rank, CARD_PALETTES.length - 1)]
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
  const cardShadow = rank === 0
    ? `0 0 40px ${accent}22, 0 0 0 1px ${accent}35`
    : `0 0 20px ${accent}10, 0 0 0 1px ${accent}20`

  return (
    <div style={{
      background: pal.cardBg,
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: cardShadow,
      border: `1px solid ${accent}25`,
      borderTop: `3px solid ${accent}`,
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
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {r.strat}
        </div>
      </div>

      {/* Revenu net */}
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px' }}>
          Revenu net après impôts
        </div>
        <div style={{
          fontSize: rank === 0 ? '64px' : '36px',
          fontWeight: 900, color: pal.netColor,
          letterSpacing: '-0.04em', lineHeight: '1', marginBottom: '4px',
          overflowWrap: 'break-word', wordBreak: 'break-word',
          ...(rank === 0 ? { textShadow: `0 0 30px ${accent}99` } : {}),
        }}>
          {fmt(r.netAnnuel)}
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>{fmt(Math.round(r.netAnnuel / 12))}/mois</div>
        {rank === 0 && gain > 500 && (
          <div style={{
            marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.30)',
            borderRadius: '14px', padding: '9px 18px',
            boxShadow: '0 0 16px rgba(16,185,129,0.22)',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#34D399' }}>+{fmt(gain)}/an</span>
            <span style={{ fontSize: '11px', color: 'rgba(52,211,153,0.65)' }}>vs moins avantageuse</span>
          </div>
        )}
        {rank > 0 && (() => { const diff = Math.round(bestNetAnnuel - r.netAnnuel); return diff > 500 ? (
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: '10px', padding: '6px 12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#F87171' }}>−{fmt(diff)}/an vs recommandée</span>
          </div>
        ) : null })()}
      </div>

      {/* Barre proportionnelle CA */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '7px', marginBottom: '4px', position: 'relative' }}>
          <div style={{ width: `${netPct.toFixed(0)}%`, background: pal.netColor, transition: 'width 400ms', position: 'relative', overflow: 'hidden' }}>
            <span className="bar-shimmer" />
          </div>
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

      {/* Footer — Score dimensions (remplace les 3 pills) */}
      <div style={{ padding: '14px 20px', background: pal.footerBg, display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>
          Score · {r.scoreTotal}/100 · TMI {cardTmi}% · Taux eff. {tauxEff}%
        </div>
        {r.scoreBreakdown ? (
          <>
            <ScoreDimBar label="NET"   score={r.scoreBreakdown.netScore}   max={r.scoreBreakdown.netMax}   color="#60a5fa" />
            <ScoreDimBar label="FLEX"  score={r.scoreBreakdown.flexScore}  max={r.scoreBreakdown.flexMax}  color="#a78bfa" />
            <ScoreDimBar label="PROT"  score={r.scoreBreakdown.protScore}  max={r.scoreBreakdown.protMax}  color="#34d399" />
            <ScoreDimBar label="ADMIN" score={r.scoreBreakdown.adminScore} max={r.scoreBreakdown.adminMax} color="#fbbf24" />
          </>
        ) : (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.20)' }}>Score {r.scoreTotal}/100</div>
        )}
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
   StepResultats — rendu redesigné
───────────────────────────────────────────────────────── */
export function StepResultats() {
  const { results, params, prevStep } = useSimulateur()
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user))
  }, [])

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
  const tauxEffBest = params.ca > 0 ? Math.round((best.ir + best.charges) / params.ca * 100) : 0

  return (
    <div className="animate-stepIn pb-28 space-y-6">

      {/* ══════════════════════════════════════════════
          1. HERO — split 2 colonnes
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#080d1a',
        border: '1px solid rgba(51,65,85,0.5)',
        borderTop: `3px solid ${structureAccent(best.forme)}`,
        borderRadius: '24px',
        padding: '32px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 0 60px ${structureAccent(best.forme)}18`,
      }}>
        {/* Glow décoratif */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.20) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: '999px', padding: '4px 14px', marginBottom: '20px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Structure recommandée
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '32px', alignItems: 'center' }}>
          {/* Gauche — net + gain */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>{best.forme}</div>
            <div style={{
              fontSize: '80px', fontWeight: 900, color: '#f1f5f9',
              letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '8px',
              textShadow: `0 0 40px ${structureAccent(best.forme)}80`,
            }}>
              {fmt(best.netAnnuel)}
            </div>
            <div style={{ fontSize: '15px', color: '#64748b', marginBottom: '22px' }}>
              {fmt(Math.round(best.netAnnuel / 12))}/mois net après impôts &amp; cotisations
            </div>
            {gain > 500 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.30)',
                borderRadius: '14px', padding: '10px 20px',
                boxShadow: '0 0 16px rgba(16,185,129,0.22)',
              }}>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#34d399' }}>+{fmt(gain)}/an</span>
                <span style={{ fontSize: '12px', color: 'rgba(52,211,153,0.65)' }}>vs structure la moins avantageuse</span>
              </div>
            )}
          </div>

          {/* Droite — jauge + mini bars + KPI pills */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            {/* Circular score */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <CircularScore score={best.scoreTotal} size={96} strokeWidth={9} />
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Score global
              </div>
            </div>

            {/* Score dimension bars */}
            {best.scoreBreakdown && (
              <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <ScoreDimBar label="NET"   score={best.scoreBreakdown.netScore}   max={best.scoreBreakdown.netMax}   color="#60a5fa" />
                <ScoreDimBar label="FLEX"  score={best.scoreBreakdown.flexScore}  max={best.scoreBreakdown.flexMax}  color="#a78bfa" />
                <ScoreDimBar label="PROT"  score={best.scoreBreakdown.protScore}  max={best.scoreBreakdown.protMax}  color="#34d399" />
                <ScoreDimBar label="ADMIN" score={best.scoreBreakdown.adminScore} max={best.scoreBreakdown.adminMax} color="#fbbf24" />
              </div>
            )}

            {/* KPI pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '10px', padding: '6px 12px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: tmi <= 11 ? '#34d399' : tmi <= 30 ? '#fbbf24' : '#f87171' }}>TMI {tmi}%</span>
                <span style={{ fontSize: '9px', color: '#334155', fontWeight: 600 }}>tranche marginale</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '10px', padding: '6px 12px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#60a5fa' }}>{tauxEffBest}%</span>
                <span style={{ fontSize: '9px', color: '#334155', fontWeight: 600 }}>taux effectif</span>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '10px', padding: '6px 12px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#f1f5f9' }}>{fmt(Math.round(best.netAnnuel / 12))}</span>
                <span style={{ fontSize: '9px', color: '#334155', fontWeight: 600 }}>net mensuel</span>
              </div>
            </div>
          </div>
        </div>

        {/* Décomposition CA */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '10px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: 700 }}>
            Décomposition du CA de {fmt(params.ca)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Revenu net', val: best.netAnnuel, color: '#60a5fa', pct: params.ca > 0 ? best.netAnnuel / params.ca * 100 : 0 },
              { label: 'Charges sociales', val: best.charges, color: '#f87171', pct: params.ca > 0 ? best.charges / params.ca * 100 : 0 },
              { label: 'IR estimé', val: best.ir, color: '#fb923c', pct: params.ca > 0 ? best.ir / params.ca * 100 : 0 },
              { label: 'IS estimé', val: best.is || 0, color: '#818cf8', pct: params.ca > 0 ? (best.is || 0) / params.ca * 100 : 0 },
            ].map(item => (
              <div key={item.label} style={{ background: '#0d1425', border: '1px solid rgba(51,65,85,0.3)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <div style={{ fontSize: '11px', color: '#475569' }}>{item.label}</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9', marginBottom: '2px' }}>{fmt(Math.round(item.val))}</div>
                <div style={{ height: '3px', borderRadius: '999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, item.pct)}%`, background: item.color, opacity: 0.8, position: 'relative', overflow: 'hidden' }}>
                    <span className="bar-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          2. COMPARAISON 4 STRUCTURES
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#080d1a',
        border: '1px solid rgba(51,65,85,0.4)',
        borderRadius: '24px',
        padding: '28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.20)',
              borderRadius: '999px', padding: '5px 16px', marginBottom: '12px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Comparaison des 4 structures
              </span>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
              Même CA · Même charges · Même foyer
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: '13px', margin: 0 }}>
              Triées par score multicritère selon votre priorité
            </p>
          </div>

          <div className={`grid gap-4 items-stretch ${cardsGrid}`}>
            {scored.map((r, i) => (
              <StructureCard key={r.forme} r={r} rank={i} params={params} gain={gain} bestNetAnnuel={scored[0].netAnnuel} />
            ))}
          </div>

          {/* Insights analytiques */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {buildAnalysis(scored, params, tmi, gain).map(item => (
              <div key={item.title} style={{
                background: '#0d1425', border: '1px solid rgba(51,65,85,0.4)',
                borderRadius: '16px', padding: '20px',
              }}>
                <div style={{ fontSize: '20px', marginBottom: '10px' }}>{item.icon}</div>
                <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: item.color, marginBottom: '6px' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: item.color, marginBottom: '2px' }}>{item.value}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)', marginBottom: '10px' }}>{item.sub}</div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          3. SCORE MULTICRITÈRE — nouveau
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#080d1a',
        border: '1px solid rgba(51,65,85,0.45)',
        borderRadius: '24px',
        padding: '28px',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.22)',
            borderRadius: '999px', padding: '5px 16px', marginBottom: '12px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Score multicritère
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em', margin: 0 }}>
            Analyse des 4 dimensions clés
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '32px', alignItems: 'start' }}>
          {/* Gauche — jauge + label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '120px' }}>
            <CircularScore score={best.scoreTotal} size={110} strokeWidth={10} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>{best.forme}</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>Meilleur score</div>
            </div>
          </div>

          {/* Droite — tableau comparatif */}
          <div>
            {/* Entêtes colonnes */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr repeat(4, 60px)',
              gap: '6px', marginBottom: '8px',
              paddingBottom: '8px', borderBottom: '1px solid rgba(51,65,85,0.4)',
            }}>
              <div style={{ fontSize: '9px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Structure</div>
              {[
                { label: 'NET', color: '#60a5fa' },
                { label: 'FLEX', color: '#a78bfa' },
                { label: 'PROT', color: '#34d399' },
                { label: 'ADMIN', color: '#fbbf24' },
              ].map(col => (
                <div key={col.label} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 800, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {col.label}
                </div>
              ))}
            </div>

            {/* Lignes structures */}
            {scored.map((r, i) => {
              const sb = r.scoreBreakdown
              const isFirst = i === 0
              const accent = CARD_PALETTES[Math.min(i, 3)].netColor
              return (
                <div key={r.forme} style={{
                  display: 'grid', gridTemplateColumns: '1fr repeat(4, 60px)',
                  gap: '6px', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < scored.length - 1 ? '1px solid rgba(51,65,85,0.2)' : 'none',
                  background: isFirst ? 'rgba(59,130,246,0.04)' : 'transparent',
                  borderRadius: isFirst ? '8px' : '0',
                  paddingLeft: isFirst ? '8px' : '0',
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: isFirst ? 800 : 600, color: isFirst ? '#f1f5f9' : '#94a3b8' }}>{r.forme}</div>
                    <div style={{ fontSize: '10px', color: '#334155', marginTop: '2px' }}>
                      {fmt(r.netAnnuel)}/an · {r.scoreTotal}/100
                    </div>
                  </div>
                  {sb ? [
                    { score: sb.netScore, max: sb.netMax, color: '#60a5fa' },
                    { score: sb.flexScore, max: sb.flexMax, color: '#a78bfa' },
                    { score: sb.protScore, max: sb.protMax, color: '#34d399' },
                    { score: sb.adminScore, max: sb.adminMax, color: '#fbbf24' },
                  ].map((dim, di) => (
                    <div key={di} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: isFirst ? dim.color : 'rgba(255,255,255,0.45)' }}>
                        {dim.score}
                      </div>
                      <div style={{ width: '100%', height: '3px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(dim.score / dim.max) * 100}%`, background: dim.color, opacity: isFirst ? 1 : 0.35, borderRadius: '999px' }} />
                      </div>
                    </div>
                  )) : (
                    <div style={{ gridColumn: 'span 4', fontSize: '10px', color: '#334155' }}>—</div>
                  )}
                </div>
              )
            })}

            {/* Légende */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(51,65,85,0.3)' }}>
              {[
                { label: 'NET — Revenu net optimisé', color: '#60a5fa' },
                { label: 'FLEX — Flexibilité capitaux', color: '#a78bfa' },
                { label: 'PROT — Protection sociale', color: '#34d399' },
                { label: 'ADMIN — Simplicité admin.', color: '#fbbf24' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#475569' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          4. PROTECTION SOCIALE — dot ratings
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#080d1a',
        border: '1px solid rgba(51,65,85,0.4)',
        borderRadius: '24px',
        padding: '28px',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)',
            borderRadius: '999px', padding: '5px 16px', marginBottom: '12px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Protection sociale
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
            Couverture par structure
          </h2>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Maladie · Retraite · Prévoyance — notation sur 5
          </p>
        </div>

        <div className={`grid gap-4 ${cardsGrid}`}>
          {scored.map((r, i) => (
            <ProtectionCard key={r.forme} r={r} rank={i} />
          ))}
        </div>

        {hasTNS && (
          <div style={{
            marginTop: '16px', padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.20)',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🛡</span>
            <p style={{ fontSize: '12px', color: '#93c5fd', lineHeight: 1.6, margin: 0 }}>
              <strong>Prévoyance TNS déductible</strong> — les primes (arrêt maladie, invalidité, décès) sont déductibles du résultat IS ou BIC.
              Simulez l&apos;économie via le levier Prévoyance ci-dessous.
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          5. POURQUOI CE CHOIX
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#080d1a',
        border: '1px solid rgba(51,65,85,0.4)',
        borderRadius: '24px',
        padding: '28px',
      }}>
        <div style={{
          fontSize: '13px', fontWeight: 800, color: '#475569',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '18px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          Pourquoi ce choix ?
          <div style={{ flex: 1, height: '1px', background: 'rgba(51,65,85,0.5)' }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div style={{ borderRadius: '16px', padding: '20px', background: 'linear-gradient(135deg, #0f2a52 0%, #0d1f3c 100%)', border: '1px solid rgba(59,130,246,0.20)' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60a5fa', marginBottom: '10px' }}>Argument fiscal</div>
            <p style={{ fontSize: '13px', lineHeight: 1.65, color: 'rgba(255,255,255,0.70)', margin: 0 }}>{pourquoi}</p>
          </div>
          <div style={{ borderRadius: '16px', padding: '20px', background: 'linear-gradient(135deg, #3b1515 0%, #1c0a0a 100%)', border: '1px solid rgba(239,68,68,0.20)' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f87171', marginBottom: '10px' }}>Point de vigilance</div>
            <p style={{ fontSize: '13px', lineHeight: 1.65, color: 'rgba(255,255,255,0.70)', margin: 0 }}>{attention}</p>
          </div>
          <div style={{ borderRadius: '16px', padding: '20px', background: 'linear-gradient(135deg, #073d28 0%, #051a10 100%)', border: '1px solid rgba(16,185,129,0.20)' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#34d399', marginBottom: '10px' }}>Avantage décisif</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#34d399', marginBottom: '4px', letterSpacing: '-0.02em' }}>
              {fmt(Math.round(best.netAnnuel / 12))}/mois
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.60)', margin: 0 }}>
              Revenu net avec <strong style={{ color: '#fff' }}>{best.forme}</strong> — TMI {tmi}% · Score {best.scoreTotal}/100
            </p>
            {gain > 500 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '11px', color: 'rgba(52,211,153,0.65)' }}>
                +{fmt(gain)}/an vs la moins avantageuse
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          6. SCÉNARIO OPTIMISÉ — inchangé
      ══════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════
          7. PONT VERS L'EXPLORER — dark
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#080d1a',
        border: '1px solid rgba(59,130,246,0.20)',
        borderRadius: '20px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap' as const,
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            🔍 Module exploration
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
            Et si votre CA augmentait ? Et si vous vous mariez ?
          </div>
          <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
            Vos chiffres sont pré-chargés dans l&apos;explorateur interactif.
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
            {[
              `CA × 2 → ${fmt(params.ca * 2)}`,
              'Se marier',
              '2 enfants',
              `PER max → ${fmt(Math.min(35194, Math.max(0, benBrut * 0.10)))}`,
            ].map(preset => (
              <span key={preset} style={{
                fontSize: '11px', fontWeight: 600, color: '#60a5fa',
                background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)',
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
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          boxShadow: '0 4px 14px rgba(29,78,216,0.35)',
          whiteSpace: 'nowrap' as const,
        }}>
          Ouvrir l&apos;explorateur →
        </Link>
      </div>

      {/* ══════════════════════════════════════════════
          8. CTA "Ces chiffres vous parlent ?"
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#080d1a',
        border: '1px solid rgba(96,165,250,0.18)',
        borderRadius: '24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(37,99,235,0.12)',
      }}>
        <div style={{
          position: 'absolute', right: '-4rem', top: '-4rem',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '32px', padding: '32px 36px', alignItems: 'center' }}>
          {/* Gauche */}
          <div style={{ flex: '1 1 300px' }}>
            <div style={{
              fontSize: '10px', fontWeight: 800, color: '#60a5fa',
              textTransform: 'uppercase', letterSpacing: '0.10em',
              marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
              Cabinet Belho Xper · Lyon &amp; Montluel
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 12px' }}>
              Ces chiffres vous parlent ?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: '14px', lineHeight: 1.65, margin: '0 0 24px', maxWidth: '420px' }}>
              Ces résultats sont des estimations certifiées barème 2025.
              Nos experts affinent votre stratégie et vous accompagnent dans la mise en œuvre concrète.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
              <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '13px 28px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  color: '#fff', textDecoration: 'none',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  boxShadow: '0 6px 20px rgba(29,78,216,0.45)',
                }}>
                Prendre RDV gratuitement →
              </a>
              <button
                onClick={() => setShowSaveModal(true)}
                style={{
                  padding: '13px 28px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  color: 'rgba(255,255,255,0.70)', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
                }}>
                💾 Enregistrer &amp; comparer
              </button>
            </div>
          </div>

          {/* Droite — card KPI */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '18px', padding: '24px', minWidth: '220px', textAlign: 'center', flexShrink: 0,
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Meilleur résultat simulé
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.48)', marginBottom: '4px' }}>
              {best.forme}
            </div>
            <div style={{ fontSize: '40px', fontWeight: 900, color: '#60a5fa', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px' }}>
              {fmt(best.netAnnuel)}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.33)', marginBottom: '16px' }}>
              {fmt(Math.round(best.netAnnuel / 12))}/mois net
            </div>
            {gain > 500 && (
              <div style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.20)', borderRadius: '10px', padding: '8px', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#34d399' }}>+{fmt(gain)}/an</div>
                <div style={{ fontSize: '10px', color: 'rgba(52,211,153,0.55)', marginTop: '1px' }}>
                  vs structure la moins avantageuse
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f1f5f9' }}>{best.scoreTotal}/100</div>
                <div style={{ fontSize: '9px', color: '#334155', fontWeight: 600 }}>Score</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: tmi <= 11 ? '#34d399' : tmi <= 30 ? '#fbbf24' : '#f87171' }}>TMI {tmi}%</div>
                <div style={{ fontSize: '9px', color: '#334155', fontWeight: 600 }}>Tranche</div>
              </div>
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.16)', marginTop: '14px', lineHeight: 1.5 }}>
              Simulation indicative · Barème 2025
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          9. Bouton retour
      ══════════════════════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '8px', borderTop: '1px solid rgba(51,65,85,0.4)' }}>
        <button
          onClick={prevStep}
          style={{
            padding: '10px 20px', fontSize: '13px', fontWeight: 600,
            color: '#64748b', background: 'transparent',
            border: '1px solid rgba(51,65,85,0.6)', borderRadius: '10px',
            cursor: 'pointer', transition: 'all 150ms',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
        >
          ← Modifier les paramètres
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          10. STICKY SAVE BAR
      ══════════════════════════════════════════════ */}
      <style>{`
        @keyframes savePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
        }
        .save-pulse { animation: savePulse 2.5s ease-in-out infinite; }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'rgba(9,15,29,0.95)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(51,65,85,0.5)',
        padding: '14px 24px',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
              {best.forme} · {fmt(best.netAnnuel)}/an · {fmt(Math.round(best.netAnnuel / 12))}/mois
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
              Score {best.scoreTotal}/100 · TMI {tmi}%{gain > 500 ? ` · +${fmt(gain)}/an vs moins avantageuse` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            {isSaved ? (
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✅ Simulation enregistrée
              </div>
            ) : isLoggedIn === false ? (
              <>
                <Link href="/auth/login" style={{
                  fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                  padding: '8px 16px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  textDecoration: 'none',
                }}>
                  Se connecter
                </Link>
                <Link href="/auth/signup" style={{
                  fontSize: '13px', fontWeight: 700, color: '#fff',
                  padding: '8px 18px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  textDecoration: 'none',
                }}>
                  Créer un compte gratuit →
                </Link>
              </>
            ) : (
              <button
                className="save-pulse"
                onClick={() => setShowSaveModal(true)}
                style={{
                  fontSize: '14px', fontWeight: 700, color: '#fff',
                  padding: '10px 22px', borderRadius: '12px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  border: 'none',
                }}
              >
                💾 Enregistrer cette simulation
              </button>
            )}
          </div>
        </div>
      </div>

      {showSaveModal && (
        <SaveSimulationModal onClose={() => setShowSaveModal(false)} onSaved={() => setIsSaved(true)} results={results} params={params} tmi={tmi} />
      )}
    </div>
  )
}
