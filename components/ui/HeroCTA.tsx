'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

export function HeroCTA() {
  const [cabinetSlug, setCabinetSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: membre } = await supabase
        .from('cabinet_membres')
        .select('cabinets(slug)')
        .eq('user_id', data.user.id)
        .limit(1)
        .maybeSingle()
      const slug = (membre?.cabinets as { slug: string } | null)?.slug
      if (slug) setCabinetSlug(slug)
    })
  }, [])

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <Link href="/simulateur"
        className="inline-flex items-center gap-2 font-bold text-[15px] text-white rounded-xl px-8 py-4 transition-all duration-150 hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 8px 32px rgba(29,78,216,0.55)' }}>
        ✦ Lancer la simulation gratuite
      </Link>
      {cabinetSlug ? (
        <Link href={`/cabinet/${cabinetSlug}`}
          className="inline-flex items-center gap-2 font-semibold text-[15px] text-white rounded-xl px-7 py-4 transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1.5px solid rgba(139,92,246,0.35)' }}>
          🏢 Accéder au dashboard →
        </Link>
      ) : (
        <Link href="/auth/signup"
          className="inline-flex items-center gap-2 font-semibold text-[15px] text-white rounded-xl px-7 py-4 transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)' }}>
          Créer un compte →
        </Link>
      )}
    </div>
  )
}
