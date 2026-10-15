'use server'

import { z } from 'zod'
import { api, type ApiResponse } from '@/src/libs/api/client'
import {
  ServiceCenterOptionSchema,
  ServiceCenterUnitSchema,
  type ServiceCenterOption,
  type ServiceCenterUnit,
} from '@/src/schema/inventory/goods-receiving/service-center-units'

const BASE = '/inventory/uds/at-provider'

async function fetchParsed<T>(
  path: string,
  params: Record<string, string>,
  schema: z.ZodType<T>
): Promise<ApiResponse<T>> {
  const result = await api.get<unknown>(path, params)
  if (!result.success) {
    return { success: false, error: result.error || 'Request failed', message: result.message }
  }
  const parsed = schema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Unexpected response', message: parsed.error.message }
  }
  return { success: true, data: parsed.data }
}

/** Scenario 73 — the Service Center picker: suppliers holding units now. */
export async function getServiceCenters(): Promise<ApiResponse<ServiceCenterOption[]>> {
  return fetchParsed(`${BASE}/providers`, {}, z.array(ServiceCenterOptionSchema))
}

/** Scenario 73 — every unit out at one service center. */
export async function getServiceCenterUnits(
  repairProviderId: string
): Promise<ApiResponse<ServiceCenterUnit[]>> {
  return fetchParsed(BASE, { repairProviderId }, z.array(ServiceCenterUnitSchema))
}

/** Scenario 73 — "Unit not listed? Search by serial." (3+ characters). */
export async function searchServiceCenterSerials(
  repairProviderId: string,
  q: string
): Promise<ApiResponse<ServiceCenterUnit[]>> {
  return fetchParsed(
    `${BASE}/serial-search`,
    { repairProviderId, q },
    z.array(ServiceCenterUnitSchema)
  )
}
