'use client'
import { useState, useMemo } from 'react'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt, fmtM } from '@/lib/utils'
import { leviers } from '@/lib/fiscal/structures'
import { tmiRate, calcPartsTotal } from '@/lib/fiscal/ir'
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

// Barème IK 2025 par puissance fiscale
const BAREME_IK: Record<number, (km: number) => number> = {
  3: (d) => d <= 5000 ? d * 0.502 : d <= 20000 ? d * 0.3 + 1007 : d * 0.364,
  4: (d) => d <= 5000 ? d * 0.575 : d <= 20000 ? d * 0.323 + 1262 : d * 0.387,
  5: (d) => d <= 5000 ? d * 0.548 : d <= 20000 ? d * 0.309 + 1194 : d * 0.373,
  6: (d) => d <= 5000 ? d * 0.574 : d <= 20000 ? d * 0.32 + 1265 : d * 0.384,
  7: (d) => d <= 5000 ? d * 0.601 : d <= 20000 ? d * 0.34 + 1301 : d * 0.407,
}

const INP = "px-3 py-2 text-sm border-[1.5px] border-surface2 rounded-lg bg-white text-ink focus:outline-none focus:border-blue-mid focus:ring-2 focus:ring-blue-mid/10 transition-all w-full"
const SEL = INP + " cursor-pointer"

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

/* ── Bloc résultat réutilisable dans les modales ── */
function ResultBlock({ rows, highlight, extra }: {
  rows: { label: string; val: string; bold?: boolean; green?: boolean }[]
  highlight: { label: string; val: string }
  extra?: { label: string; val: string }
}) {
  return (
    <div className="bg-surface rounded-xl p-4 space-y-2.5">
      {rows.map(({ label, val, bold, green }) => (
        <div key={label} className="flex justify-between text-sm border-b border-surface2 pb-2.5 last:border-0 last:pb-0">
          <span className="text-ink3">{label}</span>
          <span className={`${bold ? 'font-bold text-ink' : ''} ${green ? 'font-semibold text-green-700' : !bold ? 'text-ink' : ''}`}>{val}</span>
        </div>
      ))}
      <div className="flex justify-between items-center border-t border-surface2 pt-2.5">
        <span className="text-sm font-semibold text-ink">{highlight.label}</span>
        <span className="font-display text-xl font-black text-blue">{highlight.val}</span>
      </div>
      {extra && (
        <div className="flex justify-between items-center border-t border-surface2 pt-2.5">
          <span className="text-sm text-ink3">{extra.label}</span>
          <span className="font-bold text-ink2">{extra.val}</span>
        </div>
      )}
    </div>
  )
}

/* ── Mini-simulateurs dans modale ── */
interface LevierModalProps {
  levier: { ico: string; nom: string; desc: string; gain: number; cond: string }
  best: StructureResult
  params: SimParams
  tmi: number
  onClose: () => void
}

