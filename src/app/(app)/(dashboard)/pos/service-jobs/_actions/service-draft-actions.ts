'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  CreateServiceDraftFormSchema,
  UpdateServiceDraftFormSchema,
} from '@/src/schema/pos/service-drafts'
import type { ServiceDraft, ServiceDraftListResponse } from '@/src/schema/pos/service-drafts'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

// Mirrors src/app/(app)/(dashboard)/inventory/purchase-requests/_actions —
// plain 'use server' functions with their own session/permission check,
// Schema.safeParse(input), api.<verb>(), and revalidatePath on success. Not
// the next-safe-action/authAction pattern — this module and POS both use
// this simpler page-local pattern instead.

type Params = {
  page?: number
  limit?: number
  status?: string
  branchId?: string
}

export async function getServiceDrafts(
  params: Params = {}
): Promise<ApiResponse<ServiceDraftListResponse>> {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    status: params.status,
    branchId: params.branchId,
  }

  return api.get<ServiceDraftListResponse>('/pos/service-drafts', query)
}

export async function getServiceDraft(id: string): Promise<ApiResponse<ServiceDraft>> {
  return api.get<ServiceDraft>(`/pos/service-drafts/${id}`)
}

export async function createServiceDraft(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, POS_PERMISSIONS.SERVICE_DRAFTS_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to create service jobs',
    }
  }

  const parsed = CreateServiceDraftFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/pos/service-drafts', parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create service job',
      message: msg || errStr || 'Failed to create service job',
    }
  }

  revalidatePath('/pos/service-jobs')

  return {
    success: true,
    data: result.data,
    message: 'Service job created successfully',
  }
}

export async function updateServiceDraft(
  id: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, POS_PERMISSIONS.SERVICE_DRAFTS_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update service jobs',
    }
  }

  const parsed = UpdateServiceDraftFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ id: string }>(`/pos/service-drafts/${id}`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update service job',
      message: msg || errStr || 'Failed to update service job',
    }
  }

  revalidatePath('/pos/service-jobs')

  return {
    success: true,
    data: result.data,
    message: 'Service job updated successfully',
  }
}

export async function cancelServiceDraft(id: string): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, POS_PERMISSIONS.SERVICE_DRAFTS_CANCEL)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to cancel service jobs',
    }
  }

  const result = await api.post<{ id: string }>(`/pos/service-drafts/${id}/cancel`)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to cancel service job',
      message: msg || errStr || 'Failed to cancel service job',
    }
  }

  revalidatePath('/pos/service-jobs')

  return {
    success: true,
    data: result.data,
    message: 'Service job cancelled',
  }
}
