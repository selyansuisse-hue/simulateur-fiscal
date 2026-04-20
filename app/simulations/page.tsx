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

  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Mes simulations</h1>
              <p className="text-sm text-ink3 mt-0.5">{(simulations || []).length} simulation(s) enregistrée(s)</p>
            </div>
            <Link href="/simulateur" className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-dark transition-all">
              + Nouvelle simulation
            </Link>
          </div>
          <SimulationsGrid initialSimulations={simulations || []} />
        </div>
      </div>
      <Footer />
    </>
  )
}
