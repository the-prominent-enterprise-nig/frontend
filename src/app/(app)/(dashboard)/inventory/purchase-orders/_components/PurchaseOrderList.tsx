'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Loader2,
  Plus,
  TrendingUp,
  Search,
  FileText,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Send,
  Archive,
  PackagePlus,
  Ban,
} from 'lucide-react'
import { usePurchaseOrders } from '../_hooks/usePurchaseOrders'
import { useProcurementQuotas } from '../../procurement-quotas/_hooks/useProcurementQuotas'
import { CreateQuotaModal } from '../../procurement-quotas/_components/CreateQuotaModal'
import { CancelPoModal } from './CancelPoModal'
import { CreatePoModal } from './CreatePoModal'
import { PoReceiptsPanel } from './PoReceiptsPanel'
import { ReceiveAgainstPoModal } from './ReceiveAgainstPoModal'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import type { ProcurementQuota } from '@/src/schema/inventory/procurement-quotas'

// ─── Section tabs ─────────────────────────────────────────────────────────────

const SECTION_TABS = [
  { label: 'Purchase Orders', value: 'orders' },
  { label: 'Spending Quotas', value: 'quotas' },
] as const
type Section = (typeof SECTION_TABS)[number]['value']

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { dot: string; bg: string; border: string; text: string; label: string }
> = {
  draft: {
    dot: 'bg-zinc-400',
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    text: 'text-zinc-600',
    label: 'Draft',
  },
  approved: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    label: 'Approved',
  },
  sent: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    label: 'Sent',
  },
  partially_received: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    label: 'Partial',
  },
  fully_received: {
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    label: 'Received',
  },
  closed: {
    dot: 'bg-zinc-300',
    bg: 'bg-zinc-100',
    border: 'border-zinc-200',
    text: 'text-zinc-500',
    label: 'Closed',
  },
  cancelled: {
    dot: 'bg-red-400',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    label: 'Cancelled',
  },
}

const STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Approved', value: 'approved' },
  { label: 'Sent', value: 'sent' },
  { label: 'Partial', value: 'partially_received' },
  { label: 'Received', value: 'fully_received' },
  { label: 'Closed', value: 'closed' },
  { label: 'Cancelled', value: 'cancelled' },
] as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function PoStatusBadge({ status }: { status: PurchaseOrderSummary['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function ReceiptProgress({ lines }: { lines: PurchaseOrderSummary['lines'] }) {
  if (!lines.length) return <span className="text-zinc-300">—</span>

  const totalQty = lines.reduce((s, l) => s + Number(l.quantity), 0)
  const receivedQty = lines.reduce((s, l) => s + Number(l.receivedQuantity ?? 0), 0)
  const pct = totalQty > 0 ? Math.min((receivedQty / totalQty) * 100, 100) : 0

  const barColor = pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-zinc-200'
  const textColor = pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-zinc-400'

  return (
    <div className="w-36 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">
          {receivedQty.toFixed(0)}
          <span className="mx-0.5 text-zinc-300">/</span>
          {totalQty.toFixed(0)}
        </span>
        <span className={`font-bold ${textColor}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SupplierAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase()
  const colors = [
    'bg-prominent-purple-100 text-prominent-purple-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ]
  const color = colors[initial.charCodeAt(0) % colors.length]
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}
    >
      {initial}
    </span>
  )
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
  variant = 'default',
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'purple'
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  function handleMouseEnter() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setCoords({ top: r.top, left: r.left + r.width / 2 })
  }

  const variantClass = {
    default:
      'border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-700',
    danger: 'border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600',
    purple:
      'border border-prominent-purple-200 text-prominent-purple-500 hover:bg-prominent-purple-50 hover:text-prominent-purple-700',
  }[variant]

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setCoords(null)}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${variantClass}`}
      >
        {children}
      </button>

      {coords !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            className="pointer-events-none fixed z-[9999] -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
            style={{ top: coords.top - 32, left: coords.left }}
          >
            {title}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
          </span>,
          document.body
        )}
    </>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-100">
      {[140, 180, 90, 90, 100, 70, 120, 70, 100].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 animate-pulse rounded-md bg-zinc-100" style={{ width: `${w}px` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Quota helpers ────────────────────────────────────────────────────────────

const GRAIN_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

function GrainBadge({ grain }: { grain: ProcurementQuota['grain'] }) {
  const styles: Record<string, string> = {
    monthly: 'bg-blue-50 text-blue-700 border-blue-100',
    quarterly: 'bg-amber-50 text-amber-700 border-amber-100',
    annual: 'bg-prominent-purple-50 text-prominent-purple-700 border-prominent-purple-100',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[grain] ?? 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}
    >
      {GRAIN_LABELS[grain] ?? grain}
    </span>
  )
}

function UsageBar({ usedPct }: { usedPct: number }) {
  const pct = Math.min(usedPct, 100)
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PurchaseOrderList({
  canManageQuotas,
  canCreate,
}: {
  canManageQuotas: boolean
  canCreate: boolean
}) {
  const [activeSection, setActiveSection] = useState<Section>('orders')

  const {
    items,
    pagination,
    isLoading,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    createPO,
    isCreating,
    approvePO,
    isApproving,
    sendPO,
    isSending,
    closePO,
    isClosing,
    cancelPO,
    isCancelling,
    refetch,
  } = usePurchaseOrders()

  const {
    quotas,
    usage,
    isLoading: isQuotasLoading,
    isUsageLoading,
    createQuota,
    isCreating: isCreatingQuota,
    updateQuota,
    isUpdating,
  } = useProcurementQuotas()

  const [showCreateQuota, setShowCreateQuota] = useState(false)
  const [showCreatePo, setShowCreatePo] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrderSummary | null>(null)
  const [receiptsTarget, setReceiptsTarget] = useState<PurchaseOrderSummary | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrderSummary | null>(null)

  const isActing = isApproving || isSending || isClosing || isCancelling

  const fmtPHP = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

  const fmtNGN = (n: number) =>
    n.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 })

  return (
    <div className="min-h-screen bg-zinc-50/60 p-6">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage and track purchase orders across your organisation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSection === 'orders' && canCreate && (
            <button
              type="button"
              onClick={() => setShowCreatePo(true)}
              className="flex items-center gap-2 rounded-xl bg-prominent-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-prominent-purple-700 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              New Purchase Order
            </button>
          )}
          {activeSection === 'quotas' && canManageQuotas && (
            <button
              type="button"
              onClick={() => setShowCreateQuota(true)}
              className="flex items-center gap-2 rounded-xl bg-prominent-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-prominent-purple-700 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              New Quota
            </button>
          )}
        </div>
      </div>

      {/* ── Section tabs ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-0 border-b border-zinc-200">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveSection(tab.value)}
            className={`border-b-2 px-5 py-2.5 text-sm font-medium -mb-px transition-colors ${
              activeSection === tab.value
                ? 'border-prominent-purple-600 text-prominent-purple-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PURCHASE ORDERS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'orders' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by PO code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-64 rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-prominent-purple-400 focus:outline-none focus:ring-2 focus:ring-prominent-purple-100"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={String(f.value)}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    statusFilter === f.value
                      ? 'bg-prominent-purple-600 text-white shadow-sm'
                      : 'bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table card */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Code
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Supplier
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Exp. Delivery
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Total
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Source
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Progress
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Created
                    </th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-24 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
                          <ShoppingBag className="h-7 w-7 text-zinc-400" />
                        </div>
                        <p className="text-sm font-semibold text-zinc-600">
                          No purchase orders found
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {search || statusFilter
                            ? 'Try adjusting your filters'
                            : 'Create one directly or convert an approved purchase request'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((po) => (
                      <tr
                        key={po.id}
                        className="group relative transition-colors hover:bg-prominent-purple-50/30"
                      >
                        {/* Code */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-prominent-purple-400 opacity-0 transition-opacity group-hover:opacity-100" />
                            <span className="font-mono text-sm font-bold text-prominent-purple-700">
                              {po.code}
                            </span>
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="px-4 py-4 max-w-[180px]">
                          <div className="flex items-center gap-2.5">
                            <SupplierAvatar name={po.supplier.name} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-zinc-800">
                                {po.supplier.name}
                              </p>
                              {po.supplier.taxId && (
                                <p className="truncate font-mono text-xs text-zinc-400">
                                  TIN {po.supplier.taxId}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <PoStatusBadge status={po.status} />
                        </td>

                        {/* Exp. delivery */}
                        <td className="px-4 py-4 text-sm">
                          {po.expectedDeliveryDate ? (
                            <span className="text-zinc-600">
                              {new Date(po.expectedDeliveryDate).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>

                        {/* Total */}
                        <td className="px-4 py-4 text-right">
                          <span className="font-semibold text-zinc-900">
                            {fmtPHP(Number(po.totalAmount))}
                          </span>
                        </td>

                        {/* Source */}
                        <td className="px-4 py-4">
                          {po.fromPr ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-prominent-purple-100 bg-prominent-purple-50 px-2 py-0.5 font-mono text-xs font-semibold text-prominent-purple-700">
                              <FileText className="h-3 w-3" />
                              {po.fromPr.code}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-zinc-100 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-400">
                              Direct
                            </span>
                          )}
                        </td>

                        {/* Receipt progress */}
                        <td className="px-4 py-4">
                          <ReceiptProgress lines={po.lines} />
                        </td>

                        {/* Created */}
                        <td className="px-4 py-4 text-xs text-zinc-400">
                          {new Date(po.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {po.status === 'draft' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => approvePO(po.id)}
                                  disabled={isActing}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                  Approve
                                </button>
                                <IconBtn
                                  title="Cancel PO"
                                  onClick={() => setCancelTarget(po)}
                                  disabled={isActing}
                                  variant="danger"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </IconBtn>
                              </>
                            )}

                            {po.status === 'approved' && (
                              <>
                                <IconBtn
                                  title="Receive stock"
                                  onClick={() => setReceiveTarget(po)}
                                  variant="purple"
                                >
                                  <PackagePlus className="h-3.5 w-3.5" />
                                </IconBtn>
                                <IconBtn
                                  title="Send to supplier"
                                  onClick={() => sendPO(po.id)}
                                  disabled={isActing}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </IconBtn>
                                <IconBtn
                                  title="Cancel PO"
                                  onClick={() => setCancelTarget(po)}
                                  disabled={isActing}
                                  variant="danger"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </IconBtn>
                              </>
                            )}

                            {po.status === 'sent' && (
                              <IconBtn
                                title="Receive stock"
                                onClick={() => setReceiveTarget(po)}
                                variant="purple"
                              >
                                <PackagePlus className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}

                            {po.status === 'partially_received' && (
                              <>
                                <IconBtn
                                  title="Receive more stock"
                                  onClick={() => setReceiveTarget(po)}
                                  variant="purple"
                                >
                                  <PackagePlus className="h-3.5 w-3.5" />
                                </IconBtn>
                                <IconBtn
                                  title="Close"
                                  onClick={() => closePO(po.id)}
                                  disabled={isActing}
                                  variant="default"
                                >
                                  {isClosing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Archive className="h-3.5 w-3.5" />
                                  )}
                                </IconBtn>
                              </>
                            )}

                            {po.status === 'fully_received' && (
                              <button
                                type="button"
                                onClick={() => closePO(po.id)}
                                disabled={isActing}
                                className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-900 disabled:opacity-50 transition-colors"
                              >
                                {isClosing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Archive className="h-3.5 w-3.5" />
                                )}
                                Close
                              </button>
                            )}

                            {(po.status === 'partially_received' ||
                              po.status === 'fully_received' ||
                              po.status === 'closed') && (
                              <IconBtn
                                title="View delivery receipts"
                                onClick={() => setReceiptsTarget(po)}
                                variant="purple"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!isLoading && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3.5">
                <p className="text-xs text-zinc-400">
                  Showing{' '}
                  <span className="font-medium text-zinc-600">
                    {(page - 1) * pagination.limit + 1}–
                    {Math.min(page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium text-zinc-600">{pagination.total}</span> orders
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs font-medium text-zinc-600">
                    {page} / {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SPENDING QUOTAS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'quotas' && (
        <div className="space-y-5">
          {/* Usage widget */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-prominent-purple-50">
                <TrendingUp className="h-4 w-4 text-prominent-purple-600" />
              </div>
              <span className="text-sm font-semibold text-zinc-700">
                Current Period — Tenant-Wide
              </span>
            </div>

            {isUsageLoading ? (
              <div className="space-y-3">
                <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-100" />
                <div className="h-2 w-full animate-pulse rounded-full bg-zinc-100" />
              </div>
            ) : usage?.quota ? (
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-bold text-zinc-900">
                    {fmtNGN(usage.currentSpend)}
                  </span>
                  <span className="mb-0.5 text-sm text-zinc-500">
                    of {fmtNGN(Number(usage.quota.limitAmount))}
                  </span>
                </div>
                <UsageBar usedPct={usage.usedPct} />
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{usage.usedPct.toFixed(1)}% used</span>
                  <span className="font-medium text-zinc-600">
                    {fmtNGN(usage.remaining ?? 0)} remaining
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                No active quota configured for the current period.
              </p>
            )}
          </div>

          {/* Quotas table */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {isQuotasLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
              </div>
            ) : quotas.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-zinc-500">No spending quotas configured</p>
                {canManageQuotas && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Create a quota to enforce budget limits on purchase orders
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    {[
                      'Scope',
                      'Period',
                      'Fiscal Year',
                      'Limit',
                      'Status',
                      'Notes',
                      ...(canManageQuotas ? [''] : []),
                    ].map((h, i) => (
                      <th
                        key={h || i}
                        className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 ${i === 3 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {quotas.map((q) => (
                    <tr key={q.id} className="transition-colors hover:bg-zinc-50/70">
                      <td className="px-4 py-4">
                        {q.branch ? (
                          <span className="font-medium text-zinc-800">{q.branch.name}</span>
                        ) : (
                          <span className="italic text-zinc-400">Tenant-wide</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <GrainBadge grain={q.grain} />
                      </td>
                      <td className="px-4 py-4 text-zinc-600">{q.fiscalYear}</td>
                      <td className="px-4 py-4 text-right font-semibold text-zinc-900">
                        {fmtNGN(Number(q.limitAmount))}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${q.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${q.isActive ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                          />
                          {q.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-zinc-500">
                        {q.notes ?? <span className="text-zinc-300">—</span>}
                      </td>
                      {canManageQuotas && (
                        <td className="px-4 py-4 text-right">
                          {q.isActive ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => updateQuota(q.id, { isActive: false })}
                              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => updateQuota(q.id, { isActive: true })}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              Activate
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modals & panels ──────────────────────────────────────────────────── */}

      {showCreateQuota && (
        <CreateQuotaModal
          onClose={() => setShowCreateQuota(false)}
          onSubmit={createQuota}
          isSubmitting={isCreatingQuota}
        />
      )}

      <CreatePoModal
        open={showCreatePo}
        onClose={() => setShowCreatePo(false)}
        onSubmit={async (data) => {
          await createPO(data)
        }}
        isSubmitting={isCreating}
      />

      <CancelPoModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        po={cancelTarget}
        onCancel={async (id, reason) => {
          await cancelPO({ id, reason })
          setCancelTarget(null)
        }}
        isCancelling={isCancelling}
      />

      <PoReceiptsPanel po={receiptsTarget} onClose={() => setReceiptsTarget(null)} />

      <ReceiveAgainstPoModal
        po={receiveTarget}
        onClose={() => setReceiveTarget(null)}
        onSuccess={() => {
          setReceiveTarget(null)
          refetch()
        }}
      />
    </div>
  )
}
