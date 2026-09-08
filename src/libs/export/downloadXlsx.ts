'use client'

import { showToast } from '@/src/components/ui/toast'

/**
 * Downloads a report's `.xlsx` from its `/export` endpoint (Scenario 47).
 *
 * Always browser-side, so it goes through the Next `/api/*` proxy — which
 * already streams binary through untouched (see src/app/api/[...path]/route.ts)
 * — and the httpOnly authToken cookie rides along automatically. The filename
 * comes from the backend's Content-Disposition so the app and the file agree
 * on the naming convention in one place.
 */
export async function downloadXlsx(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
  fallbackFilename = 'report.xlsx'
): Promise<boolean> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const qs = query.toString()
  const url = `/api${endpoint}${qs ? `?${qs}` : ''}`

  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch {
    showToast({
      title: 'Export failed',
      description: 'Could not reach the server.',
      status: 'error',
    })
    return false
  }

  if (!res.ok) {
    showToast({ title: 'Export failed', description: await readErrorMessage(res), status: 'error' })
    return false
  }

  const blob = await res.blob()
  triggerDownload(blob, filenameFromResponse(res) ?? fallbackFilename)
  return true
}

/** The backend sends a 400 with an actionable message for an over-cap export
 * (see MAX_EXPORT_ROWS) — surface that text rather than a generic failure. */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.message || body?.error || `Export failed (${res.status}).`
  } catch {
    return `Export failed (${res.status}).`
  }
}

function filenameFromResponse(res: Response): string | null {
  const header = res.headers.get('content-disposition')
  if (!header) return null
  const match = /filename="?([^";]+)"?/i.exec(header)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
