'use server'

import { getItems } from '../../items/_actions/get-items'

/**
 * How many active items exist in the catalog, for the price list pages'
 * coverage figures ("376 of 1,412 items priced"). Asks for a single row and
 * reads the pagination total rather than pulling the catalog down — the
 * count is all the caller needs.
 */
export async function getCatalogTotal(): Promise<number> {
  const result = await getItems({ page: 1, limit: 1, lifecycle: 'active' })
  return result.success ? (result.data?.total ?? 0) : 0
}