function LevierModal({ levier, best, params, tmi, onClose }: LevierModalProps) {
  const isSoc = best.forme === 'EURL / SARL (IS)' || best.forme === 'SAS / SASU'
  const isTNS = best.forme === 'EI (réel normal)' || best.forme === 'EURL / SARL (IS)'
  const tauxIS = best.is > 0 && best.ben > 42500 ? 0.25 : 0.15

  const isIK = levier.nom.includes('kilométrique')
  const isPER = levier.nom.toLowerCase().includes('per') || levier.nom.includes('épargne')
  const isDom = levier.nom.includes('omicili') || levier.nom.includes('iège')
  const isPrev = levier.nom.includes('révoyance') && !levier.nom.toLowerCase().includes('per')

  // IK
  const [ikKm, setIkKm] = useState(8000)
  const [ikCV, setIkCV] = useState(5)

  // PER
  const [perMontant, setPerMontant] = useState(3000)

  // Domiciliation
  const [domStatut, setDomStatut] = useState<'locataire' | 'proprietaire'>('locataire')
  const [domSurfBureau, setDomSurfBureau] = useState(12)
  const [domSurfTotale, setDomSurfTotale] = useState(60)
  const [domLoyer, setDomLoyer] = useState(800)
  const [domChargesAnn, setDomChargesAnn] = useState(3000)

  // Prévoyance
  const [prevPrime, setPrevPrime] = useState(2400)

  // Calculs IK
  const ikFn = BAREME_IK[ikCV] || BAREME_IK[5]
  const ikMontant = Math.round(ikFn(ikKm))
  const ikTauxKm = ikKm > 0 ? ikFn(ikKm) / ikKm : 0
  let ikEconomie = 0
  if (isSoc) {
    ikEconomie = Math.round(ikMontant * tauxIS)
    if (best.forme === 'SAS / SASU') ikEconomie += Math.round(ikMontant * 0.22)
  } else {
    ikEconomie = Math.round(ikMontant * (0.45 / 1.45 + tmi / 100))
  }

  // Calculs PER
  const benBrut = Math.max(0, params.ca - params.charges - params.amort - params.deficit)
  const perPlafond = Math.round(Math.min(35194, benBrut * 0.10))
  const perRet = Math.min(perMontant, perPlafond)
  const perEcoIR = Math.round(perRet * tmi / 100)
  const perEcoCotis = isTNS ? Math.round(perRet * 0.45 / 1.45) : 0
  const perEffort = Math.max(0, perRet - perEcoIR - perEcoCotis)
  const perCapital = Math.round(perRet * ((Math.pow(1.05, 20) - 1) / 0.05))

  // Calculs Domiciliation
  const domRatio = domSurfTotale > 0 ? domSurfBureau / domSurfTotale : 0
  const domRef = domStatut === 'locataire' ? domLoyer * 12 : domChargesAnn
  const domDed = Math.round(domRef * domRatio)
  const domGain = isSoc ? Math.round(domDed * tauxIS) : Math.round(domDed * (0.45 / 1.45 + tmi / 100))

  // Calculs Prévoyance
  const prevEcoIS = isSoc ? Math.round(prevPrime * tauxIS) : 0
  const prevEcoIR = isTNS ? Math.round(prevPrime * 0.45 / 1.45) : Math.round(prevPrime * tmi / 100)
  const prevCout = Math.max(0, prevPrime - prevEcoIS - prevEcoIR)

  // Économie principale selon le levier
  const mainEconomie = isIK ? ikEconomie : isPER ? perEcoIR + perEcoCotis : isDom ? domGain : (prevEcoIS + prevEcoIR)

  // Texte contextuel
  const contextText = isIK
    ? `Les indemnités kilométriques permettent de déduire l'usage professionnel de votre véhicule personnel selon le barème fiscal 2025, sans avoir à justifier les frais réels. Renseignez vos kilomètres professionnels et la puissance de votre véhicule.`
    : isPER
    ? `Le Plan d'Épargne Retraite permet de déduire vos versements de votre revenu imposable.${isTNS ? ' Pour les TNS, les versements réduisent également les cotisations — c\'est un double levier unique.' : ''} Plafond 2025 : ${fmt(perPlafond)}/an (10% du résultat avant rémunération).`
    : isDom
    ? `Si vous travaillez depuis votre domicile, vous pouvez déduire une quote-part des charges au prorata de la surface professionnelle. La pièce doit être dédiée exclusivement à l'activité professionnelle.`
    : `Les contrats de prévoyance TNS (arrêt maladie, invalidité, décès) protègent votre revenu. Les primes sont déductibles du résultat IS ou BIC — le coût réel après économies fiscales est significativement réduit.`

  const FINP = "px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue-mid transition-all w-full"
  const FSEL = FINP + " cursor-pointer"

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* ── Header gradient ── */}
        <div className="rounded-t-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #1539B2 100%)' }}>
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase opacity-65 mb-1.5">Levier d&apos;optimisation</div>
              <h2 className="font-display text-xl font-black leading-tight">{levier.nom}</h2>
              <p className="text-sm opacity-70 mt-1">Simulateur interactif — résultat en temps réel</p>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/15 text-2xl leading-none transition-all flex-shrink-0 mt-0.5">
              ×
            </button>
          </div>
        </div>

        {/* ── Corps ── */}
        <div className="p-6 space-y-5">

          {/* Contexte */}
          <div className="bg-slate-50 rounded-xl p-4 text-[13px] text-slate-600 leading-relaxed">
            {contextText}
          </div>

          {/* ── Inputs IK ── */}
          {isIK && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Km professionnels / an</label>
                  <input type="number" value={ikKm} min={0} max={50000} step={500}
                    onChange={e => setIkKm(Math.max(0, parseInt(e.target.value) || 0))}
                    className={FINP} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Puissance fiscale</label>
                  <select value={ikCV} onChange={e => setIkCV(parseInt(e.target.value))} className={FSEL}>
                    {[3, 4, 5, 6, 7].map(cv => (
                      <option key={cv} value={cv}>{cv}{cv === 7 ? ' CV et +' : ' CV'}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-[13px] border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500">Taux barème {ikCV}CV — {ikKm.toLocaleString('fr-FR')} km</span>
                  <span className="font-semibold text-slate-700">{ikTauxKm.toFixed(3).replace('.', ',')} €/km</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">Montant déductible / an</span>
                  <span className="font-bold text-slate-800">{fmt(ikMontant)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Inputs PER ── */}
          {isPER && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Versement annuel PER (€)</label>
                <input type="number" value={perMontant} min={0} max={Math.max(perPlafond, perMontant)} step={500}
                  onChange={e => setPerMontant(Math.max(0, parseInt(e.target.value) || 0))}
                  className={FINP} />
                <p className="text-[11.5px] text-slate-400">Plafond estimé : {fmt(perPlafond)}/an</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-[13px] border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500">Versement retenu (≤ plafond)</span>
                  <span className="font-semibold text-slate-700">{fmt(perRet)}</span>
                </div>
                <div className="flex justify-between text-[13px] border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500">Économie IR (TMI {tmi}%)</span>
                  <span className="font-bold text-emerald-700">−{fmt(perEcoIR)}</span>
                </div>
                {perEcoCotis > 0 && (
                  <div className="flex justify-between text-[13px] border-b border-slate-200 pb-2.5">
                    <span className="text-slate-500">Économie cotisations TNS</span>
                    <span className="font-bold text-emerald-700">−{fmt(perEcoCotis)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">Capital projeté 20 ans (5%/an)</span>
                  <span className="font-semibold text-slate-700">{fmt(perCapital)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Inputs Domiciliation ── */}
          {isDom && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Statut du logement</label>
                  <select value={domStatut} onChange={e => setDomStatut(e.target.value as 'locataire' | 'proprietaire')} className={FSEL}>
                    <option value="locataire">Locataire</option>
                    <option value="proprietaire">Propriétaire</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Surface bureau (m²)</label>
                  <input type="number" value={domSurfBureau} min={1} max={domSurfTotale} step={1}
                    onChange={e => setDomSurfBureau(Math.max(1, parseInt(e.target.value) || 1))} className={FINP} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Surface totale (m²)</label>
                  <input type="number" value={domSurfTotale} min={domSurfBureau} max={300} step={1}
                    onChange={e => setDomSurfTotale(Math.max(domSurfBureau, parseInt(e.target.value) || 1))} className={FINP} />
                </div>
                {domStatut === 'locataire'
                  ? <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Loyer mensuel (€)</label>
                      <input type="number" value={domLoyer} min={0} step={50}
                        onChange={e => setDomLoyer(Math.max(0, parseInt(e.target.value) || 0))} className={FINP} />
                    </div>
                  : <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Charges annuelles (taxe foncière, assurance…)</label>
                      <input type="number" value={domChargesAnn} min={0} step={100}
                        onChange={e => setDomChargesAnn(Math.max(0, parseInt(e.target.value) || 0))} className={FINP} />
                    </div>
                }
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-[13px] border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500">Ratio surface pro / totale</span>
                  <span className="font-semibold text-slate-700">{Math.round(domRatio * 100)}% ({domSurfBureau}m² / {domSurfTotale}m²)</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">Charges déductibles / an</span>
                  <span className="font-bold text-slate-800">{fmt(domDed)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Inputs Prévoyance ── */}
          {isPrev && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Prime annuelle (€)</label>
                  <input type="number" value={prevPrime} min={0} step={100}
                    onChange={e => setPrevPrime(Math.max(0, parseInt(e.target.value) || 0))} className={FINP} />
                  <p className="text-[11px] text-slate-400">Recommandé : 1 800–4 800 €/an selon couverture</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Votre TMI</label>
                  <div className={`${FINP} bg-slate-100 font-semibold cursor-default`}>{tmi}%</div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                {prevEcoIS > 0 && (
                  <div className="flex justify-between text-[13px] border-b border-slate-200 pb-2.5">
                    <span className="text-slate-500">Économie IS ({Math.round(tauxIS * 100)}%)</span>
                    <span className="font-bold text-emerald-700">−{fmt(prevEcoIS)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">{isTNS ? 'Économie cotisations TNS' : `Économie IR (TMI ${tmi}%)`}</span>
                  <span className="font-bold text-emerald-700">−{fmt(prevEcoIR)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Fallback */}
          {!isIK && !isPER && !isDom && !isPrev && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{levier.desc}</p>
              <p className="text-[12px] text-slate-400">{levier.cond}</p>
            </div>
          )}

          {/* ── Résultat en temps réel ── */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <div className="text-[10.5px] font-bold tracking-widest uppercase text-emerald-700 mb-2">Économie estimée</div>
            <div className="font-display text-3xl font-black text-emerald-700 mb-1.5">
              +{fmt(isIK ? ikEconomie : isPER ? perEcoIR + perEcoCotis : isDom ? domGain : prevEcoIS + prevEcoIR)}/an
            </div>
            <div className="text-[13px] text-emerald-600 leading-relaxed">
              {isIK && `${fmt(ikMontant)} déductibles × taux effectif`}
              {isPER && `Effort réel : ${fmt(perEffort)}/an — capital 20 ans : ${fmt(perCapital)}`}
              {isDom && `${fmt(domDed)} déductibles au prorata ${Math.round(domRatio * 100)}%`}
              {isPrev && `Coût réel après économies : ${fmt(prevCout)}/an (${fmt(Math.round(prevCout / 12))}/mois)`}
              {!isIK && !isPER && !isDom && !isPrev && `Gain estimé sur votre situation`}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Estimation indicative — à valider avec votre expert-comptable
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-slate-100 p-4 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-[13px] font-semibold border border-surface2 rounded-xl text-ink3 hover:bg-surface transition-all">
            Fermer
          </button>
          <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
            className="flex-1 py-2.5 text-[13px] font-bold bg-blue text-white rounded-xl text-center hover:bg-blue-dark transition-all">
            Mettre en place →
          </a>
        </div>
      </div>
    </div>
  )
}

/* ── Composant principal ── */
export function StepResultats() {
  const { results, params, prevStep } = useSimulateur()
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [activeLevierIdx, setActiveLevierIdx] = useState<number | null>(null)

  if (!results) return null
  const { scored, best, tmi, gain } = results

  const leviersArr = leviers(best, params)
  const totalLevierGain = leviersArr.reduce((acc, l) => acc + l.gain, 0)
  const { pourquoi, attention } = genAnalyse(best, params, tmi)

  const scenarioOptimise = useMemo(() => {
    const benBrut = Math.max(0, params.ca - params.charges - params.amort - params.deficit)
    const perMax = Math.min(35194, benBrut * 0.10)
    const perEconomie = Math.round(perMax * tmi / 100)
    const ikMontant = Math.round(8000 * 0.636)
    const ikEconomie = Math.round(ikMontant * 0.15)
    const domEconomie = 360
    const prevEconomie = Math.round(benBrut * 0.02 * 0.15)
    const gainTotal = perEconomie + ikEconomie + domEconomie + prevEconomie
    return {
      perMax: Math.round(perMax),
      perEconomie,
      ikEconomie,
      domEconomie,
      prevEconomie,
      gainTotal,
      netOptimise: Math.round(best.netAnnuel + gainTotal),
    }
  }, [params, tmi, best.netAnnuel])

  // Grille adaptée au nombre de structures
  const count = scored.length
  const cardsGridClass =
    count === 1 ? 'flex justify-center' :
    count === 2 ? 'grid grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto gap-3 items-start' :
    count === 3 ? 'grid grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto gap-3 items-start' :
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start'

  const hasTNS = scored.some(r => r.forme === 'EI (réel normal)' || r.forme === 'EURL / SARL (IS)')

  const explorerUrl = `/explorer?ca=${params.ca}&charges=${params.charges}&amort=${params.amort}&capital=${params.capital}&sitfam=${params.partsBase === 2 ? 'marie' : 'celib'}&enfants=${params.nbEnfants}&per=${params.perMontant}&autresrev=${params.autresRev}&secteur=${params.secteur}`

  return (
    <div className="animate-stepIn pb-28">

      {/* ── HERO RÉSULTAT ── */}
      <div className="rounded-3xl p-8 mb-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d1627 0%, #0d1f3c 100%)' }}>
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.18)_0%,transparent_65%)] -top-36 -right-24 pointer-events-none" />
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

      {/* ── POURQUOI CE CHOIX ── */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-4 mt-8">
        Pourquoi ce choix ?
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {/* Argument fiscal */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f2a52 0%, #0d1f3c 100%)', border: '1px solid rgba(59,130,246,.2)' }}>
          <div className="text-[10px] font-bold tracking-widest uppercase text-blue-400 mb-3">Argument fiscal</div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{pourquoi}</p>
        </div>
        {/* Point de vigilance */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #3b1515 0%, #1c0a0a 100%)', border: '1px solid rgba(239,68,68,.2)' }}>
          <div className="text-[10px] font-bold tracking-widest uppercase text-red-400 mb-3">Point de vigilance</div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{attention}</p>
        </div>
        {/* Avantage décisif */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #073d28 0%, #051a10 100%)', border: '1px solid rgba(16,185,129,.2)' }}>
          <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 mb-3">Avantage décisif</div>
          <div className="font-display text-3xl font-black text-emerald-400 mb-1">
            {fmt(Math.round(best.netAnnuel / 12))}/mois
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Revenu net avec <strong className="text-white">{best.forme}</strong> — TMI {tmi}% · Score {best.scoreTotal}/100
          </p>
          {gain > 500 && (
            <div className="mt-3 pt-3 text-xs text-emerald-400/70" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
              +{fmt(gain)}/an vs la moins avantageuse
            </div>
          )}
        </div>
      </div>

      {/* ── COMPARAISON DES STRUCTURES ── */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
        Comparaison des structures
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <p className="text-sm text-ink3 mb-4">Triées par score multicritère selon votre priorité.</p>
      <div className={`${cardsGridClass} mb-6`}>
        {scored.map((r, i) => (
          <StructureCard key={r.forme} r={r} rank={i + 1} params={params} />
        ))}
      </div>

      {/* ── CE QUE VOUS POURRIEZ ATTEINDRE ── */}
      <div className="rounded-2xl p-6 mb-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)' }}>
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,.15)_0%,transparent_65%)] -top-20 -right-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">✦ Scénario optimisé</div>
              <h3 className="text-xl font-bold text-white">Ce que vous pourriez atteindre</h3>
              <p className="text-sm text-white/50 mt-1">En activant tous les leviers d&apos;optimisation disponibles</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-white/40 mb-0.5">Revenu net optimisé</div>
              <div className="text-3xl font-bold text-emerald-400">{fmt(scenarioOptimise.netOptimise)}</div>
              <div className="text-xs text-emerald-400/60">+{fmt(scenarioOptimise.gainTotal)}/an supplémentaires</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            {([
              { icon: '📊', titre: 'PER individuel', detail: `Versement max : ${fmt(scenarioOptimise.perMax)}/an`, gain: scenarioOptimise.perEconomie, desc: `Économie IR à TMI ${tmi}%` },
              { icon: '🚗', titre: 'Indemnités kilométriques', detail: '8 000 km/an · barème 5CV', gain: scenarioOptimise.ikEconomie, desc: 'Déduction à 15%' },
              { icon: '🏠', titre: 'Domiciliation domicile', detail: 'Part bureau déductible', gain: scenarioOptimise.domEconomie, desc: 'Déduction IS à 15%' },
              { icon: '🛡', titre: 'Prévoyance TNS', detail: '2% du résultat', gain: scenarioOptimise.prevEconomie, desc: 'Déductible + protection' },
            ] as const).map(lev => (
              <div key={lev.titre} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{lev.icon}</span>
                    <span className="text-sm font-semibold text-white">{lev.titre}</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-sm flex-shrink-0">+{fmt(lev.gain)}/an</span>
                </div>
                <div className="text-xs text-white/40">{lev.detail}</div>
                <div className="text-xs text-white/30 mt-0.5">{lev.desc}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10 flex-wrap gap-3">
            <div className="text-sm text-white/50">
              Gain potentiel estimé : <span className="font-bold text-emerald-400">+{fmt(scenarioOptimise.gainTotal)}/an</span>
            </div>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-400 transition-colors whitespace-nowrap">
              Mettre en place avec un expert →
            </a>
          </div>
        </div>
      </div>

      {/* ── PROTECTION SOCIALE — tableau compact ── */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-4 mt-8">
        Protection sociale
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden mb-6 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface border-b border-surface2">
                <th className="text-left text-[10px] font-bold tracking-wide uppercase text-ink3 px-4 py-3 min-w-[140px]">Critère</th>
                {scored.map((r, i) => (
                  <th key={r.forme} className={`text-left text-[10px] font-bold tracking-wide uppercase px-4 py-3 whitespace-nowrap
                    ${i === 0 ? 'text-blue' : 'text-ink3'}`}>
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
              {leviersArr.some(l => l.nom.includes('révoyance')) && (
                <button
                  onClick={() => {
                    const idx = leviersArr.findIndex(l => l.nom.includes('révoyance'))
                    if (idx >= 0) setActiveLevierIdx(idx)
                  }}
                  className="ml-2 font-semibold underline hover:no-underline">
                  Simuler l&apos;économie →
                </button>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── LEVIERS D'OPTIMISATION ── */}
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
          <p className="text-[12px] text-ink4 mb-3">Cliquez sur une carte pour ouvrir le simulateur interactif.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {leviersArr.map((l, i) => (
              <button key={i} onClick={() => setActiveLevierIdx(i)}
                className="bg-white rounded-xl p-4 text-left transition-all duration-200 relative overflow-hidden
                  hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(11,22,39,.12)] group"
                style={{ borderTop: '1px solid rgba(11,22,39,.07)', borderRight: '1px solid rgba(11,22,39,.07)',
                  borderBottom: '1px solid rgba(11,22,39,.07)', borderLeft: '4px solid #1D4ED8',
                  boxShadow: '0 2px 8px rgba(11,22,39,.05)' }}>
                <div className="absolute top-0 right-0 bottom-0 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-blue-mid text-xs">→</span>
                </div>
                <div className="text-2xl mb-2.5">{l.ico}</div>
                <div className="font-display text-[13.5px] font-bold text-ink mb-1">{l.nom}</div>
                <div className="text-xs text-ink3 leading-relaxed mb-2.5">{l.desc}</div>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ color: '#065f46', background: '#d1fae5', border: '1px solid #a7f3d0' }}>
                    ↑ {fmt(l.gain)}/an estimé
                  </div>
                  <span className="text-[10px] text-blue-mid font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Simuler →</span>
                </div>
                <div className="text-[11px] text-ink4 mt-2 leading-snug">{l.cond}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── EXPLORER CTA ── */}
      <div className="border border-blue-border bg-blue-bg rounded-xl p-5 mt-6 flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-display text-[13.5px] font-bold text-ink mb-1.5">🔍 Explorez les scénarios alternatifs</div>
          <p className="text-sm text-ink3 leading-relaxed">
            Que se passe-t-il si votre CA augmente de 20% ? Et si vous vous mariez ? Et si vous versez au PER ?
            Ajustez vos paramètres en temps réel dans le module interactif.
          </p>
        </div>
        <a href={explorerUrl}
          className="flex-shrink-0 px-4 py-2.5 bg-blue text-white font-bold text-sm rounded-lg hover:bg-blue-dark transition-all whitespace-nowrap">
          Ouvrir l&apos;explorateur →
        </a>
      </div>

      {/* ── CTA FINAL — 2 colonnes ── */}
      <div className="rounded-2xl mt-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d1627 0%, #0d1f3c 100%)' }}>
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.18)_0%,transparent_65%)] -top-48 -right-24 pointer-events-none" />
        <div className="relative grid grid-cols-1 sm:grid-cols-2">
          {/* Colonne gauche */}
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
                className="px-6 py-3 bg-blue text-white font-bold text-sm rounded-lg
                  shadow-[0_4px_16px_rgba(29,78,216,.4)] hover:bg-blue-dark hover:-translate-y-0.5 transition-all">
                Prendre RDV →
              </a>
              <button onClick={() => setShowSaveModal(true)}
                className="px-6 py-3 font-semibold text-sm rounded-lg border transition-all hover:bg-white/15 hover:-translate-y-0.5"
                style={{ background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.15)' }}>
                💾 Enregistrer
              </button>
            </div>
          </div>
          {/* Colonne droite — récap */}
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
                  <div className="text-xl font-bold text-emerald-400">+{fmt(gain)}/an</div>
                </div>
              )}
              <div className="pt-4 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Score multicritère
                </div>
                <div className="text-xl font-bold text-white">{best.scoreTotal}/100</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-start mt-6 pt-5 border-t border-surface2">
        <button onClick={prevStep} className="px-5 py-2.5 text-sm font-semibold text-ink3 border-[1.5px] border-surface2 rounded-lg hover:bg-surface hover:text-ink2 transition-all">
          ← Modifier les paramètres
        </button>
      </div>

      {/* Modales */}
      {showSaveModal && (
        <SaveSimulationModal onClose={() => setShowSaveModal(false)} results={results} params={params} tmi={tmi} />
      )}
      {activeLevierIdx !== null && (
        <LevierModal
          levier={leviersArr[activeLevierIdx]}
          best={best}
          params={params}
          tmi={tmi}
          onClose={() => setActiveLevierIdx(null)}
        />
      )}
    </div>
  )
}

/* ── StructureCard ── */
function StructureCard({ r, rank, params }: { r: StructureResult; rank: number; params: SimParams }) {
  const isBest = rank === 1
  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(tmiRate((cardTmiBase || 0) + params.autresRev, params.partsBase, params.nbEnfants) * 100)
  const cardIR = r.ir
  const revBrut = r.charges + r.ir + r.is + Math.max(0, r.netAnnuel)

  const rankLabels = ['★ Recommandé', '2ème choix', '3ème choix', '4ème choix']

  const decompRows = [
    {
      label: 'Cotisations sociales',
      val: r.charges,
      neg: true,
      hint: r.forme.includes('SAS') ? 'Charges salariales + patronales' : 'SSI (TNS)',
    },
    ...(r.ir > 0 ? [{
      label: 'Impôt sur le revenu',
      val: r.ir,
      neg: true,
      hint: `TMI ${cardTmi}% · ${params.parts} parts`,
    }] : []),
    ...(r.is > 0 ? [{
      label: 'IS société',
      val: r.is,
      neg: true,
      hint: 'IS 15%/25% sur résultat',
    }] : []),
    ...(r.div > 0 ? [{
      label: 'Dividendes',
      val: r.div,
      neg: false,
      hint: 'PFU 30%',
    }] : []),
  ]

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 hover:-translate-y-0.5
      ${isBest ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-slate-100 shadow-sm'}`}>

      {/* Zone 1 : Header */}
      <div className={`px-5 pt-5 pb-3 ${isBest ? 'bg-blue-600' : 'bg-slate-50'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-bold uppercase tracking-widest
            ${isBest ? 'text-blue-200' : 'text-slate-400'}`}>
            {rankLabels[rank - 1] || `${rank}ème choix`}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${isBest ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {r.scoreTotal}/100
          </span>
        </div>
        <div className={`text-base font-bold ${isBest ? 'text-white' : 'text-slate-900'}`}>{r.forme}</div>
        <div className={`text-xs mt-0.5 ${isBest ? 'text-blue-200' : 'text-slate-400'}`}>{r.strat}</div>
      </div>

      {/* Zone 2 : Chiffre principal */}
      <div className="px-5 py-4 border-b border-slate-50 bg-white">
        <div className="text-xs text-slate-400 mb-0.5">Revenu net après impôts</div>
        <div className={`text-3xl font-bold tracking-tight ${isBest ? 'text-blue-600' : 'text-slate-900'}`}>
          {fmt(r.netAnnuel)}
        </div>
        <div className="text-sm text-slate-400 mt-0.5">{fmt(Math.round(r.netAnnuel / 12))}/mois</div>
      </div>

      {/* Zone 3 : Décomposition */}
      <div className="px-5 py-4 bg-white space-y-2.5">
        {decompRows.map(row => (
          <div key={row.label} className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-600">{row.label}</div>
              <div className="text-[10px] text-slate-400">{row.hint}</div>
            </div>
            <div className={`text-sm font-bold ${row.neg ? 'text-red-500' : 'text-emerald-600'}`}>
              {row.neg ? '−' : '+'}{fmt(Math.abs(row.val))}
            </div>
          </div>
        ))}

        <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Tranche marginale</div>
            <div className={`text-base font-bold
              ${cardTmi <= 11 ? 'text-emerald-600' : cardTmi <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
              {cardTmi}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">IR total</div>
            <div className="text-base font-bold text-slate-700">{fmt(cardIR)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Taux effectif</div>
            <div className="text-base font-bold text-slate-700">
              {revBrut > 0 ? (cardIR / revBrut * 100).toFixed(1) : '0'}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
