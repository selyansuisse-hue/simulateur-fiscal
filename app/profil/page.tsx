import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { Footer } from '@/components/ui/Footer'
import { ProfilForm } from './ProfilForm'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-surface">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="font-display text-2xl font-bold text-ink tracking-tight mb-8">Mon profil</h1>
          <ProfilForm user={{ id: user.id, email: user.email || '', full_name: profile?.full_name || '' }} />
        </div>
      </div>
      <Footer />
    </>
  )
}
