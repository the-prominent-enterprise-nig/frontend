import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const upstream = await fetch(`${API_BASE_URL}/payslips/${id}/download`, {
    headers: { Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  })

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}))
    return NextResponse.json(
      { error: body.message || body.error || 'Download failed' },
      { status: upstream.status }
    )
  }

  const buffer = await upstream.arrayBuffer()
  const contentType = upstream.headers.get('content-type') || 'application/pdf'
  const contentDisposition =
    upstream.headers.get('content-disposition') || `attachment; filename="payslip-${id}.pdf"`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
    },
  })
}
