'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { usePriceListUpload } from '../../_hooks/usePriceListUpload'
import { FileStep } from './FileStep'
import { ReviewStep, isImportable } from './ReviewStep'
import { SkippedRowsTable } from './ImportRowsTables'
import { ImportDone } from './ImportDone'
import { PLEX } from '@/src/libs/design/plex'

/** One file for every price use: each row is sent to the company-wide list
 * for its PRICE USE, and every list is written in a single transaction. */
export function AllListsUploadPageView() {
  const upload = usePriceListUpload()
  const { result, phase } = upload

  return (
    <div className={`w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8 ${PLEX}`}>
      <div className="space-y-5">
        <div>
          <Link
            href="/inventory/price-lists"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#5b5b6b] hover:text-[#3f1490]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to price lists
          </Link>
          <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">Bulk upload</h1>
          <p className="mt-1.5 text-sm text-[#5b5b6b]">
            Upload the whole price sheet in one go — WIP, CR-BR, SSC, Zero Interest, Credit Card,
            Tonik, Skyro and the rest. No need to pick a price use: each row is added to, or
            updates, the price list for its own PRICE USE.
          </p>
        </div>

        {phase === 'done' && result ? (
          <>
            <ImportDone result={result} onUploadAnother={upload.reset} />
            {/* Kept after the upload so the skipped rows can still be downloaded and fixed. */}
            <SkippedRowsTable rows={result.rows.filter((r) => !isImportable(r.status))} />
          </>
        ) : (
          <>
            <FileStep
              file={upload.file}
              isBusy={phase === 'previewing' || phase === 'applying'}
              onFile={upload.preview}
            />
            {result && (phase === 'review' || phase === 'applying') && (
              <ReviewStep
                result={result}
                showTargets
                isApplying={phase === 'applying'}
                onApply={upload.apply}
                onCancel={upload.reset}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
