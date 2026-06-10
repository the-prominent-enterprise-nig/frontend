'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  FileText,
  MoreHorizontal,
  Loader2,
  ArrowRightCircle,
  Send,
  CheckCircle2,
  XCircle,
  ShoppingCart,
} from 'lucide-react'
import Link from 'next/link'
import type { Quotation } from '@/src/libs/actions/sales.actions'
import { convertQuotationToOrder, updateQuotationStatus } from '@/src/libs/actions/sales.actions'
import CreateQuotationModal from './CreateQuotationModal'

type QuotationStatus = Quotation['status']

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
}

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
}

const ALL_STATUSES: QuotationStatus[] = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
]

// ─── Action menu ─────────────────────────────────────────────────────────────

function QuotationMenu({
  quotation,
  busy,
  onConvert,
  onStatusChange,
}: {
  quotation: Quotation
  busy: boolean
  onConvert: (id: string) => void
  onStatusChange: (id: string, status: QuotationStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const { status, id } = quotation
  const isTerminal = status === 'converted' || status === 'rejected' || status === 'expired'
  const canConvert = !isTerminal
  const canMarkSent = status === 'draft'
  const canMarkAccepted = status === 'sent'
  const canMarkRejected = status === 'draft' || status === 'sent' || status === 'accepted'

  if (isTerminal && status !== 'converted') {
    return null
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        disabled={busy}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 transition disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {status === 'converted' && quotation.salesOrderId ? (
            <Link
              href="/sales/orders"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-purple-700 hover:bg-purple-50"
              onClick={() => setOpen(false)}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              View Order
            </Link>
          ) : null}
          {canConvert && (
            <button
              onClick={() => {
                setOpen(false)
                onConvert(id)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <ArrowRightCircle className="h-3.5 w-3.5 text-purple-500" />
              Convert to Order
            </button>
          )}
          {canMarkSent && (
            <button
              onClick={() => {
                setOpen(false)
                onStatusChange(id, 'sent')
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Send className="h-3.5 w-3.5 text-blue-500" />
              Mark as Sent
            </button>
          )}
          {canMarkAccepted && (
            <button
              onClick={() => {
                setOpen(false)
                onStatusChange(id, 'accepted')
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Mark as Accepted
            </button>
          )}
          {canMarkRejected && (
            <button
              onClick={() => {
                setOpen(false)
                onStatusChange(id, 'rejected')
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              Mark as Rejected
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  initialData: Quotation[]
  initialTotal: number
}

export default function QuotationsClient({ initialData, initialTotal }: Props) {
  const [quotations, setQuotations] = useState<Quotation[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = quotations.filter((q) => {
    const matchSearch =
      q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.customerName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    return matchSearch && matchStatus
  })

  function handleCreated(newQuotation: Quotation) {
    setQuotations((prev) => [newQuotation, ...prev])
    setTotal((t) => t + 1)
    setModalOpen(false)
  }

  const handleConvert = useCallback(async (quotationId: string) => {
    setBusyId(quotationId)
    setActionError(null)
    const result = await convertQuotationToOrder(quotationId)
    setBusyId(null)
    if (result.success && result.data) {
      const order = result.data
      setQuotations((prev) =>
        prev.map((q) =>
          q.id === quotationId ? { ...q, status: 'converted', salesOrderId: order.id } : q
        )
      )
    } else {
      setActionError(result.error ?? 'Failed to convert quotation')
    }
  }, [])

  const handleStatusChange = useCallback(async (quotationId: string, status: QuotationStatus) => {
    setBusyId(quotationId)
    setActionError(null)
    const result = await updateQuotationStatus(quotationId, status)
    setBusyId(null)
    if (result.success && result.data) {
      const updated = result.data
      setQuotations((prev) => prev.map((q) => (q.id === quotationId ? { ...q, ...updated } : q)))
    } else {
      setActionError(result.error ?? 'Failed to update status')
    }
  }, [])

  function formatAmount(amount: string, currency: string) {
    const num = parseFloat(amount)
    if (isNaN(num)) return `${currency} 0.00`
    return `${currency} ${num.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {total} quotation{total !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-prominent-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Quotation
          </button>
        </div>

        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2">
          {(['all', ...ALL_STATUSES] as const).map((s) => {
            const count =
              s === 'all' ? quotations.length : quotations.filter((q) => q.status === s).length
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-prominent-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusFilter === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {count}
                </span>
              </button>
            )
          })}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-4 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto h-10 w-10 text-gray-200" />
              <p className="mt-3 text-sm font-medium text-gray-500">No quotations found</p>
              <p className="mt-1 text-xs text-gray-400">
                {quotations.length === 0
                  ? 'Create your first quotation to get started.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Quotation #',
                    'Customer',
                    'Issue Date',
                    'Expiry Date',
                    'Total',
                    'Status',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((q) => (
                  <tr key={q.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-semibold text-purple-700">
                          {q.quotationNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{q.customerName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(q.issueDate)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(q.expiryDate)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {formatAmount(q.totalAmount, q.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[q.status]}`}
                      >
                        {STATUS_LABELS[q.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <QuotationMenu
                        quotation={q}
                        busy={busyId === q.id}
                        onConvert={handleConvert}
                        onStatusChange={handleStatusChange}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateQuotationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreated}
      />
    </div>
  )
}
