import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * POST /api/leads/from-signup
 * Crée un lead dans le cabinet belho-xper lors d'une inscription.
 * Utilise le service role key pour bypasser RLS.
 * Non-bloquant : les erreurs ne font pas échouer le signup.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, fullName, userId } = body as {
      email?: string
      fullName?: string
      userId?: string
    }

    if (!email) {
      return NextResponse.json({ error: 'email requis' }, { status: 400 })
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Récupérer le cabinet belho-xper
    const { data: cabinet } = await supabaseAdmin
      .from('cabinets')
      .select('id')
      .eq('slug', 'belho-xper')
      .single()

    if (!cabinet) {
      return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 404 })
    }

    const nom = fullName || email.split('@')[0] || 'Prospect'

    const { error: leadError } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          cabinet_id: cabinet.id,
          email,
          nom,
          ...(userId ? { user_id: userId } : {}),
          statut: 'nouveau',
          source: 'inscription',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'cabinet_id,email', ignoreDuplicates: false }
      )

    if (leadError) {
      console.error('[from-signup] Erreur upsert lead:', leadError)
      return NextResponse.json({ error: leadError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[from-signup] Exception:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
