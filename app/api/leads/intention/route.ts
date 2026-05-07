import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * POST /api/leads/intention
 * Enregistre l'intention de changement du dirigeant (chaleur du lead).
 * Identifie le lead via simulationId (lead_simulations join).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await req.json()
    const { simulationId, intention } = body as {
      simulationId?: string
      intention?: string
    }

    if (!intention || !['urgent', 'reflechis', 'info'].includes(intention)) {
      return NextResponse.json({ error: 'intention invalide' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    if (simulationId) {
      // Trouver le lead via lead_simulations
      const { data: linkRow } = await supabaseAdmin
        .from('lead_simulations')
        .select('lead_id')
        .eq('simulation_id', simulationId)
        .maybeSingle()

      if (linkRow?.lead_id) {
        await supabaseAdmin
          .from('leads')
          .update({ intention, updated_at: new Date().toISOString() })
          .eq('id', linkRow.lead_id)
      }
    } else {
      // Fallback : trouver le lead par email de l'user dans belho-xper
      const { data: cabinet } = await supabaseAdmin
        .from('cabinets')
        .select('id')
        .eq('slug', 'belho-xper')
        .single()

      if (cabinet && user.email) {
        await supabaseAdmin
          .from('leads')
          .update({ intention, updated_at: new Date().toISOString() })
          .eq('cabinet_id', cabinet.id)
          .eq('email', user.email)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads/intention] Exception:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
