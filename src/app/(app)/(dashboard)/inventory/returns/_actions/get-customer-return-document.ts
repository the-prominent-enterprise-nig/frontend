'use server'

import { api } from '@/src/libs/api/client'

/** The customer's copy, as the same print envelope every other document in
 *  the app is printed from — the return plus the enterprise header. Mirrors
 *  goods-receiving/_actions/get-receiving-document.ts. */
export async function getCustomerReturnDocument(id: string) {
  return api.get<unknown>(`/inventory/stock/customer-returns/${id}/document`)
}
