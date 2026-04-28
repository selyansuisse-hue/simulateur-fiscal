import type { Plan } from '@/lib/types/cabinet'

const PLAN_CONFIG: Record<Plan, { label: string; bg: string; color: string; border: string }> = {
  starter: { label: 'Starter', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  pro: { label: 'Pro', bg: 'rgba(37,99,235,0.15)', color: '#60a5fa', border: 'rgba(37,99,235,0.3)' },
  cabinet_plus: { label: 'Cabinet+', bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
}

export function PlanBadge({ plan, size = 'sm' }: { plan: Plan; size?: 'sm' | 'md' }) {
  const cfg = PLAN_CONFIG[plan]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: size === 'md' ? '4px 12px' : '2px 8px',
      borderRadius: '999px',
      fontSize: size === 'md' ? '12px' : '10px',
      fontWeight: 700, letterSpacing: '0.04em',
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  )
}
