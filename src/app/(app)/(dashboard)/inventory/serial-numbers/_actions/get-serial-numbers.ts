'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  SerialNumberListResponseSchema,
  type SerialNumberListResponse,
} from '@/src/schema/inventory/serial-numbers'

type Params = {
  page?: number
  limit?: number
  itemId?: string
  categoryId?: string
  warehouseId?: string
  status?: string
  search?: string
  // Scenario 08 (Caravan) Part 2 — "Caravan" view. Any value here
  // signals "show what's consigned to my branch" — the backend always
  // resolves the real branch server-side for a branch-restricted caller, so
  // the value itself only matters for an unrestricted Business Owner
  // explicitly checking a specific branch.
  consignedToBranchId?: string
  // "company": cross-branch availability, excludes the caller's own branch.
  // "override" (Scenario 29 SN-01): bypasses branch scoping entirely
  // (including the caller's own branch) — requires itemId and the
  // inventory:transfers:serial-override permission server-side.
  scope?: 'company' | 'override'
}

export async function getSerialNumbers(
  params: Params = {}
): Promise<ApiResponse<SerialNumberListResponse>> {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    categoryId: params.categoryId,
    warehouseId: params.warehouseId,
    status: params.status,
    search: params.search,
    consignedToBranchId: params.consignedToBranchId,
    scope: params.scope,
  }

  const result = await api.get<SerialNumberListResponse>('/inventory/serial-numbers', query)

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch serial numbers',
      message: result.message,
    }
  }

  const validated = SerialNumberListResponseSchema.safeParse(result.data)
  if (!validated.success) {
    // Return raw data if shape differs slightly — backend evolves independently
    return { success: true, data: result.data as SerialNumberListResponse }
  }

  return { success: true, data: validated.data }
}
