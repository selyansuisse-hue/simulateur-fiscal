import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { SimulationsGrid } from './SimulationsGrid'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: simulations = [] } = await supabase
    .from('simulations')
    .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, best_ir, tmi, ca, situation, gain')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const profile = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const firstName = (profile.data?.full_name || user.email || 'vous').split(' ')[0]

  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-surface">
        <div className="bg-navy border-b border-white/[0.05]">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="text-[10.5px] font-semibold tracking-widest uppercase text-blue-mid mb-2">Dashboard</div>
            <h1 className="font-display text-3xl font-black text-white tracking-tight mb-1">
              Bonjour {firstName} 👋
            </h1>
            <p className="text-sm text-white/40">Vos simulations fiscales sauvegardées.</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-10">
          <DashboardStats simulations={simulations || []} />

          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-ink tracking-tight">Mes simulations</h2>
            <Link
              href="/simulateur"
              className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg
                shadow-[0_2px_6px_rgba(29,78,216,.3)] hover:bg-blue-dark transition-all"
            >
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
