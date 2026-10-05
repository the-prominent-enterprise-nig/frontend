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
  // One caravan's id, or 'caravan' for every caravan — same contract as
  // getSerialNumbers. A branch-restricted caller only ever sees caravans
  // their own branch hosts, enforced server-side.
  caravanId?: string
}

// Scenario 60 — the Caravan tab's "By Item" rollup. Counts come from the
// backend rather than from grouping a page of serials client-side, so they
// cover every unit out at caravans and not just the twenty on screen.
export async function getCaravanItemGroups(
  params: Params = {}
): Promise<ApiResponse<CaravanItemGroupListResponse>> {
  const result = await api.get<CaravanItemGroupListResponse>(
    '/inventory/serial-numbers/caravan-summary',
    {
      page: params.page,
      limit: params.limit,
      categoryId: params.categoryId,
      status: params.status,
      search: params.search,
      caravanId: params.caravanId,
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
