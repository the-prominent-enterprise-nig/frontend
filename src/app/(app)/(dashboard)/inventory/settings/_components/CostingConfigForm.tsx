'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Settings2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useCostingConfig } from '../_hooks/useCostingConfig'
import {
  COSTING_METHOD_LABELS,
  COSTING_METHOD_DESCRIPTIONS,
  COSTING_METHODS,
  type CostingMethod,
} from '@/src/schema/inventory/costing'
import type { SessionUser } from '@/src/libs/guards/permission'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export default function CostingConfigForm({ session }: { session: SessionUser }) {
  const canConfigure = hasPermission(session, INVENTORY_PERMISSIONS.COSTING_CONFIGURE)
  const { config, isLoading, updateConfig, isUpdating } = useCostingConfig()

  const [selectedMethod, setSelectedMethod] = useState<CostingMethod | null>(null)
  const [allowOverride, setAllowOverride] = useState<boolean | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const currentMethod = config?.defaultCostingMethod ?? null
  const currentAllowOverride = config?.allowPerItemOverride ?? true
  const pendingMethod = selectedMethod ?? currentMethod
  const pendingAllowOverride = allowOverride ?? currentAllowOverride

  const methodChanged = selectedMethod !== null && selectedMethod !== currentMethod
  const overrideChanged = allowOverride !== null && allowOverride !== currentAllowOverride
  const isDirty = methodChanged || overrideChanged

  function handleMethodSelect(method: CostingMethod) {
    if (!canConfigure) return
    setSelectedMethod(method === currentMethod ? null : method)
    setShowConfirm(false)
  }

  async function handleSave() {
    if (!pendingMethod) return
    await updateConfig({
      defaultCostingMethod: pendingMethod,
      allowPerItemOverride: pendingAllowOverride,
    })
    setSelectedMethod(null)
    setAllowOverride(null)
    setShowConfirm(false)
  }

  function handleCancel() {
    setSelectedMethod(null)
    setAllowOverride(null)
    setShowConfirm(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800">Stock Costing Method</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Configure how Cost of Goods Sold (COGS) and inventory valuation are calculated. Applies
          globally unless per-item overrides are enabled.
        </p>
      </div>

      {/* Method selector */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {COSTING_METHODS.map((method) => {
            const isSelected = pendingMethod === method
            const isCurrent = currentMethod === method
            return (
              <button
                key={method}
                type="button"
                onClick={() => handleMethodSelect(method)}
                disabled={!canConfigure || isUpdating}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-prominent-purple-500 bg-prominent-purple-50 ring-1 ring-prominent-purple-400'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                } ${!canConfigure ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? 'border-prominent-purple-600 bg-prominent-purple-600'
                          : 'border-zinc-300 bg-white'
                      }`}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-800">{COSTING_METHOD_LABELS[method]}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {COSTING_METHOD_DESCRIPTIONS[method]}
                      </p>
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle className="h-3 w-3" />
                      Current
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Per-item override toggle */}
      {!isLoading && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
          <div>
            <p className="font-medium text-zinc-800">Allow per-item costing method override</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              When enabled, individual items can use a different costing method than the global
              default.
            </p>
          </div>
          <button
            type="button"
            onClick={() => canConfigure && setAllowOverride(!pendingAllowOverride)}
            disabled={!canConfigure || isUpdating}
            className="ml-4 shrink-0 disabled:opacity-50"
          >
            {pendingAllowOverride ? (
              <ToggleRight className="h-8 w-8 text-prominent-purple-600" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-zinc-400" />
            )}
          </button>
        </div>
      )}

      {/* Mid-period warning (only when changing method) */}
      {methodChanged && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-800">
                Changing the costing method mid-period
              </p>
              <p className="text-sm text-amber-700">
                Switching from{' '}
                <strong>{currentMethod ? COSTING_METHOD_LABELS[currentMethod] : '—'}</strong> to{' '}
                <strong>{COSTING_METHOD_LABELS[selectedMethod!]}</strong> may require a revaluation
                entry if there are stock movements in the current open fiscal period. This cannot be
                reversed without a counter-entry.
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showConfirm}
                  onChange={(e) => setShowConfirm(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-prominent-purple-600"
                />
                <span className="text-sm font-medium text-amber-800">
                  I understand and confirm this change
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {isDirty && canConfigure && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isUpdating || (methodChanged && !showConfirm)}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            <Settings2 className="h-4 w-4" />
            {isUpdating ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUpdating}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      )}

      {!canConfigure && (
        <p className="text-xs text-zinc-400">
          You have read-only access. Contact a Finance Manager to make changes.
        </p>
      )}

      {config?.updatedAt && (
        <p className="text-xs text-zinc-400">
          Last updated:{' '}
          {new Date(config.updatedAt).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
