'use client'

import { useMe } from '@/src/hooks/useMe'
import { can } from '@/src/libs/guards/permission'

/**
 * Whether the signed-in person edits a recorded entry as the Business Owner
 * does — holding `permission` (accounting:recorded-entries:edit, or
 * pos:new-receipts:edit for New Receipts). They must say why: the reason is
 * kept in the audit log with what changed. Anyone else edits as before and is
 * asked for nothing.
 *
 * `active` is whether the entry is already recorded; a draft has nothing posted,
 * so no reason is asked of anyone.
 */
export function useOwnerEdit(permission: string, active = true) {
  const { data: me } = useMe()
  return active && !!me && can(me, permission)
}

/** The shared wording, so every page asks the same way. */
export const EDIT_REASON_REQUIRED = 'Say why this recorded entry is being changed.'

/**
 * The reason box a Business Owner's edit carries. A flat labelled row, on the
 * page itself (no pop-up), placed above the form it belongs to.
 */
export default function EditReasonSection({
  value,
  onChange,
  testId = 'edit-reason',
  what = 'entry',
}: {
  value: string
  onChange: (next: string) => void
  testId?: string
  /** What is being changed, for the helper line: "expense", "transfer"… */
  what?: string
}) {
  return (
    <section data-testid={`${testId}-section`}>
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">
          Reason for this change *
        </span>
        <textarea
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. Bank cleared this on the 30th, not the 2nd"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
        />
      </label>
      <p className="mt-1 text-xs text-gray-500">
        Required. This {what} is already recorded, so the reason is kept in the audit log with what
        was changed.
      </p>
    </section>
  )
}
