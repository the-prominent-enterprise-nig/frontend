'use client'

import { X, Loader2, Layers, AlertCircle } from 'lucide-react'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { BundleComponentSummary } from '@/src/schema/inventory/bundles'

type Props = {
  isOpen: boolean
  bundle: ItemSummary | null
  components: BundleComponentSummary[]
  availableQty: number | null | undefined
  isLoading: boolean
  onClose: () => void
}

export default function BundleDetailModal({
  isOpen,
  bundle,
  components,
  availableQty,
  isLoading,
  onClose,
}: Props) {
  if (!isOpen) return null

  const isLowStock = availableQty !== null && availableQty !== undefined && availableQty <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Bundle Detail</h2>
            {bundle && <p className="mt-0.5 font-mono text-xs text-zinc-400">{bundle.sku}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : bundle ? (
            <div className="space-y-5">
              {/* Bundle identity */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Name</p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900">{bundle.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">SKU</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-900">
                    {bundle.sku}
                  </p>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid gap-4 sm:grid-cols-2">
                {bundle.costPrice != null && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Cost Price
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-700">
                      {bundle.costPrice.toLocaleString('en-PH', {
                        style: 'currency',
                        currency: 'PHP',
                      })}
                    </p>
                  </div>
                )}
                {bundle.sellingPrice != null && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Selling Price
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-700">
                      {bundle.sellingPrice.toLocaleString('en-PH', {
                        style: 'currency',
                        currency: 'PHP',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Availability banner */}
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isLowStock ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                }`}
              >
                <Layers
                  className={`h-5 w-5 shrink-0 ${isLowStock ? 'text-red-600' : 'text-green-600'}`}
                />
                <div>
                  <p
                    className={`text-xs font-medium ${
                      isLowStock ? 'text-red-800' : 'text-green-800'
                    }`}
                  >
                    Bundle Availability
                  </p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      isLowStock ? 'text-red-700' : 'text-green-700'
                    }`}
                  >
                    {availableQty ?? '—'} units
                  </p>
                  <p className="text-xs text-zinc-500">
                    Minimum of floor(component stock ÷ required qty)
                  </p>
                </div>
              </div>

              {/* Components table */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Component Items ({components.length})
                </p>

                {components.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-zinc-400" />
                    <p className="text-sm text-zinc-500">No components found for this bundle.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Component
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Qty / Bundle
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            In Stock
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Contributes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {components.map((comp, i) => {
                          const inStock = comp.availableStock ?? null
                          const contributes =
                            inStock !== null && comp.quantityPerBundle > 0
                              ? Math.floor(inStock / comp.quantityPerBundle)
                              : null
                          const isBottleneck =
                            contributes !== null &&
                            availableQty !== null &&
                            availableQty !== undefined &&
                            contributes === availableQty

                          return (
                            <tr key={comp.id ?? i} className="hover:bg-zinc-50">
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-zinc-900">
                                  {comp.componentItem?.name ?? '—'}
                                </p>
                                {comp.componentItem?.sku && (
                                  <p className="font-mono text-xs text-zinc-400">
                                    {comp.componentItem.sku}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center font-semibold text-zinc-700">
                                {comp.quantityPerBundle}
                              </td>
                              <td className="px-3 py-2.5 text-center text-zinc-600">
                                {inStock ?? '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {contributes !== null ? (
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      isBottleneck
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-zinc-100 text-zinc-600'
                                    }`}
                                  >
                                    {contributes}
                                    {isBottleneck && ' ⚠'}
                                  </span>
                                ) : (
                                  <span className="text-xs text-zinc-400">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-1.5 text-xs text-zinc-400">
                  ⚠ marks the bottleneck component limiting bundle availability.
                </p>
              </div>

              {bundle.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Description
                  </p>
                  <p className="mt-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    {bundle.description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-400">No bundle selected.</p>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
