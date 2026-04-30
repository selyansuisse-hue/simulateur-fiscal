import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
    const { data: membre } = await supabase
      .from('cabinet_membres')
      .select('cabinet_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membre) {
      const admin = await createAdminClient()
      const { data: cabinet } = await admin
        .from('cabinets')
        .select('id')
        .eq('slug', 'belho-xper')
        .single()

      if (cabinet) {
        const userName = (user.user_metadata?.full_name as string | undefined) || user.email || ''
        await admin.from('leads').upsert({
          cabinet_id: cabinet.id,
          email: user.email,
          nom: userName,
          ca_simule: body.ca,
          structure_recommandee: body.best_forme,
          net_annuel: body.best_net_annuel,
          score: body.score ?? null,
          simulation_data: { params: body.params, results: body.results },
          statut: 'nouveau',
          source: 'direct',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cabinet_id,email', ignoreDuplicates: false })
      }
    }
  } catch {
    // Non-bloquant : la simulation est déjà sauvegardée
  }

  return NextResponse.json(data, { status: 201 })
}
