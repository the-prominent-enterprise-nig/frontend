import { ShoppingBag, RotateCcw, XCircle, ArrowLeftRight, Receipt, Calculator } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getPurchaseOrders } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-purchase-orders'
import { getTransfers } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/get-transfers'
import {
  getPendingReturnRefundRequests,
  getMissingCogsReport,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { ARInvoices } from '@/src/libs/data/AccountingV2Data'

export type AttentionItem = {
  id: string
  icon: LucideIcon
  iconStyle: string
  label: string
  sub: string
  /** ISO timestamp used for within-tier sorting (oldest first — longest-waiting is most actionable). */
  timestamp: string
  /** 1 = revenue/accounting-integrity issue (red), 2 = a routine approval awaiting a decision (amber). */
  tier: 1 | 2
  badge: string
  badgeStyle: string
  /** Where clicking this row should go. Omitted only if no relevant screen exists. */
  href?: string
}

function fmtMoney(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`
}

/**
 * Merges the four separate pending-decision sources (draft POs, void/refund
 * requests, stock transfers awaiting approval) with the two revenue-integrity
 * signals (COGS posting gaps, overdue AR) into one prioritized feed — an
 * owner cares about "what needs a decision from me," not which module it
 * happens to live in. Shared between the Needs Attention widget (full list)
 * and the KPI strip (just the count), so both agree on what counts.
 */
export async function getNeedsAttentionItems(branchId?: string): Promise<AttentionItem[]> {
  const [poRes, returnRes, mgrTransfers, hqTransfers, cogsRes, arRes] = await Promise.all([
    getPurchaseOrders({ status: 'draft', limit: 20, branchId }),
    getPendingReturnRefundRequests(branchId),
    getTransfers({ status: 'pending_manager_approval', limit: 20, branchId }),
    getTransfers({ status: 'pending_hq_approval', limit: 20, branchId }),
    getMissingCogsReport(branchId),
    ARInvoices.list({ branchId }),
  ])

  const items: AttentionItem[] = []

  // ── Tier 1: revenue/accounting integrity ──────────────────────────────────
  const cogs = cogsRes.success ? cogsRes.data : null
  if (cogs) {
    for (const sale of cogs.sample) {
      items.push({
        id: `cogs-${sale.transactionId}`,
        icon: Calculator,
        iconStyle: 'text-red-500 bg-red-50',
        label: `Missing COGS — ${sale.transactionNumber}`,
        sub: 'Completed sale has no inventory posting',
        timestamp: sale.occurredAt,
        tier: 1,
        badge: 'COGS Gap',
        badgeStyle: 'bg-red-100 text-red-700',
        href: '/pos/transactions',
      })
    }
  }

  const now = Date.now()
  const invoices = arRes.data?.items ?? []
  for (const inv of invoices) {
    const balance = (inv.totalAmount ?? 0) - (inv.amountPaid ?? 0)
    if (balance <= 0) continue
    const isOverdue =
      inv.status === 'OVERDUE' || (inv.dueDate ? new Date(inv.dueDate).getTime() < now : false)
    if (!isOverdue) continue
    items.push({
      id: `ar-${inv.id}`,
      icon: Receipt,
      iconStyle: 'text-red-500 bg-red-50',
      label: `Overdue Invoice — ${inv.invoiceNumber}`,
      sub: `${inv.customer?.name ?? 'Unknown'} · ${fmtMoney(balance)}`,
      timestamp: inv.dueDate,
      tier: 1,
      badge: 'Overdue',
      badgeStyle: 'bg-red-100 text-red-700',
      href: `/accounting/ar-invoices/${inv.id}`,
    })
  }

  // ── Tier 2: routine approvals awaiting a decision ─────────────────────────
  const poItems: AttentionItem[] = (poRes.data?.data ?? []).map((po) => ({
    id: `po-${po.id}`,
    icon: ShoppingBag,
    iconStyle: 'text-blue-500 bg-blue-50',
    label: `Purchase Order #${po.code}`,
    sub: `${po.branch?.name ?? po.supplier?.name ?? '—'} · ${fmtMoney(po.totalAmount)}`,
    timestamp: po.createdAt,
    tier: 2,
    badge: 'PO',
    badgeStyle: 'bg-blue-100 text-blue-700',
    href: '/inventory/purchase-orders',
  }))

  const returnRefund = returnRes.data ?? []
  const voidItems: AttentionItem[] = returnRefund
    .filter((r) => r.type === 'void' && r.status === 'pending')
    .map((r) => ({
      id: `void-${r.id}`,
      icon: XCircle,
      iconStyle: 'text-amber-500 bg-amber-50',
      label: `Void Request — ${r.transaction?.transactionNumber ?? 'Transaction'}`,
      sub: `${r.session?.terminal?.branch?.name ?? '—'} · ${fmtMoney(r.transaction?.totalAmount ?? 0)}`,
      timestamp: r.createdAt,
      tier: 2 as const,
      badge: 'Void',
      badgeStyle: 'bg-amber-100 text-amber-700',
      href: '/pos/return-refund-approvals',
    }))
  const refundItems: AttentionItem[] = returnRefund
    .filter((r) => r.type === 'refund' && r.status === 'pending')
    .map((r) => ({
      id: `refund-${r.id}`,
      icon: RotateCcw,
      iconStyle: 'text-amber-500 bg-amber-50',
      label: `Refund — ${r.refundCartSnapshot?.customer?.name ?? 'Customer'}`,
      sub: `${r.session?.terminal?.branch?.name ?? '—'} · ${fmtMoney(r.refundCartSnapshot?.totalAmount ?? 0)}`,
      timestamp: r.createdAt,
      tier: 2 as const,
      badge: 'Refund',
      badgeStyle: 'bg-amber-100 text-amber-700',
      href: '/pos/return-refund-approvals',
    }))

  const transferRows = [...(mgrTransfers.data?.data ?? []), ...(hqTransfers.data?.data ?? [])]
  const transferItems: AttentionItem[] = transferRows.map((t) => ({
    id: `transfer-${t.id}`,
    icon: ArrowLeftRight,
    iconStyle: 'text-purple-500 bg-purple-50',
    label: `Stock Transfer #${t.transferNumber ?? t.id}`,
    sub: `${t.fromWarehouse?.name ?? '—'} → ${t.toWarehouse?.name ?? '—'}`,
    timestamp: t.createdAt ?? new Date(0).toISOString(),
    tier: 2,
    badge: 'Transfer',
    badgeStyle: 'bg-purple-100 text-purple-700',
    href: '/inventory/transfers',
  }))

  items.push(...poItems, ...voidItems, ...refundItems, ...transferItems)

  return items.sort(
    (a, b) => a.tier - b.tier || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}
