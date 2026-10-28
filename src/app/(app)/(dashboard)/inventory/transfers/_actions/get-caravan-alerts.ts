'use server'

import { z } from 'zod'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CaravanAlertSchema, type CaravanAlert } from '@/src/schema/inventory/warehouses'

const CaravanAlertsResponseSchema = z.object({ data: z.array(CaravanAlertSchema) })

/**
 * Scenario 60 Part 3 — running caravans and ended ones still holding stock.
 * A branch-restricted caller only ever gets the caravans their own branch
 * hosts (server-side); `hostBranchId` narrows an unrestricted one, e.g. the
 * POS passing its terminal's branch. `includeEnded` keeps ended caravans
 * that have been emptied (closed ones included) — the Caravan tab lists them.
 */
export async function getCaravanAlerts(
  hostBranchId?: string,
  includeEnded = false
): Promise<ApiResponse<CaravanAlert[]>> {
  const result = await api.get<unknown>('/inventory/caravans/alerts', {
    hostBranchId,
    includeEnded: includeEnded || undefined,
  })
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to load caravan alerts' }
  }
  const parsed = CaravanAlertsResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Unexpected caravan alerts response' }
  }
  return { success: true, data: parsed.data.data }
}
