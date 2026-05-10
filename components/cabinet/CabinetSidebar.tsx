'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlanBadge } from './PlanBadge'
import { useSidebar } from '@/context/SidebarContext'
import type { Cabinet } from '@/lib/types/cabinet'

// ── SVG icons ──────────────────────────────────────────────────────────────
const IcoHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>
  </svg>
)
const IcoUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IcoChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>
  </svg>
)
const IcoStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.39 5.56L20 8.5l-4.06 4.04L17 18.5 12 15.77 7 18.5l1.06-5.96L4 8.5l5.61-.94z"/>
  </svg>
)
const IcoSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
)
const IcoFolder = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)
const IcoCompare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16l-4-4 4-4"/><path d="M3 12h14"/>
    <path d="M17 8l4 4-4 4"/><path d="M7 12h14"/>
  </svg>
)
const IcoWidget = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const IcoSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IcoLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const IcoChevron = ({ rotated }: { rotated: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10"
    style={{
      color: '#94a3b8',
      transition: 'transform 300ms ease-in-out',
      transform: rotated ? 'rotate(180deg)' : 'rotate(0deg)',
    }}
  >
    <path d="M6 2L4 5L6 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
)

// ── Nav item ──────────────────────────────────────────────────────────────
interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
  collapsed: boolean
}

function NavItem({ href, icon, label, active, collapsed }: NavItemProps) {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : '10px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    padding: collapsed ? '10px 0' : '9px 12px',
    borderRadius: '10px',
    margin: '0 6px',
    fontSize: '13.5px',
    fontWeight: active ? 600 : 500,
    textDecoration: 'none',
    transition: 'all 180ms ease',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    color: active ? '#ffffff' : '#94a3b8',
    background: active
      ? 'linear-gradient(90deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.08) 100%)'
      : 'transparent',
    borderLeft: active && !collapsed ? '2px solid #3B82F6' : '2px solid transparent',
  }

  return (
    <Link href={href} style={baseStyle} title={collapsed ? label : undefined}
      onMouseOver={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.color = '#e2e8f0'
        }
      }}
      onMouseOut={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#94a3b8'
        }
      }}
    >
      <span style={{
        flexShrink: 0, color: active ? '#60a5fa' : '#64748b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color 180ms',
      }}>
        {icon}
      </span>
      {!collapsed && (
        <span style={{
          overflow: 'hidden', whiteSpace: 'nowrap',
          opacity: collapsed ? 0 : 1,
          transition: 'opacity 200ms ease',
        }}>
          {label}
        </span>
      )}
    </Link>
  )
}

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      padding: '16px 16px 6px',
      fontSize: '10px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '.22em',
      color: '#334155',
    }}>
      {label}
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ margin: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }} />
}

// ── Main sidebar ───────────────────────────────────────────────────────────
export function CabinetSidebar({ cabinet }: { cabinet: Cabinet }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { collapsed, toggle } = useSidebar()

  const base = `/cabinet/${cabinet.slug}`

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Active detection helpers
  const isActive = (href: string, exact = false) => exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        minHeight: '100vh', flexShrink: 0,
        width: collapsed ? '64px' : '288px',
        transition: 'width 300ms ease-in-out',
        background: 'linear-gradient(180deg, #0a1020 0%, #080d1a 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >

      {/* ── Toggle button ── */}
      <button
        onClick={toggle}
        title={collapsed ? 'Étendre' : 'Réduire'}
        style={{
          position: 'absolute', right: '-12px', top: '50%',
          transform: 'translateY(-50%)',
          width: '24px', height: '24px',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(100,116,139,0.5)',
          background: 'linear-gradient(135deg, #0d1628, #111c35)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          cursor: 'pointer', zIndex: 50,
          transition: 'border-color 150ms, transform 150ms',
        }}
        onMouseOver={e => {
          e.currentTarget.style.borderColor = 'rgba(148,163,184,0.7)'
          e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'
        }}
        onMouseOut={e => {
          e.currentTarget.style.borderColor = 'rgba(100,116,139,0.5)'
          e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
        }}
      >
        <IcoChevron rotated={!collapsed} />
      </button>

      {/* ── Header logo ── */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: collapsed ? 'center' : 'flex-start',
        alignItems: 'center',
        transition: 'padding 300ms ease-in-out',
      }}>
        {collapsed ? (
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '13px', color: '#fff',
            boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
          }}>
            BX
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '13px', color: '#fff',
              boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
            }}>
              BX
            </div>
            <div style={{ lineHeight: 1.2, overflow: 'hidden' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
                {cabinet.nom}
              </div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.2em', color: '#475569', fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginTop: '2px' }}>
                Espace cabinet
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, paddingTop: '8px', paddingBottom: '8px', overflowY: 'auto' }}>

        {/* Accueil */}
        <div style={{ paddingTop: '4px', paddingBottom: '4px' }}>
          <NavItem
            href="/app"
            icon={<IcoHome />}
            label="Accueil"
            active={isActive('/app', true)}
            collapsed={collapsed}
          />
        </div>

        <Divider />

        {/* PROSPECTS */}
        {!collapsed && <SectionLabel label="Prospects" />}
        {collapsed && <div style={{ height: '8px' }} />}

        <NavItem href={base} icon={<IcoUsers />} label="Leads"
          active={isActive(base, true) || pathname === `${base}/leads`}
          collapsed={collapsed} />
        <NavItem href={`${base}/stats`} icon={<IcoChart />} label="Statistiques"
          active={isActive(`${base}/stats`)} collapsed={collapsed} />

        <Divider />

        {/* OUTILS */}
        {!collapsed && <SectionLabel label="Outils" />}
        {collapsed && <div style={{ height: '8px' }} />}

        <NavItem href="/simulateur" icon={<IcoStar />} label="Simulateur"
          active={isActive('/simulateur', true)} collapsed={collapsed} />
        <NavItem href="/explorer" icon={<IcoSearch />} label="Explorateur"
          active={isActive('/explorer', true)} collapsed={collapsed} />
        <NavItem href="/simulations" icon={<IcoFolder />} label="Mes simulations"
          active={pathname === '/simulations'} collapsed={collapsed} />
        <NavItem href="/simulations/comparer" icon={<IcoCompare />} label="Comparaison"
          active={pathname === '/simulations/comparer'} collapsed={collapsed} />

        <Divider />

        {/* CABINET */}
        {!collapsed && <SectionLabel label="Cabinet" />}
        {collapsed && <div style={{ height: '8px' }} />}

        <NavItem href={`${base}/widget`} icon={<IcoWidget />} label="Widget"
          active={isActive(`${base}/widget`)} collapsed={collapsed} />
        <NavItem href={`${base}/settings`} icon={<IcoSettings />} label="Paramètres"
          active={isActive(`${base}/settings`)} collapsed={collapsed} />
      </nav>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>

        {/* Plan badge */}
        {!collapsed && (
          <div style={{
            margin: '12px', padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '10px', color: '#334155', textTransform: 'uppercase', letterSpacing: '.16em', marginBottom: '2px' }}>
              Plan actif
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                {cabinet.plan.charAt(0).toUpperCase() + cabinet.plan.slice(1).replace('_', ' ')}
              </div>
              <PlanBadge plan={cabinet.plan} />
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Déconnexion' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '14px 0' : '12px 18px',
            color: '#475569', fontSize: '13.5px', fontWeight: 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseOver={e => {
            e.currentTarget.style.color = '#94a3b8'
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
          onMouseOut={e => {
            e.currentTarget.style.color = '#475569'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <IcoLogout />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
