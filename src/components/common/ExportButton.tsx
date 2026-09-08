'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadXlsx } from '@/src/libs/export/downloadXlsx'

interface Props {
  /** Backend path of the report's `/export` sibling, e.g. `/pos/reports/sales-by-branch/export` */
  endpoint: string
  /** Same query params the on-screen report was loaded with — that's what keeps
   * the file and the screen in agreement. */
  params?: Record<string, string | number | boolean | undefined | null>
  fallbackFilename?: string
  label?: string
  disabled?: boolean
}

/** Shared "Export to Excel" action for every Scenario 47 report. */
export default function ExportButton({
  endpoint,
  params = {},
  fallbackFilename,
  label = 'Export to Excel',
  disabled = false,
}: Props): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  const handleClick = async (): Promise<void> => {
    setBusy(true)
    try {
      await downloadXlsx(endpoint, params, fallbackFilename)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? 'Preparing…' : label}
    </button>
  )
}
