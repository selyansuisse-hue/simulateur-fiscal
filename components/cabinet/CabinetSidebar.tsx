'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlanBadge } from './PlanBadge'
import type { Cabinet } from '@/lib/types/cabinet'

const PROSPECTS = [
  { subpath: '',       label: 'Leads',        icon: '👥' },
  { subpath: '/stats', label: 'Statistiques', icon: '📊' },
]

const OUTILS = [
  { href: '/simulateur',           label: 'Simulateur',      icon: '✦' },
  { href: '/explorer',             label: 'Explorateur',     icon: '🔍' },
  { href: '/simulations',          label: 'Mes simulations', icon: '📁' },
  { href: '/simulations/comparer', label: 'Comparaison',     icon: '⇄' },
]

const CABINET = [
  { subpath: '/widget',   label: 'Widget',     icon: '🔌' },
  { subpath: '/settings', label: 'Paramètres', icon: '⚙️' },
]

const SECTION_LABEL: React.CSSProperties = {
  padding: '4px 12px 5px',
  fontSize: '9.5px', fontWeight: 700, color: '#2d3f58',
  textTransform: 'uppercase', letterSpacing: '0.11em',
}

const DIVIDER: React.CSSProperties = {
  margin: '6px 8px',
  borderTop: '1px solid rgba(51,65,85,0.4)',
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', borderRadius: '9px',
      fontSize: '13px', fontWeight: active ? 700 : 500,
      color: active ? '#f1f5f9' : '#64748b',
      background: active ? 'rgba(37,99,235,0.15)' : 'transparent',
      border: active ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
      textDecoration: 'none', transition: 'all 150ms',
    }}
      onMouseOver={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.color = '#94a3b8'
        }
      }}
      onMouseOut={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#64748b'
        }
      }}
    >
      <span style={{ fontSize: '15px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {label}
    </Link>
  )
}

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
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>Espace cabinet</div>
          </div>
        </div>

        {/* Lien Accueil app */}
        <Link href="/app" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginTop: '12px', padding: '7px 10px', borderRadius: '8px',
          background: pathname === '/app' ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.04)',
          border: pathname === '/app' ? '1px solid rgba(37,99,235,0.35)' : '1px solid rgba(51,65,85,0.3)',
          fontSize: '12px', fontWeight: 600,
          color: pathname === '/app' ? '#93c5fd' : '#475569',
          textDecoration: 'none', transition: 'all 150ms',
        }}>
          <span style={{ fontSize: '14px' }}>🏠</span>
          Accueil
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '1px', overflowY: 'auto' }}>

        {/* PROSPECTS */}
        <div style={SECTION_LABEL}>Prospects</div>
        {PROSPECTS.map(item => {
          const href = `${base}${item.subpath}`
          const isActive = item.subpath === ''
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(href)
          return <NavItem key={item.subpath} href={href} label={item.label} icon={item.icon} active={isActive} />
        })}

        <div style={DIVIDER} />

        {/* OUTILS */}
        <div style={SECTION_LABEL}>Outils</div>
        {OUTILS.map(item => {
          const isActive = item.href === '/simulations'
            ? pathname === '/simulations'
            : item.href === '/simulateur'
              ? pathname === '/simulateur'
              : item.href === '/explorer'
                ? pathname === '/explorer'
                : pathname.startsWith(item.href)
          return <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} active={isActive} />
        })}

        <div style={DIVIDER} />

        {/* CABINET */}
        <div style={SECTION_LABEL}>Cabinet</div>
        {CABINET.map(item => {
          const href = `${base}${item.subpath}`
          const isActive = pathname.startsWith(href)
          return <NavItem key={item.subpath} href={href} label={item.label} icon={item.icon} active={isActive} />
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
