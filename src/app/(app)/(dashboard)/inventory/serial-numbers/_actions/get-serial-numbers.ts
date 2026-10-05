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
  brandId?: string
  warehouseId?: string
  // Scenario 50 — multi-location scoping, so the Item 360 Serials tab can
  // honour a several-branch filter. Singular `warehouseId` stays for callers
  // that mean exactly one.
  branchIds?: string[]
  warehouseIds?: string[]
  status?: string
  // Stock classification — several are OR-ed server-side.
  classification?: string[]
  search?: string
  // Scenario 55 Part 4 — auto-resolving which of this item's sold serials
  // belongs to a picked InstallmentAccount's customer, so a repossession
  // line's serial can be found from the account rather than the other way
  // around.
  soldToCustomerId?: string
  // Scenario 60 — the Caravan tab: one caravan's id, or 'caravan' for every
  // caravan. Lists units sitting in caravan warehouses; a branch-restricted
  // caller only ever sees caravans their own branch hosts (server-side).
  caravanId?: string
  // "company": cross-branch availability, excludes the caller's own branch.
  // "override" (Scenario 29 SN-01): bypasses branch scoping entirely
  // (including the caller's own branch) — requires itemId and the
  // inventory:transfers:serial-override permission server-side.
  scope?: 'company' | 'override'
  // Scenario 56 — leave out units already claimed by an open transfer, so a
  // transfer picker (or its availability count) never offers one.
  freeForTransfer?: boolean
  // Scenario 56 — the Stock Balance Operations filter, carried into Item 360.
  region?: 'panay' | 'negros'
}

export async function getSerialNumbers(
  params: Params = {}
): Promise<ApiResponse<SerialNumberListResponse>> {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    itemId: params.itemId,
    categoryId: params.categoryId,
    brandId: params.brandId,
    warehouseId: params.warehouseId,
    branchIds: params.branchIds?.length ? params.branchIds.join(',') : undefined,
    warehouseIds: params.warehouseIds?.length ? params.warehouseIds.join(',') : undefined,
    status: params.status,
    search: params.search,
    classification: params.classification?.length ? params.classification.join(',') : undefined,
    soldToCustomerId: params.soldToCustomerId,
    caravanId: params.caravanId,
    scope: params.scope,
    freeForTransfer: params.freeForTransfer ? 'true' : undefined,
    region: params.region,
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
