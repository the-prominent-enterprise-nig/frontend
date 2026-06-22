'use client'

import { useState, useTransition } from 'react'
import { Pencil, X, Save, RotateCcw } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import type { BranchPaymentMethod, PosPaymentMethod } from '@/src/schema/pos'
import {
  saveBranchPaymentMethods,
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
  const [editMethods, setEditMethods] = useState<BranchPaymentMethod[]>(initialMethods)
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleEdit = () => {
    setEditMethods(methods.map((m) => ({ ...m })))
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditMethods(methods.map((m) => ({ ...m })))
    setIsEditing(false)
  }

  const handleToggle = (method: PosPaymentMethod) => {
    setEditMethods((prev) =>
      prev.map((m) =>
        m.method === method && m.ownerDefault ? { ...m, isEnabled: !m.isEnabled } : m
      )
    )
  }

  const handleSave = () => {
    const changes = editMethods
      .filter((em) => {
        const original = methods.find((m) => m.method === em.method)
        return original?.isEnabled !== em.isEnabled
      })
      .map((m) => ({ method: m.method, isEnabled: m.isEnabled }))

    if (changes.length === 0) {
      setIsEditing(false)
      return
    }

    startTransition(async () => {
      const result = await saveBranchPaymentMethods(branchId, changes)
      if (!result.success) {
        showToast({ title: result.error || 'Failed to save payment methods', status: 'error' })
      } else {
        setMethods(editMethods.map((m) => ({ ...m })))
        setIsEditing(false)
        showToast({ title: `Payment methods saved for ${branchName}`, status: 'success' })
      }
    })
  }

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetBranchPaymentMethods(branchId)
      if (!result.success) {
        showToast({ title: 'Failed to reset payment methods', status: 'error' })
      } else {
        const reset = methods.map((m) => ({ ...m, isEnabled: m.ownerDefault, isOverridden: false }))
        setMethods(reset)
        setEditMethods(reset.map((r) => ({ ...r })))
        setIsEditing(false)
        showToast({
          title: `Payment methods reset to defaults for ${branchName}`,
          status: 'success',
        })
      }
    })
  }

  const displayed = isEditing ? editMethods : methods
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
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Methods disabled by the Business Owner cannot be enabled here.
        </span>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-prominent-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-orange-600 transition-colors disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEdit}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
        {displayed.map((m) => {
          const disabledByOwner = !m.ownerDefault
          const canToggle = isEditing && !disabledByOwner && !readOnly

          return (
            <div
              key={m.method}
              className={`flex items-center justify-between px-4 py-3 ${disabledByOwner ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{m.label}</span>
                {disabledByOwner && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
                    Disabled by Business Owner
                  </span>
                )}
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={m.isEnabled && !disabledByOwner}
                disabled={!canToggle || isPending}
                onClick={() => canToggle && handleToggle(m.method)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${
                  canToggle ? 'cursor-pointer' : 'cursor-default'
                } ${m.isEnabled && !disabledByOwner ? 'bg-prominent-orange-500' : 'bg-gray-200'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    m.isEnabled && !disabledByOwner ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )
        })}
      </div>

      {!readOnly && !isEditing && hasOverrides && (
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
