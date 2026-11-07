import { redirect } from 'next/navigation'
import { STOCK_TRANSACTION_PATH } from './_lib/procurementHref'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Purchase orders and requests are viewed on the Stock Transaction hub's
 * Purchase Order tab now. This old address only forwards there, keeping the
 * link's own parameters (po, pr, newFor, supplierName…) so dashboard widgets,
 * notifications and bookmarks still open the right order or request.
 */
export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}): Promise<never> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    // `tab` here meant this page's Orders / Requests tabs; the hub has its own.
    if (key === 'tab' || value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v)
  }
  params.set('tab', 'purchase-orders')
  redirect(`${STOCK_TRANSACTION_PATH}?${params}`)
}
