'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import {
  getMissingCogsReport,
  type MissingCogsReport,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'

export default function CogsGapsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 2 : 4
  const [report, setReport] = useState<MissingCogsReport | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await getMissingCogsReport()
      if (cancelled) return
      setReport(res.success ? (res.data ?? { count: 0, sample: [] }) : { count: 0, sample: [] })
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
      {!isCompact && (
        <div className="flex flex-col gap-0.5">
          {report.sample.slice(0, limit).map((sale) => (
            <div
              key={sale.transactionId}
              className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-zinc-50"
            >
              <span className="truncate text-xs font-medium text-zinc-800">
                {sale.transactionNumber}
              </span>
              <span className="shrink-0 text-[10px] text-zinc-400">
                {new Date(sale.occurredAt).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
