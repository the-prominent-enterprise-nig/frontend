import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/human-resource',
  '/accounting',
  '/inventory',
  '/crm',
]
const AUTH_ROUTE_PREFIXES = ['/login']

function startsWithAny(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasAuthToken = Boolean(request.cookies.get('authToken')?.value)

  if (startsWithAny(pathname, AUTH_ROUTE_PREFIXES) && hasAuthToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (startsWithAny(pathname, PROTECTED_ROUTE_PREFIXES) && !hasAuthToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
