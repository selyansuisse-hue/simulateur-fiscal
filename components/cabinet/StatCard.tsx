interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: string
  color?: string
  delta?: number | null
}

export function StatCard({ label, value, sub, icon, color = '#3B82F6', delta }: StatCardProps) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: '14px',
      border: '1px solid rgba(51,65,85,0.7)',
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
            {label}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{sub}</div>
          )}
        </div>
        {icon && (
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0, border: `1px solid ${color}25`,
          }}>
            {icon}
          </div>
        )}
      </div>
      {delta !== null && delta !== undefined && Math.abs(delta) > 0 && (
        <div style={{ marginTop: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
            background: delta >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: delta >= 0 ? '#34d399' : '#f87171',
            border: `1px solid ${delta >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {delta >= 0 ? '↑ +' : '↓ '}{Math.abs(delta)}% vs mois dernier
          </span>
        </div>
      )}
    </div>
  )
}
