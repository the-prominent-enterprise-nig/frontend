'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { getNeedsAttentionItems, type AttentionItem } from './needsAttentionData'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

// Replaces the old separate Pending Approvals / COGS Gaps / Outstanding
// Invoices widgets for the admin dashboard — an owner thinks in terms of
// "what needs a decision from me right now," not which module it lives in.
// Those three widgets stay registered (see dashboardWidgets.ts) for roles
// that still use them individually.
export default function NeedsAttentionWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'
  const limit = isCompact ? 4 : 8

  const [items, setItems] = useState<AttentionItem[] | null>(null)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    getNeedsAttentionItems(branchId ?? undefined).then((result) => {
      if (!cancelled) setItems(result)
    })
    return () => {
      cancelled = true
    }
  }, [branchId])

  if (items === null) {
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
      <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1.5 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        <p className="text-sm font-medium text-zinc-600">All caught up</p>
        <p className="text-xs text-zinc-400">No approvals, overdue invoices, or posting gaps.</p>
      </div>
    )
  }

  const urgentCount = items.filter((i) => i.tier === 1).length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-0.5">
        <span className="text-xs font-semibold text-zinc-700">
          {items.length} need{items.length === 1 ? 's' : ''} your attention
        </span>
        {urgentCount > 0 && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">
            {urgentCount} urgent
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.slice(0, limit).map((item) => {
          const Icon = item.icon
          const row = (
            <>
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
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${item.badgeStyle}`}
                >
                  {item.badge}
                </span>
                <p className="text-[10px] text-zinc-400">{timeAgo(item.timestamp)}</p>
              </div>
            </>
          )
          const rowClass = `flex items-start gap-2 rounded-lg border-l-2 px-2 py-1.5 transition-colors duration-200 hover:bg-zinc-50 ${
            item.tier === 1 ? 'border-l-red-400' : 'border-l-amber-300'
          }`
          return item.href ? (
            <Link key={item.id} href={item.href} className={rowClass}>
              {row}
            </Link>
          ) : (
            <div key={item.id} className={rowClass}>
              {row}
            </div>
          )
        })}
      </div>
      {items.length > limit && (
        <p className="px-2 text-[10px] text-zinc-400">+{items.length - limit} more</p>
      )}
    </div>
  )
}
