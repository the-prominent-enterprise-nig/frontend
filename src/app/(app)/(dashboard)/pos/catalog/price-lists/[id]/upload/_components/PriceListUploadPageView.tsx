'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getPriceList } from '../../../_actions/get-price-list'
import { EDITABLE_STATUSES, STATUS_LABELS, statusTone } from '../../../_lib/price-list-format'
import { usePriceListUpload } from '../../../_hooks/usePriceListUpload'
import { FileStep } from '../../../_components/upload/FileStep'
import { ReviewStep, isImportable } from '../../../_components/upload/ReviewStep'
import { SkippedRowsTable } from '../../../_components/upload/ImportRowsTables'
import { ImportDone } from '../../../_components/upload/ImportDone'
import { PLEX } from '@/src/libs/design/plex'
import type { PriceListDetail } from '@/src/schema/inventory/price-lists'

function usePriceListHeader(priceListId: string) {
  return useQuery({
    queryKey: ['inventory-price-list-detail', priceListId],
    queryFn: async (): Promise<PriceListDetail> => {
      const res = await getPriceList(priceListId)
      if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to load price list')
      return res.data
    },
    staleTime: 10 * 1000,
  })
}

function BackLink({ priceListId, label }: { priceListId: string; label: string }) {
  return (
    <Link
      href={`/pos/catalog/price-lists/${priceListId}`}
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#5b5b6b] hover:text-[#3f1490]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}

/** Upload into ONE list — every row goes there; other price uses are skipped.
 * (The Price Lists page has the all-lists upload for a file that spans WIP,
 * SSC, ZI…) */
export function PriceListUploadPageView({ priceListId }: { priceListId: string }) {
  const { data: priceList, isLoading, error } = usePriceListHeader(priceListId)
  const upload = usePriceListUpload(priceListId)

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-24 text-[#8b8b9b]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (error || !priceList) {
    return (
      <div className={`w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8 ${PLEX}`}>
        <BackLink priceListId={priceListId} label="Back to price lists" />
        <p className="text-sm text-[#8f1c14]">Price list could not be found.</p>
      </div>
    )
  }

  const editable = EDITABLE_STATUSES.includes(priceList.status)
  const tone = statusTone(priceList.status)
  const { result, phase } = upload

  return (
    <div className={`w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8 ${PLEX}`}>
      <div className="space-y-5">
        <div>
          <BackLink priceListId={priceListId} label={`Back to ${priceList.name}`} />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
              Upload prices from CSV
            </h1>
            {priceList.priceUseType && (
              <span className="inline-flex rounded-md bg-[#f0e9fc] px-2.5 py-1 text-xs font-medium text-[#3f1490]">
                {priceList.priceUseType.name}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${tone.chip}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
              {STATUS_LABELS[priceList.status] ?? priceList.status}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[#5b5b6b]">
            Adds items to, and updates prices in,{' '}
            <span className="font-medium">{priceList.name}</span> only. Have the whole sheet, with
            every price use? Use{' '}
            <Link
              href="/pos/catalog/price-lists/upload"
              className="font-medium text-[#5b21b6] hover:text-[#3f1490]"
            >
              Bulk upload
            </Link>{' '}
            instead.
          </p>
        </div>

        {!editable ? (
          <div className="rounded-lg border border-[#f5e2c6] bg-[#fdf3e7] px-4 py-2 text-sm text-[#8a4b06]">
            This list is {priceList.status.replace('_', ' ')} — it can’t be edited. Create a new
            version to make changes.
          </div>
        ) : phase === 'done' && result ? (
          <>
            <ImportDone result={result} priceListId={priceListId} onUploadAnother={upload.reset} />
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
                showTargets={false}
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
