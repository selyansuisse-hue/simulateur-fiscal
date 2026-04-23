'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt } from '@/lib/utils'
import { tmiRate, calcPartsTotal } from '@/lib/fiscal/ir'
import { StructureResult } from '@/lib/fiscal'
import { SimParams } from '@/lib/fiscal/types'
import { SaveSimulationModal } from '@/components/simulateur/SaveSimulationModal'

/* ── Analyse contextuelle ── */
function genAnalyse(best: StructureResult, params: SimParams, tmi: number) {
  const ben = Math.max(0, params.ca - params.charges - params.amort - params.deficit)
  const parts = calcPartsTotal(params.partsBase, params.nbEnfants)
  const partsStr = parts % 1 === 0 ? parts.toString() : parts.toFixed(1).replace('.', ',')
  const situStr = params.partsBase === 2
    ? `couple${params.nbEnfants > 0 ? ` avec ${params.nbEnfants} enfant${params.nbEnfants > 1 ? 's' : ''}` : ''}`
    : 'célibataire'
  const f = best.forme
  let pourquoi = '', attention = ''

  if (f === 'EI (réel normal)') {
    pourquoi = `Avec un CA de ${fmt(params.ca)} et un résultat avant rémunération de ${fmt(ben)}, en situation de ${situStr} (${partsStr} parts), votre TMI reste à ${tmi}%. L'EI au réel vous permet de déduire toutes les charges réelles et profite de cotisations SSI calculées par composante — sans surcoût lié à l'IS.`
    attention = `Si votre résultat avant rémunération dépasse 60 000 €/an, le passage en société IS (EURL ou SASU) devient généralement avantageux : l'IS 15% sera inférieur à votre TMI IR (${tmi}%).`
  } else if (f === 'EURL / SARL (IS)') {
    pourquoi = `Avec un CA de ${fmt(params.ca)} et un résultat avant rémunération de ${fmt(ben)}, l'IS 15% sur les premiers 42 500 € est inférieur à votre TMI (${tmi}%). La séparation patrimoine personnel / société apporte également une protection supplémentaire.`
    attention = `Les dividendes supérieurs à ${fmt(params.capital * 0.10)} (10% du capital de ${fmt(params.capital)}) sont soumis aux cotisations TNS ~45%. Augmenter le capital social permet d'augmenter ce seuil de distribution.`
  } else if (f === 'SAS / SASU') {
    pourquoi = `Avec un CA de ${fmt(params.ca)}, la SASU combine un salaire de président (cotisations assimilé salarié) et des dividendes sans cotisations sociales. C'est la seule structure en France offrant ce double avantage — particulièrement pertinent avec votre résultat avant rémunération de ${fmt(ben)}.`
    attention = `En tant que président de SASU, vous n'êtes pas couvert par France Travail. Une assurance perte d'emploi (GSC ou contrat Madelin) est fortement recommandée et déductible de l'IS.`
  } else {
    pourquoi = `Avec un CA de ${fmt(params.ca)}, le régime micro offre la simplicité maximale : abattement forfaitaire de ${Math.round((params.abat || 0.5) * 100)}% sans comptabilité obligatoire. Vos charges réelles étant limitées, ce régime est bien adapté à votre profil.`
    attention = `Si votre CA dépasse 77 700 € deux années consécutives, le passage au régime réel est obligatoire. Votre CA actuel représente ${Math.round(params.ca / 77700 * 100)}% du plafond — anticipez la transition dès maintenant.`
  }
  return { pourquoi, attention }
}

/* ── LevierCard — mini-simulateur inline dépliable ── */
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

      {/* Header */}
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

      {/* Toggle */}
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

      {/* Mini-simulateur */}
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

