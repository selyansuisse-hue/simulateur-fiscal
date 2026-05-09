import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { calculateLeadScore } from '@/lib/cabinet-utils'
import type { Lead } from '@/lib/types/cabinet'

function formatEur(n: number | null | undefined) {
  if (!n && n !== 0) return '—'
  if (n >= 1000) return `${Math.round(n / 1000)} k€`
  return `${Math.round(n)} €`
}

// ── SVG icons ────────────────────────────────────────────────────────────────
const IcoUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IcoTool = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
)
const IcoStar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l2.39 5.56L20 8.5l-4.06 4.04L17 18.5 12 15.77 7 18.5l1.06-5.96L4 8.5l5.61-.94z"/>
  </svg>
)
const IcoSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
)
const IcoCompare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 16l-4-4 4-4"/><path d="M3 12h14"/>
    <path d="M17 8l4 4-4 4"/><path d="M7 12h14"/>
  </svg>
)
const IcoWarn = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IcoFolder = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

export default async function AppHomePage() {
  const supabase   = await createClient()
  const adminSupa  = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: membre } = await supabase
    .from('cabinet_membres')
    .select('cabinet_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membre) redirect('/')

  const { data: cabinet } = await supabase
    .from('cabinets').select('*').eq('id', membre.cabinet_id).single()
  if (!cabinet) redirect('/')

  // ── Données leads ──────────────────────────────────────────────────────────
  const { data: rawLeads } = await adminSupa
    .from('leads')
    .select('*')
    .eq('cabinet_id', cabinet.id)
    .order('created_at', { ascending: false })
    .limit(200)
  const leads: Lead[] = rawLeads || []

  const totalLeads      = leads.length
  const leadsChauds     = leads.filter(l => calculateLeadScore(l) >= 70).length
  const leadsARelancer  = leads.filter(l => {
    const jours = differenceInDays(new Date(), new Date(l.derniere_relance || l.created_at))
    return l.statut === 'nouveau' && jours > 3
  }).length

  // ── Simulations récentes ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: simulations = [] } = await supabase
    .from('simulations')
    .select('id, name, created_at, ca, best_forme, situation')
    .order('created_at', { ascending: false })
    .limit(5) as { data: { id: string; name: string; created_at: string; ca: number | null; best_forme: string | null; situation: string | null }[] | null }

  // ── Fil d'activité ────────────────────────────────────────────────────────
  type Activite = { icon: string; badge: string; badgeColor: string; texte: string; detail: string; temps: string; dotClass: string }
  const activites: Activite[] = []

  // Leads récents (< 7j)
  leads
    .filter(l => differenceInDays(new Date(), new Date(l.created_at)) <= 7)
    .slice(0, 2)
    .forEach(l => activites.push({
      icon: '👤',
      badge: 'Nouveau lead',
      badgeColor: '#93c5fd',
      texte: `Nouveau lead — ${l.nom || l.email || 'Anonyme'}`,
      detail: l.ca_simule
        ? `CA ${formatEur(l.ca_simule)} · ${l.structure_recommandee || 'Simulation en cours'}`
        : 'Inscription sans simulation',
      temps: formatDistanceToNow(new Date(l.created_at), { locale: fr, addSuffix: true }),
      dotClass: 'blue',
    }))

  // Leads à relancer
  leads
    .filter(l => {
      const j = differenceInDays(new Date(), new Date(l.derniere_relance || l.created_at))
      return l.statut === 'nouveau' && j > 3
    })
    .slice(0, 1)
    .forEach(l => {
      const j = differenceInDays(new Date(), new Date(l.derniere_relance || l.created_at))
      activites.push({
        icon: '⚠️',
        badge: 'Relance',
        badgeColor: '#fcd34d',
        texte: `${l.nom || l.email || 'Lead'} n'a pas été contacté`,
        detail: `Depuis ${j} jour${j > 1 ? 's' : ''} · ${l.statut}`,
        temps: '',
        dotClass: 'amber',
      })
    })

  // Simulations récentes
  ;(simulations || []).slice(0, 2).forEach(s => activites.push({
    icon: '📊',
    badge: 'Simulation',
    badgeColor: '#6ee7b7',
    texte: `Simulation enregistrée — ${s.name || 'Sans titre'}`,
    detail: `${formatEur(s.ca)} · ${s.best_forme || '—'}`,
    temps: formatDistanceToNow(new Date(s.created_at), { locale: fr, addSuffix: true }),
    dotClass: 'green',
  }))

  // ── Infos affichage ───────────────────────────────────────────────────────
  const prenom = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    || user.email?.split('@')[0]
    || 'Selyan'

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
  // capitalize first letter
  const dateCap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

  const cabinetHref = `/cabinet/${cabinet.slug}`

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: '1400px', width: '100%' }}>

      {/* ── Keyframes (pulseDot + wave) ── */}
      <style>{`
        @keyframes pulseDot {
          0%,100% { transform:scale(1);opacity:1;box-shadow:0 0 0 0 rgba(245,158,11,0.5); }
          50%      { transform:scale(1.3);opacity:.85;box-shadow:0 0 0 6px rgba(245,158,11,0); }
        }
        @keyframes pulseGreen {
          0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,0.6); }
          50%      { box-shadow:0 0 0 6px rgba(16,185,129,0); }
        }
        @keyframes wave {
          0%,100% { transform:rotate(0deg); }
          20%  { transform:rotate(-12deg); }
          40%  { transform:rotate(14deg); }
          60%  { transform:rotate(-8deg); }
          80%  { transform:rotate(8deg); }
        }
        .pulse-amber { animation:pulseDot 1.6s ease-in-out infinite; }
        .pulse-green { animation:pulseGreen 1.8s ease-in-out infinite; }
        .wave-hand { display:inline-block;transform-origin:70% 70%;animation:wave 2.4s ease-in-out .6s 1; }
        .hero-card { transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease; }
        .hero-blue:hover  { transform:translateY(-3px);border-color:rgba(59,130,246,0.45)!important;box-shadow:0 18px 50px -20px rgba(59,130,246,0.45); }
        .hero-violet:hover{ transform:translateY(-3px);border-color:rgba(139,92,246,0.45)!important;box-shadow:0 18px 50px -20px rgba(139,92,246,0.45); }
        .tool-row:hover { padding-left:8px; }
        .tool-row:hover .tool-arrow { color:#c4b5fd;transform:translateX(2px); }
        .quick-card:hover { background:#111c35!important;border-color:rgba(148,163,184,0.22)!important;transform:translateY(-2px); }
        .tl-item:hover { border-color:rgba(148,163,184,0.18)!important;transform:translateX(2px); }
        .cta-link:hover .arr { transform:translateX(4px); }
      `}</style>

      {/* ══════════════════════════════════
          1. HEADER GREETING
      ══════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Bonjour, {prenom}</span>
            <span className="wave-hand" style={{ fontSize: '17px' }}>👋</span>
          </div>
          <h1 style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.05, color: '#fff', margin: '0 0 10px' }}>
            Tableau de bord{' '}
            <span style={{
              background: 'linear-gradient(90deg, #fff 0%, #93b4ff 50%, #c4a8ff 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Belho Xper</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>Que souhaitez-vous faire aujourd&apos;hui ?</p>
        </div>

        {/* Date pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: '#0d1425', border: '1px solid rgba(148,163,184,0.10)',
          borderRadius: '12px', padding: '8px 16px',
          color: '#94a3b8', fontSize: '13px',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}>
          <span className="pulse-green" style={{
            display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
            background: '#10B981', flexShrink: 0,
          }} />
          {dateCap}
        </div>
      </div>

      {/* ══════════════════════════════════
          2. DEUX HERO CARDS
      ══════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '48px' }}>

        {/* ── Card 1 — Dashboard Leads ── */}
        <Link href={cabinetHref} className="hero-card hero-blue" style={{
          display: 'block', borderRadius: '20px', padding: '32px', overflow: 'hidden',
          position: 'relative', textDecoration: 'none',
          background: 'radial-gradient(600px 320px at 100% 0%, rgba(59,130,246,0.18), transparent 65%), linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)',
          border: '1px solid rgba(59,130,246,0.22)',
        }}>
          {/* Texture grid */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .5,
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }} />
          <div style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.28)', color: '#93c5fd',
              }}><IcoUsers /></div>
              <div style={{ flex: 1, paddingTop: '2px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '.22em', textTransform: 'uppercase', fontWeight: 600, color: '#60a5fa', fontFamily: "'JetBrains Mono',ui-monospace,monospace", marginBottom: '6px' }}>
                  Gestion des prospects
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Dashboard Leads</div>
              </div>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '13.5px', lineHeight: 1.6, marginBottom: '24px', maxWidth: '420px' }}>
              Gérez vos prospects, suivez leur avancement et analysez vos statistiques de conversion.
            </p>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { val: totalLeads,     color: '#f1f5f9', label: 'Leads · Total',    pulse: false },
                { val: leadsARelancer, color: '#fbbf24', label: 'À relancer',        pulse: leadsARelancer > 0 },
                { val: leadsChauds,    color: '#6ee7b7', label: 'Chauds 🔥',         pulse: false },
              ].map((m, i) => (
                <div key={i} style={{ padding: '16px 4px', textAlign: 'center', position: 'relative' }}>
                  {i > 0 && <div style={{ position: 'absolute', left: 0, top: '18px', bottom: '18px', width: '1px', background: 'linear-gradient(180deg, transparent, rgba(148,163,184,0.18), transparent)' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontVariantNumeric: 'tabular-nums', fontSize: '36px', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: m.color }}>
                      {m.val}
                    </span>
                    {m.pulse && <span className="pulse-amber" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: '11px', color: i === 1 ? 'rgba(245,158,11,0.7)' : i === 2 ? 'rgba(16,185,129,0.7)' : '#64748b', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600 }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Alert */}
            {leadsARelancer > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '11px 14px', color: '#fbbf24', fontSize: '13px', fontWeight: 600, marginBottom: '24px' }}>
                <IcoWarn />
                {leadsARelancer} lead{leadsARelancer > 1 ? 's' : ''} nécessite{leadsARelancer > 1 ? 'nt' : ''} une relance
              </div>
            )}

            {/* CTA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="cta-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: '#60a5fa' }}>
                Accéder au dashboard <span className="arr" style={{ display: 'inline-block', transition: 'transform .2s' }}>→</span>
              </span>
              <div style={{ fontSize: '10.5px', fontFamily: "'JetBrains Mono',ui-monospace,monospace", textTransform: 'uppercase', letterSpacing: '.2em', color: '#2d3f58' }}>/leads</div>
            </div>
          </div>
        </Link>

        {/* ── Card 2 — Suite Fiscale ── */}
        <Link href="/simulateur" className="hero-card hero-violet" style={{
          display: 'block', borderRadius: '20px', padding: '32px', overflow: 'hidden',
          position: 'relative', textDecoration: 'none',
          background: 'radial-gradient(600px 320px at 100% 0%, rgba(139,92,246,0.18), transparent 65%), linear-gradient(135deg, #0d0f28 0%, #150d2e 100%)',
          border: '1px solid rgba(139,92,246,0.22)',
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .5, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)', backgroundSize: '22px 22px' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.28)', color: '#c4b5fd' }}>
                <IcoTool />
              </div>
              <div style={{ flex: 1, paddingTop: '2px' }}>
                <div style={{ fontSize: '10.5px', letterSpacing: '.22em', textTransform: 'uppercase', fontWeight: 600, color: '#a78bfa', fontFamily: "'JetBrains Mono',ui-monospace,monospace", marginBottom: '6px' }}>
                  Outils professionnels
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Suite Fiscale</div>
              </div>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '13.5px', lineHeight: 1.6, marginBottom: '24px', maxWidth: '420px' }}>
              Simulateur, explorateur de scénarios et comparaison pour vos consultations clients.
            </p>

            {/* Tool list */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px' }}>
              {[
                { icon: <IcoStar />, label: 'Simulateur fiscal',      sub: 'Comparez 4 structures en 4 étapes',    href: '/simulateur' },
                { icon: <IcoSearch />, label: 'Explorateur',           sub: 'Analysez les scénarios en temps réel', href: '/explorer' },
                { icon: <IcoCompare />, label: 'Comparaison',          sub: 'Confrontez plusieurs simulations',     href: '/simulations/comparer' },
              ].map((tool, i) => (
                <div key={i} className="tool-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 4px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'padding .18s ease' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.22)', color: '#c4b5fd' }}>
                    {tool.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: '13.5px', fontWeight: 600 }}>{tool.label}</div>
                    <div style={{ color: '#475569', fontSize: '12px', marginTop: '2px' }}>{tool.sub}</div>
                  </div>
                  <div className="tool-arrow" style={{ color: '#475569', fontSize: '14px', transition: 'all .18s ease' }}>→</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="cta-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: '#a78bfa' }}>
                Accéder aux outils <span className="arr" style={{ display: 'inline-block', transition: 'transform .2s' }}>→</span>
              </span>
              <div style={{ fontSize: '10.5px', fontFamily: "'JetBrains Mono',ui-monospace,monospace", textTransform: 'uppercase', letterSpacing: '.2em', color: '#2d3f58' }}>/suite-fiscale</div>
            </div>
          </div>
        </Link>
      </div>

      {/* ══════════════════════════════════
          3. ACCÈS RAPIDES
      ══════════════════════════════════ */}
      <div style={{ marginBottom: activites.length > 0 ? '48px' : 0 }}>
        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '.22em', textTransform: 'uppercase', color: '#475569', fontWeight: 600 }}>Accès rapides</span>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(148,163,184,0.18), transparent)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          {[
            { href: cabinetHref, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, icoStyle: { background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.28)',color:'#93c5fd' }, label: 'Leads', sub: 'Voir les prospects' },
            { href: '/simulateur', icon: <IcoStar />, icoStyle: { background:'rgba(139,92,246,0.15)',border:'1px solid rgba(139,92,246,0.28)',color:'#c4b5fd' }, label: 'Simulateur', sub: 'Lancer une simulation' },
            { href: '/explorer', icon: <IcoSearch />, icoStyle: { background:'rgba(6,182,212,0.15)',border:'1px solid rgba(6,182,212,0.28)',color:'#67e8f9' }, label: 'Explorateur', sub: 'Analyser un scénario' },
            { href: '/simulations', icon: <IcoFolder />, icoStyle: { background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.28)',color:'#fcd34d' }, label: 'Simulations', sub: 'Mes analyses sauvegardées' },
          ].map((item, i) => (
            <Link key={i} href={item.href} className="quick-card" style={{
              position: 'relative', display: 'block', background: '#0d1425',
              border: '1px solid rgba(148,163,184,0.10)', borderRadius: '16px',
              padding: '18px', textDecoration: 'none', transition: 'all .2s ease', overflow: 'hidden',
            }}>
              {/* Arrow top-right */}
              <span style={{ position: 'absolute', top: '16px', right: '18px', color: '#334155', fontSize: '16px', transition: 'all .2s ease' }}>→</span>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', ...item.icoStyle }}>
                {item.icon}
              </div>
              <div style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>{item.label}</div>
              <div style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>{item.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════
          4. ACTIVITÉ RÉCENTE (en bas)
      ══════════════════════════════════ */}
      {activites.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <span style={{ fontSize: '11px', letterSpacing: '.22em', textTransform: 'uppercase', color: '#475569', fontWeight: 600 }}>Activité récente</span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(148,163,184,0.18), transparent)' }} />
            </div>
            <Link href={cabinetHref} style={{ fontSize: '12px', color: '#475569', textDecoration: 'none', marginLeft: '16px', transition: 'color .15s' }}
              onMouseOver={undefined}>
              Tout voir →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activites.slice(0, 4).map((a, i) => {
              const dotColors: Record<string, { bg: string; border: string; color: string }> = {
                blue:  { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', color: '#93c5fd' },
                amber: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', color: '#fcd34d' },
                green: { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', color: '#6ee7b7' },
              }
              const dc = dotColors[a.dotClass] || dotColors.blue
              return (
                <div key={i} className="tl-item" style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  background: '#0d1425', border: '1px solid rgba(148,163,184,0.10)',
                  borderRadius: '14px', padding: '14px 16px',
                  transition: 'border-color .18s ease, transform .18s ease',
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '15px', background: dc.bg, border: `1px solid ${dc.border}`, color: dc.color }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono',ui-monospace,monospace", textTransform: 'uppercase', letterSpacing: '.16em', color: a.badgeColor, fontWeight: 600, opacity: .8 }}>
                        {a.badge}
                      </span>
                      <span style={{ color: '#334155' }}>·</span>
                      <span style={{ color: '#e2e8f0', fontSize: '13.5px', fontWeight: 500 }}>{a.texte}</span>
                    </div>
                    <div style={{ color: '#475569', fontSize: '12.5px', marginTop: '4px' }}>{a.detail}</div>
                  </div>
                  {a.temps && (
                    <div style={{ color: '#475569', fontSize: '12px', fontFamily: "'JetBrains Mono',ui-monospace,monospace", whiteSpace: 'nowrap', paddingLeft: '12px' }}>
                      {a.temps}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ height: '64px' }} />
    </div>
  )
}
