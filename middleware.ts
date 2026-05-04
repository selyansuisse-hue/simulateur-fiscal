import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

const PROTECTED = ['/profil', '/cabinet']
const ADMIN_ONLY = ['/admin']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: ResponseCookie }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  const isAdminOnly = ADMIN_ONLY.some(p => pathname.startsWith(p))
  if (isAdminOnly) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
    if (!adminEmails.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    // Cabinet member → redirect to their cabinet page after login
    // This is the ONLY place where a cabinet-specific redirect happens.
    // All other routes (/simulateur, /explorer, /simulations…) are freely accessible.
    const { data: membership } = await supabase
      .from('cabinet_membres')
      .select('cabinet_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership?.cabinet_id) {
      const { data: cabinet } = await supabase
        .from('cabinets')
        .select('slug')
        .eq('id', membership.cabinet_id)
        .maybeSingle()

      if (cabinet?.slug) {
        return NextResponse.redirect(new URL(`/cabinet/${cabinet.slug}`, request.url))
      }
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
