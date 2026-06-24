'use client'

import { useState, useTransition } from 'react'
import { Pencil, X, Save } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import type { OwnerPaymentMethod, PosPaymentMethod } from '@/src/schema/pos'
import { saveOwnerPaymentMethods } from '@/src/app/(app)/(dashboard)/settings/configuration/_actions/owner-payment-methods'

interface Props {
  initialMethods: OwnerPaymentMethod[]
}

export function OwnerPaymentMethodsSection({ initialMethods }: Props) {
  const [methods, setMethods] = useState<OwnerPaymentMethod[]>(initialMethods)
  const [editMethods, setEditMethods] = useState<OwnerPaymentMethod[]>(initialMethods)
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
      prev.map((m) => (m.method === method ? { ...m, isEnabled: !m.isEnabled } : m))
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
      const result = await saveOwnerPaymentMethods(changes)
      if (!result.success) {
        showToast({ title: 'Failed to save payment methods', status: 'error' })
      } else {
        setMethods(editMethods.map((m) => ({ ...m })))
        setIsEditing(false)
        showToast({ title: 'Payment methods saved', status: 'success' })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Payment Methods</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Methods disabled here are off for all branches and cannot be overridden.
          </p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={handleEdit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
        {(isEditing ? editMethods : methods).map((m) => (
          <div key={m.method} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-gray-800">{m.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={m.isEnabled}
              disabled={!isEditing || isPending}
              onClick={() => handleToggle(m.method)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${
                isEditing ? 'cursor-pointer' : 'cursor-default'
              } ${m.isEnabled ? 'bg-prominent-orange-500' : 'bg-gray-200'} ${
                !isEditing ? 'opacity-80' : ''
              }`}
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
    </div>
  )
}
