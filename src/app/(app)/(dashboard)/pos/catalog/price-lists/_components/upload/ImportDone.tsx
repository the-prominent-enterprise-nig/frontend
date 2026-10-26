'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { MONO } from '@/src/libs/design/plex'
import { skippedCount } from './ImportSummary'
import type { PriceListImportResult } from '@/src/schema/inventory/price-lists/import'

type Props = {
  result: PriceListImportResult
  /** Set when the upload went into one list — the link goes back to it. */
  priceListId?: string
  onUploadAnother: () => void
}

export function ImportDone({ result, priceListId, onUploadAnother }: Props) {
  const applied = result.applied ?? { created: 0, updated: 0 }
  const skipped = skippedCount(result.totals)
  const pending = result.targets.some((t) => t.listStatusAfter === 'pending_approval')
  return (
    <section className="rounded-xl border border-[#d7ebe2] bg-[#eef7f2] p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0b6644]" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-prominent-purple-900">Upload complete</h2>
          <p className="text-sm text-[#0b6644]">
            <span className={MONO}>{applied.created.toLocaleString()}</span> item(s) added,{' '}
            <span className={MONO}>{applied.updated.toLocaleString()}</span> updated
            {result.targets.length > 1 && <> across {result.targets.length} price lists</>}
            {skipped > 0 && (
              <>
                , <span className={MONO}>{skipped.toLocaleString()}</span> row(s) skipped
              </>
            )}
            .
          </p>
          {result.targets.length > 1 && (
            <ul className="space-y-0.5 text-xs text-[#5b5b6b]">
              {result.targets.map((t) => (
                <li key={t.listId}>
                  <span className="font-medium">{t.priceUse}</span> → {t.listName}:{' '}
                  {t.applied?.created.toLocaleString()} added, {t.applied?.updated.toLocaleString()}{' '}
                  updated
                </li>
              ))}
            </ul>
          )}
          {pending && (
            <p className="text-sm text-[#5b5b6b]">
              {result.targets.length > 1 ? 'These lists are' : 'The list is'} now Pending Approval —{' '}
              {result.targets.length > 1 ? 'they apply' : 'it applies'} at checkout once approved.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={
            priceListId ? `/pos/catalog/price-lists/${priceListId}` : '/pos/catalog/price-lists'
          }
          className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
        >
          {priceListId ? 'Back to price list' : 'Back to price lists'}
        </Link>
        <button
          type="button"
          onClick={onUploadAnother}
          className="rounded-lg px-4 py-2 text-sm font-medium text-[#3f1490] hover:bg-[#f0e9fc]"
        >
          Upload another file
        </button>
      </div>
    </section>
  )
}
