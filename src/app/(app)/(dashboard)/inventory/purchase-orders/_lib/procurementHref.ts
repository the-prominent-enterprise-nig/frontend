export const STOCK_TRANSACTION_PATH = '/inventory/stock-transaction'

export type ProcurementView = 'orders' | 'requests'

/**
 * Where a PO or PR link should land. Inside the Stock Transaction hub both
 * are managed on the Purchase Order tab (requests in its open-requests
 * section), so a link stays in the hub instead of jumping to the standalone
 * Purchase Orders page, whose Orders / Requests tabs `view` picks between.
 */
export function procurementHref(
  pathname: string,
  view: ProcurementView,
  extra: Record<string, string> = {}
): string {
  if (pathname === STOCK_TRANSACTION_PATH) {
    const params = new URLSearchParams({ tab: 'purchase-orders', ...extra })
    return `${STOCK_TRANSACTION_PATH}?${params}`
  }
  const params = new URLSearchParams({ tab: view, ...extra })
  return `/inventory/purchase-orders?${params}`
}
