'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, RotateCcw, XCircle, ArrowLeftRight } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { getPendingReturnRefundRequests } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { getPurchaseOrders } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-purchase-orders'
import { getTransfers } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/get-transfers'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

type ApprovalItem = {
  id: string
  icon: typeof ShoppingBag
  iconStyle: string
  label: string
  sub: string
  createdAt: string
  badge: string
  badgeStyle: string
}

function fmtMoney(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Real replacement for the old hardcoded APPROVALS array — this app has no
// single unified "approval" model (that's Scenario 21's own scope), but it
// does have 4 separate, already-real pending-approval flows. This widget
// pulls one page from each and merges them, newest-first, same 4 categories
// the original mock sample data was modeled on.
export default function PendingApprovalsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 4

  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getPurchaseOrders({ status: 'draft', limit: 20, branchId: branchId ?? undefined }),
      getPendingReturnRefundRequests(branchId ?? undefined),
      getTransfers({
        status: 'pending_manager_approval',
        limit: 20,
        branchId: branchId ?? undefined,
      }),
      getTransfers({
        status: 'pending_hq_approval',
        limit: 20,
        branchId: branchId ?? undefined,
      }),
    ]).then(([poRes, returnRes, mgrTransfers, hqTransfers]) => {
      if (cancelled) return

      const poItems: ApprovalItem[] = (poRes.data?.data ?? []).map((po) => ({
        id: `po-${po.id}`,
        icon: ShoppingBag,
        iconStyle: 'text-blue-500 bg-blue-50',
        label: `Purchase Order #${po.code}`,
        sub: `${po.branch?.name ?? po.supplier?.name ?? '—'} · ${fmtMoney(po.totalAmount)}`,
        createdAt: po.createdAt,
        badge: 'PO',
        badgeStyle: 'bg-blue-100 text-blue-700',
      }))

      const returnRefund = returnRes.data ?? []
      const voidItems: ApprovalItem[] = returnRefund
        .filter((r) => r.type === 'void' && r.status === 'pending')
        .map((r) => ({
          id: `void-${r.id}`,
          icon: XCircle,
          iconStyle: 'text-red-500 bg-red-50',
          label: `Void Request — ${r.transaction?.transactionNumber ?? 'Transaction'}`,
          sub: `${r.session?.terminal?.branch?.name ?? '—'} · ${fmtMoney(r.transaction?.totalAmount ?? 0)}`,
          createdAt: r.createdAt,
          badge: 'Void',
          badgeStyle: 'bg-red-100 text-red-700',
        }))
      const refundItems: ApprovalItem[] = returnRefund
        .filter((r) => r.type === 'refund' && r.status === 'pending')
        .map((r) => ({
          id: `refund-${r.id}`,
          icon: RotateCcw,
          iconStyle: 'text-amber-500 bg-amber-50',
          label: `Refund — ${r.refundCartSnapshot?.customer?.name ?? 'Customer'}`,
          sub: `${r.session?.terminal?.branch?.name ?? '—'} · ${fmtMoney(r.refundCartSnapshot?.totalAmount ?? 0)}`,
          createdAt: r.createdAt,
          badge: 'Refund',
          badgeStyle: 'bg-amber-100 text-amber-700',
        }))

      const transferRows = [...(mgrTransfers.data?.data ?? []), ...(hqTransfers.data?.data ?? [])]
      const transferItems: ApprovalItem[] = transferRows.map((t) => ({
        id: `transfer-${t.id}`,
        icon: ArrowLeftRight,
        iconStyle: 'text-purple-500 bg-purple-50',
        label: `Stock Transfer #${t.transferNumber ?? t.id}`,
        sub: `${t.fromWarehouse?.name ?? '—'} → ${t.toWarehouse?.name ?? '—'}`,
        createdAt: t.createdAt ?? new Date(0).toISOString(),
        badge: 'Transfer',
        badgeStyle: 'bg-purple-100 text-purple-700',
      }))

      const all = [...poItems, ...voidItems, ...refundItems, ...transferItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setItems(all)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [branchId])

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-16 items-center justify-center">
        <p className="text-xs text-zinc-400">No pending approvals</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {items.slice(0, limit).map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.id}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-50"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.iconStyle}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{item.label}</p>
              {!isCompact && <p className="truncate text-[10px] text-zinc-500">{item.sub}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${item.badgeStyle}`}>
                {item.badge}
              </span>
              <p className="text-[10px] text-zinc-400">{timeAgo(item.createdAt)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
