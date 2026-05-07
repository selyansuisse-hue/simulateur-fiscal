import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('simulations')
    .select('id, name, created_at, best_forme, best_net_annuel, best_net_mois, tmi, ca, situation, gain')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()

  // Vérification limite 20 simulations
  const { count } = await supabase
    .from('simulations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count || 0) >= 20) {
    return NextResponse.json({ error: 'Limite de 20 simulations atteinte. Supprimez-en une pour continuer.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('simulations')
    .insert({
      user_id: user.id,
      name: body.name,
      params: body.params,
      results: body.results,
      best_forme: body.best_forme,
      best_net_annuel: body.best_net_annuel,
      best_net_mois: body.best_net_mois,
      best_ir: body.best_ir,
      tmi: body.tmi,
      ca: body.ca,
      situation: body.situation,
      parts: body.parts,
      per_montant: body.per_montant || 0,
      gain: body.gain,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-lead : si l'user n'est pas membre cabinet, créer/mettre à jour un lead belho-xper
  try {
    // Client admin direct (service role) — bypass RLS complet
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Vérifier que ce user n'est PAS membre cabinet
    const { data: estMembre } = await supabaseAdmin
      .from('cabinet_membres')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!estMembre) {
      // Récupérer le cabinet belho-xper
      const { data: cabinet } = await supabaseAdmin
        .from('cabinets')
        .select('id')
        .eq('slug', 'belho-xper')
        .single()

      if (cabinet) {
        const emailUser = user.email ?? null
        // Ne pas insérer si pas d'email (contrainte UNIQUE cabinet_id, email)
        if (emailUser) {
          const nom = (user.user_metadata?.full_name as string | undefined)
            ?? emailUser.split('@')[0]
            ?? 'Prospect'

          const now = new Date().toISOString()

          const { data: leadData, error: leadError } = await supabaseAdmin
            .from('leads')
            .upsert({
              cabinet_id: cabinet.id,
              email: emailUser,
              nom,
              user_id: user.id,
              ca_simule: body.ca ?? null,
              structure_recommandee: body.best_forme ?? null,
              net_annuel: body.best_net_annuel ?? null,
              score: body.gain ?? null,
              simulation_data: { params: body.params ?? {}, results: body.results ?? {} },
              statut: 'nouveau',
              source: 'simulation_enregistree',
              derniere_simulation: now,
              updated_at: now,
            }, { onConflict: 'cabinet_id,email', ignoreDuplicates: false })
            .select('id')
            .single()

          if (leadError) {
            console.error('[leads] Erreur upsert lead:', leadError)
          } else if (leadData?.id && data?.id) {
            // Lier la simulation au lead
            const { error: lsError } = await supabaseAdmin
              .from('lead_simulations')
              .upsert(
                { lead_id: leadData.id, simulation_id: data.id },
                { onConflict: 'lead_id,simulation_id', ignoreDuplicates: true }
              )
            if (lsError) console.error('[lead_simulations] Erreur upsert:', lsError)
          }
        }
      }
    }
  } catch (err) {
    // Non-bloquant : la simulation est déjà sauvegardée
    console.error('[leads] Exception lors de la création du lead:', err)
  }

  return NextResponse.json(data, { status: 201 })
}
