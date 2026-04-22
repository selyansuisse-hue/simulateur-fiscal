'use client'
import { useState } from 'react'
import { useSimulateur } from '@/hooks/useSimulateur'
import { fmt, fmtM } from '@/lib/utils'
import { swot, leviers, plan } from '@/lib/fiscal/structures'
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

  const swotBest = swot(best, params)
  const leviersArr = leviers(best, params)
  const planArr = plan(best, params)
  const totalLevierGain = leviersArr.reduce((acc, l) => acc + l.gain, 0)
  const { pourquoi, attention } = genAnalyse(best, params, tmi)

  // Grille adaptée au nombre de structures
  const count = scored.length
  const cardsGridClass =
    count === 1 ? 'flex justify-center' :
    count === 2 ? 'grid grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto gap-3 items-start' :
    count === 3 ? 'grid grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto gap-3 items-start' :
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start'

  const hasTNS = scored.some(r => r.forme === 'EI (réel normal)' || r.forme === 'EURL / SARL (IS)')

  return (
    <div className="animate-stepIn pb-28">

      {/* ── HERO RÉSULTAT ── */}
      <div className="bg-navy rounded-2xl p-9 mb-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.22)_0%,transparent_65%)] -top-36 -right-24 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(rgba(255,255,255,.15)_1px,transparent_1px)] bg-[length:24px_24px] [mask-image:linear-gradient(135deg,black_0%,transparent_60%)]" />
        <div className="relative">
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

      {/* ── POURQUOI CETTE RECOMMANDATION ── */}
      <div className="font-display text-lg font-bold text-ink tracking-tight flex items-center gap-3 mb-2 mt-8">
        Pourquoi cette recommandation ?
        <span className="flex-1 h-px bg-gradient-to-r from-surface2 to-transparent" />
      </div>
      <div className="bg-white border border-black/[0.07] rounded-xl p-5 mb-6 shadow-card space-y-4">
        <div>
          <div className="text-[10.5px] font-bold tracking-wide uppercase text-blue-mid mb-2">Ce qui explique le résultat</div>
          <p className="text-sm text-ink2 leading-relaxed">{pourquoi}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5">
          <div className="flex gap-2.5 text-sm text-amber-800 leading-relaxed">
            <span className="flex-shrink-0">⚠️</span>
            <p>{attention}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
          <p className="text-sm text-ink3">Pour valider ce choix et optimiser votre rémunération, prenez rendez-vous avec un expert Belho Xper.</p>
          <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 px-4 py-2 bg-blue text-white font-semibold text-sm rounded-lg hover:bg-blue-dark transition-colors whitespace-nowrap">
            Prendre RDV →
          </a>
        </div>
      </div>

      {/* ── COMPARAISON 4 STRUCTURES ── */}
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
      <div className={`${cardsGridClass} mb-4`}>
        {scored.map((r, i) => {
          const qualStyles: Record<string, { border: string; bg: string; badge: string }> = {
            bon: { border: '#bbf7d0', bg: '#f0fdf4', badge: 'text-green-700 bg-green-100' },
            moyen: { border: '#fde68a', bg: '#fffbeb', badge: 'text-amber-700 bg-amber-100' },
            faible: { border: '#fecaca', bg: '#fef2f2', badge: 'text-red-700 bg-red-100' },
            'très faible': { border: '#fecaca', bg: '#fef2f2', badge: 'text-red-800 bg-red-100' },
          }
          const qs = qualStyles[r.prot.qual] || { border: '#e2e8f0', bg: '#f8fafc', badge: 'text-ink3 bg-surface' }
          const isTNSStruct = r.forme === 'EI (réel normal)' || r.forme === 'EURL / SARL (IS)'
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
                {isTNSStruct && (
                  <div className="mt-2 pt-2 border-t border-black/[0.06]">
                    <div className="text-[11px] text-ink3 mb-1">Mutuelle santé recommandée</div>
                    <div className="text-[11px] font-semibold text-ink2">50 – 150 €/mois</div>
                    <div className="text-[10.5px] text-ink4 mt-0.5">Primes déductibles du résultat</div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Note prévoyance TNS */}
      {hasTNS && (
        <div className="bg-blue-bg border border-blue-border rounded-xl p-4 mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-2.5 text-sm text-blue-dark">
            <span className="flex-shrink-0">🛡</span>
            <div>
              <strong>Prévoyance TNS déductible</strong> — les primes de prévoyance (arrêt maladie, invalidité, décès) sont déductibles du résultat IS ou BIC.
              Simulez l&apos;économie réelle via le levier Prévoyance ci-dessous.
            </div>
          </div>
          {leviersArr.some(l => l.nom.includes('révoyance')) && (
            <button
              onClick={() => {
                const idx = leviersArr.findIndex(l => l.nom.includes('révoyance'))
                if (idx >= 0) setActiveLevierIdx(idx)
              }}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-blue text-white rounded-lg hover:bg-blue-dark transition-colors whitespace-nowrap">
              Simuler l&apos;économie →
            </button>
          )}
        </div>
      )}

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

      {/* ── EXPLORER CTA ── */}
      {(() => {
        const explorerUrl = `/explorer?ca=${params.ca}&charges=${params.charges}&amort=${params.amort}&capital=${params.capital}&sitfam=${params.partsBase === 2 ? 'marie' : 'celib'}&enfants=${params.nbEnfants}&per=${params.perMontant}&autresrev=${params.autresRev}&secteur=${params.secteur}`
        return (
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
        )
      })()}

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
  const rankColor = RANK_COLORS[rank - 1] || RANK_COLORS[3]
  const cardTmiBase = r.baseIR ?? r.bNet ?? r.ben
  const cardTmi = Math.round(tmiRate((cardTmiBase || 0) + params.autresRev, params.partsBase, params.nbEnfants) * 100)
  const cardIR = r.ir

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

      <div className="border-t border-surface2 pt-3 flex flex-col gap-0">
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
