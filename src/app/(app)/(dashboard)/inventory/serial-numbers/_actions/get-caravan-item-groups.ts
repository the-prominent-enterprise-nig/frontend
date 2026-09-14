'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  CaravanItemGroupListResponseSchema,
  type CaravanItemGroupListResponse,
} from '@/src/schema/inventory/serial-numbers'

type Params = {
  page?: number
  limit?: number
  categoryId?: string
  status?: string
  search?: string
  // Same sentinel contract as getSerialNumbers: the backend resolves the real
  // branch server-side for a branch-restricted caller, so this only matters
  // for an unrestricted Business Owner checking a specific branch.
  consignedToBranchId?: string
}

// Scenario 08 (Caravan) — the "By Item" rollup. Counts come from the backend
// rather than from grouping a page of serials client-side, so they cover every
// consigned unit and not just the twenty currently on screen.
export async function getCaravanItemGroups(
  params: Params = {}
): Promise<ApiResponse<CaravanItemGroupListResponse>> {
  const result = await api.get<CaravanItemGroupListResponse>(
    '/inventory/serial-numbers/consigned-summary',
    {
      page: params.page,
      limit: params.limit,
      categoryId: params.categoryId,
      status: params.status,
      search: params.search,
      consignedToBranchId: params.consignedToBranchId,
    }
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch caravan items',
      message: result.message,
    }
  }

  const validated = CaravanItemGroupListResponseSchema.safeParse(result.data)
  if (!validated.success) {
    // Return raw data if shape differs slightly — backend evolves independently
    return { success: true, data: result.data as CaravanItemGroupListResponse }
  }

  return { success: true, data: validated.data }
}
