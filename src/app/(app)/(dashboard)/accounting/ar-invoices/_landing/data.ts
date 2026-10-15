import { ARInvoices, type ARInvoiceCustomerRollup } from '@/src/libs/data/AccountingV2Data'
import { settle, type Settled } from '@/src/libs/api/unwrap'
import { PER_PAGE, type LandingParams } from './params'

/**
 * One page of the per-customer rollup, grouped and ordered on the server.
 * Server-side only; never throws, so it is safe to start without awaiting.
 */
export function fetchRollup(
  params: LandingParams
): Promise<Settled<{ items: ARInvoiceCustomerRollup[]; total: number }>> {
  return settle(
    ARInvoices.byCustomer({
      search: params.search,
      limit: PER_PAGE,
      offset: (params.page - 1) * PER_PAGE,
    })
  )
}
