export const STOCK_TRANSACTION_PATH = '/inventory/stock-transaction'

export type ProcurementView = 'orders' | 'requests'

/**
 * Where a PO or PR link should land: the Stock Transaction hub's Purchase
 * Order tab, which manages both (requests in its open-requests section). The
 * standalone Purchase Orders page only redirects there now. `pathname` and
 * `view` are kept so existing callers need no change.
 */
export function procurementHref(
  _pathname: string,
  _view: ProcurementView,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams({ tab: 'purchase-orders', ...extra })
  return `${STOCK_TRANSACTION_PATH}?${params}`
}
