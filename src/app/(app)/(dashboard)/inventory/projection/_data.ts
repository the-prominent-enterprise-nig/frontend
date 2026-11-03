import { api } from '@/src/libs/api/client'
import { settle, type Settled } from '@/src/libs/api/unwrap'
import {
  ProjectionSummaryResponseSchema,
  type ProjectionSummaryResponse,
  type StockoutAlert,
} from '@/src/schema/inventory/projection'
import { getStockoutAlerts } from './_actions/get-stockout-alerts'
import { PER_PAGE, type ProjectionParams } from './_params'

/**
 * One page of the projection in the lean `summary` shape. Server-side only
 * (called from Server Components); the response is validated before it reaches
 * the markup. Never throws, so it is safe to start without awaiting.
 */
export async function fetchProjection(
  params: ProjectionParams
): Promise<Settled<ProjectionSummaryResponse>> {
  const result = await settle(
    api.get<unknown>('/inventory/projection', {
      view: 'summary',
      days: params.days,
      warehouseId: params.warehouseId,
      limit: PER_PAGE,
      offset: (params.page - 1) * PER_PAGE,
    })
  )
  if (!result.ok) return result

  const parsed = ProjectionSummaryResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    console.error('Projection response shape mismatch:', parsed.error.flatten())
    return { ok: false, error: 'Unexpected response shape' }
  }
  return { ok: true, data: parsed.data }
}

export async function fetchStockoutAlerts(
  params: ProjectionParams
): Promise<Settled<StockoutAlert[]>> {
  const result = await settle(
    getStockoutAlerts({ days: params.days, warehouseId: params.warehouseId })
  )
  return result.ok ? { ok: true, data: result.data.data } : result
}
