'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  VehicleListResponseSchema,
  type VehicleListItem,
  type VehicleListResponse,
} from '@/src/schema/inventory/vehicles'

type Params = {
  q?: string
}

// The dispatch form's Plate suggestions: every vehicle on the roster, any
// branch — not scoped to the branch the stock leaves from or to the caller's
// own. A short list — it is a type-ahead, not a page.
export async function searchVehicles(params: Params = {}): Promise<ApiResponse<VehicleListItem[]>> {
  const result = await api.get<VehicleListResponse>('/inventory/vehicles/lookup', {
    q: params.q,
    limit: 20,
  })

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch vehicles',
      message: result.message,
    }
  }

  const validated = VehicleListResponseSchema.safeParse(result.data)
  return { success: true, data: validated.success ? validated.data.data : result.data.data }
}
