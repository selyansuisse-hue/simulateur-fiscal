import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CabinetSidebar } from '@/components/cabinet/CabinetSidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: membre } = await supabase
    .from('cabinet_membres')
    .select('cabinet_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membre) redirect('/')

  const { data: cabinet } = await supabase
    .from('cabinets')
    .select('*')
    .eq('id', membre.cabinet_id)
    .single()

  if (!cabinet) redirect('/')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060d1a' }}>
      <CabinetSidebar cabinet={cabinet} />
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
