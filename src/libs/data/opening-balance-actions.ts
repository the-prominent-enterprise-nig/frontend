'use server'

import { revalidatePath } from 'next/cache'
import { type ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type {
  OpeningImportResult,
  OpeningKind,
  OpeningPreview,
  OpeningRowData,
} from '@/src/schema/accounting/opening-balances'
import { humanizeOpeningImportError } from './opening-balance-errors'

const KINDS: Record<OpeningKind, { permission: string; revalidate: string }> = {
  'ap-bills': {
    permission: ACCOUNTING_PERMISSIONS.AP_BILLS_CREATE,
    revalidate: '/accounting/ap-bills',
  },
  'cash-advances': {
    permission: ACCOUNTING_PERMISSIONS.EXPENSE_CREATE,
    revalidate: '/accounting/special-accounts',
  },
}

async function send<T>(
  kind: OpeningKind,
  path: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, KINDS[kind].permission)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to load opening balances',
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'No file provided', message: 'A CSV file is required' }
  }

  const { cookies } = await import('next/headers')
  const authToken = (await cookies()).get('authToken')?.value
  const apiUrl = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

  const body = new FormData()
  body.append('file', file, file.name)
  body.append('asOfDate', String(formData.get('asOfDate') ?? ''))
  const offset = String(formData.get('offsetAccountId') ?? '')
  if (offset) body.append('offsetAccountId', offset)

  try {
    const response = await fetch(`${apiUrl}/accounting/opening-balances/${path}`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body,
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const raw = data?.message
      const message = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : undefined
      return {
        success: false,
        error: 'import_failed',
        message:
          humanizeOpeningImportError(message) ?? `Upload failed with status ${response.status}`,
      }
    }
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'invalid_response',
        message: 'Unexpected response from server',
      }
    }
    return { success: true, data: data as T }
  } catch (error) {
    return {
      success: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

/** Dry run — reads the CSV and reports what each row would do. Writes nothing.
 * FormData fields: `file`, `asOfDate`, `offsetAccountId` (optional). */
export async function previewOpeningBalance(
  kind: OpeningKind,
  formData: FormData
): Promise<ApiResponse<OpeningPreview<OpeningRowData>>> {
  return send<OpeningPreview<OpeningRowData>>(kind, `${kind}/preview`, formData)
}

/** The real load — re-sends the same file once the user has read the preview.
 * All rows are written, or none. */
export async function commitOpeningBalance(
  kind: OpeningKind,
  formData: FormData
): Promise<ApiResponse<OpeningImportResult>> {
  const res = await send<OpeningImportResult>(kind, kind, formData)
  if (res.success) revalidatePath(KINDS[kind].revalidate)
  return res
}
