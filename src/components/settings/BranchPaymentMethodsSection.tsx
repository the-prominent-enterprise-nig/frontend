'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { BranchPaymentMethod } from '@/src/schema/pos'
import {
  toggleBranchPaymentMethod,
  resetBranchPaymentMethods,
} from '@/src/app/(app)/(dashboard)/settings/branches/[id]/_actions/branch-payment-methods'

interface Props {
  branchId: string
  branchName: string
  initialMethods: BranchPaymentMethod[]
  readOnly?: boolean
}

export function BranchPaymentMethodsSection({
  branchId,
  branchName,
  initialMethods,
  readOnly = false,
}: Props) {
  const [methods, setMethods] = useState<BranchPaymentMethod[]>(initialMethods)
  const [toggling, setToggling] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleToggle = (method: BranchPaymentMethod) => {
    if (readOnly || toggling) return
    const next = !method.isEnabled
    setToggling(method.method)

    // Optimistic update
    setMethods((prev) =>
      prev.map((m) =>
        m.method === method.method ? { ...m, isEnabled: next, isOverridden: true } : m
      )
    )

    startTransition(async () => {
      const result = await toggleBranchPaymentMethod(branchId, method.method, next)
      if (!result.success) {
        // Roll back
        setMethods((prev) =>
          prev.map((m) =>
            m.method === method.method
              ? { ...m, isEnabled: method.isEnabled, isOverridden: method.isOverridden }
              : m
          )
        )
        showToast({ title: 'Failed to update payment method', status: 'error' })
      } else {
        showToast({
          title: `${method.label} ${next ? 'enabled' : 'disabled'} for ${branchName}`,
          status: 'success',
        })
      }
      setToggling(null)
    })
  }

  const handleReset = () => {
    if (readOnly || isPending) return
    startTransition(async () => {
      const result = await resetBranchPaymentMethods(branchId)
      if (!result.success) {
        showToast({ title: 'Failed to reset payment methods', status: 'error' })
      } else {
        setMethods((prev) =>
          prev.map((m) => ({ ...m, isEnabled: m.tenantDefault, isOverridden: false }))
        )
        showToast({
          title: `Payment methods reset to defaults for ${branchName}`,
          status: 'success',
        })
      }
    })
  }

  const hasOverrides = methods.some((m) => m.isOverridden)

  if (initialMethods.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
        <p className="text-sm text-gray-400">No payment methods available for this branch.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
        {methods.map((m) => (
          <div key={m.method} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-800">{m.label}</span>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              disabled={readOnly || toggling === m.method || isPending}
              onClick={() => handleToggle(m)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                m.isEnabled ? 'bg-prominent-orange-500' : 'bg-gray-200'
              }`}
              aria-checked={m.isEnabled}
              role="switch"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  m.isEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {!readOnly && hasOverrides && (
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to defaults
        </button>
      )}
    </div>
  )
}
