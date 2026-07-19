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
