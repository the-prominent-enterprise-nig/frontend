'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import {
  getMissingCogsReport,
  type MissingCogsReport,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

export default function CogsGapsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 2 : 4
  const [report, setReport] = useState<MissingCogsReport | null>(null)
  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await getMissingCogsReport(branchId ?? undefined)
      if (cancelled) return
      setReport(
        res.success
          ? (res.data ?? { count: 0, sample: [], items: [] })
          : { count: 0, sample: [], items: [] }
      )
    })()
    return () => {
      cancelled = true
    }
  }, [branchId])

  if (report === null) {
    return <div className="text-xs text-zinc-400 p-2">Loading...</div>
  }

  if (report.count === 0) {
    return (
      <div className="flex h-full min-h-16 flex-col items-center justify-center gap-1.5 text-center">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <p className="text-xs text-zinc-500">Every completed sale has a COGS posting.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs font-semibold text-amber-800">
          {report.count} {report.count === 1 ? 'sale is' : 'sales are'} missing a COGS posting
        </p>
      </div>
      {!isCompact && report.items.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {/* The items, not the sales. A posted sale cannot be repaired after
              the fact; giving the item a cost stops the next one. */}
          <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            Items with no cost
          </p>
          {report.items.slice(0, limit).map((item) => (
            <div
              key={item.itemId}
              className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-zinc-50"
            >
              <span className="truncate text-xs font-medium text-prominent-purple-900">
                {item.name}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-400">
                {item.salesAffected} {item.salesAffected === 1 ? 'sale' : 'sales'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
