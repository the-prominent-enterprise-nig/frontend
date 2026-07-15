'use client'

import { useState } from 'react'
import { Loader2, Plus, TrendingUp } from 'lucide-react'
import { useProcurementQuotas } from '../_hooks/useProcurementQuotas'
import { CreateQuotaModal } from './CreateQuotaModal'
import type { ProcurementQuota } from '@/src/schema/inventory/procurement-quotas'

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

export function QuotaList({ canManage }: { canManage: boolean }) {
  const {
    quotas,
    usage,
    isLoading,
    isUsageLoading,
    createQuota,
    isCreating,
    updateQuota,
    isUpdating,
  } = useProcurementQuotas()

  const [showCreate, setShowCreate] = useState(false)

  const fmt = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Spending Quotas</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage authorised budget limits enforced on purchase orders
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700"
          >
            <Plus className="h-4 w-4" />
            New Quota
          </button>
        )}
      </div>

      {/* Usage Widget */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-700">Current Period — Tenant-Wide</span>
        </div>
        {isUsageLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
          </div>
        ) : usage?.quota ? (
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span className="text-2xl font-semibold text-zinc-900">
                {fmt(usage.currentSpend)}
              </span>
              <span className="text-sm text-zinc-500">
                of {fmt(Number(usage.quota.limitAmount))}
              </span>
            </div>
            <UsageBar usedPct={usage.usedPct} />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{usage.usedPct.toFixed(1)}% used</span>
              <span>{fmt(usage.remaining ?? 0)} remaining</span>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : quotas.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No spending quotas configured</p>
            {canManage && (
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
                  {canManage && (
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
                        <span className="text-zinc-500 italic">Tenant-wide</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <GrainBadge grain={q.grain} />
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{q.fiscalYear}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {fmt(Number(q.limitAmount))}
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
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
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

      {showCreate && (
        <CreateQuotaModal
          onClose={() => setShowCreate(false)}
          onSubmit={createQuota}
          isSubmitting={isCreating}
        />
      )}
    </div>
  )
}
