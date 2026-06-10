'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function bulkAssignTaxRate(
  taxRateId: string
): Promise<ApiResponse<{ updated: number; failed: number }>> {
  if (!taxRateId) {
    return { success: false, error: 'Tax rate ID is required' }
  }

  const allItemIds: string[] = []
  let page = 1
  const limit = 500

  while (true) {
    const res = await api.get<{ data: Array<{ id: string; taxRateId?: string | null }> }>(
      '/inventory/items',
      { page, limit }
    )
    if (!res.success || !res.data) break
    const items = res.data.data ?? []
    for (const item of items) {
      if (!item.taxRateId) allItemIds.push(item.id)
    }
    if (items.length < limit) break
    page++
  }

  if (allItemIds.length === 0) {
    return {
      success: true,
      data: { updated: 0, failed: 0 },
      message: 'All items already have a tax rate.',
    }
  }

  let updated = 0
  let failed = 0
  await Promise.all(
    allItemIds.map(async (id) => {
      const res = await api.patch(`/inventory/items/${id}`, { taxRateId })
      if (res.success) updated++
      else failed++
    })
  )

  revalidatePath('/inventory/items')
  return {
    success: true,
    data: { updated, failed },
    message: `Applied to ${updated} item${updated !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`,
  }
}

export async function bulkRemoveTaxRate(
  taxRateId: string
): Promise<ApiResponse<{ updated: number; failed: number }>> {
  if (!taxRateId) {
    return { success: false, error: 'Tax rate ID is required' }
  }

  const allItemIds: string[] = []
  let page = 1
  const limit = 500

  while (true) {
    const res = await api.get<{ data: Array<{ id: string; taxRateId?: string | null }> }>(
      '/inventory/items',
      { page, limit }
    )
    if (!res.success || !res.data) break
    const items = res.data.data ?? []
    for (const item of items) {
      if (item.taxRateId === taxRateId) allItemIds.push(item.id)
    }
    if (items.length < limit) break
    page++
  }

  if (allItemIds.length === 0) {
    return {
      success: true,
      data: { updated: 0, failed: 0 },
      message: 'No items had this tax rate.',
    }
  }

  let updated = 0
  let failed = 0
  await Promise.all(
    allItemIds.map(async (id) => {
      const res = await api.patch(`/inventory/items/${id}`, { taxRateId: null })
      if (res.success) updated++
      else failed++
    })
  )

  revalidatePath('/inventory/items')
  return {
    success: true,
    data: { updated, failed },
    message: `Removed from ${updated} item${updated !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`,
  }
}
