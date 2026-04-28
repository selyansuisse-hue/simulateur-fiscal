'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip as ChartTooltip, Legend,
} from 'chart.js'
import { StatCard } from '@/components/cabinet/StatCard'
import { fmt } from '@/lib/utils'
import type { Lead } from '@/lib/types/cabinet'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, Legend)

const STRUCT_COLORS: Record<string, string> = {
  'EURL / SARL (IS)': '#3B82F6', 'SAS / SASU': '#8B5CF6',
  'EI (réel normal)': '#F59E0B', 'Micro-entreprise': '#94A3B8',
}

export default function StatsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const chartRendered = useRef(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: cabinet } = await supabase
        .from('cabinets').select('id').eq('slug', slug).single()
      if (!cabinet) { setLoading(false); return }
      const { data } = await supabase
        .from('leads').select('*').eq('cabinet_id', cabinet.id)
        .order('created_at', { ascending: false })
      setLeads((data || []) as Lead[])
      setLoading(false)
    }
    load()
  }, [slug])

  const stats = useMemo(() => {
    if (!leads.length) return null
    const now = new Date()

    // Leads par semaine (8 semaines)
    const weeksData = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(now)
      end.setDate(end.getDate() - i * 7)
      const start = new Date(end)
      start.setDate(start.getDate() - 7)
      const count = leads.filter(l => {
        const d = new Date(l.created_at)
        return d >= start && d < end
      }).length
      const label = `S-${i === 0 ? '0' : i}`
      return { label, count }
    }).reverse()

    // Structures
    const structMap: Record<string, number> = {}
    leads.forEach(l => {
      const key = l.structure_recommandee || 'Autre'
      structMap[key] = (structMap[key] || 0) + 1
    })

    // KPIs
    const withCA = leads.filter(l => l.ca_simule)
    const withNet = leads.filter(l => l.net_annuel)
    const withScore = leads.filter(l => l.score)
    const avgCA = withCA.length ? Math.round(withCA.reduce((s, l) => s + (l.ca_simule || 0), 0) / withCA.length) : 0
    const avgNet = withNet.length ? Math.round(withNet.reduce((s, l) => s + (l.net_annuel || 0), 0) / withNet.length) : 0
    const avgScore = withScore.length ? Math.round(withScore.reduce((s, l) => s + (l.score || 0), 0) / withScore.length) : 0
    const convertis = leads.filter(l => l.statut === 'converti').length
    const taux = Math.round(convertis / leads.length * 100)

    // Funnel
    const funnel = [
      { label: 'Total leads', count: leads.length, color: '#60a5fa' },
      { label: 'Contactés', count: leads.filter(l => l.statut === 'contacté' || l.statut === 'converti').length, color: '#fbbf24' },
      { label: 'Convertis', count: convertis, color: '#34d399' },
    ]

    return { weeksData, structMap, avgCA, avgNet, avgScore, taux, funnel, total: leads.length }
  }, [leads])

  if (loading) return (
    <div style={{ padding: '28px 32px', color: '#64748b', fontSize: '14px' }}>Chargement...</div>
  )

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Statistiques</h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Vue d&apos;ensemble de votre activité</p>
      </div>

      {!stats || stats.total === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>Aucun lead encore</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>Intégrez le widget pour commencer à recevoir des leads.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <StatCard label="Total leads" value={stats.total} icon="👥" color="#60a5fa" />
            <StatCard label="CA moyen simulé" value={fmt(stats.avgCA)} icon="💶" color="#a78bfa" />
            <StatCard label="Net moyen/an" value={fmt(stats.avgNet)} icon="💰" color="#34d399" />
            <StatCard label="Taux conversion" value={`${stats.taux}%`} icon="🎯" color="#fbbf24" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            {/* Leads par semaine */}
            <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>Leads par semaine</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>8 dernières semaines</div>
              <div style={{ height: '180px' }}>
                <Bar
                  data={{
                    labels: stats.weeksData.map(w => w.label),
                    datasets: [{
                      data: stats.weeksData.map(w => w.count),
                      backgroundColor: '#3B82F680',
                      borderColor: '#3B82F6',
                      borderWidth: 1, borderRadius: 4,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#94a3b8', bodyColor: '#f1f5f9' } },
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } }, border: { color: '#334155' } },
                      y: { grid: { color: 'rgba(51,65,85,0.5)' }, ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 }, border: { color: '#334155' } },
                    },
                  }}
                />
              </div>
            </div>

            {/* Structures */}
            <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>Structures</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>Répartition recommandées</div>
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={{
                    labels: Object.keys(stats.structMap).map(k => k.replace(' / SARL (IS)', '').replace(' / SASU', '')),
                    datasets: [{
                      data: Object.values(stats.structMap),
                      backgroundColor: Object.keys(stats.structMap).map(k => (STRUCT_COLORS[k] ?? '#64748B') + 'CC'),
                      borderColor: Object.keys(stats.structMap).map(k => STRUCT_COLORS[k] ?? '#64748B'),
                      borderWidth: 1,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: {
                      legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 10 }, boxWidth: 10, padding: 8 } },
                      tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#94a3b8', bodyColor: '#f1f5f9' },
                    },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Funnel */}
          <div style={{ background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>Entonnoir de conversion</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.funnel.map((step, i) => {
                const pct = stats.total > 0 ? Math.round(step.count / stats.total * 100) : 0
                return (
                  <div key={step.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{step.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: step.color }}>{step.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: '#0f172a', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: step.color, borderRadius: '999px', transition: 'width 600ms ease', opacity: i === 0 ? 1 : 0.8 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Score moyen */}
          <div style={{ background: '#1e293b', borderRadius: '14px', border: '1px solid #334155', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '24px' }}>🏆</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Score moyen</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#34d399' }}>{stats.avgScore}/100</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
