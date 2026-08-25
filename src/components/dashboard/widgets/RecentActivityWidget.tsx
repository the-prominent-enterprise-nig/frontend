'use client'

import { useEffect, useState } from 'react'
import {
  ShoppingCart,
  CheckCircle,
  Undo2,
  Activity,
  ClipboardCheck,
  ArrowRightLeft,
  Gift,
} from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import {
  getRecentActivity,
  type ActivityEntry,
} from '@/src/app/(app)/(dashboard)/_actions/activity-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Human-readable past-tense verb for an AccountingAuditLog action code
// (e.g. 'APPROVE_HQ' -> 'approved (HQ)'), used by the two Scenario 29 Gap 9
// inventory cases below whose action set is larger than a simple lookup.
function actionVerb(action: string): string {
  const map: Record<string, string> = {
    CREATE: 'created',
    CONFIRM: 'confirmed',
    INVESTIGATE: 'flagged for investigation',
    APPROVE: 'approved',
    APPROVE_MANAGER: 'approved (manager)',
    APPROVE_HQ: 'approved (HQ)',
    REJECT: 'rejected',
    REJECT_MANAGER: 'rejected (manager)',
    REJECT_HQ: 'rejected (HQ)',
    DELETE: 'withdrawn',
    REQUEST_FROM_POS: 'requested',
    ACCEPT: 'accepted',
    DISPATCH: 'dispatched',
    RECEIVE: 'received',
    CANCEL: 'cancelled',
  }
  return map[action] ?? action.toLowerCase().replace(/_/g, ' ')
}

function describe(entry: ActivityEntry): {
  icon: typeof ShoppingCart
  color: string
  label: string
  sub: string
} {
  const meta = entry.metadata ?? {}
  const items = Array.isArray(meta.items)
    ? (meta.items as unknown[]).filter((i): i is string => typeof i === 'string')
    : []
  switch (entry.resourceType) {
    case 'inventory:stock-adjustment':
      return {
        icon: ClipboardCheck,
        color: 'text-orange-500 bg-orange-50',
        label: `Stock adjustment ${actionVerb(entry.action)}`,
        sub: items.join(', '),
      }
    case 'inventory:transfer':
      return {
        icon: ArrowRightLeft,
        color: 'text-indigo-500 bg-indigo-50',
        label: `Stock transfer ${actionVerb(entry.action)}`,
        sub: items.join(', '),
      }
    case 'pos:gift-card': {
      const cardNumber = entry.newValues?.cardNumber
      return {
        icon: Gift,
        color: 'text-pink-500 bg-pink-50',
        label: `Gift card ${entry.action === 'ISSUE' ? 'issued' : 'voided'}`,
        sub: typeof cardNumber === 'string' ? `#${cardNumber}` : '',
      }
    }
    case 'pos:transaction': {
      const amount = Number(meta.totalAmount ?? 0)
      const kind = meta.transactionType === 'refund' ? 'Refund' : 'Sale'
      return {
        icon: ShoppingCart,
        color: 'text-blue-500 bg-blue-50',
        label: `${kind} completed — ${entry.resourceName ?? ''}`,
        sub: amount > 0 ? `₱${amount.toLocaleString()}` : '',
      }
    }
    case 'inventory:purchase-order':
      return {
        icon: CheckCircle,
        color: 'text-emerald-500 bg-emerald-50',
        label: 'Purchase Order approved',
        sub: entry.resourceName ?? '',
      }
    case 'pos:return-refund-request':
      return {
        icon: Undo2,
        color: 'text-amber-500 bg-amber-50',
        label: `${entry.resourceName ?? 'Return/refund request'} approved`,
        sub: '',
      }
    default:
      return {
        icon: Activity,
        color: 'text-zinc-400 bg-zinc-100',
        label: entry.resourceName ?? entry.resourceType,
        sub: '',
      }
  }
}

export default function RecentActivityWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 5

  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    getRecentActivity({ limit, branchId: branchId ?? undefined }).then((res) => {
      if (cancelled) return
      if (res.success && res.data) setActivity(res.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [limit, branchId])

  if (loading) {
    return (
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-100 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-32 rounded bg-zinc-100 animate-pulse" />
              <div className="h-2 w-20 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <p className="text-xs text-zinc-400">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {activity.map((entry) => {
        const { icon: Icon, color, label, sub } = describe(entry)
        return (
          <div
            key={entry.id}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{label}</p>
              {!isCompact && sub && <p className="truncate text-[10px] text-zinc-500">{sub}</p>}
            </div>
            <p className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">
              {timeAgo(entry.createdAt)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
