'use client'

import { useEffect, useState } from 'react'
import { useWidgetSize } from '../WidgetSizeContext'
import { ARInvoices, type ARInvoice } from '@/src/libs/data/AccountingV2Data'

const STATUS_STYLES: Record<string, string> = {
  SENT: 'bg-amber-100 text-amber-700',
  PARTIAL: 'bg-blue-100 text-blue-700',
  OVERDUE: 'bg-red-100 text-red-700',
  DRAFT: 'bg-zinc-100 text-zinc-600',
}

function fmtMoney(n: number): string {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dueLabel(invoice: ARInvoice): string {
  if (!invoice.dueDate) return ''
  const due = new Date(invoice.dueDate)
  const diffDays = Math.round((due.getTime() - Date.now()) / 86400000)
  if (diffDays < 0) return `Overdue ${Math.abs(diffDays)}d`
  if (diffDays === 0) return 'Due today'
  if (diffDays <= 7) return `Due in ${diffDays}d`
  return `Due ${due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
}

export default function OutstandingInvoicesWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs'
  const limit = isCompact ? 3 : 4
  const [invoices, setInvoices] = useState<ARInvoice[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await ARInvoices.list()
      if (cancelled) return
      const all = res.data?.items ?? []
      // Outstanding = not fully paid, sorted by due date ascending
      const outstanding = all
        .filter((i) => (i.totalAmount ?? 0) > (i.amountPaid ?? 0))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      setInvoices(outstanding)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (invoices === null) {
    return <div className="text-xs text-zinc-400 p-2">Loading...</div>
  }
  if (invoices.length === 0) {
    return <div className="text-xs text-zinc-400 p-2 italic">No outstanding invoices.</div>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {invoices.slice(0, limit).map((inv) => {
        const balance = (inv.totalAmount ?? 0) - (inv.amountPaid ?? 0)
        const customer = inv.customer
          ? `${inv.customer.firstName} ${inv.customer.lastName}`.trim()
          : 'Unknown'
        return (
          <div
            key={inv.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-800">{inv.invoiceNumber}</p>
              {!isCompact && (
                <p className="truncate text-[10px] text-zinc-500">
                  {customer} · {dueLabel(inv)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[inv.status] ?? 'bg-zinc-100 text-zinc-600'}`}
              >
                {inv.status}
              </span>
              <span className="text-xs font-semibold text-zinc-700">{fmtMoney(balance)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
