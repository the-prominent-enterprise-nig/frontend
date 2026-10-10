'use client'

import { AlertTriangle, ShieldCheck } from 'lucide-react'
import {
  describeChange,
  type TaxOverrideChange,
  type TaxOverrideEntry,
} from '@/src/libs/tax/tax-override'

// Scenario 69 Part I — a tax code changed away from its default, on a form and on
// the document's own page. The server enforces the permission and the reason;
// these say what is going on so nobody finds out after pressing Save.

const when = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * The reason a form asks for when a tax code is kept away from its default, with
 * any change already on record shown beside it. Nothing at all when there is
 * neither.
 */
export function TaxOverrideBox({
  testId = 'tax-override',
  changes,
  standing = [],
  canOverride,
  reason,
  onReason,
}: {
  testId?: string
  /** The changes that are new: nothing on record covers them yet. */
  changes: TaxOverrideChange[]
  /** Changes already on the document, which stand as they were made. */
  standing?: TaxOverrideEntry[]
  canOverride: boolean
  reason: string
  onReason: (value: string) => void
}) {
  if (changes.length === 0 && standing.length === 0) return null
  return (
    <div className="space-y-3" data-testid={testId}>
      {standing.length > 0 && <TaxOverrideSummary entries={standing} title="Changed earlier" />}
      {changes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <AlertTriangle size={13} aria-hidden />
            {changes.length > 1
              ? 'Tax codes were changed from their defaults'
              : 'A tax code was changed from its default'}
          </div>
          <ul
            className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-900"
            data-testid={`${testId}-changes`}
          >
            {changes.map((c) => (
              <li key={`${c.field}-${c.line ?? 'doc'}-${c.to}`}>{describeChange(c)}</li>
            ))}
          </ul>
          {canOverride ? (
            <label className="mt-2 block">
              <span className="mb-1 block text-xs font-medium text-amber-900">Why? *</span>
              <textarea
                data-testid={`${testId}-reason`}
                aria-label="Reason the tax code was changed"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => onReason(e.target.value)}
                placeholder="e.g. Delivery van, capitalised"
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
              <span className="mt-1 block text-[11px] text-amber-800">
                Kept with the document, with your name and the time, and listed on the Tax Code
                Exception Report.
              </span>
            </label>
          ) : (
            <p
              role="status"
              data-testid={`${testId}-denied`}
              className="mt-2 text-xs text-amber-900"
            >
              Changing a tax code from its default needs the tax-code override permission. Ask an
              accountant, or put the code back.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** What was changed from its default on a document, why, by whom and when. */
export function TaxOverrideSummary({
  entries,
  title = 'Tax codes changed from their defaults',
  testId = 'tax-override-summary',
}: {
  entries: TaxOverrideEntry[] | null | undefined
  title?: string
  testId?: string
}) {
  if (!entries || entries.length === 0) return null
  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-3"
      data-testid={testId}
      aria-label={title}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-prominent-purple-900">
        <ShieldCheck size={13} aria-hidden />
        {title}
      </div>
      <ul className="mt-2 space-y-2">
        {entries.map((e) => (
          <li
            key={`${e.field}-${e.line ?? 'doc'}-${e.to}`}
            className="text-xs text-gray-700"
            data-testid="tax-override-entry"
          >
            <div className="font-medium text-gray-900">
              {describeChange({ field: e.field, line: e.line, from: e.from, to: e.to })}
            </div>
            <div className="text-gray-600">
              &ldquo;{e.reason}&rdquo; · {e.byName ?? 'Someone'}
              {e.at ? `, ${when(e.at)}` : ''}
              {e.approvedByName ? ` · approved by ${e.approvedByName}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
