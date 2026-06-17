'use client'

import { useState } from 'react'
import { toast } from 'sonner'

const ALL_MODULES = [
  {
    code: 'accounting',
    label: 'Accounting',
    description: 'Journal entries, ledger, and financial reports.',
  },
  {
    code: 'inventory',
    label: 'Inventory',
    description: 'Stock tracking, adjustments, and warehouses.',
  },
  {
    code: 'pos',
    label: 'Point of Sale',
    description: 'Sales transactions, receipts, and cashiering.',
  },
  { code: 'crm', label: 'CRM', description: 'Customer profiles, leads, and follow-ups.' },
]

interface Props {
  enterpriseId: string
  initialModules: string[]
}

export function ModuleAssignmentForm({ enterpriseId, initialModules }: Props) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initialModules))
  const [baseline, setBaseline] = useState<string[]>([...initialModules].sort())
  const [saving, setSaving] = useState(false)

  const hasChanges = JSON.stringify([...enabled].sort()) !== JSON.stringify(baseline)

  function toggle(code: string) {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function enableAll() {
    setEnabled(new Set(ALL_MODULES.map((m) => m.code)))
  }

  function disableAll() {
    setEnabled(new Set())
  }

  async function save() {
    setSaving(true)
    try {
      const enabledModules = [...enabled]
      const res = await fetch(`/api/super-admin/enterprises/${enterpriseId}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledModules }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to save modules')
      }
      toast.success('Module access updated')
      setBaseline([...enabledModules].sort())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = enabled.size

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Actions bar */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={enableAll}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Enable All
            </button>
            <button
              onClick={disableAll}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Disable All
            </button>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {enabledCount} module{enabledCount !== 1 ? 's' : ''} enabled
          </span>
        </div>
        <button
          onClick={save}
          disabled={!hasChanges || saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_MODULES.map((m) => {
          const isEnabled = enabled.has(m.code)
          return (
            <button
              key={m.code}
              onClick={() => toggle(m.code)}
              className={`group flex items-start gap-3 rounded-lg border p-4 text-left transition-all ${
                isEnabled
                  ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40'
                  : 'border-zinc-100 bg-zinc-50 hover:border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700'
              }`}
            >
              {/* Toggle switch */}
              <div
                className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
                  isEnabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    isEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    isEnabled
                      ? 'text-indigo-900 dark:text-indigo-100'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {m.label}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{m.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {hasChanges && (
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You have unsaved changes. Click "Save Changes" to apply.
          </p>
        </div>
      )}
    </div>
  )
}
