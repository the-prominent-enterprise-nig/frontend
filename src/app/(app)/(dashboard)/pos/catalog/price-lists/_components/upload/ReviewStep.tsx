'use client'

import { Loader2 } from 'lucide-react'
import { ImportSummary } from './ImportSummary'
import { TargetsTable } from './TargetsTable'
import { ChangesTable, SkippedRowsTable } from './ImportRowsTables'
import type { PriceListImportResult } from '@/src/schema/inventory/price-lists/import'

export const isImportable = (status: string): boolean => status === 'create' || status === 'update'

type Props = {
  result: PriceListImportResult
  /** Several lists are involved — show where each price use goes. */
  showTargets: boolean
  isApplying: boolean
  onApply: () => void
  onCancel: () => void
}

export function ReviewStep({ result, showTargets, isApplying, onApply, onCancel }: Props) {
  const changes = result.rows.filter((r) => isImportable(r.status))
  const skipped = result.rows.filter((r) => !isImportable(r.status))
  const writeCount = changes.length
  const canApply = writeCount > 0 && !result.blockedReason
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-prominent-purple-900">2. Review</h2>
      <ImportSummary result={result} bulkHint={!showTargets} />
      {showTargets && <TargetsTable targets={result.targets} />}
      <ChangesTable rows={changes} showPriceUse={showTargets} />
      <SkippedRowsTable rows={skipped} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canApply || isApplying}
          onClick={onApply}
          className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
          {writeCount > 0
            ? `Upload ${writeCount.toLocaleString()} item${writeCount === 1 ? '' : 's'}`
            : 'Nothing to upload'}
        </button>
        <button
          type="button"
          disabled={isApplying}
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
