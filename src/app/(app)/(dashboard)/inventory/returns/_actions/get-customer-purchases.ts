'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { CustomerPurchase, CustomerPurchaseSchema } from '@/src/schema/inventory/returns'

/** What this customer has actually bought, so the return form can offer their
 *  own units instead of the whole catalogue. */
export async function getCustomerPurchases(
  customerId: string
): Promise<ApiResponse<CustomerPurchase[]>> {
  const result = await api.get<CustomerPurchase[]>('/inventory/stock/customer-purchases', {
    customerId,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load purchases',
      message: typeof result.message === 'string' ? result.message : 'Failed to load purchases',
    }
  }

  const parsed = CustomerPurchaseSchema.array().safeParse(result.data)
  return { success: true, data: parsed.success ? parsed.data : [] }
}
