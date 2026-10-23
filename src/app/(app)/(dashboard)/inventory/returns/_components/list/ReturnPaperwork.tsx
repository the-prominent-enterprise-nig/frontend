'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import type { ReturnSummary } from '@/src/schema/inventory/returns'
import { printCustomerCopy } from '../printCustomerCopy'
import { paperworkRefs, outstandingCount, type PaperRef } from './paperwork'

const TONE: Record<PaperRef['tone'], string> = {
  filled: 'text-zinc-900',
  'n/a': 'text-zinc-400',
  missing: 'text-amber-700',
}

function RefField({ field }: { field: PaperRef }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {field.label}
      </dt>
      <dd className={`mt-0.5 break-all font-mono text-xs ${TONE[field.tone]}`}>
        {field.href && field.tone === 'filled' ? (
          <Link
            href={field.href}
            className="text-prominent-purple-700 underline-offset-2 hover:underline"
          >
            {field.value}
          </Link>
        ) : (
          field.value
        )}
      </dd>
    </div>
  )
}

/**
 * Every number the return can be quoted back by, in one card.
 *
 * These used to be stacked four-deep inside the Outcome column of the row
 * itself, where they wrapped, pushed the row to three lines, and still left
 * out the two that live in the ledger. A reference nobody can read at a
 * glance may as well be in the panel, where there is room to say what each
 * one is and whether it is actually missing.
 */
export default function ReturnPaperwork({
  ret,
  processedAt,
}: {
  ret: ReturnSummary
  processedAt: string
}) {
  const refs = paperworkRefs(ret)
  const outstanding = outstandingCount(refs)
  const [printing, setPrinting] = useState(false)

  // Only a return raised as a document has a copy to reprint. The legacy
  // single-ledger-row returns predate the header this is built from, and the
  // endpoint has nothing to answer with for them — so the button is absent
  // rather than present and failing.
  const canReprint = ret.outcome === 'document'

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Paperwork
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              outstanding ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {outstanding ? `${outstanding} outstanding` : 'Complete'}
          </span>
          {/* The counter's own reason to come back to this row: a customer
              who lost the copy they left with. Same document the posted
              dialog prints, off the same endpoint. */}
          {canReprint && (
            <button
              type="button"
              onClick={async () => {
                setPrinting(true)
                try {
                  await printCustomerCopy(ret.id)
                } finally {
                  setPrinting(false)
                }
              }}
              disabled={printing}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {printing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Printer className="h-3 w-3" />
              )}
              Print customer copy
            </button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
        {refs.map((field) => (
          <RefField key={field.label} field={field} />
        ))}
      </dl>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-zinc-100 bg-zinc-50/70 px-4 py-3">
        <div className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Processed
          </dt>
          <dd className="mt-0.5 text-sm text-zinc-700">{processedAt}</dd>
        </div>
        <div className="min-w-[14rem] flex-1">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Notes
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700">
            {ret.notes || <span className="text-zinc-400">None</span>}
          </dd>
        </div>
      </div>
    </div>
  )
}
