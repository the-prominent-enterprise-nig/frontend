'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import { printAgingRawDataDocument } from '@/src/libs/print/printInventoryDocument'
import type { AgingFilters } from '../_params'

/**
 * Print always fetches the complete report with the current filters, so it can
 * never print data that was loaded before the filters (or the backend) changed.
 * That is the one place the full ~30 MB structure is still wanted.
 */
export function PrintButton({
  filters,
  disabled,
}: {
  filters: AgingFilters
  disabled: boolean
}): React.JSX.Element {
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePrint = async () => {
    setPrinting(true)
    setError(null)
    const res = await installmentAccountsApi.agingReport(filters)
    setPrinting(false)
    if (res.success && res.data) printAgingRawDataDocument(res.data)
    else setError(res.error ?? 'Failed to load the aging report')
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={handlePrint}
        disabled={disabled || printing}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Printer className="h-4 w-4" />
        {printing ? 'Preparing…' : 'Print'}
      </button>
    </div>
  )
}
