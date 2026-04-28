import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WidgetApp } from './WidgetApp'
import type { Cabinet } from '@/lib/types/cabinet'

export const dynamic = 'force-dynamic'

export default async function WidgetPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: cabinet } = await supabase
    .from('cabinets')
    .select('*')
    .eq('slug', params.slug)
    .eq('actif', true)
    .single()

  if (!cabinet) notFound()

  return <WidgetApp cabinet={cabinet as Cabinet} />
}
