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

function structureColor(forme: string): string {
  if (!forme) return '#60a5fa'
  const f = forme.toLowerCase()
  if (f.includes('sas')) return '#a78bfa'
  if (f.includes('eurl') || f.includes('sarl')) return '#60a5fa'
  if (f.includes('micro')) return '#94a3b8'
  return '#fbbf24'
}

function generateNarrative(sims: SimRow[]) {
  const sorted = [...sims].sort((a, b) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const gainTotal = (best.best_net_annuel ?? 0) - (worst.best_net_annuel ?? 0)
  const insights: Insight[] = []

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

function generateWhyBullets(sims: SimRow[]): { emoji: string; text: string; color: string }[] {
  if (sims.length < 2) return []
  const sorted = [...sims].sort((a, b) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const bullets: { emoji: string; text: string; color: string }[] = []

  const caDiff = (best.ca ?? 0) - (worst.ca ?? 0)
  if (Math.abs(caDiff) > 5000) {
    bullets.push({
      emoji: '📈',
      text: `CA ${caDiff > 0 ? 'supérieur' : 'inférieur'} de ${fmt(Math.abs(caDiff))} dans "${best.name}" — impact direct sur le revenu brut disponible.`,
      color: '#3b82f6',
    })
  }

  if (Math.abs(caDiff) < 5000 && (best.best_net_annuel - worst.best_net_annuel) > 1000) {
    bullets.push({
      emoji: '🔀',
      text: `À CA comparable, "${best.name}" dégage ${fmt(best.best_net_annuel - worst.best_net_annuel)}/an de plus — optimisation de structure ou de paramètres fiscaux.`,
      color: '#8b5cf6',
    })
  }

  if (best.best_forme !== worst.best_forme) {
    bullets.push({
      emoji: '🏗️',
      text: `Structures différentes : ${best.best_forme} vs ${worst.best_forme}. Le niveau de cotisations et le mode d'imposition divergent significativement.`,
      color: '#6366f1',
    })
  }

  if (best.tmi !== worst.tmi) {
    const lower = best.tmi < worst.tmi
    bullets.push({
      emoji: lower ? '✅' : '⚠️',
      text: `TMI ${best.tmi}% pour "${best.name}" vs ${worst.tmi}% — ${lower ? 'tranche marginale plus basse, moins d\'IR à la marge' : 'TMI plus élevé mais compensé par d\'autres avantages structurels'}.`,
      color: lower ? '#10b981' : '#f59e0b',
    })
  }

  const bestHasPER = (best.params?.perMontant ?? 0) > 0 || best.params?.perActif === 'oui'
  const worstHasPER = (worst.params?.perMontant ?? 0) > 0 || worst.params?.perActif === 'oui'
  if (bestHasPER && !worstHasPER) {
    bullets.push({
      emoji: '💰',
      text: `PER activé dans "${best.name}" — réduit la base imposable et génère une économie d'IR directe sur l'exercice.`,
      color: '#10b981',
    })
  } else if (!bestHasPER && worstHasPER) {
    bullets.push({
      emoji: '⚠️',
      text: `PER présent dans "${worst.name}" mais absent du meilleur scénario — d'autres leviers (structure, charges) compensent avantageusement.`,
      color: '#f59e0b',
    })
  }

  return bullets.slice(0, 4)
}

interface Props { simulations: SimRow[] }

export function NarrativeAnalysis({ simulations }: Props) {
  if (simulations.length < 2) return null
  const analysis = generateNarrative(simulations)
  const whyBullets = generateWhyBullets(simulations)
  const color = structureColor(analysis.best.best_forme)

  return (
    <div style={{ marginBottom: '32px' }}>

      {/* ── Hero card ── */}
      <div style={{
        background: 'linear-gradient(135deg, #050c1a 0%, #0d1f3c 100%)',
        borderRadius: '20px',
        overflow: 'hidden',
        marginBottom: '16px',
        border: '1px solid rgba(37,99,235,0.22)',
      }}>
        {/* Top label */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            📊 Analyse comparative — {simulations.length} scénarios
          </div>
        </div>

        {/* 3-col hero */}
        <div style={{
          padding: '26px 24px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '20px',
          alignItems: 'start',
        }}>
          {/* Col 1 — meilleur scénario */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '10px' }}>
              Meilleur scénario
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {analysis.best.name}
            </div>
            <div style={{ fontSize: '38px', fontWeight: 900, color: '#34d399', letterSpacing: '-0.035em', lineHeight: 1 }}>
              {fmt(analysis.best.best_net_annuel ?? 0)}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(52,211,153,0.5)', marginTop: '5px' }}>
              {fmt(Math.round((analysis.best.best_net_annuel ?? 0) / 12))}/mois
            </div>
          </div>

          {/* Col 2 — écart (center) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '148px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Écart total
            </div>
            <div style={{
              background: 'rgba(16,185,129,0.09)',
              border: '1px solid rgba(16,185,129,0.20)',
              borderRadius: '16px',
              padding: '14px 18px',
              textAlign: 'center',
              width: '100%',
            }}>
              <div style={{ fontSize: '40px', fontWeight: 900, color: '#34d399', letterSpacing: '-0.04em', lineHeight: 1 }}>
                +{fmt(analysis.gainTotal)}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(52,211,153,0.48)', marginTop: '4px' }}>
                +{fmt(Math.round(analysis.gainTotal / 12))}/mois
              </div>
            </div>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#fbbf24',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.18)',
              borderRadius: '8px',
              padding: '5px 12px',
              textAlign: 'center',
              width: '100%',
            }}>
              Sur 10 ans : +{fmt(analysis.gainTotal * 10)}
            </div>
          </div>

          {/* Col 3 — structure optimale */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '10px' }}>
              Structure optimale
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color, marginBottom: '6px' }}>
              {analysis.best.best_forme}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginBottom: '12px' }}>
              TMI {analysis.best.tmi}% · CA {fmt(analysis.best.ca)}
            </div>
            <span style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 700,
              color: '#60a5fa',
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: '999px',
              padding: '4px 12px',
            }}>
              ★ Scénario optimal
            </span>
          </div>
        </div>

        {/* Conclusion */}
        <div style={{ padding: '0 24px 22px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '14px 18px',
          }}>
            <p style={{ fontSize: '13px', lineHeight: 1.75, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
              {analysis.conclusion}
            </p>
          </div>
        </div>
      </div>

      {/* ── Pourquoi section ── */}
      {whyBullets.length > 0 && (
        <div style={{
          background: '#07111f',
          border: '1px solid rgba(51,65,85,0.45)',
          borderRadius: '16px',
          padding: '18px 22px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '14px' }}>
            Pourquoi &ldquo;{analysis.best.name}&rdquo; est plus rentable ?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {whyBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{b.emoji}</span>
                <span style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.65 }}>
                  {b.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Insights grid ── */}
      {analysis.insights.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {analysis.insights.map(insight => (
            <div key={insight.type} style={{
              background: '#07111f',
              border: `1px solid ${insight.color}28`,
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                borderBottom: `1px solid ${insight.color}18`,
                background: `${insight.color}09`,
              }}>
                <span style={{ fontSize: '18px' }}>{insight.icon}</span>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{insight.title}</h3>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.7, margin: 0 }}>{insight.text}</p>
                {insight.highlight && (
                  <div style={{
                    marginTop: '12px',
                    background: `${insight.color}0C`,
                    border: `1px solid ${insight.color}22`,
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: insight.color,
                    lineHeight: 1.55,
                  }}>
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
