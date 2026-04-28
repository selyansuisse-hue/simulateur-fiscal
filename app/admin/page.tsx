import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlanBadge } from '@/components/cabinet/PlanBadge'
import type { Cabinet, Plan } from '@/lib/types/cabinet'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    redirect('/dashboard')
  }

  const adminClient = await createAdminClient()

  const { data: cabinets = [] } = await adminClient
    .from('cabinets').select('*').order('created_at', { ascending: false })

  const { data: leadsCount = [] } = await adminClient
    .from('leads').select('cabinet_id')

  const leadsByCabinet: Record<string, number> = {}
  leadsCount?.forEach(l => {
    leadsByCabinet[l.cabinet_id] = (leadsByCabinet[l.cabinet_id] || 0) + 1
  })

  const totalLeads = leadsCount?.length || 0
  const activeCabinets = cabinets?.filter(c => c.actif).length || 0

  const MRR_MAP: Record<Plan, number> = { starter: 149, pro: 299, cabinet_plus: 499 }
  const mrr = cabinets?.filter(c => c.actif).reduce((s, c) => s + (MRR_MAP[c.plan as Plan] || 0), 0) || 0

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
            🛡️ Super-Admin
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Vue d&apos;ensemble — accès restreint
          </p>
        </div>
        <Link href="/dashboard" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'MRR total', value: `${mrr.toLocaleString('fr-FR')} €`, icon: '💶', color: '#34d399' },
          { label: 'Cabinets actifs', value: activeCabinets, icon: '🏢', color: '#60a5fa' },
          { label: 'Total leads', value: totalLeads, icon: '👥', color: '#a78bfa' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#1e293b', borderRadius: '14px', border: '1px solid #334155', padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: kpi.color }} />
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{kpi.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{kpi.icon}</span>
              <span style={{ fontSize: '28px', fontWeight: 900, color: kpi.color, letterSpacing: '-0.03em' }}>{kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Cabinets table */}
      <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
            Cabinets ({cabinets?.length || 0})
          </span>
          <Link href="/admin/nouveau-cabinet" style={{
            padding: '7px 14px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
          }}>
            + Créer un cabinet
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.5)' }}>
                {['Cabinet', 'Plan', 'Leads', 'Statut', 'Créé le', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(cabinets || []).map(cabinet => (
                <tr key={cabinet.id} style={{ borderTop: '1px solid rgba(51,65,85,0.5)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{cabinet.nom}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{cabinet.slug}</div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>{cabinet.email_contact}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <PlanBadge plan={cabinet.plan as Plan} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: '#60a5fa' }}>
                    {leadsByCabinet[cabinet.id] || 0}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      background: cabinet.actif ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                      color: cabinet.actif ? '#34d399' : '#64748b',
                    }}>
                      {cabinet.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(cabinet.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Link href={`/cabinet/${cabinet.slug}`} style={{
                        padding: '4px 10px', borderRadius: '6px',
                        background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
                        color: '#60a5fa', fontSize: '11px', fontWeight: 600, textDecoration: 'none',
                      }}>
                        Dashboard
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {(!cabinets || cabinets.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '14px' }}>
                    Aucun cabinet enregistré
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: '11px', color: '#334155', textAlign: 'center' }}>
        Accès restreint — {user.email}
      </div>
    </div>
  )
}
