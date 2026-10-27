'use client'

import Link from 'next/link'
import { AlertTriangle, Info } from 'lucide-react'
import { MONO } from '@/src/libs/design/plex'
import type { PriceListImportResult } from '@/src/schema/inventory/price-lists/import'

export function skippedCount(totals: PriceListImportResult['totals']): number {
  return (
    totals.otherPriceUse +
    totals.noList +
    totals.notInCatalog +
    totals.ambiguous +
    totals.duplicates +
    totals.errors
  )
}

type Stat = { label: string; value: number; note: string; tone: string }

function buildStats(totals: PriceListImportResult['totals']): Stat[] {
  const skipped = skippedCount(totals)
  return [
    {
      label: 'Will add',
      value: totals.toCreate,
      note: 'new items on this list',
      tone: 'text-[#0b6644]',
    },
    {
      label: 'Will update',
      value: totals.toUpdate,
      note: 'items already on the list',
      tone: 'text-[#3f1490]',
    },
    {
      label: 'Skipped',
      value: skipped,
      note: skipped ? 'listed below — not uploaded' : 'every row is good',
      tone: skipped ? 'text-[#d18b1d]' : 'text-[#17171c]',
    },
    {
      label: 'Will clear a value',
      value: totals.warnings,
      note: totals.warnings ? 'blank cells wipe an old one' : 'nothing is wiped',
      tone: totals.warnings ? 'text-[#d18b1d]' : 'text-[#17171c]',
    },
  ]
}

export function ImportSummary({
  result,
  bulkHint = false,
}: {
  result: PriceListImportResult
  /** Offered on a single list's upload, where other price uses get skipped. */
  bulkHint?: boolean
}) {
  const liveLists = result.targets.filter((t) => t.listStatus === 'active')
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#e4e4e9] bg-white lg:grid-cols-4">
        {buildStats(result.totals).map((stat, index) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 px-4 py-3 ${index % 2 === 1 ? 'border-l border-[#eeeef1]' : ''} lg:border-l lg:first:border-l-0 ${index > 1 ? 'border-t border-[#eeeef1] lg:border-t-0' : ''}`}
          >
            <span
              className={`${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
            >
              {stat.label}
            </span>
            <span className={`${MONO} text-[19px] font-semibold tracking-tight ${stat.tone}`}>
              {stat.value.toLocaleString()}
            </span>
            <span className="text-[11px] text-[#5b5b6b]">{stat.note}</span>
          </div>
        ))}
      </div>

      {result.blockedReason && (
        <div className="flex gap-2 rounded-lg border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3 text-sm text-[#8f1c14]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">This file can’t be uploaded yet. </span>
            {result.blockedReason}
          </span>
        </div>
      )}

      {bulkHint && result.totals.otherPriceUse > 0 && (
        <div className="flex gap-2 rounded-lg border border-[#c5d6f0] bg-[#eaf0fb] px-4 py-3 text-sm text-[#1f4b99]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {result.totals.otherPriceUse.toLocaleString()} row(s) are for other price uses and were
            skipped. To send the whole sheet — every price use — in one go, use{' '}
            <Link href="/pos/catalog/price-lists/upload" className="font-medium underline">
              Bulk upload
            </Link>
            .
          </span>
        </div>
      )}

      {liveLists.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-[#c5d6f0] bg-[#eaf0fb] px-4 py-3 text-sm text-[#1f4b99]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {liveLists.length === 1 ? 'This list is' : `${liveLists.length} of these lists are`}{' '}
            active. Uploading moves {liveLists.length === 1 ? 'the whole list' : 'each whole list'}{' '}
            back to Pending Approval — {liveLists.length === 1 ? 'it stops' : 'they stop'} applying
            at checkout (not just these items) until someone re-approves.
          </span>
        </div>
      )}

      {result.skippedBlankRows > 0 && (
        <p className="text-xs text-[#8b8b9b]">
          {result.skippedBlankRows} fully blank row(s) ignored.
        </p>
      )}
    </div>
  )
}
