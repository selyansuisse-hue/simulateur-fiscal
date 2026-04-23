import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { PersonalKPIs } from '@/components/dashboard/PersonalKPIs'
import { LastSimulationCard } from '@/components/dashboard/LastSimulationCard'
import { SimulationsTimeline } from '@/components/dashboard/SimulationsTimeline'
import { ActionsSuggested } from '@/components/dashboard/ActionsSuggested'
import { ExpertCTA } from '@/components/dashboard/ExpertCTA'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: rawSims = [] } = await supabase
    .from('simulations')
    .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, best_ir, tmi, ca, situation, gain, params, results')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const profile = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const firstName = (profile.data?.full_name || user.email || 'vous').split(' ')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulations = (rawSims || []) as any[]
  const lastSim = simulations[0] ?? null

  return (
    <>
      <PageHeader />
      <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>

        <WelcomeBanner firstName={firstName} lastSim={lastSim} />

        {simulations.length > 0 && (
          <PersonalKPIs simulations={simulations} />
        )}

        <div className="max-w-6xl mx-auto px-6 pb-12" style={{ paddingTop: simulations.length === 0 ? '32px' : '0' }}>

          {/* Pas encore de simulation */}
          {!lastSim && (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-5xl mb-5">📊</div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Prêt à simuler votre structure optimale ?</h2>
              <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto">
                En 4 minutes et 4 étapes, découvrez quelle structure vous fait vraiment économiser.
              </p>
              <Link href="/simulateur"
                className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}>
                ✦ Lancer ma première simulation
              </Link>
            </div>
          )}

          {/* Layout 2 colonnes quand on a des simulations */}
          {lastSim && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Colonne principale (2/3) */}
              <div className="lg:col-span-2 space-y-6">
                <LastSimulationCard sim={lastSim} />
                <SimulationsTimeline simulations={simulations} />
              </div>

              {/* Sidebar droite (1/3) */}
              <div className="space-y-5">
                <ActionsSuggested sim={lastSim} />
                <ExpertCTA />

                {/* Lien vers toutes les simulations */}
                {simulations.length > 1 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Comparaison</div>
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      Comparez vos {simulations.length} simulations côte à côte avec l&apos;analyse narrative.
                    </p>
                    <Link href="/simulations"
                      className="block text-center text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2.5 rounded-xl hover:bg-blue-100 transition-colors">
                      Voir mes {simulations.length} simulations →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  )
}
