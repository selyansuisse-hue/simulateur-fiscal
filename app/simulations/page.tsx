import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { SimulationsGrid } from '../dashboard/SimulationsGrid'
import { CompareTable } from '@/components/dashboard/CompareTable'

export default async function SimulationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: simulations = [] } = await supabase
    .from('simulations')
    .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, best_ir, tmi, ca, situation, gain')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const sims = simulations || []

  // Narrative analysis: find best and worst by net annuel
  const sorted = [...sims].filter(s => s.best_net_annuel).sort((a, b) => (b.best_net_annuel ?? 0) - (a.best_net_annuel ?? 0))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const hasNarrative = sims.length >= 2 && best && worst && best.id !== worst.id && (best.best_net_annuel ?? 0) > (worst.best_net_annuel ?? 0)

  const fmtEuro = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Mes simulations</h1>
              <p className="text-sm text-ink3 mt-0.5">{sims.length} simulation(s) enregistrée(s)</p>
            </div>
            <Link href="/simulateur" className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-dark transition-all">
              + Nouvelle simulation
            </Link>
          </div>

          {hasNarrative && (
            <div className="mb-8 bg-white border border-black/[0.07] rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10.5px] font-bold tracking-widest uppercase text-emerald-700 mb-1">Analyse comparative</div>
                  <p className="text-[14px] text-ink leading-relaxed">
                    Votre meilleure simulation <strong className="text-ink">&laquo;{best.name}&raquo;</strong> génère{' '}
                    <span className="font-black text-emerald-600">{fmtEuro(best.best_net_annuel ?? 0)}/an</span> de revenu net,
                    soit <span className="font-bold text-emerald-600">+{fmtEuro((best.best_net_annuel ?? 0) - (worst.best_net_annuel ?? 0))}</span> de plus
                    que <strong>&laquo;{worst.name}&raquo;</strong>. La structure <strong>{best.best_forme}</strong> ressort systématiquement
                    comme la plus avantageuse pour votre profil.
                  </p>
                </div>
              </div>
            </div>
          )}

          <SimulationsGrid initialSimulations={sims} />
        </div>
      </div>
      <Footer />
    </>
  )
}
