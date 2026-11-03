'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'

export type ProviderCoverage = {
  uncovered: { serialNumber: string; itemName: string; hasSuppliersOnFile: boolean }[]
}

/** Which of these units' items don't list this provider as a supplier.
 *  Advisory: the provider pickers warn on it; nothing is refused. */
export async function checkUdsProvider(
  supplierId: string,
  serialIds: string[]
): Promise<ApiResponse<ProviderCoverage>> {
  const params = new URLSearchParams({ supplierId, serialIds: serialIds.join(',') })
  return api.get<ProviderCoverage>(`/inventory/uds/provider-check?${params}`)
}

/** Suppliers on file for every item on the ticket — listed first in the picker. */
export async function getUdsProviderOptions(
  serialIds: string[]
): Promise<ApiResponse<{ supplierIds: string[] }>> {
  const params = new URLSearchParams({ serialIds: serialIds.join(',') })
  return api.get<{ supplierIds: string[] }>(`/inventory/uds/provider-options?${params}`)
}
