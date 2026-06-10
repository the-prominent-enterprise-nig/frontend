'use server'

import { api } from '@/src/libs/api/client'
import type { BarcodeRecord } from '@/src/schema/inventory/barcodes'

export async function getItemBarcodes(itemId: string) {
  return api.get<BarcodeRecord[]>(`/inventory/items/${itemId}/barcodes`)
}
