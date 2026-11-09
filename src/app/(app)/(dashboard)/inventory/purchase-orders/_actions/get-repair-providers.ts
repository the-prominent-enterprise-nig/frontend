'use server'

import type { ApiResponse } from '@/src/libs/api/client'
import { getSuppliers, type SupplierOption } from './get-suppliers'

export interface RepairProviders {
  data: SupplierOption[]
  total: number
  /** No supplier is marked a service center yet, so this is every supplier. */
  fallback: boolean
}

/**
 * Who can repair a unit: the suppliers marked as service centers, A–Z. Until
 * the tenant has marked any (the service center list not imported yet), every
 * supplier comes back instead with `fallback`, so the repair pickers are never
 * empty.
 */
export async function getRepairProviders(params?: {
  search?: string
}): Promise<ApiResponse<RepairProviders>> {
  const centers = await getSuppliers({ ...params, limit: 500, isServiceCenter: true })
  if (!centers.success || !centers.data) return { ...centers, data: undefined }
  if (centers.data.data.length > 0 || !(await noneMarked(params?.search))) {
    return { success: true, data: { ...sorted(centers.data.data), fallback: false } }
  }
  const all = await getSuppliers({ ...params, limit: 500 })
  if (!all.success || !all.data) return { ...all, data: undefined }
  return { success: true, data: { ...sorted(all.data.data), fallback: true } }
}

/** True when the tenant has no service center at all — not just none matching `search`. */
async function noneMarked(search?: string): Promise<boolean> {
  if (!search) return true
  const any = await getSuppliers({ limit: 1, isServiceCenter: true })
  return !!any.success && (any.data?.data.length ?? 0) === 0
}

function sorted(rows: SupplierOption[]): { data: SupplierOption[]; total: number } {
  return { data: [...rows].sort((a, b) => a.name.localeCompare(b.name)), total: rows.length }
}
