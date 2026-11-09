'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { PriceListListResponse } from '@/src/schema/inventory/price-lists'

type Params = {
  page?: number
  limit?: number
  search?: string
  status?: string
  // Retired lists (inactive/expired) have no hard-delete, so anything ever
  // deactivated — a real lapsed price list, or Playwright test fixtures —
  // stays in the table forever. Default to hiding them so the working view
  // only shows what's actually live or actionable; pass true to see everything.
  includeInactive?: boolean
}

const RETIRED_STATUSES = ['inactive', 'expired']

function visibleRows(
  rows: PriceListListResponse['data'],
  includeInactive: boolean | undefined
): PriceListListResponse['data'] {
  return includeInactive ? rows : rows.filter((pl) => !RETIRED_STATUSES.includes(pl.status))
}

export async function getPriceLists(
  params: Params = {}
): Promise<ApiResponse<PriceListListResponse>> {
  try {
    const result = await api.get('/inventory/price-lists', {
      search: params.search,
      status: params.status,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch price lists',
        message: result.message,
      }
    }

    const raw = result.data
    const page = params.page ?? 1
    const limit = params.limit ?? 20

    if (Array.isArray(raw)) {
      const filtered = visibleRows(raw, params.includeInactive)
      const start = (page - 1) * limit
      return {
        success: true,
        data: { data: filtered.slice(start, start + limit), total: filtered.length, page, limit },
      }
    }

    if (raw && Array.isArray((raw as PriceListListResponse).data)) {
      const paginated = raw as PriceListListResponse
      const filtered = visibleRows(paginated.data, params.includeInactive)
      return {
        success: true,
        data: { ...paginated, data: filtered, total: filtered.length },
      }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse price lists response',
    }
  } catch (error) {
    console.error('Error fetching price lists:', error)
    return {
      success: false,
      error: 'Failed to fetch price lists',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
