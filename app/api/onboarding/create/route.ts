import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nom, slug: rawSlug, email_contact, plan, telephone } = body

    if (!nom || !email_contact) {
      return NextResponse.json({ error: 'nom et email_contact sont requis' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const adminClient = await createAdminClient()

    const baseSlug = rawSlug || slugify(nom)
    let slug = baseSlug
    let attempt = 0
    while (attempt < 10) {
      const { data: existing } = await adminClient.from('cabinets').select('id').eq('slug', slug).maybeSingle()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const { data: cabinet, error: cabinetError } = await adminClient
      .from('cabinets')
      .insert({
        nom,
        slug,
        email_contact,
        plan: plan || 'starter',
        telephone: telephone || null,
        couleur_principale: '#3B82F6',
        couleur_secondaire: '#8B5CF6',
        actif: true,
      })
      .select()
      .single()

    if (cabinetError) {
      console.error('Cabinet insert error:', cabinetError)
      return NextResponse.json({ error: cabinetError.message }, { status: 500 })
    }

    const { error: membreError } = await adminClient.from('cabinet_membres').insert({
      cabinet_id: cabinet.id,
      user_id: user.id,
      role: 'admin',
    })

    if (membreError) {
      console.error('Membre insert error:', membreError)
    }

    return NextResponse.json({ success: true, slug: cabinet.slug, cabinet_id: cabinet.id })
  } catch (err) {
    console.error('onboarding/create error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
