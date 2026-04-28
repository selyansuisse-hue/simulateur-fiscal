'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlanBadge } from './PlanBadge'
import type { Cabinet } from '@/lib/types/cabinet'

const NAV = [
  { href: '', label: 'Leads', icon: '👥' },
  { href: '/stats', label: 'Statistiques', icon: '📊' },
  { href: '/widget', label: 'Widget', icon: '🔌' },
  { href: '/settings', label: 'Paramètres', icon: '⚙️' },
]

export function CabinetSidebar({ cabinet }: { cabinet: Cabinet }) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/cabinet/${cabinet.slug}`

  const initials = cabinet.nom.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside style={{
      width: '240px', flexShrink: 0,
      background: '#1a2332', borderRight: '1px solid #334155',
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      position: 'sticky', top: 0,
    }}>
      {/* Logo + Cabinet name */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {cabinet.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cabinet.logo_url} alt={cabinet.nom}
              style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
              background: cabinet.couleur_principale + '30',
              border: `1px solid ${cabinet.couleur_principale}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 800, color: cabinet.couleur_principale,
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cabinet.nom}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>Tableau de bord</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV.map(item => {
          const href = `${base}${item.href}`
          const isActive = item.href === ''
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(href)
          return (
            <Link key={item.href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '9px',
              fontSize: '13px', fontWeight: isActive ? 700 : 500,
              color: isActive ? '#f1f5f9' : '#64748b',
              background: isActive ? 'rgba(37,99,235,0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
              textDecoration: 'none', transition: 'all 150ms',
            }}>
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: plan + logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Plan actif</span>
          <PlanBadge plan={cabinet.plan} />
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '8px', borderRadius: '8px',
          background: 'transparent', border: '1px solid #334155',
          color: '#64748b', fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', transition: 'all 150ms',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}>
          ← Déconnexion
        </button>
      </div>
    </aside>
  )
}
