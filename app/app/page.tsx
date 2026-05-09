import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AppHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: membre } = await supabase
    .from('cabinet_membres')
    .select('cabinet_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membre) redirect('/')

  const { data: cabinet } = await supabase
    .from('cabinets')
    .select('*')
    .eq('id', membre.cabinet_id)
    .single()

  if (!cabinet) redirect('/')

  // Métriques leads
  const [
    { count: totalLeads },
    { count: leadsARelancer },
    { count: leadsChauds },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('cabinet_id', cabinet.id),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('cabinet_id', cabinet.id)
      .in('statut', ['nouveau', 'contacté']),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('cabinet_id', cabinet.id)
      .eq('intention', 'urgent'),
  ])

  const cabinetHref = `/cabinet/${cabinet.slug}`

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: '960px', width: '100%' }}>

      {/* Greeting */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '4px' }}>Bonjour 👋</div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.025em', color: '#f1f5f9', margin: '0 0 6px' }}>
          Tableau de bord Belho Xper
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Que souhaitez-vous faire aujourd&apos;hui ?
        </p>
      </div>

      {/* 2 grandes zones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Zone 1 — Leads */}
        <Link href={cabinetHref} style={{
          display: 'block', borderRadius: '20px', padding: '32px',
          background: 'linear-gradient(135deg, #0d1628 0%, #111c35 100%)',
          border: '1px solid rgba(99,130,246,0.15)',
          textDecoration: 'none', transition: 'border-color 200ms',
        }}
          onMouseOver={undefined}
          className="group hover:border-blue-500/40"
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#60a5fa', textTransform: 'uppercase', marginBottom: '8px' }}>
            GESTION DES PROSPECTS
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px' }}>
            Dashboard Leads
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px' }}>
            Gérez vos prospects, suivez leur avancement et analysez vos statistiques de conversion.
          </p>

          {/* Métriques */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
                {totalLeads ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>leads total</div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>
                {leadsARelancer ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>à relancer</div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#6ee7b7', lineHeight: 1 }}>
                {leadsChauds ?? 0}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>chauds</div>
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>
            Accéder au dashboard →
          </div>
        </Link>

        {/* Zone 2 — Suite fiscale */}
        <Link href="/simulateur" style={{
          display: 'block', borderRadius: '20px', padding: '32px',
          background: 'linear-gradient(135deg, #0d1120 0%, #150d28 100%)',
          border: '1px solid rgba(139,92,246,0.15)',
          textDecoration: 'none',
        }}
          className="hover:border-violet-500/40"
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔧</div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#a78bfa', textTransform: 'uppercase', marginBottom: '8px' }}>
            OUTILS PROFESSIONNELS
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px' }}>
            Suite Fiscale
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px' }}>
            Simulateur, explorateur de scénarios et comparaison multi-simulations pour vos consultations clients.
          </p>

          {/* Liste des outils */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {[
              { icon: '✦', label: 'Simulateur fiscal' },
              { icon: '🔍', label: 'Explorateur de scénarios' },
              { icon: '⇄', label: 'Comparaison multi-simulations' },
            ].map((outil, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
                <span style={{ color: '#a78bfa' }}>{outil.icon}</span>
                {outil.label}
              </div>
            ))}
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa' }}>
            Accéder aux outils →
          </div>
        </Link>
      </div>

      {/* Accès rapide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { href: cabinetHref,             icon: '👥', label: 'Leads' },
          { href: '/simulateur',           icon: '✦',  label: 'Simulateur' },
          { href: '/explorer',             icon: '🔍', label: 'Explorateur' },
          { href: '/simulations',          icon: '📁', label: 'Simulations' },
        ].map((item, i) => (
          <Link key={i} href={item.href} style={{
            display: 'block',
            background: '#0d1628', border: '1px solid rgba(51,65,85,0.4)',
            borderRadius: '14px', padding: '18px', textAlign: 'center',
            textDecoration: 'none', transition: 'border-color 150ms',
          }}
            className="hover:border-slate-600/60"
          >
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>{item.icon}</div>
            <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>{item.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
