'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { CustomerPurchase, CustomerPurchaseSchema } from '@/src/schema/inventory/returns'

/** Either the named account, or the paper a walk-in brought back. */
export type CustomerPurchaseLookup = { customerId: string } | { invoiceNumber: string }

/**
 * What was actually sold, so the return form can offer real units instead of
 * the whole catalogue.
 *
 * Two ways in, because the counter has two kinds of customer. A named account
 * is looked up by id and offers their whole history. A walk-in has no account
 * at all — `CustomerReturn.customerId` is nullable precisely for them — so
 * they are found by the document number on what they are holding.
 */
export async function getCustomerPurchases(
  lookup: CustomerPurchaseLookup
): Promise<ApiResponse<CustomerPurchase[]>> {
  const result = await api.get<CustomerPurchase[]>('/inventory/stock/customer-purchases', {
    ...('customerId' in lookup
      ? { customerId: lookup.customerId }
      : { invoiceNumber: lookup.invoiceNumber }),
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
