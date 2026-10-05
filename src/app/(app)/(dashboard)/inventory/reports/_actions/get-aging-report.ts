'use server'

import { api } from '@/src/libs/api/client'
import type { AgingReportResponse, SerialAgingBucket } from '@/src/schema/inventory/reports'

type Params = {
  warehouseId?: string
  categoryId?: string
  itemId?: string
  search?: string
  serialNumber?: string
  brandId?: string
  model?: string
  receivedFrom?: string
  receivedTo?: string
  bucket?: SerialAgingBucket
  page?: number
  limit?: number
}

export async function getAgingReport(params: Params = {}) {
  const query: Record<string, string | number | undefined> = {
    warehouseId: params.warehouseId,
    categoryId: params.categoryId,
    itemId: params.itemId,
    search: params.search,
    serialNumber: params.serialNumber,
    brandId: params.brandId,
    model: params.model,
    receivedFrom: params.receivedFrom,
    receivedTo: params.receivedTo,
    bucket: params.bucket,
    page: params.page,
    limit: params.limit,
  }

  return api.get<AgingReportResponse>('/inventory/reports/aging', query, {
    tags: ['inventory-report-aging'],
  })
}
