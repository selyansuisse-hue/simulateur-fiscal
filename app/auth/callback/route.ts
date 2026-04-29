import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: ResponseCookie }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      let destination = next
      if (next === '/dashboard') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: membre } = await supabase
            .from('cabinet_membres')
            .select('cabinets(slug)')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()
          const cabs = membre?.cabinets
          const slug = Array.isArray(cabs)
            ? (cabs as { slug: string }[])[0]?.slug
            : (cabs as unknown as { slug: string } | null)?.slug
          if (slug) destination = `/cabinet/${slug}`
        }
      }
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin
      return NextResponse.redirect(`${appUrl}${destination}`)
    }
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || origin}/auth/login?error=auth_callback_failed`)
}
