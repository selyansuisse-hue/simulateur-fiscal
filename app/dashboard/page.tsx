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
        <div className="bg-navy border-b border-white/[0.05] relative overflow-hidden">
          <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,.14) 0%, transparent 65%)', top: '-12rem', right: '-6rem' }} />
          <div className="max-w-6xl mx-auto px-6 py-12 relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px w-5 rounded-full bg-blue-mid" />
              <span className="text-[10.5px] font-bold tracking-[0.18em] uppercase text-blue-mid">Dashboard</span>
            </div>
            <h1 className="font-display text-[2.2rem] font-black text-white tracking-tight mb-2">
              Bonjour, {firstName}
            </h1>
            <p className="text-[14px] text-white/42 max-w-md leading-relaxed">
              Retrouvez et comparez toutes vos simulations fiscales sauvegardées.
            </p>
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
