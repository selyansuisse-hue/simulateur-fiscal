import Link from 'next/link'
import { fmt } from '@/lib/utils'

interface Props {
  firstName: string
  lastSim: {
    created_at: string
    best_forme: string
    best_net_annuel: number
    ca: number
  } | null
}

function getMsg(firstName: string, lastSim: Props['lastSim'], days: number) {
  if (!lastSim) return {
    title: `Bonjour ${firstName} 👋`,
    subtitle: "Vous n'avez pas encore de simulation. Lancez-en une pour découvrir votre structure optimale.",
    cta: { label: '✦ Lancer ma première simulation', href: '/simulateur', amber: false },
  }
  if (days > 90) return {
    title: `Bon retour, ${firstName} 👋`,
    subtitle: `Votre dernière simulation date de ${days} jours. Votre situation a peut-être évolué — CA, situation familiale, objectifs. Une mise à jour s'impose.`,
    cta: { label: '↻ Mettre à jour ma simulation', href: '/simulateur', amber: true },
  }
  if (days > 30) return {
    title: `Bonjour ${firstName}`,
    subtitle: `Votre dernière simulation remonte à ${days} jours. Avez-vous exploré tous les leviers d'optimisation ?`,
    cta: { label: '🔍 Explorer mes scénarios', href: `/explorer?ca=${lastSim.ca}`, amber: false },
  }
  return {
    title: `Bonjour ${firstName} ✓`,
    subtitle: `Votre simulation est à jour. Structure optimale : ${lastSim.best_forme} à ${fmt(lastSim.best_net_annuel)}/an.`,
    cta: null,
  }
}

export function WelcomeBanner({ firstName, lastSim }: Props) {
  const days = lastSim
    ? Math.floor((Date.now() - new Date(lastSim.created_at).getTime()) / 86_400_000)
    : 0
  const msg = getMsg(firstName, lastSim, days)

  return (
    <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #050c1a 0%, #0d1f3c 100%)' }}>
      <div style={{
        position: 'absolute', right: '-5rem', top: '-5rem', width: '400px', height: '400px',
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(37,99,235,.25) 0%, transparent 65%)',
      }} />
      <div className="max-w-6xl mx-auto px-6 py-8 relative flex items-center justify-between gap-8 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{msg.title}</h1>
          <p className="text-white/60 text-sm max-w-xl leading-relaxed">{msg.subtitle}</p>
        </div>
        {msg.cta && (
          <Link
            href={msg.cta.href}
            className="flex-shrink-0 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:-translate-y-0.5"
            style={{
              background: msg.cta.amber
                ? 'linear-gradient(135deg, #D97706, #B45309)'
                : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              boxShadow: msg.cta.amber
                ? '0 4px 16px rgba(217,119,6,0.4)'
                : '0 4px 16px rgba(29,78,216,0.4)',
            }}
          >
            {msg.cta.label}
          </Link>
        )}
      </div>
    </div>
  )
}
