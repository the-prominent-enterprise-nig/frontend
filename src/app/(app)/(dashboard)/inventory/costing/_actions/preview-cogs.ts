'use server'

import { api } from '@/src/libs/api/client'
import type { CogsPreview } from '@/src/schema/inventory/costing'

export async function previewCogs(params: {
  itemId: string
  warehouseId: string
  quantity: number
}) {
  return api.get<CogsPreview>('/inventory/costing/preview', params)
}
