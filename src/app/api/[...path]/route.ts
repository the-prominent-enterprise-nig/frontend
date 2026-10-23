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

  // Surfaces the endpoints that dominate Fast Origin Transfer in the Vercel
  // function logs, so oversized list payloads get found instead of guessed at.
  const upstreamBytes = Number(res.headers.get('content-length'))
  if (upstreamBytes > LARGE_RESPONSE_WARN_BYTES) {
    console.warn(
      `[api proxy] large response: ${req.method} /${path.join('/')} ${(upstreamBytes / 1024 / 1024).toFixed(1)} MB`
    )
  }

  // Pass through binary (e.g. PDFs) as a stream; everything else as-is
  const respHeaders = new Headers()
  res.headers.forEach((value, key) => {
    // Don't forward hop-by-hop or encoding headers — they confuse Next. Node's
    // fetch has already decoded the upstream body, so a forwarded
    // `content-encoding` would describe bytes we are no longer sending.
    if (['transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase()))
      return
    respHeaders.set(key, value)
  })

  // Because the body above is decoded, everything leaving this function used
  // to be uncompressed — and every byte of it is billed as Fast Origin Transfer
  // (function → CDN). Re-compress text responses so list payloads cost a
  // fraction of that.
  if (res.body && shouldCompress(req, res)) {
    respHeaders.set('content-encoding', 'gzip')
    respHeaders.append('vary', 'Accept-Encoding')
    return new NextResponse(res.body.pipeThrough(new CompressionStream('gzip')), {
      status: res.status,
      headers: respHeaders,
    })
  }

  return new NextResponse(res.body, { status: res.status, headers: respHeaders })
}

// JSON / text / CSV only — PDFs, images and the like are already compact or
// are consumed as-is, and tiny responses aren't worth the CPU.
const COMPRESSIBLE_TYPE = /^(application\/(json|[\w.+-]+\+json|csv|xml)|text\/)/i
const MIN_COMPRESS_BYTES = 1024
const LARGE_RESPONSE_WARN_BYTES = 1024 * 1024

function shouldCompress(req: NextRequest, res: Response): boolean {
  if (req.method === 'HEAD' || res.status === 204 || res.status === 304) return false
  if (!/\bgzip\b/i.test(req.headers.get('accept-encoding') ?? '')) return false
  if (!COMPRESSIBLE_TYPE.test(res.headers.get('content-type') ?? '')) return false
  // Upstream content-length describes the *compressed* upstream body when the
  // backend gzips, so it is only a lower bound — good enough to skip the tiny ones.
  const upstreamLength = Number(res.headers.get('content-length'))
  if (upstreamLength > 0 && upstreamLength < MIN_COMPRESS_BYTES) return false
  return true
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
