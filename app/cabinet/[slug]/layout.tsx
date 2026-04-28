import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CabinetSidebar } from '@/components/cabinet/CabinetSidebar'

export default async function CabinetLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/cabinet/${params.slug}`)
  }

  const { data: cabinet } = await supabase
    .from('cabinets')
    .select('*')
    .eq('slug', params.slug)
    .eq('actif', true)
    .single()

  if (!cabinet) notFound()

  const { data: membership } = await supabase
    .from('cabinet_membres')
    .select('role')
    .eq('cabinet_id', cabinet.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    redirect('/dashboard?error=unauthorized')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
      <CabinetSidebar cabinet={cabinet} />
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
