import { canAny, type SessionUser } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import type { LedgerRefLink } from '@/src/schema/crm/types'

/** A page a Ref can open, and what its own guard asks for (any one). */
interface RefTarget {
  path: (id: string) => string
  perms: string[]
}

/** In order of preference: a customer return opens under Inventory for whoever
 * has it, else under Accounting's Receiving Reports — the same RRC page. */
const TARGETS: Record<LedgerRefLink['kind'], RefTarget[]> = {
  sale: [
    { path: (id) => `/pos/transactions?id=${id}`, perms: [POS_PERMISSIONS.TRANSACTIONS_READ] },
  ],
  invoice: [
    {
      path: (id) => `/accounting/ar-invoices/${id}`,
      perms: [ACCOUNTING_PERMISSIONS.AR_INVOICES_READ],
    },
  ],
  customerReturn: [
    {
      path: (id) => `/inventory/stock/reports/returns/${id}`,
      perms: [INVENTORY_PERMISSIONS.RECEIVE_READ],
    },
    {
      path: (id) => `/accounting/receiving-reports/returns/${id}`,
      perms: [ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ],
    },
  ],
  goodsReceipt: [
    { path: (id) => `/inventory/stock/reports/${id}`, perms: [INVENTORY_PERMISSIONS.RECEIVE_READ] },
  ],
  deliveryReceipt: [
    {
      path: (id) => `/inventory/delivery-receipts/${id}`,
      perms: [
        INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_READ,
        INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE,
        INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_APPROVE,
      ],
    },
  ],
}

/** The page a ledger row's Ref opens — the sale, a charge sale's AR invoice,
 * a customer return's RR (a return, or a repair's intake RRC), the goods
 * receipt a repossession came in on, or the DR a repaired unit went back on.
 * Null when this user can't open it (the page would only send them to 403),
 * so the Ref stays plain text. Checked with the same permissions as each
 * page's own guard. */
export function ledgerRefHref(link: LedgerRefLink, user: SessionUser | null): string | null {
  if (!user) return null
  const target = TARGETS[link.kind].find((t) => canAny(user, t.perms))
  return target ? target.path(encodeURIComponent(link.id)) : null
}
