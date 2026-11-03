'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'

export interface SupplierItemMapping {
  id: string
  supplierId: string
  itemId: string
  item: { id: string; name: string; sku: string }
  supplierSku?: string | null
  unitPrice?: number | null
  leadTimeDays?: number | null
  isPreferred: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export async function getSupplierItems(
  supplierId: string
): Promise<ApiResponse<SupplierItemMapping[]>> {
  return api.get<SupplierItemMapping[]>(`/suppliers/${supplierId}/items`)
}

export async function addSupplierItem(
  supplierId: string,
  data: {
    itemId: string
    supplierSku?: string
    unitPrice?: number
    leadTimeDays?: number
    isPreferred?: boolean
    notes?: string
  }
): Promise<ApiResponse<SupplierItemMapping>> {
  return api.post<SupplierItemMapping>(`/suppliers/${supplierId}/items`, data)
}

export async function updateSupplierItem(
  supplierId: string,
  itemId: string,
  data: {
    supplierSku?: string
    unitPrice?: number
    leadTimeDays?: number
    isPreferred?: boolean
    notes?: string
  }
): Promise<ApiResponse<SupplierItemMapping>> {
  return api.patch<SupplierItemMapping>(`/suppliers/${supplierId}/items/${itemId}`, data)
}

export async function removeSupplierItem(
  supplierId: string,
  itemId: string
): Promise<ApiResponse<void>> {
  return api.delete<void>(`/suppliers/${supplierId}/items/${itemId}`)
}

/** A link the backend thinks is likely — nothing is written until the user
 * ticks it and it comes back through `bulkAddSupplierItems`. */
export interface SupplierItemSuggestion {
  itemId: string
  sku: string
  name: string
  brandName?: string | null
  source: 'purchase_history' | 'brand'
  suggestedUnitPrice?: number | null
  reason: string
}

export async function getSupplierItemSuggestions(
  supplierId: string
): Promise<ApiResponse<SupplierItemSuggestion[]>> {
  return api.get<SupplierItemSuggestion[]>(`/suppliers/${supplierId}/items/suggestions`)
}

export async function bulkAddSupplierItems(
  supplierId: string,
  items: { itemId: string; unitPrice?: number; notes?: string }[]
): Promise<ApiResponse<{ created: number; skipped: number }>> {
  return api.post<{ created: number; skipped: number }>(`/suppliers/${supplierId}/items/bulk`, {
    items,
  })
}
