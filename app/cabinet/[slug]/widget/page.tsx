import { createClient } from '@/lib/supabase/server'
import { WidgetPreview } from '@/components/cabinet/WidgetPreview'
import type { Cabinet } from '@/lib/types/cabinet'

export default async function CabinetWidgetPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: cabinet } = await supabase
    .from('cabinets').select('*').eq('slug', params.slug).single()

  if (!cabinet) return null

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Widget</h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Intégrez le simulateur sur votre site web
        </p>
      </div>
      <div style={{ maxWidth: '800px' }}>
        <WidgetPreview cabinet={cabinet as Cabinet} />
      </div>
    </div>
  )
}
