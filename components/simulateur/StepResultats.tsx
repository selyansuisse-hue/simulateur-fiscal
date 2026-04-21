'use client'
import { useState } from 'react'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt, fmtM } from '@/lib/utils'
import { swot, leviers, plan } from '@/lib/fiscal/structures'
import { tmiRate } from '@/lib/fiscal/ir'
import { StructureResult } from '@/lib/fiscal'
import { SimParams } from '@/lib/fiscal/types'
import { SaveSimulationModal } from '@/components/simulateur/SaveSimulationModal'

const RANK_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444']
const RANK_LABELS = ['Meilleur', '2ème', '3ème', '4ème']

function tmiColor(tmi: number): string {
  if (tmi <= 11) return '#16a34a'
  if (tmi <= 30) return '#d97706'
  return '#dc2626'
}

function tmiLabel(tmi: number): string {
  if (tmi <= 11) return 'tranche basse'
  if (tmi <= 30) return 'tranche moyenne'
  return 'tranche haute'
}

export function StepResultats() {
  const { results, params, prevStep } = useSimulateur()
  const [showSaveModal, setShowSaveModal] = useState(false)

  if (!results) return null
  const { scored, best, tmi, gain } = results

  const swotBest = swot(best, params)
  const leviersArr = leviers(best, params)
  const planArr = plan(best, params)
  const totalLevierGain = leviersArr.reduce((acc, l) => acc + l.gain, 0)

  return (
    <div className="animate-stepIn pb-28">

      {/* ── HERO RÉSULTAT ── */}
      <div className="bg-navy rounded-2xl p-9 mb-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.22)_0%,transparent_65%)] -top-36 -right-24 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(rgba(255,255,255,.15)_1px,transparent_1px)] bg-[length:24px_24px] [mask-image:linear-gradient(135deg,black_0%,transparent_60%)]" />
        <div className="relative">
          {/* Recommandation label with pulse */}
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-mid opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-mid" />
            </span>
            <div className="text-[10.5px] font-semibold tracking-widest uppercase text-blue-mid">Recommandation</div>
          </div>
          <div className="font-display text-base font-bold text-white/75 mb-2">{best.forme}</div>
          <div className="font-display font-black text-white tracking-tighter leading-none mb-2"
            style={{ fontSize: 'clamp(3rem, 8vw, 4.5rem)',
              backgroundImage: 'linear-gradient(135deg, #3B82F6, #93C5FD)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {fmt(best.netAnnuel)}
          </div>
          <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,.40)' }}>
            {fmtM(best.netAnnuel)} · net après IR &amp; cotisations
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: `rgba(${tmi <= 11 ? '34,197,94' : tmi <= 30 ? '245,158,11' : '239,68,68'},.18)`,
                border: `1px solid rgba(${tmi <= 11 ? '34,197,94' : tmi <= 30 ? '245,158,11' : '239,68,68'},.30)`,
                color: tmi <= 11 ? '#4ade80' : tmi <= 30 ? '#fcd34d' : '#fca5a5' }}>
              📊 TMI {tmi}%
            </span>
            <span className="text-[11px] font-medium px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)', color: 'rgba(255,255,255,.50)' }}>
              Score {best.scoreTotal}/100
            </span>
            {gain > 500 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.28)', color: '#86efac' }}>
                💰 +{fmt(gain)} vs la moins favorable
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── COMPARAISON 4 STRUCTURES ── */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
        Comparaison des structures
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <p className="text-sm text-ink3 mb-4">Triées par score multicritère selon votre priorité.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {scored.map((r, i) => (
          <StructureCard key={r.forme} r={r} rank={i + 1} params={params} />
        ))}
      </div>

      {/* ── TABLEAU RÉCAPITULATIF ── */}
      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden mb-6 shadow-card">
        <div className="bg-ink px-5 py-4 flex items-baseline gap-2.5">
          <h3 className="font-display text-sm font-bold text-white">Tableau comparatif complet</h3>
          <p className="text-xs text-white/38">Toutes les structures · revenus nets</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface border-b border-surface2">
                {['Structure', 'Net annuel', 'Net/mois', 'Cotisations', 'IR', 'IS', 'Score'].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold tracking-wide uppercase text-ink3 px-3.5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scored.map((r, i) => (
                <tr key={r.forme} className={i % 2 === 0 ? 'bg-white hover:bg-surface/50 transition-colors' : 'bg-surface/60 hover:bg-surface transition-colors'}
                  style={i === 0 ? { background: 'rgba(29,78,216,.025)' } : {}}>
                  <td className="px-3.5 py-3 border-b border-surface2">
                    <span className="font-bold text-ink text-[13px]">{r.forme}</span>
                    {i === 0 && (
                      <span className="ml-1.5 inline-flex items-center bg-blue text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                        ⭐ Recommandé
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 border-b border-surface2 font-bold text-[13px] text-green-700">{fmt(r.netAnnuel)}</td>
                  <td className="px-3.5 py-3 border-b border-surface2 text-[13px] text-ink3">{fmt(r.netAnnuel / 12)}/mois</td>
                  <td className="px-3.5 py-3 border-b border-surface2 text-[13px] text-red-600">−{fmt(r.charges)}</td>
                  <td className="px-3.5 py-3 border-b border-surface2 text-[13px] text-red-600">−{fmt(r.ir)}</td>
                  <td className="px-3.5 py-3 border-b border-surface2 text-[13px] text-ink3">{r.is > 0 ? `−${fmt(r.is)}` : '—'}</td>
                  <td className="px-3.5 py-3 border-b border-surface2">
                    <span className={`font-bold text-[13px] ${i === 0 ? 'text-blue' : 'text-ink3'}`}>{r.scoreTotal}/100</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PROTECTION SOCIALE ── */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
        Protection sociale
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {scored.map((r, i) => {
          const qualStyles: Record<string, { border: string; bg: string; badge: string }> = {
            bon: { border: '#bbf7d0', bg: '#f0fdf4', badge: 'text-green-700 bg-green-100' },
            moyen: { border: '#fde68a', bg: '#fffbeb', badge: 'text-amber-700 bg-amber-100' },
            faible: { border: '#fecaca', bg: '#fef2f2', badge: 'text-red-700 bg-red-100' },
            'très faible': { border: '#fecaca', bg: '#fef2f2', badge: 'text-red-800 bg-red-100' },
          }
          const qs = qualStyles[r.prot.qual] || { border: '#e2e8f0', bg: '#f8fafc', badge: 'text-ink3 bg-surface' }
          return (
            <div key={r.forme} className="rounded-xl p-4 transition-transform hover:-translate-y-0.5"
              style={{ border: `1.5px solid ${i === 0 ? '#93c5fd' : qs.border}`, background: i === 0 ? '#eff6ff' : qs.bg,
                boxShadow: i === 0 ? '0 0 0 3px rgba(29,78,216,.06)' : '0 1px 4px rgba(11,22,39,.04)' }}>
              <div className="font-display text-[13px] font-bold text-ink mb-2">{r.forme}</div>
              <div className={`inline-block text-[9.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-3 ${qs.badge}`}>
                {r.prot.qual}
              </div>
              <div className="space-y-1.5">
                {[
                  { l: 'IJ maladie / jour', v: `${r.prot.ijJ} €`, bold: true },
                  { l: 'IJ maladie / mois', v: `${r.prot.ijM} €`, bold: true },
                  { l: 'Trimestres / an', v: String(r.prot.trims), bold: false },
                  { l: 'Retraite complémentaire', v: r.prot.complement, bold: false },
                ].map(({ l, v, bold }) => (
                  <div key={l} className="flex justify-between text-[11.5px] py-1 border-b border-black/[0.06]">
                    <span className="text-ink3">{l}</span>
                    <span className={bold ? 'font-bold text-ink' : 'font-medium text-ink2'}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── SWOT ── */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
        Analyse SWOT — {best.forme}
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Forces', items: swotBest.pos, cls: 'bg-green-50 border-green-200', tCls: 'text-green-800', dCls: 'bg-green-500' },
          { label: 'Faiblesses', items: swotBest.neg, cls: 'bg-red-50 border-red-200', tCls: 'text-red-800', dCls: 'bg-red-500' },
          { label: 'Opportunités', items: swotBest.opp, cls: 'bg-blue-bg border-blue-border', tCls: 'text-blue-dark', dCls: 'bg-blue-mid' },
          { label: 'Risques', items: swotBest.rsk, cls: 'bg-amber-50 border-amber-200', tCls: 'text-amber-800', dCls: 'bg-amber-500' },
        ].map(({ label, items, cls, tCls, dCls }) => (
          <div key={label} className={`rounded-xl p-4 border ${cls}`}>
            <div className={`text-[10.5px] font-bold tracking-wide uppercase mb-3 ${tCls}`}>{label}</div>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 py-1.5 text-[12px] text-ink2 leading-snug">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dCls}`} />
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── LEVIERS ── */}
      {leviersArr.length > 0 && (
        <>
          <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
            Leviers d&apos;optimisation
            <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
          </div>
          <div className="rounded-xl px-5 py-4 mb-4 flex justify-between items-center"
            style={{ background: 'linear-gradient(135deg, #1D4ED8, #1539B2)', boxShadow: '0 4px 18px rgba(29,78,216,.32)' }}>
            <span className="text-sm font-medium text-white/75">Potentiel d&apos;optimisation estimé</span>
            <span className="font-display text-2xl font-black text-white">{fmt(totalLevierGain)}/an</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {leviersArr.map((l, i) => (
              <div key={i} className="bg-white rounded-xl p-4 transition-all duration-200 relative overflow-hidden"
                style={{ borderTop: '1px solid rgba(11,22,39,.07)', borderRight: '1px solid rgba(11,22,39,.07)', borderBottom: '1px solid rgba(11,22,39,.07)', borderLeft: '4px solid #1D4ED8', boxShadow: '0 2px 8px rgba(11,22,39,.05)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(11,22,39,.12)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(11,22,39,.05)' }}
              >
                <div className="text-2xl mb-2.5">{l.ico}</div>
                <div className="font-display text-[13.5px] font-bold text-ink mb-1">{l.nom}</div>
                <div className="text-xs text-ink3 leading-relaxed mb-2.5">{l.desc}</div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ color: '#065f46', background: '#d1fae5', border: '1px solid #a7f3d0' }}>
                  ↑ {fmt(l.gain)}/an estimé
                </div>
                <div className="text-[11px] text-ink4 mt-2 leading-snug">{l.cond}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── PLAN D'ACTION ── */}
      {planArr.length > 0 && (
        <>
          <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
            Plan d&apos;action — {best.forme}
            <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
          </div>
          <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-6 shadow-card">
            {planArr.map((item, i) => (
              <div key={i} className={`flex gap-3.5 py-3.5 ${i < planArr.length - 1 ? 'border-b border-surface2' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center font-display text-[11px] font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <div>
                  <div className="font-display text-[13.5px] font-bold text-ink mb-1">{item.t}</div>
                  <div className="text-[12.5px] text-ink2 leading-relaxed">{item.d}</div>
                  <span className={`inline-block mt-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded border ${
                    item.cls === 'tg-g' ? 'bg-green-50 text-green-800 border-green-200' :
                    item.cls === 'tg-a' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    'bg-blue-bg text-blue-dark border-blue-border'
                  }`}>{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── CTA CABINET ── */}
      <div className="bg-navy rounded-2xl p-8 text-center mt-6 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.2)_0%,transparent_65%)] -top-48 -right-24 pointer-events-none" />
        <div className="relative">
          <h3 className="font-display text-2xl font-black text-white mb-2.5 tracking-tight">Ces résultats vous intéressent ?</h3>
          <p className="text-white/42 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Prenons rendez-vous pour affiner votre situation réelle. Cabinet Belho Xper — Lyon &amp; Montluel.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="px-6 py-3 bg-blue text-white font-bold text-sm rounded-lg
                shadow-[0_4px_16px_rgba(29,78,216,.4)] hover:bg-blue-dark hover:-translate-y-0.5 transition-all">
              Prendre RDV →
            </a>
            <button onClick={() => setShowSaveModal(true)}
              className="px-6 py-3 font-semibold text-sm rounded-lg border transition-all hover:bg-white/15 hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,.10)', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}>
              💾 Enregistrer cette simulation
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-start mt-6 pt-5 border-t border-surface2">
        <button onClick={prevStep} className="px-5 py-2.5 text-sm font-semibold text-ink3 border-[1.5px] border-surface2 rounded-lg hover:bg-surface hover:text-ink2 transition-all">
          ← Modifier les paramètres
        </button>
      </div>

      {showSaveModal && (
        <SaveSimulationModal onClose={() => setShowSaveModal(false)} results={results} params={params} tmi={tmi} />
      )}
    </div>
  )
}

/* ── StructureCard ── */
function StructureCard({ r, rank, params }: { r: StructureResult; rank: number; params: SimParams }) {
  const isBest = rank === 1
  const rankColor = RANK_COLORS[rank - 1] || RANK_COLORS[3]
  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(tmiRate((cardTmiBase || 0) + params.autresRev, params.partsBase, params.nbEnfants) * 100)
  const cardIR = r.ir

  // Proportional bars
  const revBrut = r.charges + r.ir + r.is + Math.max(0, r.netAnnuel)
  const pct = (n: number) => revBrut > 0 ? Math.min(100, Math.round(n / revBrut * 100)) : 0

  const costRows = [
    { k: 'Cotisations', v: `−${fmt(r.charges)}`, p: pct(r.charges) },
    ...(r.ir > 0 ? [{ k: 'IR', v: `−${fmt(cardIR)}`, p: pct(cardIR) }] : []),
    ...(r.is > 0 ? [{ k: 'IS', v: `−${fmt(r.is)}`, p: pct(r.is) }] : []),
    ...(r.div > 0 ? [{ k: 'Dividendes', v: `+${fmt(r.div)}`, p: 0 }] : []),
  ]

  return (
    <div className="bg-white rounded-xl p-4 border flex flex-col transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: isBest ? '#1D4ED8' : 'rgba(11,22,39,.08)',
        borderWidth: isBest ? '1.5px' : '1px',
        boxShadow: isBest
          ? '0 0 0 3px rgba(29,78,216,.08), 0 8px 28px rgba(11,22,39,.10)'
          : '0 2px 8px rgba(11,22,39,.05)',
      }}>
      {/* Rank + badge */}
      <div className="flex items-center justify-between h-6 mb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rankColor }} />
          <span className="text-[10px] font-semibold" style={{ color: rankColor }}>{RANK_LABELS[rank - 1]}</span>
        </div>
        {isBest && (
          <span className="inline-flex items-center gap-1 bg-blue text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wide">
            ⭐ Recommandé
          </span>
        )}
      </div>

      <div className="font-display text-[14px] font-bold text-ink mb-1">{r.forme}</div>
      <div className="text-[11.5px] text-ink3 leading-snug min-h-[28px] mb-3">{r.strat}</div>

      <div className="font-display font-black tracking-tight leading-none mb-1"
        style={{ fontSize: '1.75rem', color: isBest ? '#1D4ED8' : '#0B1627' }}>
        {fmt(r.netAnnuel)}
      </div>
      <div className="text-[12px] text-ink4 mb-3">{fmt(r.netAnnuel / 12)}/mois</div>

      {/* Cost breakdown with mini bars */}
      <div className="border-t border-surface2 pt-3 flex flex-col flex-1 gap-0">
        {costRows.map(({ k, v, p }) => (
          <div key={k} className="flex items-center justify-between text-[11.5px] py-1.5 border-b border-surface2 gap-2">
            <span className="text-ink3 flex-shrink-0">{k}</span>
            <div className="flex items-center gap-2 ml-auto">
              {p > 0 && (
                <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                  <div className="h-full rounded-full" style={{ width: `${p}%`, background: k === 'Cotisations' ? '#f87171' : '#fca5a5' }} />
                </div>
              )}
              <span className={`font-semibold text-right ${k === 'Dividendes' ? 'text-green-600' : 'text-red-500'}`}>{v}</span>
            </div>
          </div>
        ))}
      </div>

      {/* TMI + IR block */}
      <div className="mt-3 pt-2.5 border-t border-surface2">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-lg p-2 text-center" style={{ background: '#f8fafc' }}>
            <div className="text-[9px] uppercase tracking-wide text-ink4 mb-0.5">TMI</div>
            <div className="font-bold text-lg leading-none" style={{ color: tmiColor(cardTmi) }}>{cardTmi}%</div>
            <div className="text-[9px] text-ink4 mt-0.5">{tmiLabel(cardTmi)}</div>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: '#f8fafc' }}>
            <div className="text-[9px] uppercase tracking-wide text-ink4 mb-0.5">IR estimé</div>
            <div className="font-bold text-base leading-none text-ink">{fmt(cardIR)}</div>
            <div className="text-[9px] text-ink4 mt-0.5">{fmt(cardIR / 12)}/mois</div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-ink4">Score multicritère</span>
          <span className="text-[12px] font-semibold" style={{ color: isBest ? '#1D4ED8' : '#4A6380' }}>{r.scoreTotal}/100</span>
        </div>
      </div>
    </div>
  )
}
