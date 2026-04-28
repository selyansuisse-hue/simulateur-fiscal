import { createClient } from '@/lib/supabase/server'
import { LeadTable } from '@/components/cabinet/LeadTable'
import type { Lead } from '@/lib/types/cabinet'

export default async function CabinetLeadsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  const { data: cabinet } = await supabase
    .from('cabinets')
    .select('id, nom')
    .eq('slug', params.slug)
    .single()

  const { data: rawLeads = [] } = cabinet
    ? await supabase
        .from('leads')
        .select('*')
        .eq('cabinet_id', cabinet.id)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [] }

  const leads = (rawLeads || []) as Lead[]

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
          Leads
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Prospects ayant utilisé votre simulateur
        </p>
      </div>
      <LeadTable initialLeads={leads} cabinetId={cabinet?.id || ''} />
    </div>
  )
}