/* ── Composant principal ── */
export function StepResultats() {
  const { results, params, prevStep } = useSimulateur()
  const [showSaveModal, setShowSaveModal] = useState(false)

  if (!results) return null
  const { scored, best, tmi, gain } = results

  const { pourquoi, attention } = genAnalyse(best, params, tmi)

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
      perGain,
      ikGain,
      domGain,
      prevGain,
      gainTotal,
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
            {gain > 500 && (
              <span className="bg-emerald-500/15 text-emerald-400 text-xs px-3 py-1 rounded-full font-medium">
                +{fmt(gain)}/an vs la moins avantageuse
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── POURQUOI CE CHOIX — 3 blocs dark ── */}
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

      {/* ── COMPARAISON DES STRUCTURES — cards dark uniformes ── */}
      <div>
        <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-1">
          Comparaison des structures
          <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
        </div>
        <p className="text-sm text-ink3 mb-3">Triées par score multicritère selon votre priorité.</p>
        <div className={`grid gap-4 items-stretch ${cardsGrid}`}>
          {scored.map((r, i) => (
            <StructureCard key={r.forme} r={r} rank={i} params={params} gain={gain} />
          ))}
        </div>
      </div>

      {/* ── PONT VERS L'EXPLORER ── */}
      <div className="rounded-2xl overflow-hidden border border-slate-200"
        style={{ background: 'linear-gradient(135deg, #EFF4FF, #EEF2FF)' }}>
        <div className="px-6 py-5 flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
              🔍 Explorez les variantes
            </div>
            <div className="text-base font-bold text-slate-900">
              Et si votre CA augmentait ? Et si vous vous mariez ?
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              Ajustez vos paramètres en temps réel. Vos chiffres sont pré-chargés.
            </div>
          </div>
          <Link href={explorerUrl}
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 12px rgba(29,78,216,0.3)' }}>
            <span>Ouvrir l&apos;explorateur</span>
            <span>→</span>
          </Link>
        </div>
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          {[
            { label: `CA × 2 (${fmt(params.ca * 2)})`, emoji: '📈' },
            { label: 'Se marier', emoji: '💍' },
            { label: '2 enfants', emoji: '👨‍👩‍👧' },
            { label: `PER ${fmt(Math.min(35194, Math.max(0, benBrut * 0.10)))}`, emoji: '📊' },
          ].map(preset => (
            <span key={preset.label}
              className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full font-medium">
              {preset.emoji} {preset.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── SCÉNARIO OPTIMISÉ + LEVIERS UNIFIÉS ── */}
      <div className="rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #052e16, #064e23, #065f2c)' }}>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">
                ✦ Scénario optimisé
              </div>
              <h2 className="font-display text-2xl font-black text-white mb-1">
                Ce que vous pourriez atteindre
              </h2>
              <p className="text-sm text-white/50">
                En activant tous les leviers disponibles pour {best.forme}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] text-white/30 mb-1">Revenu net optimisé</div>
              <div className="font-display text-4xl font-black text-emerald-400 tracking-tight">
                {fmt(scenarioOptimise.netOptimise)}
              </div>
              <div className="text-sm text-emerald-400/60 mt-0.5">
                +{fmt(scenarioOptimise.gainTotal)}/an supplémentaires
              </div>
            </div>
          </div>
        </div>

        {/* Les 4 leviers cliquables */}
        <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LevierCard
            icon="📊"
            titre="PER individuel"
            detail={`Versement max : ${fmt(scenarioOptimise.perMax)}/an`}
            gainDefault={scenarioOptimise.perGain}
            explication={`À TMI ${tmi}%, chaque euro versé au PER réduit votre IR de ${tmi} centimes. C'est un double levier unique pour les TNS : économie IR + économie cotisations. Plafond 2025 : 10% du résultat, max ${fmt(35194)}/an.`}
            inputLabel="Montant PER annuel (€)"
            inputMax={Math.max(100, scenarioOptimise.perMax)}
            inputDefault={scenarioOptimise.perMax}
            calcGain={(val) => Math.round(val * tmi / 100)}
          />
          <LevierCard
            icon="🚗"
            titre="Indemnités kilométriques"
            detail="Barème fiscal 2025 — déductible du résultat"
            gainDefault={scenarioOptimise.ikGain}
            explication={`Les IK sont déductibles de votre résultat (IS ou BIC) selon le barème fiscal 2025. Pour un véhicule 5CV : 0,636 €/km jusqu'à 5 000 km. Sur 8 000 km, la déduction est de ${fmt(Math.round(8000 * 0.636))}, soit une économie IS d'environ ${fmt(scenarioOptimise.ikGain)}.`}
            inputLabel="Kilomètres professionnels / an"
            inputMax={50000}
            inputDefault={8000}
            calcGain={(val) => Math.round(val * 0.636 * 0.15)}
          />
          <LevierCard
            icon="🏠"
            titre="Domiciliation domicile"
            detail="Part bureau déductible au prorata surface"
            gainDefault={scenarioOptimise.domGain}
            explication={`Si vous travaillez depuis votre domicile, une quote-part des charges (loyer, EDF, internet, assurance) est déductible au prorata de la surface bureau / surface totale. La pièce doit être dédiée à l'activité professionnelle.`}
            inputLabel="Charges annuelles domicile (€)"
            inputMax={30000}
            inputDefault={12000}
            calcGain={(val) => Math.round(val * 0.20 * 0.15)}
          />
          <LevierCard
            icon="🛡"
            titre="Prévoyance TNS"
            detail="Déductible du résultat IS ou BIC"
            gainDefault={scenarioOptimise.prevGain}
            explication={`Les primes de prévoyance (arrêt maladie, invalidité, décès) sont entièrement déductibles du résultat. Double avantage : protection renforcée ET économie fiscale immédiate. Pour ${fmt(Math.max(1000, Math.round(benBrut * 0.02)))}/an de prime, l'économie IS estimée est de ${fmt(scenarioOptimise.prevGain)}.`}
            inputLabel="Prime annuelle prévoyance (€)"
            inputMax={10000}
            inputDefault={Math.max(1000, Math.round(benBrut * 0.02))}
            calcGain={(val) => Math.round(val * 0.15)}
          />
        </div>

        {/* Footer total + CTA */}
        <div className="px-8 pb-8">
          <div className="flex items-center justify-between pt-5 flex-wrap gap-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <div className="text-sm text-white/50">Gain potentiel total estimé</div>
              <div className="font-display text-2xl font-black text-emerald-400">
                +{fmt(scenarioOptimise.gainTotal)}/an
              </div>
              <div className="text-xs text-white/30 mt-0.5">
                Estimations indicatives · À valider avec un expert-comptable
              </div>
            </div>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.4)' }}>
              Mettre en place avec un expert →
            </a>
          </div>
        </div>
      </div>

      {/* ── PROTECTION SOCIALE — tableau compact ── */}
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
                  <th className="text-left text-[10px] font-bold tracking-wide uppercase text-ink3 px-4 py-3 min-w-[140px]">
                    Critère
                  </th>
                  {scored.map((r, i) => (
                    <th key={r.forme} className={`text-left text-[10px] font-bold tracking-wide uppercase px-4 py-3 whitespace-nowrap
                      ${i === 0 ? 'text-blue' : 'text-ink3'}`}>
                      {r.forme}
                      {i === 0 && (
                        <span className="ml-1.5 text-[8px] bg-blue text-white px-1.5 py-0.5 rounded-full">★</span>
                      )}
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
                    <td className="px-4 py-3 text-[12px] font-semibold text-ink3 border-b border-surface2">
                      {row.label}
                    </td>
                    {scored.map((r, ci) => {
                      const val = row.fn(r)
                      const isQual = row.label === 'Qualité globale'
                      const qualColor = isQual
                        ? val === 'bon' ? 'text-green-700 font-bold'
                          : val === 'moyen' ? 'text-amber-700 font-bold'
                          : 'text-red-700 font-bold'
                        : ci === 0 ? 'text-blue font-bold' : 'text-ink'
                      return (
                        <td key={r.forme} className={`px-4 py-3 text-[12px] border-b border-surface2 ${qualColor}`}>
                          {val}
                        </td>
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

      {/* ── CTA FINAL — 2 colonnes ── */}
      <div className="rounded-2xl relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d1627 0%, #0d1f3c 100%)' }}>
        <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(37,99,235,.18) 0%,transparent 65%)', top: '-12rem', right: '-6rem' }} />
        <div className="relative grid grid-cols-1 sm:grid-cols-2">
          <div className="p-8">
            <h3 className="font-display text-2xl font-black text-white mb-2.5 tracking-tight">
              Ces résultats vous intéressent ?
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Prenons rendez-vous pour affiner votre situation réelle et mettre en place les leviers identifiés.
              Cabinet Belho Xper — Lyon &amp; Montluel.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
                className="px-6 py-3 bg-blue text-white font-bold text-sm rounded-lg hover:bg-blue-dark hover:-translate-y-0.5 transition-all"
                style={{ boxShadow: '0 4px 16px rgba(29,78,216,.4)' }}>
                Prendre RDV →
              </a>
              <button onClick={() => setShowSaveModal(true)}
                className="px-6 py-3 font-semibold text-sm rounded-lg border transition-all hover:bg-white/15 hover:-translate-y-0.5"
                style={{ background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.15)' }}>
                💾 Enregistrer
              </button>
            </div>
          </div>
          <div className="p-8 flex items-center" style={{ borderLeft: '1px solid rgba(255,255,255,.07)' }}>
            <div className="w-full rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,.05)' }}>
              <div>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {best.forme}
                </div>
                <div className="font-display text-3xl font-black text-emerald-400">{fmt(best.netAnnuel)}</div>
                <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {fmt(Math.round(best.netAnnuel / 12))}/mois
                </div>
              </div>
              {gain > 500 && (
                <div className="pt-4 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Gain vs moins avantageuse
                  </div>
                  <div className="font-display text-xl font-bold text-emerald-400">+{fmt(gain)}/an</div>
                </div>
              )}
              <div className="pt-4 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Score multicritère
                </div>
                <div className="font-display text-xl font-bold text-white">{best.scoreTotal}/100</div>
              </div>
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

      {/* Modales */}
      {showSaveModal && (
        <SaveSimulationModal onClose={() => setShowSaveModal(false)} results={results} params={params} tmi={tmi} />
      )}
    </div>
  )
}

/* ── StructureCard — dark, hauteur uniforme ── */
const CARD_PALETTES = [
  {
    headerBg: 'linear-gradient(135deg, #1e3a5f, #152d4a)',
    accent: '#60A5FA',
    badgeBg: 'rgba(96,165,250,0.15)',
    badgeColor: '#93C5FD',
    netColor: '#60A5FA',
    border: 'rgba(96,165,250,0.3)',
    glow: 'rgba(96,165,250,0.15)',
  },
  {
    headerBg: 'linear-gradient(135deg, #2d1f0e, #231808)',
    accent: '#FBBF24',
    badgeBg: 'rgba(251,191,36,0.15)',
    badgeColor: '#FCD34D',
    netColor: '#FBBF24',
    border: 'rgba(251,191,36,0.25)',
    glow: 'rgba(251,191,36,0.08)',
  },
  {
    headerBg: 'linear-gradient(135deg, #1a1f2e, #141820)',
    accent: '#94A3B8',
    badgeBg: 'rgba(148,163,184,0.12)',
    badgeColor: '#CBD5E1',
    netColor: '#94A3B8',
    border: 'rgba(148,163,184,0.2)',
    glow: 'rgba(148,163,184,0.05)',
  },
  {
    headerBg: 'linear-gradient(135deg, #141820, #0f1219)',
    accent: '#64748B',
    badgeBg: 'rgba(100,116,139,0.10)',
    badgeColor: '#94A3B8',
    netColor: '#64748B',
    border: 'rgba(100,116,139,0.15)',
    glow: 'rgba(100,116,139,0.04)',
  },
]

function StructureCard({ r, rank, params, gain }: {
  r: StructureResult
  rank: number
  params: SimParams
  gain: number
}) {
  const isRec = rank === 0
  const p = CARD_PALETTES[Math.min(rank, CARD_PALETTES.length - 1)]

  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(tmiRate((cardTmiBase || 0) + params.autresRev, params.partsBase, params.nbEnfants) * 100)
  const revBrut = Math.max(1, r.netAnnuel + r.charges + r.ir + (r.is || 0))
  const tauxEff = (r.ir / revBrut * 100).toFixed(1)

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        border: `1px solid ${p.border}`,
        boxShadow: isRec
          ? `0 0 0 2px ${p.accent}40, 0 8px 32px rgba(0,0,0,0.2)`
          : '0 2px 8px rgba(0,0,0,0.1)',
      }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: p.headerBg }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isRec && <span className="text-sm leading-none">★</span>}
            <span className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: p.accent }}>
              {isRec ? 'RECOMMANDÉ' : `${rank + 1}ème choix`}
            </span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: p.badgeBg, color: p.badgeColor }}>
            {r.scoreTotal}/100
          </span>
        </div>
        <div className="text-base font-bold text-white mb-0.5">{r.forme}</div>
        <div className="text-xs text-white/40 truncate">{r.strat}</div>
      </div>

      {/* Revenu net */}
      <div className="px-5 py-5 border-b" style={{ borderColor: p.border + '40', background: '#0d1829' }}>
        <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Revenu net après impôts</div>
        <div className="font-display text-4xl font-black tracking-tight leading-none mb-1.5"
          style={{ color: p.netColor }}>
          {fmt(r.netAnnuel)}
        </div>
        <div className="text-sm text-white/40">{fmt(Math.round(r.netAnnuel / 12))}/mois</div>
        {isRec && gain > 500 && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}>
            +{fmt(gain)}/an vs moins avantageuse
          </div>
        )}
      </div>

      {/* Décomposition */}
      <div className="px-5 py-4 flex-1 space-y-2.5" style={{ background: '#0a1220' }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-white/60">Cotisations sociales</div>
            <div className="text-[10px] text-white/30">
              {r.forme.includes('SAS') ? 'Charges sal. + patronales' : 'SSI (TNS)'}
            </div>
          </div>
          <div className="text-sm font-bold text-red-400 flex-shrink-0">−{fmt(r.charges)}</div>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-white/60">Impôt sur le revenu</div>
            <div className="text-[10px] text-white/30">TMI {cardTmi}% · {params.parts} parts</div>
          </div>
          <div className="text-sm font-bold text-orange-400 flex-shrink-0">−{fmt(r.ir)}</div>
        </div>
        {r.is > 0 && (
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-white/60">IS société</div>
              <div className="text-[10px] text-white/30">15%/25% sur résultat</div>
            </div>
            <div className="text-sm font-bold text-blue-400 flex-shrink-0">−{fmt(r.is)}</div>
          </div>
        )}
        {r.div > 0 && (
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-white/60">Dividendes</div>
              <div className="text-[10px] text-white/30">{r.methDiv || 'PFU 30%'}</div>
            </div>
            <div className="text-sm font-bold text-emerald-400 flex-shrink-0">+{fmt(r.div)}</div>
          </div>
        )}
      </div>

      {/* Footer TMI */}
      <div className="px-5 py-3.5 grid grid-cols-3 divide-x divide-white/[0.07]"
        style={{ background: '#07101d', borderTop: `1px solid ${p.border}30` }}>
        <div className="text-center pr-3">
          <div className="text-[9px] text-white/25 uppercase tracking-wide mb-1">TMI</div>
          <div className={`text-sm font-black
            ${cardTmi <= 11 ? 'text-emerald-400' : cardTmi <= 30 ? 'text-amber-400' : 'text-red-400'}`}>
            {cardTmi}%
          </div>
        </div>
        <div className="text-center px-3">
          <div className="text-[9px] text-white/25 uppercase tracking-wide mb-1">IR total</div>
          <div className="text-sm font-black text-white/70">{fmt(r.ir)}</div>
        </div>
        <div className="text-center pl-3">
          <div className="text-[9px] text-white/25 uppercase tracking-wide mb-1">Taux eff.</div>
          <div className="text-sm font-black text-white/70">{tauxEff}%</div>
        </div>
      </div>
    </div>
  )
}
