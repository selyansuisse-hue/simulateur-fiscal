import Link from 'next/link'
import { fmt } from '@/lib/utils'

interface SimData {
  id: string
  created_at: string
  best_forme: string
  tmi: number
  ca: number
  gain: number
  params?: {
    charges?: number
    amort?: number
    capital?: number
    perMontant?: number
    perActif?: string
  }
}

interface Action {
  priority: 'high' | 'medium' | 'low'
  icon: string
  titre: string
  desc: string
  cta: string
  href: string
  gain: number | null
}

function generateActions(sim: SimData): Action[] {
  const actions: Action[] = []
  const charges = (sim.params?.charges ?? 0) + (sim.params?.amort ?? 0)
  const benBrut = Math.max(0, sim.ca - charges)
  const daysSince = Math.floor((Date.now() - new Date(sim.created_at).getTime()) / 86_400_000)

  // PER non activé et TMI >= 30%
  const perMontant = sim.params?.perMontant ?? 0
  const perActif = sim.params?.perActif ?? 'non'
  if ((perMontant === 0 || perActif === 'non') && sim.tmi >= 30) {
    const perPlafond = Math.round(Math.min(35194, benBrut * 0.10))
    const gain = Math.round(perPlafond * sim.tmi / 100)
    if (perPlafond > 0) {
      actions.push({
        priority: 'high',
        icon: '📊',
        titre: 'Activer votre PER',
        desc: `Vous n'avez pas de PER. À TMI ${sim.tmi}%, un versement de ${fmt(perPlafond)} vous économiserait ${fmt(gain)}/an d'IR.`,
        cta: "Simuler l'impact PER",
        href: `/explorer?ca=${sim.ca}`,
        gain,
      })
    }
  }

  // EI recommandée et bénéfice proche seuil IS
  if (sim.best_forme.includes('EI') && benBrut > 50_000) {
    actions.push({
      priority: 'medium',
      icon: '⚡',
      titre: 'Seuil de bascule IS proche',
      desc: `Votre bénéfice approche 60 000 €, seuil au-delà duquel une EURL/SASU devient souvent plus avantageuse.`,
      cta: 'Voir la simulation à la hausse',
      href: `/explorer?ca=${Math.round(sim.ca * 1.15)}`,
      gain: null,
    })
  }

  // Simulation ancienne
  if (daysSince > 90) {
    actions.push({
      priority: 'high',
      icon: '🔄',
      titre: 'Mettre à jour votre simulation',
      desc: `Votre simulation date de ${daysSince} jours. Nouveau barème, changement de CA ou de situation familiale ?`,
      cta: 'Relancer la simulation',
      href: '/simulateur',
      gain: null,
    })
  }

  // EURL et capital trop faible
  const capital = sim.params?.capital ?? 0
  if (sim.best_forme.includes('EURL') && capital < 10_000) {
    const seuilDiv = Math.round(capital * 0.10)
    actions.push({
      priority: 'medium',
      icon: '🏦',
      titre: 'Augmenter votre capital social',
      desc: `Votre seuil dividendes sans cotis. est de ${fmt(seuilDiv)}. Augmenter le capital à 50 000 € permettrait de distribuer jusqu'à ${fmt(5000)}/an sans cotisations TNS.`,
      cta: 'Simuler avec capital 50k',
      href: `/explorer?ca=${sim.ca}`,
      gain: null,
    })
  }

  // Invitation permanente à explorer
  actions.push({
    priority: 'low',
    icon: '🔍',
    titre: 'Explorer vos scénarios',
    desc: 'Et si votre CA augmentait de 20% ? Et si vous vous mariez ? Testez en temps réel.',
    cta: "Ouvrir l'explorateur",
    href: `/explorer?ca=${sim.ca}`,
    gain: null,
  })

  return actions.slice(0, 4)
}

const PRIORITY_STYLE: Record<string, { border: string; bg: string }> = {
  high: { border: 'rgba(239,68,68,0.2)', bg: 'rgba(239,68,68,0.03)' },
  medium: { border: 'rgba(245,158,11,0.2)', bg: 'rgba(245,158,11,0.03)' },
  low: { border: 'rgba(203,213,225,0.8)', bg: '#FAFBFF' },
}

interface Props { sim: SimData }

export function ActionsSuggested({ sim }: Props) {
  const actions = generateActions(sim)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs">✦</div>
        <h3 className="text-sm font-bold text-slate-900">Actions recommandées</h3>
      </div>
      <div className="space-y-3">
        {actions.map((action, i) => {
          const style = PRIORITY_STYLE[action.priority]
          return (
            <div key={i} className="rounded-xl p-4 border transition-all hover:shadow-sm"
              style={{ borderColor: style.border, background: style.bg }}>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{action.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="text-sm font-bold text-slate-900">{action.titre}</div>
                    {action.gain && (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        +{fmt(action.gain)}/an
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{action.desc}</p>
                  <Link href={action.href}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    {action.cta} →
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
