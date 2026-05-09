'use client'
import { tmiRate } from '@/lib/fiscal/ir'
import { fmt } from '@/lib/utils'

/* ── Types ──────────────────────────────────────────────── */
interface ScoreBreakdown {
  netScore: number; netMax: number
  flexScore: number; flexMax: number
  protScore: number; protMax: number
  adminScore: number; adminMax: number
}

export interface StoredResult {
  forme: string
  netAnnuel: number
  ir: number
  charges: number
  is: number
  scoreTotal: number
  // Extended (saved from v2+ modal)
  strat?: string
  ben?: number
  bNet?: number
  baseIR?: number
  div?: number
  divNet?: number
  remBrute?: number
  remNet?: number
  remMois?: number
  netMois?: number
  ratioDivPct?: number
  methDiv?: string
  tauxCotis?: number
  scoreBreakdown?: ScoreBreakdown
  cotisPatronales?: number
  cotisSalariales?: number
}

interface StoredParams {
  ca?: number
  charges?: number
  amort?: number
  partsBase?: number
  nbEnfants?: number
  parts?: number
  autresRev?: number
  stratActif?: string
}

interface Props {
  scored: StoredResult[]
  params: StoredParams
  ca: number
  gain: number
}

/* ── Helpers ─────────────────────────────────────────────── */
function structureAccent(forme: string): string {
  if (forme.includes('SAS')) return '#8b5cf6'
  if (forme.includes('EURL') || forme.includes('SARL')) return '#3b82f6'
  if (forme.includes('Micro')) return '#94a3b8'
  return '#f59e0b'
}

const SCORE_TOOLTIP = 'Score multicritère /100 — pondère : revenu net, flexibilité, protection sociale et simplicité administrative.'

function ScoreBadge({ score, color }: { score: number; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        borderRadius: '6px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.6)',
        padding: '2px 8px', fontSize: '11px', fontFamily: 'ui-monospace,monospace',
        color, cursor: 'help',
      }}
      title={SCORE_TOOLTIP}
    >
      {score}<span style={{ color: '#475569' }}>/100</span>
      <span style={{ fontSize: '9px', color: '#475569' }}>ⓘ</span>
    </span>
  )
}

function ScoreDimBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '11px', fontFamily: 'ui-monospace,monospace', color: '#cbd5e1' }}>
          {score}<span style={{ color: '#334155' }}>/{max}</span>
        </span>
      </div>
      <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(30,41,59,0.8)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: color, boxShadow: `0 0 8px ${color}80`, transition: 'width 500ms' }} />
      </div>
    </div>
  )
}

