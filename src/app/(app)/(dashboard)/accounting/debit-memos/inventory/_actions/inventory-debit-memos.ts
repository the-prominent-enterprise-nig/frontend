'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import {
  IdmDetailSchema,
  IdmFormSchema,
  IdmListSchema,
  type IdmDetail,
  type IdmFormValues,
  type IdmList,
  type IdmStatus,
} from '@/src/schema/accounting/inventory-debit-memos'
import { idmFailure } from '../_lib/idm-errors'
import type { PrintDocumentEnvelope } from '@/src/libs/print/printInventoryDocument'
import { INVENTORY_DEBIT_MEMO_ACCESS } from '@/src/libs/guards/shared-ownership'

const BASE = '/inventory-debit-memos'

async function allowed(permissions: string[]): Promise<boolean> {
  const session = await getSessionOrNull()
  return !!session && canAny(session, permissions)
}

const forbidden = <T>(): ApiResponse<T> => ({
  success: false,
  error: 'Forbidden',
  message: 'You do not have permission to do that',
})

function revalidate(id?: string): void {
  revalidatePath('/accounting/debit-memos')
  revalidatePath('/inventory/stock-transaction')
  if (id) revalidatePath(`/accounting/debit-memos/inventory/${id}`)
}

export async function getInventoryDebitMemos(params?: {
  status?: IdmStatus
  search?: string
  page?: number
  limit?: number
}): Promise<ApiResponse<IdmList>> {
  const result = await api.get<IdmList>(BASE, params)
  if (!result.success || !result.data) return { success: false, error: result.error, message: '' }
  const parsed = IdmListSchema.safeParse(result.data)
  if (!parsed.success) return { success: false, error: 'Invalid response from server', message: '' }
  return { success: true, data: parsed.data, message: '' }
}

export async function getInventoryDebitMemo(id: string): Promise<ApiResponse<IdmDetail>> {
  const result = await api.get<IdmDetail>(`${BASE}/${id}`)
  if (!result.success || !result.data) return { success: false, error: result.error, message: '' }
  const parsed = IdmDetailSchema.safeParse(result.data)
  if (!parsed.success) return { success: false, error: 'Invalid response from server', message: '' }
  return { success: true, data: parsed.data, message: '' }
}

function toBody(v: IdmFormValues): Record<string, unknown> {
  return {
    memoDate: v.memoDate,
    purpose: v.purpose || undefined,
    referenceNo: v.referenceNo.trim() || undefined,
    referenceDate: v.referenceDate || undefined,
    reason: v.reason.trim() || undefined,
    lines: v.lines.map((l) => ({
      accountId: l.accountId,
      description: l.description.trim() || undefined,
      debit: l.debit,
      credit: l.credit,
    })),
  }
}

/** Creates a standalone memo when there is no id, otherwise saves the draft. */
export async function saveInventoryDebitMemo(
  id: string | null,
  input: unknown
): Promise<ApiResponse<{ id: string; memoNumber: string }>> {
  const permission = id ? INVENTORY_DEBIT_MEMO_ACCESS.UPDATE : INVENTORY_DEBIT_MEMO_ACCESS.CREATE
  if (!(await allowed(permission))) return forbidden()
  const parsed = IdmFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', message: parsed.error.issues[0]?.message }
  }
  const body = toBody(parsed.data)
  const result = id
    ? await api.patch<{ id: string; memoNumber: string }>(`${BASE}/${id}`, body)
    : await api.post<{ id: string; memoNumber: string }>(BASE, body)
  if (!result.success || !result.data) return idmFailure(result, 'Failed to save the memo')
  revalidate(result.data.id)
  return { success: true, data: result.data, message: `${result.data.memoNumber} saved` }
}

export async function postInventoryDebitMemo(id: string): Promise<ApiResponse<{ id: string }>> {
  if (!(await allowed(INVENTORY_DEBIT_MEMO_ACCESS.APPROVE))) return forbidden()
  const result = await api.post(`${BASE}/${id}/post`)
  if (!result.success) return idmFailure(result, 'Failed to post the memo')
  revalidate(id)
  return { success: true, data: { id }, message: 'Posted' }
}

export async function voidInventoryDebitMemo(
  id: string,
  reason: string
): Promise<ApiResponse<{ id: string }>> {
  if (!(await allowed(INVENTORY_DEBIT_MEMO_ACCESS.VOID))) return forbidden()
  const result = await api.post(`${BASE}/${id}/void`, { reason: reason.trim() })
  if (!result.success) return idmFailure(result, 'Failed to void the memo')
  revalidate(id)
  return { success: true, data: { id }, message: 'Voided' }
}

export async function getInventoryDebitMemoDocument(
  id: string
): Promise<ApiResponse<PrintDocumentEnvelope>> {
  const result = await api.get<PrintDocumentEnvelope>(`${BASE}/${id}/document`)
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? 'Could not load the document', message: '' }
  }
  return { success: true, data: result.data, message: '' }
}
