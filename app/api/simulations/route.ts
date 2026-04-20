import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  return NextResponse.json(data, { status: 201 })
}