/* ── StructureDetailCard ─────────────────────────────────── */
function StructureDetailCard({ r, rank, params, gain, bestNetAnnuel, ca }: {
  r: StoredResult
  rank: number
  params: StoredParams
  gain: number
  bestNetAnnuel: number
  ca: number
}) {
  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(
    tmiRate(
      (cardTmiBase || 0) + (params.autresRev || 0),
      params.partsBase || 1,
      params.nbEnfants || 0
    ) * 100
  )
  const safeCA = Math.max(1, ca)
  const exploitCharges = (params.charges || 0) + (params.amort || 0)
  const exploitPct = Math.min(100, exploitCharges / safeCA * 100)
  const netPct = Math.min(100, r.netAnnuel / safeCA * 100)
  const chargesPct = Math.min(100, r.charges / safeCA * 100)
  const irPct = Math.min(100, r.ir / safeCA * 100)
  const isPct = Math.min(100, (r.is || 0) / safeCA * 100)
  const coutTotal = r.charges + r.ir + (r.is || 0)
  const coutPct = (coutTotal / safeCA * 100).toFixed(0)
  const revBrut = Math.max(1, r.netAnnuel + coutTotal)
  const tauxEff = (r.ir / revBrut * 100).toFixed(1)

  const accent = structureAccent(r.forme)
  const isReco = rank === 0
  const diff = Math.round(bestNetAnnuel - r.netAnnuel)
  const rankLabels = ['★ Recommandée', '2ᵉ choix', '3ᵉ choix', '4ᵉ choix']
  const rankLabel = rankLabels[Math.min(rank, 3)]

  const formDesc: Record<string, string> = {
    'SAS / SASU': 'Salaire assimilé-salarié + dividendes sans CS',
    'EURL / SARL (IS)': 'Rémunération TNS + dividendes · régime IS',
    'EI (réel normal)': 'Revenu BIC/BNC · cotisations SSI sur résultat',
    'Micro-entreprise': 'Cotisations sur CA · abattement forfaitaire',
  }

  return (
    <div
      style={{
        position: 'relative', borderRadius: '16px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: '#0f172a',
        border: isReco ? `1px solid ${accent}aa` : '1px solid rgba(51,65,85,0.5)',
        boxShadow: isReco ? `0 20px 60px -20px ${accent}55, 0 0 0 1px ${accent}30` : 'none',
        transform: isReco ? 'scale(1.02)' : 'none',
      }}
    >
      {/* Top accent strip */}
      <div style={{ height: '3px', width: '100%', background: accent }} />

      {/* Rank + Score */}
      <div style={{ padding: '14px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isReco ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px',
            padding: '2px 8px', fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            background: `${accent}26`, color: accent, border: `1px solid ${accent}55`,
          }}>
            {rankLabel}
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px',
            background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.6)',
            padding: '2px 8px', fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.14em', color: '#64748b',
          }}>
            {rankLabel}
          </span>
        )}
        <ScoreBadge score={r.scoreTotal} color={accent} />
      </div>

      {/* Forme + desc + strat */}
      <div style={{ padding: '12px 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: accent }}>{r.forme}</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
          {formDesc[r.forme] || r.forme}
        </p>
        {r.strat && (
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.strat}
          </p>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(30,41,59,1)' }} />

      {/* Net annuel */}
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#475569', fontWeight: 600 }}>Net après impôts</div>
        <div style={{ marginTop: '6px', fontSize: '30px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>
          {fmt(r.netAnnuel)}
        </div>
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#475569', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>
          {fmt(Math.round(r.netMois ?? r.netAnnuel / 12))}/mois
        </div>
        {isReco && gain > 500 && (
          <div style={{
            marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px',
            borderRadius: '6px', background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.25)', padding: '4px 10px',
            fontSize: '11px', color: '#6ee7b7', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap',
          }}>
            +{fmt(gain)}/an vs pire
          </div>
        )}
        {!isReco && diff > 500 && (
          <div style={{
            marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px',
            borderRadius: '6px', background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.20)', padding: '4px 10px',
            fontSize: '11px', color: '#fca5a5', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap',
          }}>
            −{fmt(diff)}/an vs recommandée
          </div>
        )}
      </div>

      {/* Proportional bar [Charges exploit][Cotis][IR][IS][Net] */}
      <div style={{ padding: '0 18px 16px' }}>
        <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', height: '6px', marginBottom: '8px', background: 'rgba(30,41,59,0.8)' }}>
          {exploitPct > 0 && <div style={{ width: `${exploitPct.toFixed(0)}%`, background: '#64748b' }} />}
          <div style={{ width: `${chargesPct.toFixed(0)}%`, background: '#f97316' }} />
          <div style={{ width: `${irPct.toFixed(0)}%`, background: '#f59e0b' }} />
          {r.is > 0 && <div style={{ width: `${isPct.toFixed(0)}%`, background: '#8b5cf6' }} />}
          <div style={{ width: `${netPct.toFixed(0)}%`, background: '#10b981' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { dot: '#64748b', label: 'Charges' },
            { dot: '#f97316', label: 'Cotis.' },
            { dot: '#f59e0b', label: 'IR' },
            ...(r.is > 0 ? [{ dot: '#8b5cf6', label: 'IS' }] : []),
            { dot: '#10b981', label: 'Net' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#475569' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: l.dot }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(30,41,59,1)' }} />

      {/* Breakdown */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Cotisations sociales</div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', fontFamily: 'ui-monospace,monospace' }}>
              {r.forme.includes('SAS') ? 'Charges sal. + patronales' : 'SSI (TNS) — maladie, retraite'}
            </div>
          </div>
          <div style={{ fontSize: '13px', fontFamily: 'ui-monospace,monospace', color: '#fca5a5', flexShrink: 0, whiteSpace: 'nowrap' }}>
            −{fmt(r.charges)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Impôt sur le revenu</div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', fontFamily: 'ui-monospace,monospace' }}>
              TMI {cardTmi}% · {params.parts ?? params.partsBase ?? 1} parts
            </div>
          </div>
          <div style={{ fontSize: '13px', fontFamily: 'ui-monospace,monospace', color: '#fca5a5', flexShrink: 0, whiteSpace: 'nowrap' }}>
            −{fmt(r.ir)}
          </div>
        </div>
        {r.is > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>IS société</div>
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', fontFamily: 'ui-monospace,monospace' }}>15% jusqu&apos;à 42 500 €</div>
              </div>
              <div style={{ fontSize: '13px', fontFamily: 'ui-monospace,monospace', color: '#fca5a5', flexShrink: 0, whiteSpace: 'nowrap' }}>
                −{fmt(r.is)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>Résultat net société</div>
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', fontFamily: 'ui-monospace,monospace' }}>
                  {params.stratActif === 'max' ? 'À distribuer en dividendes' : 'En réserve dans la société'}
                </div>
              </div>
              <div style={{ fontSize: '13px', fontFamily: 'ui-monospace,monospace', color: '#c4b5fd', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {fmt(Math.max(0, (r.ben || 0) - r.is))}
              </div>
            </div>
          </>
        )}
        {(r.div ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Dividendes perçus</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', fontFamily: 'ui-monospace,monospace' }}>{r.methDiv || 'PFU 30%'}</div>
            </div>
            <div style={{ fontSize: '13px', fontFamily: 'ui-monospace,monospace', color: '#6ee7b7', flexShrink: 0, whiteSpace: 'nowrap' }}>
              +{fmt(r.div!)}
            </div>
          </div>
        )}
        {/* Coût total */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', paddingTop: '10px', borderTop: '1px solid rgba(30,41,59,1)' }}>
          <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>Coût total</div>
          <div style={{ fontSize: '13px', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: '#f1f5f9', flexShrink: 0, whiteSpace: 'nowrap' }}>
            −{fmt(coutTotal)} <span style={{ color: '#334155', fontSize: '10px' }}>{coutPct}% CA</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(30,41,59,1)' }} />

      {/* Score dimension bars OR fallback */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {r.scoreBreakdown ? (
          <>
            <ScoreDimBar label="NET"   score={r.scoreBreakdown.netScore}   max={r.scoreBreakdown.netMax}   color={accent} />
            <ScoreDimBar label="FLEX"  score={r.scoreBreakdown.flexScore}  max={r.scoreBreakdown.flexMax}  color={accent} />
            <ScoreDimBar label="PROT"  score={r.scoreBreakdown.protScore}  max={r.scoreBreakdown.protMax}  color={accent} />
            <ScoreDimBar label="ADMIN" score={r.scoreBreakdown.adminScore} max={r.scoreBreakdown.adminMax} color={accent} />
          </>
        ) : (
          <div style={{ fontSize: '12px', color: '#475569', fontFamily: 'ui-monospace,monospace' }}>
            Score {r.scoreTotal}/100 · TMI {cardTmi}% · Eff. {tauxEff}%
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main export ─────────────────────────────────────────── */
export function SimulationCards({ scored, params, ca, gain }: Props) {
  if (!scored || scored.length === 0) return null
  const bestNetAnnuel = scored[0]?.netAnnuel ?? 0
  const cols = scored.length >= 4 ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(280px, 1fr))'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '16px', alignItems: 'start' }}>
      {scored.map((r, i) => (
        <StructureDetailCard
          key={r.forme}
          r={r}
          rank={i}
          params={params}
          gain={gain}
          bestNetAnnuel={bestNetAnnuel}
          ca={ca}
        />
      ))}
    </div>
  )
}
