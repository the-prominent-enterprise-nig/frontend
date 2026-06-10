'use server'

import { api } from '@/src/libs/api/client'

export async function getItemAttributes(itemId: string): Promise<Record<string, string>> {
  const result = await api.get(`/inventory/attributes/items/${itemId}`)
  if (!result.success || !result.data) return {}
  const data = result.data as Record<string, unknown>
  // Response may be { attributes: {...} } or the flat object itself
  const raw =
    typeof data.attributes === 'object' && data.attributes !== null ? data.attributes : data
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
  )
}
