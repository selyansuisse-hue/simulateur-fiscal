import { fmt } from '@/lib/utils'

interface SimRow {
  id: string
  name: string
  created_at: string
  best_forme: string
  best_net_annuel: number
  tmi: number
  ca: number
  params?: {
    perMontant?: number
    perActif?: string
    partsBase?: number
    nbEnfants?: number
    charges?: number
    amort?: number
  }
}

interface Insight {
  type: string
  title: string
  icon: string
  color: string
  text: string
  highlight: string | null
}

function generateNarrative(sims: SimRow[]) {
  const sorted = [...sims].sort((a, b) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const gainTotal = (best.best_net_annuel ?? 0) - (worst.best_net_annuel ?? 0)
  const insights: Insight[] = []

  // Différence de CA
  const caMax = Math.max(...sims.map(s => s.ca ?? 0))
  const caMin = Math.min(...sims.map(s => s.ca ?? 0))
  if (caMax / Math.max(1, caMin) > 1.15) {
    insights.push({
      type: 'ca',
      title: "L'impact du niveau de CA",
      icon: '📈',
      color: '#3B82F6',
      text: `Vos scénarios couvrent des CA de ${fmt(caMin)} à ${fmt(caMax)}. Cet écart de ${fmt(caMax - caMin)} explique une grande partie de la différence de revenu net. Plus le CA est élevé, plus les structures IS (EURL/SASU) deviennent avantageuses par rapport à l'EI directement imposé à l'IR.`,
      highlight: `À ${fmt(caMin)}, l'IR direct peut être moins cher que l'IS 15%. À ${fmt(caMax)}, c'est l'inverse.`,
    })
  }

  // Structures différentes
  const structures = Array.from(new Set(sims.map(s => s.best_forme).filter(Boolean)))
  if (structures.length > 1) {
    const hasSASU = structures.some(s => s.includes('SAS') || s.includes('SASU'))
    const hasEURL = structures.some(s => s.includes('EURL'))
    const hasEI = structures.some(s => s === 'EI' || s.startsWith('EI'))
    insights.push({
      type: 'structure',
      title: 'La structure optimale change selon vos paramètres',
      icon: '🔀',
      color: '#8B5CF6',
      text: `Vos simulations recommandent des structures différentes : ${structures.join(' et ')}. Ce n'est pas une contradiction — c'est le reflet de la réalité fiscale : la structure optimale dépend de votre niveau de CA, de votre situation familiale et de votre stratégie de rémunération.`,
      highlight: hasSASU && hasEURL
        ? 'SASU = pas de cotis. sur dividendes. EURL = TNS plus souple. Le choix dépend de votre mix salaire/dividendes.'
        : hasEI
        ? "L'EI est avantageuse quand le bénéfice reste sous ~60 000 €. Au-delà, une structure IS prend le dessus."
        : null,
    })
  }

  // Différence de TMI
  const tmis = Array.from(new Set(sims.map(s => s.tmi).filter(Boolean)))
  if (tmis.length > 1) {
    const tmiMin = Math.min(...tmis)
    const tmiMax = Math.max(...tmis)
    insights.push({
      type: 'tmi',
      title: 'Votre TMI évolue avec vos revenus',
      icon: '📊',
      color: '#F59E0B',
      text: `Vos simulations montrent des TMI de ${tmiMin}% à ${tmiMax}%. La tranche marginale change quand vos revenus imposables franchissent les seuils du barème. À ${tmiMax}% de TMI, chaque euro supplémentaire de revenu imposable coûte ${tmiMax} centimes d'IR — ce qui rend les leviers de déduction (PER, IK, prévoyance) encore plus précieux.`,
      highlight: `Avec une TMI à ${tmiMax}%, un PER de 5 000 €/an vous économise ${fmt(Math.round(5000 * tmiMax / 100))} d'IR.`,
    })
  }

  // Impact PER
  const simsAvecPER = sims.filter(s => (s.params?.perMontant ?? 0) > 0 || s.params?.perActif === 'oui')
  const sansPER = sims.filter(s => !((s.params?.perMontant ?? 0) > 0) && s.params?.perActif !== 'oui')
  if (simsAvecPER.length > 0 && sansPER.length > 0) {
    const avgAvec = simsAvecPER.reduce((a, s) => a + (s.best_net_annuel ?? 0), 0) / simsAvecPER.length
    const avgSans = sansPER.reduce((a, s) => a + (s.best_net_annuel ?? 0), 0) / sansPER.length
    const gain = Math.round(avgAvec - avgSans)
    insights.push({
      type: 'per',
      title: "L'effet du PER sur votre revenu net",
      icon: '💰',
      color: '#10B981',
      text: "En activant le PER dans vos simulations, vous réduisez votre base imposable et votre IR. L'effort réel est inférieur au versement brut grâce à l'économie d'IR générée.",
      highlight: gain > 0
        ? `Avec le PER, votre revenu net s'améliore d'environ ${fmt(Math.abs(gain))}/an en moyenne.`
        : null,
    })
  }

  const conclusion = `En résumé : votre scénario le plus favorable est "${best.name}" avec ${fmt(best.best_net_annuel ?? 0)}/an. ${
    gainTotal > 5_000
      ? `L'écart de ${fmt(gainTotal)} avec votre scénario le moins favorable justifie pleinement de prendre le temps d'optimiser votre situation.`
      : `Les scénarios sont relativement proches — la différence principale peut être qualitative (protection sociale, simplicité de gestion).`
  }`

  return { best, worst, gainTotal, insights, conclusion }
}

interface Props { simulations: SimRow[] }

export function NarrativeAnalysis({ simulations }: Props) {
  if (simulations.length < 2) return null
  const analysis = generateNarrative(simulations)

  return (
    <div className="mb-8">
      {/* Header résumé sombre */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, #050c1a, #0d1f3c)' }}>
        <div className="p-6">
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">
            📊 Analyse de vos {simulations.length} scénarios
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Meilleur scénario</div>
              <div className="text-base font-bold text-white truncate">{analysis.best.name}</div>
              <div className="text-2xl font-black tracking-tight" style={{ color: '#60A5FA' }}>
                {fmt(analysis.best.best_net_annuel ?? 0)}/an
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Écart entre vos scénarios</div>
              <div className="text-2xl font-black tracking-tight text-emerald-400">
                +{fmt(analysis.gainTotal)}/an
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(52,211,153,0.50)' }}>
                soit +{fmt(Math.round(analysis.gainTotal / 12))}/mois
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Structure optimale</div>
              <div className="text-base font-bold text-white">{analysis.best.best_forme}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                TMI {analysis.best.tmi}% · CA {fmt(analysis.best.ca)}
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.70)' }}>
              {analysis.conclusion}
            </p>
          </div>
        </div>
      </div>

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.insights.map((insight) => (
            <div key={insight.type} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3"
                style={{ background: insight.color + '0D', borderBottom: `1px solid ${insight.color}20` }}>
                <span className="text-xl">{insight.icon}</span>
                <h3 className="text-sm font-bold text-slate-900">{insight.title}</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-slate-600 leading-relaxed mb-3">{insight.text}</p>
                {insight.highlight && (
                  <div className="rounded-xl px-4 py-3 text-xs leading-relaxed font-medium"
                    style={{ background: insight.color + '0A', border: `1px solid ${insight.color}20`, color: insight.color }}>
                    💡 {insight.highlight}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
