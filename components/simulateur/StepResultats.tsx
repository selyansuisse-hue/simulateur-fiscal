'use client'
import { useState } from 'react'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt, fmtM } from '@/lib/utils'
import { swot, leviers, plan } from '@/lib/fiscal/structures'
import { tmiRate } from '@/lib/fiscal/ir'
import { StructureResult } from '@/lib/fiscal'
import { SimParams } from '@/lib/fiscal/types'
import { SaveSimulationModal } from '@/components/simulateur/SaveSimulationModal'

export function StepResultats() {
  const { results, params, prevStep } = useSimulateur()
  const [showSaveModal, setShowSaveModal] = useState(false)

  if (!results) return null
  const { scored, best, tmi, gain } = results

  const swotBest = swot(best, params)
  const leviersArr = leviers(best, params)
  const planArr = plan(best, params)

  const qualColor: Record<string, string> = {
    bon: 'text-green-700 bg-green-50 border-green-200',
    moyen: 'text-amber-700 bg-amber-50 border-amber-200',
    faible: 'text-red-700 bg-red-50 border-red-200',
    'très faible': 'text-red-800 bg-red-50 border-red-200',
  }

  return (
    <div className="animate-stepIn">
      {/* HERO RÉSULTAT */}
      <div className="bg-navy rounded-2xl p-9 mb-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.22)_0%,transparent_65%)] -top-36 -right-24 pointer-events-none" />
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] bg-[length:24px_24px] [mask-image:linear-gradient(135deg,black_0%,transparent_60%)]" />
        <div className="relative">
          <div className="text-[10.5px] font-semibold tracking-widest uppercase text-blue-mid mb-2.5">Recommandation</div>
          <div className="font-display text-base font-bold text-white/75 mb-2">{best.forme}</div>
          <div className="font-display text-5xl sm:text-6xl font-black text-white tracking-tighter leading-none mb-2">
            <span className="bg-gradient-to-r from-blue-mid to-blue-light bg-clip-text text-transparent">
              {fmt(best.netAnnuel)}
            </span>
          </div>
          <div className="text-sm text-white/35 mb-6">{fmtM(best.netAnnuel)} · net après IR &amp; cotisations</div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[11px] font-medium px-3 py-1 rounded-full border bg-blue-mid/15 border-blue-mid/30 text-blue-light">TMI {tmi}%</span>
            <span className="text-[11px] font-medium px-3 py-1 rounded-full border bg-white/6 border-white/10 text-white/42">Score {best.scoreTotal}/100</span>
            {gain > 500 && (
              <span className="text-[11px] font-medium px-3 py-1 rounded-full border bg-green-500/15 border-green-500/30 text-green-300">
                +{fmt(gain)} vs la moins favorable
              </span>
            )}
          </div>
        </div>
      </div>

      {/* COMPARAISON 4 STRUCTURES */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
        Comparaison des structures
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <p className="text-sm text-ink3 mb-4">Triées par score multicritère selon votre priorité.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {scored.map((r, i) => (
          <StructureCard key={r.forme} r={r} isBest={i === 0} rank={i + 1} params={params} />
        ))}
      </div>

      {/* TABLEAU RÉCAPITULATIF */}
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
                <tr key={r.forme} className={i === 0 ? 'bg-blue/[0.025]' : 'hover:bg-surface transition-colors'}>
                  <td className="px-3.5 py-3 border-b border-surface2">
                    <span className="font-bold text-ink text-[13px]">{r.forme}</span>
                    {i === 0 && <span className="ml-1.5 inline-flex items-center bg-blue text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full tracking-wide">⭐ Recommandé</span>}
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

      {/* PROTECTION SOCIALE */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
        Protection sociale
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {scored.map((r, i) => (
          <div key={r.forme} className={`bg-white rounded-xl p-4 border shadow-card transition-transform hover:-translate-y-0.5
            ${i === 0 ? 'border-blue-mid/60 shadow-[0_0_0_3px_rgba(29,78,216,.06)]' : 'border-black/[0.08]'}`}>
            <div className="font-display text-[13px] font-bold text-ink mb-2">{r.forme}</div>
            <div className={`inline-block text-[9.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border mb-3 ${qualColor[r.prot.qual] || 'text-ink3 bg-surface border-surface2'}`}>
              {r.prot.qual}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11.5px] py-1 border-b border-surface2">
                <span className="text-ink3">IJ maladie / jour</span>
                <span className="font-semibold">{r.prot.ijJ} €</span>
              </div>
              <div className="flex justify-between text-[11.5px] py-1 border-b border-surface2">
                <span className="text-ink3">IJ maladie / mois</span>
                <span className="font-semibold">{r.prot.ijM} €</span>
              </div>
              <div className="flex justify-between text-[11.5px] py-1 border-b border-surface2">
                <span className="text-ink3">Trimestres / an</span>
                <span className="font-semibold">{r.prot.trims}</span>
              </div>
              <div className="flex justify-between text-[11.5px] py-1">
                <span className="text-ink3">Retraite complémentaire</span>
                <span className="font-semibold text-xs">{r.prot.complement}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SWOT */}
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

      {/* LEVIERS */}
      {leviersArr.length > 0 && (
        <>
          <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
            Leviers d&apos;optimisation
            <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
          </div>
          <div className="bg-gradient-to-r from-blue to-blue-dark rounded-xl px-5 py-4 mb-4 flex justify-between items-center shadow-[0_4px_18px_rgba(29,78,216,.28)]">
            <span className="text-sm font-medium text-white/75">Potentiel d&apos;optimisation estimé</span>
            <span className="font-display text-2xl font-black text-white">
              {fmt(leviersArr.reduce((acc, l) => acc + l.gain, 0))}/an
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {leviersArr.map((l, i) => (
              <div key={i} className="bg-white border border-black/[0.07] rounded-xl p-4 shadow-card hover:-translate-y-0.5 hover:shadow-card-md transition-all relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-mid scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                <div className="text-2xl mb-2.5">{l.ico}</div>
                <div className="font-display text-[13.5px] font-bold text-ink mb-1">{l.nom}</div>
                <div className="text-xs text-ink3 leading-relaxed mb-2.5">{l.desc}</div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  ↑ {fmt(l.gain)}/an estimé
                </div>
                <div className="text-[11px] text-ink4 mt-2 leading-snug">{l.cond}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PLAN D'ACTION */}
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

      {/* CTA CABINET */}
      <div className="bg-navy rounded-2xl p-8 text-center mt-6 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.2)_0%,transparent_65%)] -top-48 -right-24 pointer-events-none" />
        <div className="relative">
          <h3 className="font-display text-2xl font-black text-white mb-2.5 tracking-tight">Ces résultats vous intéressent ?</h3>
          <p className="text-white/42 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Prenons rendez-vous pour affiner votre situation réelle. Cabinet Belho Xper — Lyon &amp; Montluel.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="https://www.belhoxper.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue text-white font-bold text-sm rounded-lg
                shadow-[0_4px_16px_rgba(29,78,216,.4)] hover:bg-blue-dark hover:-translate-y-0.5 transition-all"
            >
              Prendre RDV →
            </a>
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-6 py-3 bg-white/10 text-white font-semibold text-sm rounded-lg border border-white/15
                hover:bg-white/15 transition-all"
            >
              💾 Enregistrer cette simulation
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-start mt-6 pt-5 border-t border-surface2">
        <button onClick={prevStep} className="px-5 py-2.5 text-sm font-semibold text-ink3 border-[1.5px] border-surface2 rounded-lg hover:bg-surface hover:text-ink2 transition-all">← Modifier les paramètres</button>
      </div>

      {showSaveModal && (
        <SaveSimulationModal
          onClose={() => setShowSaveModal(false)}
          results={results}
          params={params}
          tmi={tmi}
        />
      )}
    </div>
  )
}

function StructureCard({ r, isBest, rank, params }: { r: StructureResult; isBest: boolean; rank: number; params: SimParams }) {
  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(tmiRate((cardTmiBase || 0) + params.autresRev, params.partsBase, params.nbEnfants) * 100)
  const cardIR = r.ir
  return (
    <div className={`bg-white rounded-xl p-4.5 border flex flex-col transition-all hover:-translate-y-0.5
      ${isBest ? 'border-blue-mid border-[1.5px] shadow-[0_0_0_4px_rgba(29,78,216,.07),0_8px_28px_rgba(11,22,39,.1)]' : 'border-black/[0.08] shadow-card hover:shadow-card-md'}`}>
      <div className="h-6 mb-2.5 flex items-center">
        {isBest && (
          <span className="inline-flex items-center gap-1 bg-blue text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wide">
            ⭐ Recommandé
          </span>
        )}
      </div>
      <div className="font-display text-[14px] font-bold text-ink mb-1">{r.forme}</div>
      <div className="text-[11.5px] text-ink3 leading-snug min-h-[28px] mb-3.5">{r.strat}</div>
      <div className={`font-display text-3xl font-black tracking-tight leading-none mb-1 ${isBest ? 'text-blue' : 'text-ink'}`}>
        {fmt(r.netAnnuel)}
      </div>
      <div className="text-[12px] text-ink4 mb-3.5">{fmt(r.netAnnuel / 12)}/mois</div>
      <div className="border-t border-surface2 pt-3 flex flex-col flex-1 gap-0">
        {[
          { k: 'Cotisations', v: `−${fmt(r.charges)}`, cls: 'text-red-500' },
          ...(r.charges ? [{ k: 'IR', v: `−${fmt(cardIR)}`, cls: 'text-red-500' }] : []),
          ...(r.is ? [{ k: 'IS', v: `−${fmt(r.is)}`, cls: 'text-red-500' }] : []),
          ...(r.div ? [{ k: 'Dividendes', v: `+${fmt(r.div)}`, cls: 'text-green-600' }] : []),
        ].map(({ k, v, cls }) => (
          <div key={k} className="flex justify-between text-[11.5px] py-1 border-b border-surface2">
            <span className="text-ink3">{k}</span>
            <span className={`font-semibold ${cls}`}>{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-surface2 flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-ink4">TMI</span>
          <span className={`text-[13px] font-bold ${isBest ? 'text-blue' : 'text-ink3'}`}>{cardTmi}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-ink4">Score multicritère</span>
          <span className={`text-[12px] font-semibold ${isBest ? 'text-blue' : 'text-ink3'}`}>{r.scoreTotal}/100</span>
        </div>
      </div>
    </div>
  )
}
