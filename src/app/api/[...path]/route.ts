import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Catch-all proxy: forwards /api/* (except routes that have their own handler
 * like /api/users/me) to the backend with the access token attached.
 *
 * Reads the `authToken` cookie set by the login server action (`login.ts`)
 * and forwards it to the backend as a Bearer token. This is what lets client
 * components call `apiClient('/accounts')` safely from the browser.
 */

const BACKEND_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('authToken')?.value

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const search = req.nextUrl.search
  const url = `${BACKEND_URL}/${path.join('/')}${search}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }
  const contentType = req.headers.get('content-type')
  if (contentType) headers['content-type'] = contentType

  // Forward real client IP so the backend can record it in audit logs
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip')
  if (clientIp) headers['x-forwarded-for'] = clientIp

  // Read body for methods that have one
  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text()
  }

  let res: Response
  try {
    res = await fetch(url, { method: req.method, headers, body, cache: 'no-store' })
  } catch (err) {
    console.error('[api proxy] upstream fetch failed:', url, err)
    return NextResponse.json(
      { error: 'Backend unreachable', message: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }

  // Pass through binary (e.g. PDFs) as a stream; everything else as-is
  const respHeaders = new Headers()
  res.headers.forEach((value, key) => {
    // Don't forward hop-by-hop or encoding headers — they confuse Next
    if (['transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase()))
      return
    respHeaders.set(key, value)
  })

  return new NextResponse(res.body, { status: res.status, headers: respHeaders })
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
