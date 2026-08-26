'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import {
  createPaymentMethodOption,
  updatePaymentMethodOption,
  deletePaymentMethodOption,
} from '../../../pos/_actions/pos-actions'
import type { PaymentMethodConfig } from '@/src/schema/pos'

type Props = {
  initialMethods: PaymentMethodConfig[]
}

// Scenario 37 — only these three methods carry a named sub-choice today.
// Filtered by key rather than hardcoding labels here, so a future standard
// method just needs its own STANDARD_METHOD_OPTIONS entry on the backend to
// show up the same way.
const OPTION_METHOD_KEYS = ['card', 'bank_transfer', 'qr']

export default function PaymentMethodOptionsSection({ initialMethods }: Props) {
  const [methods, setMethods] = useState(initialMethods)
  const [newOptionName, setNewOptionName] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const relevantMethods = methods.filter((m) => OPTION_METHOD_KEYS.includes(m.key ?? ''))

  function patchConfig(configId: string, updater: (m: PaymentMethodConfig) => PaymentMethodConfig) {
    setMethods((prev) => prev.map((m) => (m.id === configId ? updater(m) : m)))
  }

  function handleAdd(configId: string) {
    const name = (newOptionName[configId] ?? '').trim()
    if (!name) return
    setPendingId(configId)
    startTransition(async () => {
      const result = await createPaymentMethodOption(configId, name)
      if (result.success && result.data) {
        const created = result.data
        patchConfig(configId, (m) => ({ ...m, options: [...m.options, created] }))
        setNewOptionName((prev) => ({ ...prev, [configId]: '' }))
        showToast({ title: 'Option added', status: 'success' })
      } else {
        showToast({ title: 'Failed to add option', description: result.error, status: 'error' })
      }
      setPendingId(null)
    })
  }

  function handleToggle(configId: string, optionId: string, isEnabled: boolean) {
    setPendingId(optionId)
    startTransition(async () => {
      const result = await updatePaymentMethodOption(configId, optionId, { isEnabled })
      if (result.success && result.data) {
        const updated = result.data
        patchConfig(configId, (m) => ({
          ...m,
          options: m.options.map((o) => (o.id === optionId ? updated : o)),
        }))
      } else {
        showToast({ title: 'Failed to update option', description: result.error, status: 'error' })
      }
      setPendingId(null)
    })
  }

  function handleDelete(configId: string, optionId: string) {
    setPendingId(optionId)
    startTransition(async () => {
      const result = await deletePaymentMethodOption(configId, optionId)
      if (result.success) {
        patchConfig(configId, (m) => ({
          ...m,
          options: m.options.filter((o) => o.id !== optionId),
        }))
        showToast({ title: 'Option removed', status: 'success' })
      } else {
        showToast({
          title: 'Failed to remove option',
          description: result.error?.includes('IN_USE')
            ? 'Still referenced by a payment — disable it instead of deleting.'
            : result.error,
          status: 'error',
        })
      }
      setPendingId(null)
    })
  }

  if (relevantMethods.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
        Couldn&apos;t load payment methods.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {relevantMethods.map((m) => (
        <div
          key={m.id}
          data-testid={`payment-method-options-${m.key}`}
          className="rounded-2xl border border-zinc-200 bg-white shadow-sm"
        >
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">{m.name}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {m.key === 'card'
                ? 'The POS Terminal offered when a card payment is entered.'
                : m.key === 'bank_transfer'
                  ? 'The bank offered when a bank transfer is entered.'
                  : 'The gateway offered when a QR payment is entered.'}
            </p>
          </div>
          <div className="divide-y divide-zinc-100">
            {m.options.length === 0 && (
              <p className="px-6 py-4 text-sm text-zinc-400">No options yet.</p>
            )}
            {m.options.map((o) => (
              <div
                key={o.id}
                data-testid={`payment-method-option-row-${o.id}`}
                className="flex items-center justify-between px-6 py-3"
              >
                <span className={`text-sm ${o.isEnabled ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  {o.name}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={o.isEnabled}
                    disabled={isPending && pendingId === o.id}
                    onClick={() => handleToggle(m.id, o.id, !o.isEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${o.isEnabled ? 'bg-prominent-purple-700' : 'bg-zinc-200'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${o.isEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    disabled={isPending && pendingId === o.id}
                    onClick={() => handleDelete(m.id, o.id)}
                    className="rounded-lg p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-zinc-200 px-6 py-4">
            <input
              type="text"
              value={newOptionName[m.id] ?? ''}
              onChange={(e) => setNewOptionName((prev) => ({ ...prev, [m.id]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd(m.id)}
              placeholder="e.g. BDO"
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
            <button
              type="button"
              disabled={isPending && pendingId === m.id}
              onClick={() => handleAdd(m.id)}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isPending && pendingId === m.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
