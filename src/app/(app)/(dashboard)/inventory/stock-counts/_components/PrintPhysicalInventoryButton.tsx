'use client'

import { useState, type ReactElement } from 'react'
import { Loader2, Printer } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import { printPhysicalInventory } from '@/src/libs/print/printPhysicalInventory'
import { getCountLines } from '../_actions/get-count-lines'
import type { CountSummary } from '@/src/schema/inventory/stock-counts'

/**
 * Scenario 87 Part 4 — prints a completed physical inventory: the Monthly
 * Physical Inventory (note, certification, sign-off) and its Stock Count
 * Sheet. Lines are fetched fresh at print time, never from a cached sheet.
 */
export default function PrintPhysicalInventoryButton({
  count,
  variant = 'button',
}: {
  count: CountSummary
  /** 'icon' for a list row (with a tooltip), 'button' for the session view. */
  variant?: 'icon' | 'button'
}): ReactElement {
  const [busy, setBusy] = useState(false)

  const print = async (): Promise<void> => {
    setBusy(true)
    const opened = await printPhysicalInventory(count, async () => {
      const res = await getCountLines(count.id)
      return res.success && res.data ? res.data : null
    })
    setBusy(false)
    if (!opened) {
      showToast({
        title: 'Could not open the printout',
        description: 'Allow pop-ups for this site, then try again.',
        status: 'error',
      })
    }
  }

  const icon = busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />

  if (variant === 'icon') {
    return (
      <Tooltip label="Print physical inventory" align="end">
        <button
          type="button"
          aria-label="Print physical inventory"
          disabled={busy}
          onClick={(e) => {
            // The row itself opens the count; printing shouldn't.
            e.stopPropagation()
            void print()
          }}
          className="rounded-lg p-1.5 text-ink-muted hover:bg-prominent-purple-50 hover:text-prominent-purple-700 disabled:opacity-50"
        >
          {icon}
        </button>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void print()}
      disabled={busy}
      className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
    >
      {icon}
      {busy ? 'Preparing…' : 'Print'}
    </button>
  )
}
