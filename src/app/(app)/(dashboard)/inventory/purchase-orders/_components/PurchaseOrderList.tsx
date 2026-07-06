'use client'

import { useState } from 'react'
import { Loader2, Plus, TrendingUp } from 'lucide-react'
import { usePurchaseOrders } from '../_hooks/usePurchaseOrders'
import { useProcurementQuotas } from '../../procurement-quotas/_hooks/useProcurementQuotas'
import { CreateQuotaModal } from '../../procurement-quotas/_components/CreateQuotaModal'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import type { ProcurementQuota } from '@/src/schema/inventory/procurement-quotas'

// ─── Section tabs ─────────────────────────────────────────────────────────────

const SECTION_TABS = [
  { label: 'Purchase Orders', value: 'orders' },
  { label: 'Spending Quotas', value: 'quotas' },
] as const

type Section = (typeof SECTION_TABS)[number]['value']

// ─── PO helpers ───────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Approved', value: 'approved' },
  { label: 'Sent', value: 'sent' },
  { label: 'Partially Received', value: 'partially_received' },
  { label: 'Fully Received', value: 'fully_received' },
] as const

function PoStatusBadge({ status }: { status: PurchaseOrderSummary['status'] }) {
  const styles: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    approved: 'bg-emerald-100 text-emerald-700',
    sent: 'bg-blue-100 text-blue-700',
    partially_received: 'bg-yellow-100 text-yellow-700',
    fully_received: 'bg-green-100 text-green-700',
    closed: 'bg-zinc-100 text-zinc-500',
    cancelled: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    draft: 'Draft',
    approved: 'Approved',
    sent: 'Sent',
    partially_received: 'Partially Received',
    fully_received: 'Fully Received',
    closed: 'Closed',
    cancelled: 'Cancelled',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

// ─── Quota helpers ─────────────────────────────────────────────────────────────

const GRAIN_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

function GrainBadge({ grain }: { grain: ProcurementQuota['grain'] }) {
  const styles: Record<string, string> = {
    monthly: 'bg-blue-100 text-blue-700',
    quarterly: 'bg-amber-100 text-amber-700',
    annual: 'bg-prominent-purple-100 text-prominent-purple-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[grain] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {GRAIN_LABELS[grain] ?? grain}
    </span>
  )
}

function UsageBar({ usedPct }: { usedPct: number }) {
  const pct = Math.min(usedPct, 100)
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PurchaseOrderList({ canManageQuotas }: { canManageQuotas: boolean }) {
  const [activeSection, setActiveSection] = useState<Section>('orders')

  // PO state
  const {
    items,
    pagination,
    isLoading,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    approvePO,
    isApproving,
    sendPO,
    isSending,
    cancelPO,
    isCancelling,
  } = usePurchaseOrders()

  // Quota state
  const {
    quotas,
    usage,
    isLoading: isQuotasLoading,
    isUsageLoading,
    createQuota,
    isCreating,
    updateQuota,
    isUpdating,
  } = useProcurementQuotas()

  const [showCreateQuota, setShowCreateQuota] = useState(false)

  const isActing = isApproving || isSending || isCancelling

  const fmtNGN = (n: number) =>
    n.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 })

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            View and manage purchase orders across your organisation
          </p>
        </div>
        {activeSection === 'quotas' && canManageQuotas && (
          <button
            type="button"
            onClick={() => setShowCreateQuota(true)}
            className="flex items-center gap-2 rounded-xl bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700"
          >
            <Plus className="h-4 w-4" />
            New Quota
          </button>
        )}
      </div>

      {/* Section Tabs */}
      <div className="mb-5 flex gap-1 border-b border-zinc-200">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveSection(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeSection === tab.value
                ? 'border-prominent-purple-600 text-prominent-purple-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Purchase Orders tab ────────────────────────────────────────────── */}
      {activeSection === 'orders' && (
        <>
          {/* Status Filter Tabs */}
          <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200">
            {STATUS_TABS.map((tab) => (
              <button
                key={String(tab.value)}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  statusFilter === tab.value
                    ? 'border-prominent-purple-600 text-prominent-purple-700'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-zinc-500">No purchase orders found</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Purchase orders are created from approved purchase requests
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Supplier
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Expected Delivery
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Total Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        From PR
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((po) => (
                      <tr key={po.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium text-zinc-900">
                            {po.code}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-zinc-700">{po.supplier.name}</p>
                          {po.supplier.taxId && (
                            <p className="text-xs text-zinc-400">TIN: {po.supplier.taxId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <PoStatusBadge status={po.status} />
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {po.expectedDeliveryDate ? (
                            new Date(po.expectedDeliveryDate).toLocaleDateString()
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-900">
                          {Number(po.totalAmount).toLocaleString('en-PH', {
                            style: 'currency',
                            currency: 'PHP',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          {po.fromPr ? (
                            <span className="font-mono text-xs text-zinc-600">
                              {po.fromPr.code}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {po.status === 'draft' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => approvePO(po.id)}
                                  disabled={isActing}
                                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelPO(po.id)}
                                  disabled={isActing}
                                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {po.status === 'approved' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => sendPO(po.id)}
                                  disabled={isActing}
                                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  Send
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelPO(po.id)}
                                  disabled={isActing}
                                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Spending Quotas tab ────────────────────────────────────────────── */}
      {activeSection === 'quotas' && (
        <>
          {/* Usage Widget */}
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-700">
                Current Period — Tenant-Wide
              </span>
            </div>
            {isUsageLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
              </div>
            ) : usage?.quota ? (
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-semibold text-zinc-900">
                    {fmtNGN(usage.currentSpend)}
                  </span>
                  <span className="text-sm text-zinc-500">
                    of {fmtNGN(Number(usage.quota.limitAmount))}
                  </span>
                </div>
                <UsageBar usedPct={usage.usedPct} />
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{usage.usedPct.toFixed(1)}% used</span>
                  <span>{fmtNGN(usage.remaining ?? 0)} remaining</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                No active quota configured for the current period.
              </p>
            )}
          </div>

          {/* Quotas Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {isQuotasLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            ) : quotas.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-zinc-500">No spending quotas configured</p>
                {canManageQuotas && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Create a quota to enforce budget limits on purchase orders
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Scope
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Period
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Fiscal Year
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Limit
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Notes
                      </th>
                      {canManageQuotas && (
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {quotas.map((q) => (
                      <tr key={q.id} className="transition-colors hover:bg-zinc-50/50">
                        <td className="px-4 py-3">
                          {q.branch ? (
                            <span className="font-medium text-zinc-800">{q.branch.name}</span>
                          ) : (
                            <span className="italic text-zinc-500">Tenant-wide</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <GrainBadge grain={q.grain} />
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{q.fiscalYear}</td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-900">
                          {fmtNGN(Number(q.limitAmount))}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              q.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {q.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {q.notes ?? <span className="text-zinc-300">—</span>}
                        </td>
                        {canManageQuotas && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end">
                              {q.isActive ? (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => updateQuota(q.id, { isActive: false })}
                                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => updateQuota(q.id, { isActive: true })}
                                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showCreateQuota && (
        <CreateQuotaModal
          onClose={() => setShowCreateQuota(false)}
          onSubmit={createQuota}
          isSubmitting={isCreating}
        />
      )}
    </div>
  )
}
