'use client'

import { useState } from 'react'
import { RefreshCw, Plus, Coins } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useRevaluation } from '../_hooks/useRevaluation'
import { REASON_CODE_LABELS, REASON_CODES } from '@/src/schema/inventory/revaluation'
import type { CreateRevaluationFormValues } from '@/src/schema/inventory/revaluation'

function formatCurrency(value?: number): string {
  if (value == null) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function reasonLabel(code: string): string {
  return REASON_CODE_LABELS[code as keyof typeof REASON_CODE_LABELS] ?? code
}

const INITIAL_FORM: CreateRevaluationFormValues = {
  itemId: '',
  warehouseId: '',
  newCost: 0,
  reasonCode: 'other',
  notes: '',
}

export default function RevaluationPageView({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.REVALUATION_CREATE)

  const {
    records,
    isLoading,
    isFetching,
    isModalOpen,
    setIsModalOpen,
    itemOptions,
    warehouseOptions,
    createRevaluation,
    isCreating,
    refetch,
  } = useRevaluation()

  const [form, setForm] = useState<CreateRevaluationFormValues>(INITIAL_FORM)
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CreateRevaluationFormValues, string>>
  >({})

  function validateForm(): boolean {
    const errors: Partial<Record<keyof CreateRevaluationFormValues, string>> = {}
    if (!form.itemId) errors.itemId = 'Item is required'
    if (!form.warehouseId) errors.warehouseId = 'Warehouse is required'
    if (!form.newCost || form.newCost <= 0) errors.newCost = 'New cost must be greater than 0'
    if (!form.reasonCode) errors.reasonCode = 'Reason code is required'
    if (!form.notes || form.notes.length < 10) errors.notes = 'Notes must be at least 10 characters'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return
    await createRevaluation(form)
    setForm(INITIAL_FORM)
    setFormErrors({})
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    setForm(INITIAL_FORM)
    setFormErrors({})
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Inventory Revaluation</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Create and review inventory revaluation entries to adjust carrying values.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Revaluation
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
            isFetching ? 'opacity-60' : ''
          }`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              Loading revaluation history…
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Coins className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No revaluation entries yet</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Create a revaluation entry to adjust inventory carrying values.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell">
                      SKU
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                      Warehouse
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                      Old Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      New Cost
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">
                      Change
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">
                      Reason
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:table-cell">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {records.map((record) => {
                    const change = record.oldCost != null ? record.newCost - record.oldCost : null
                    const changePositive = change != null && change >= 0
                    const notesPreview =
                      record.notes.length > 40 ? record.notes.slice(0, 40) + '…' : record.notes

                    return (
                      <tr key={record.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                          {formatDate(record.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">{record.item?.name ?? '—'}</p>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                            {record.item?.sku ?? '—'}
                          </code>
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                          {record.warehouse?.name ?? '—'}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-zinc-600 md:table-cell">
                          {formatCurrency(record.oldCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-900">
                          {formatCurrency(record.newCost)}
                        </td>
                        <td className="hidden px-4 py-3 text-right lg:table-cell">
                          {change != null ? (
                            <span
                              className={`font-medium ${changePositive ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {changePositive ? '+' : ''}
                              {formatCurrency(change)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                          {reasonLabel(record.reasonCode)}
                        </td>
                        <td
                          className="hidden px-4 py-3 text-zinc-500 xl:table-cell"
                          title={record.notes}
                        >
                          {notesPreview}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Revaluation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">New Revaluation</h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {/* Item */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Item <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.itemId}
                  onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="">Select an item…</option>
                  {itemOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {formErrors.itemId && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.itemId}</p>
                )}
              </div>

              {/* Warehouse */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.warehouseId}
                  onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="">Select a warehouse…</option>
                  {warehouseOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {formErrors.warehouseId && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.warehouseId}</p>
                )}
              </div>

              {/* New Unit Cost */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  New Unit Cost <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.newCost || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, newCost: parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                {formErrors.newCost && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.newCost}</p>
                )}
              </div>

              {/* Reason Code */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Reason Code <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.reasonCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      reasonCode: e.target.value as CreateRevaluationFormValues['reasonCode'],
                    }))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  {REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {REASON_CODE_LABELS[code]}
                    </option>
                  ))}
                </select>
                {formErrors.reasonCode && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.reasonCode}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Provide at least 10 characters describing the reason for revaluation…"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500 resize-none"
                />
                {formErrors.notes && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Submit Revaluation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
