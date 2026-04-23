import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { SimulationsGrid } from '../dashboard/SimulationsGrid'
import { NarrativeAnalysis } from '@/components/simulations/NarrativeAnalysis'
import { EnrichedCompareTable } from '@/components/simulations/EnrichedCompareTable'

export default async function SimulationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: rawSims = [] } = await supabase
    .from('simulations')
    .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, best_ir, tmi, ca, situation, gain, params')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sims = (rawSims || []) as any[]

  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Mes simulations</h1>
              <p className="text-sm text-ink3 mt-0.5">
                {sims.length} simulation{sims.length > 1 ? 's' : ''} enregistrée{sims.length > 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/simulateur"
              className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-dark transition-all">
              + Nouvelle simulation
            </Link>
          </div>

          {sims.length >= 2 && (
            <>
              <NarrativeAnalysis simulations={sims} />
              <EnrichedCompareTable simulations={sims} />
            </>
          )}

          <SimulationsGrid initialSimulations={sims} />
        </div>
      </div>
      <Footer />
    </>
  )
}
