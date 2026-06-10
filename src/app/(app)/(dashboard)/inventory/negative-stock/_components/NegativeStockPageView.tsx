'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useNegativeStock } from '../_hooks/useNegativeStock'
import {
  NegativeStockPolicyFormSchema,
  type NegativeStockPolicyFormValues,
} from '@/src/schema/inventory/negative-stock'

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const POLICY_LABELS: Record<string, { label: string; description: string; color: string }> = {
  block: {
    label: 'Block',
    description: 'Prevent transactions that would result in negative stock.',
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  warn: {
    label: 'Warn',
    description: 'Allow transactions but show a warning when stock goes negative.',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  allow: {
    label: 'Allow',
    description: 'Allow stock to go below zero without warnings.',
    color: 'text-green-600 bg-green-50 border-green-200',
  },
}

export default function NegativeStockPageView({ session }: { session: SessionUser }) {
  const canConfigure = hasPermission(session, INVENTORY_PERMISSIONS.NEGATIVE_STOCK_CONFIGURE)

  const {
    policy,
    violations,
    isLoadingPolicy,
    isLoadingViolations,
    isFetching,
    error,
    savePolicy,
    isSaving,
    refetch,
  } = useNegativeStock()

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<NegativeStockPolicyFormValues>({
    resolver: zodResolver(NegativeStockPolicyFormSchema),
    defaultValues: { defaultPolicy: 'block' },
  })

  const currentPolicyValue = watch('defaultPolicy')

  useEffect(() => {
    if (policy) {
      reset({ defaultPolicy: policy.defaultPolicy })
    }
  }, [policy, reset])

  async function handleSave(data: NegativeStockPolicyFormValues) {
    await savePolicy(data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Negative Stock Policy</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Configure how the system handles transactions that would result in negative stock.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load policy</p>
          </div>
        )}

        {/* Policy Form */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">Default Policy</h2>
          {isLoadingPolicy ? (
            <div className="py-8 text-center text-sm text-zinc-400">Loading policy…</div>
          ) : (
            <form onSubmit={handleSubmit(handleSave)} noValidate>
              <div className="space-y-3">
                {(['block', 'warn', 'allow'] as const).map((opt) => {
                  const meta = POLICY_LABELS[opt]
                  const isSelected = currentPolicyValue === opt
                  return (
                    <Controller
                      key={opt}
                      name="defaultPolicy"
                      control={control}
                      render={({ field }) => (
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${isSelected ? meta.color : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'} ${!canConfigure ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <input
                            type="radio"
                            value={opt}
                            checked={field.value === opt}
                            onChange={() => field.onChange(opt)}
                            disabled={!canConfigure}
                            className="mt-0.5 h-4 w-4 border-zinc-300 text-prominent-purple-700"
                          />
                          <div>
                            <p className="font-medium text-zinc-900">{meta.label}</p>
                            <p className="mt-0.5 text-sm text-zinc-500">{meta.description}</p>
                          </div>
                        </label>
                      )}
                    />
                  )
                })}
              </div>
              {errors.defaultPolicy && (
                <p className="mt-2 text-xs text-red-600">{errors.defaultPolicy.message}</p>
              )}

              {canConfigure && (
                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving || !isDirty}
                    className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSaving ? 'Saving…' : 'Save Policy'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Violations */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-base font-semibold text-zinc-900">Negative Stock Violations</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Items currently at or below zero stock.</p>
          </div>
          {isLoadingViolations ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading violations…</div>
          ) : violations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="mb-3 h-8 w-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No violations found</p>
              <p className="mt-1 text-xs text-zinc-400">
                All items are currently above zero stock.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {violations.map((v) => (
                    <tr key={v.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{v.itemName ?? v.itemId ?? '—'}</p>
                        {v.itemSku && (
                          <p className="font-mono text-xs text-zinc-400">{v.itemSku}</p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                        {v.warehouseName ?? v.warehouseId ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">
                        {v.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
