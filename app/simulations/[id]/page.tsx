import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { fmt } from '@/lib/utils'

interface SimResult { forme: string; netAnnuel: number; ir: number; charges: number; is: number; scoreTotal: number }
interface SimRow { id: string; name: string; created_at: string; params: Record<string, unknown>; results: { scored: SimResult[] }; best_forme: string; best_net_annuel: number; tmi: number; ca: number; gain: number; situation: string }

export default async function SimulationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: sim } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sim) notFound()
  const s = sim as SimRow
  const scored: SimResult[] = s.results?.scored || []
  const best = scored[0]

  const date = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-surface">
        <div className="max-w-[920px] mx-auto px-6 py-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-ink3 mb-6">
            <Link href="/simulations" className="hover:text-ink transition-colors">Mes simulations</Link>
            <span>/</span>
            <span className="text-ink font-medium">{s.name}</span>
          </div>

          {/* HERO */}
          <div className="bg-navy rounded-2xl p-8 mb-6 relative overflow-hidden">
            <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.2)_0%,transparent_65%)] -top-32 -right-16 pointer-events-none" />
            <div className="relative">
              <div className="text-[10.5px] font-semibold tracking-widest uppercase text-blue-mid mb-2">Simulation · {date}</div>
              <div className="font-display text-lg font-bold text-white/75 mb-2">{s.name}</div>
              {best && (
                <>
                  <div className="font-display text-5xl font-black text-white tracking-tighter mb-1.5">
                    <span className="bg-gradient-to-r from-blue-mid to-blue-light bg-clip-text text-transparent">
                      {fmt(best.netAnnuel)}
                    </span>
                  </div>
                  <div className="text-sm text-white/35 mb-5">{fmt(best.netAnnuel / 12)}/mois · {best.forme}</div>
                </>
              )}
              <div className="flex gap-2 flex-wrap">
                <span className="text-[11px] px-3 py-1 rounded-full border bg-blue-mid/15 border-blue-mid/30 text-blue-light">TMI {s.tmi}%</span>
                <span className="text-[11px] px-3 py-1 rounded-full border bg-white/6 border-white/10 text-white/42">CA {fmt(s.ca)}</span>
                {s.gain > 500 && <span className="text-[11px] px-3 py-1 rounded-full border bg-green-500/15 border-green-500/30 text-green-300">Gain vs moins favorable : +{fmt(s.gain)}</span>}
              </div>
            </div>
          </div>

          {/* Tableau structures */}
          {scored.length > 0 && (
            <div className="bg-white border border-black/[0.07] rounded-xl overflow-hidden mb-6 shadow-card">
              <div className="bg-ink px-5 py-4">
                <h2 className="font-display text-sm font-bold text-white">Comparaison des structures</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface border-b border-surface2">
                      {['Structure', 'Net/an', 'Net/mois', 'Cotisations', 'IR', 'IS', 'Score'].map(h => (
                        <th key={h} className="text-left text-[10px] font-bold tracking-wide uppercase text-ink3 px-3.5 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scored.map((r, i) => (
                      <tr key={r.forme} className={i === 0 ? 'bg-blue/[0.025]' : 'hover:bg-surface'}>
                        <td className="px-3.5 py-3 border-b border-surface2 font-bold text-ink text-[13px]">
                          {r.forme}
                          {i === 0 && <span className="ml-2 text-[9px] bg-blue text-white font-bold px-2 py-0.5 rounded-full">⭐ Meilleur</span>}
                        </td>
                        <td className="px-3.5 py-3 border-b border-surface2 font-bold text-green-700 text-[13px]">{fmt(r.netAnnuel)}</td>
                        <td className="px-3.5 py-3 border-b border-surface2 text-ink3 text-[13px]">{fmt(r.netAnnuel / 12)}/mois</td>
                        <td className="px-3.5 py-3 border-b border-surface2 text-red-500 text-[13px]">−{fmt(r.charges)}</td>
                        <td className="px-3.5 py-3 border-b border-surface2 text-red-500 text-[13px]">−{fmt(r.ir)}</td>
                        <td className="px-3.5 py-3 border-b border-surface2 text-ink3 text-[13px]">{r.is > 0 ? `−${fmt(r.is)}` : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-surface2 font-bold text-[13px]"><span className={i === 0 ? 'text-blue' : 'text-ink3'}>{r.scoreTotal}/100</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <a
              href={`/api/simulations/${s.id}/pdf`}
              className="px-5 py-2.5 bg-blue text-white font-semibold text-sm rounded-lg hover:bg-blue-dark transition-all"
            >
              📄 Télécharger le rapport PDF
            </a>
            <Link
              href="/simulations"
              className="px-5 py-2.5 text-ink3 border border-surface2 text-sm font-semibold rounded-lg hover:bg-surface transition-all"
            >
              ← Retour
            </Link>
          </div>

          {/* CTA Cabinet */}
          <div className="mt-8 bg-navy rounded-xl p-6 text-center">
            <div className="text-white font-display text-lg font-bold mb-2">Ces résultats vous intéressent ?</div>
            <p className="text-white/40 text-sm mb-4">Prenons RDV pour affiner votre situation réelle.</p>
            <a href="https://www.belhoxper.com/contact" target="_blank" rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-blue text-white font-semibold text-sm rounded-lg hover:bg-blue-dark transition-all">
              Prendre RDV →
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
