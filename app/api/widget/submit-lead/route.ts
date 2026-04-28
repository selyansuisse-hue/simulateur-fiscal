import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      cabinet_id, nom, email, telephone,
      ca_simule, structure_recommandee, net_annuel, score,
      simulation_data, statut, source,
    } = body

    if (!cabinet_id || !email) {
      return NextResponse.json({ error: 'cabinet_id et email sont requis' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Insérer le lead
    const { data: lead, error } = await supabase.from('leads').insert({
      cabinet_id, nom, email, telephone,
      ca_simule, structure_recommandee, net_annuel, score,
      simulation_data, statut: statut || 'nouveau', source: source || 'widget',
    }).select().single()

    if (error) {
      console.error('Lead insert error:', error)
      return NextResponse.json({ error: 'Erreur insertion lead' }, { status: 500 })
    }

    // Récupérer l'email du cabinet pour notification
    const { data: cabinet } = await supabase
      .from('cabinets').select('nom, email_contact, slug').eq('id', cabinet_id).single()

    // Déclencher notification email (edge function Supabase si déployée)
    if (cabinet && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-cabinet`
        await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ lead_id: lead.id, cabinet_id, cabinet }),
        })
      } catch {
        // Edge function optionnelle, ne pas bloquer si non déployée
      }
    }

    return NextResponse.json({ success: true, lead_id: lead.id })
  } catch (err) {
    console.error('submit-lead error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
