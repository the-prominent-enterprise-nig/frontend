'use server'

import { getTransfers } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/get-transfers'
import { getPurchaseRequests } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_actions/get-purchase-requests'
import { getPurchaseOrders } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-purchase-orders'
import type { TransferStatus } from '@/src/schema/inventory/transfers'
import type {
  ActionQueueDocument,
  ActionQueueSide,
  ActionQueueSource,
} from '@/src/app/(app)/(dashboard)/inventory/_lib/action-queue'

/** Transfer statuses where someone still has to do something. */
const OPEN_TRANSFER_STATUSES: TransferStatus[] = [
  'pending_manager_approval',
  'pending_hq_approval',
  'requested',
  'pending_substitution_confirmation',
  'draft',
  'in_transit',
  'partially_received',
]

/** PO statuses where someone still has to approve, send or receive it. */
const OPEN_PO_STATUSES = ['draft', 'approved', 'sent', 'partially_received']

const PER_STATUS_LIMIT = 50

function rowsOf(result: unknown): Record<string, unknown>[] {
  const r = result as { success?: boolean; data?: unknown } | null
  if (!r?.success) return []
  const data = r.data as { data?: unknown } | unknown[] | undefined
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  return Array.isArray(data?.data) ? (data.data as Record<string, unknown>[]) : []
}

function sideOf(warehouse: unknown): ActionQueueSide | null {
  const w = warehouse as { branchId?: string | null; name?: string; branch?: { name?: string } }
  if (!w) return null
  return { branchId: w.branchId ?? null, label: w.branch?.name ?? w.name ?? '—' }
}

function toTransferDoc(t: Record<string, unknown>): ActionQueueDocument {
  return {
    kind: 'transfer',
    id: String(t.id),
    code: String(t.transferNumber ?? t.id),
    status: String(t.status),
    date: (t.dispatchedAt ?? t.transferDate ?? t.createdAt ?? null) as string | null,
    from: sideOf(t.fromWarehouse),
    to: sideOf(t.toWarehouse),
    dispatchedById: (t.dispatchedById ?? null) as string | null,
  }
}

function toPurchaseDoc(kind: 'pr' | 'po', p: Record<string, unknown>): ActionQueueDocument {
  const supplier = p.supplier as { name?: string } | null | undefined
  return {
    kind,
    id: String(p.id),
    code: String(p.code ?? p.id),
    status: String(p.status),
    date: (p.orderDate ?? p.createdAt ?? null) as string | null,
    from: supplier?.name ? { branchId: null, label: supplier.name } : null,
    to: null,
    dispatchedById: null,
  }
}

/**
 * Every open document the dashboard's Action Queue sorts into "yours to act
 * on". The backend already scopes each list to the caller's branch; which
 * side of a transfer the caller is on (and so whether it is theirs) is
 * decided client-side by `buildActionQueue`, which has the session user.
 */
export async function getActionQueue(): Promise<{ success: true; data: ActionQueueSource }> {
  const [transfers, prs, pos] = await Promise.all([
    Promise.all(
      OPEN_TRANSFER_STATUSES.map((status) => getTransfers({ status, limit: PER_STATUS_LIMIT }))
    ),
    getPurchaseRequests({ status: 'submitted', limit: PER_STATUS_LIMIT }),
    Promise.all(
      OPEN_PO_STATUSES.map((status) => getPurchaseOrders({ status, limit: PER_STATUS_LIMIT }))
    ),
  ])
  return {
    success: true,
    data: {
      transfers: transfers.flatMap(rowsOf).map(toTransferDoc),
      purchaseRequests: rowsOf(prs).map((p) => toPurchaseDoc('pr', p)),
      purchaseOrders: pos.flatMap(rowsOf).map((p) => toPurchaseDoc('po', p)),
    },
  }
}
