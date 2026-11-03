'use server'

import { revalidatePath } from 'next/cache'
import { type ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { AgingLoadStatus, AgingPreview } from '@/src/schema/crm/aging-load'
import { humanizeOpeningImportError } from './opening-balance-errors'

/** Same pair the backend accepts: creating an installment account or an AR
 * invoice is what loading the aging does. */
const AGING_LOAD_PERMISSIONS = [
  CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_CREATE,
  ACCOUNTING_PERMISSIONS.AR_INVOICES_CREATE,
]

async function call<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: FormData }
): Promise<ApiResponse<T>> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!canAny(session, AGING_LOAD_PERMISSIONS)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to load the aging',
    }
  }

  const { cookies } = await import('next/headers')
  const authToken = (await cookies()).get('authToken')?.value
  const apiUrl = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

  try {
    const response = await fetch(`${apiUrl}/accounting/opening-balances/ar-aging${path}`, {
      method: init.method,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: init.body,
      cache: 'no-store',
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

function fileBody(formData: FormData): FormData | ApiResponse<never> {
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'No file provided', message: 'A CSV file is required' }
  }
  const body = new FormData()
  body.append('file', file, file.name)
  return body
}

/** Dry run — reads the sheet and reports what each row would do. Writes
 * nothing. FormData field: `file` (CSV, or the same gzipped). */
export async function previewAgingLoad(formData: FormData): Promise<ApiResponse<AgingPreview>> {
  const body = fileBody(formData)
  if (!(body instanceof FormData)) return body
  return call<AgingPreview>('/preview', { method: 'POST', body })
}

/** Starts the real load — re-sends the same file once the preview has been
 * read. Returns at once; poll getAgingLoadStatus for progress. */
export async function startAgingLoad(formData: FormData): Promise<ApiResponse<AgingLoadStatus>> {
  const body = fileBody(formData)
  if (!(body instanceof FormData)) return body
  return call<AgingLoadStatus>('', { method: 'POST', body })
}

export async function getAgingLoadStatus(jobId: string): Promise<ApiResponse<AgingLoadStatus>> {
  const res = await call<AgingLoadStatus>(`/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' })
  if (res.success && res.data?.state === 'done') {
    revalidatePath('/crm/installment-accounts')
    revalidatePath('/crm/installment-accounts/aging-report')
  }
  return res
}
