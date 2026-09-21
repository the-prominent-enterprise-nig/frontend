'use client'

import { type CashPosition, peso } from './form-model'

/**
 * The one place the form is filled in, closed and reopened, pinned to the
 * bottom of the page.
 *
 * A branch reconciles the count at the bottom of a long grid, which is where
 * the decision gets made — so that is where the button lives, with the count
 * against the cash it has to meet stated next to it rather than left three
 * screens up.
 *
 * "Filed" here means the branch has saved the form's handwritten half. It is
 * not a lock: the paper equivalent can be amended and re-signed too, so
 * reopening is a button rather than a permission.
 */
interface Props {
  editing: boolean
  filed: boolean
  saving: boolean
  /** A corrected count with no reason typed yet — blocks the save. */
  missingReason: boolean
  position: CashPosition
  totalCollection: number
  onFill: () => void
  onCancel: () => void
  onSave: () => void
}

export default function DailyCollectionActionBar({
  editing,
  filed,
  saving,
  missingReason,
  position,
  totalCollection,
  onFill,
  onCancel,
  onSave,
}: Props): React.JSX.Element {
  const note = editing
    ? missingReason
      ? 'A corrected count needs a reason before it can be filed'
      : position.balanced
        ? 'Cash balances'
        : 'Recount before filing'
    : filed
      ? 'The form’s handwritten half is saved'
      : 'Not filed yet'

  const headline = editing
    ? `${peso(position.cashCollected)} counted of ${peso(totalCollection)}`
    : filed
      ? 'Report filed'
      : 'Fill in the count and the signatories'

  return (
    <div className="sticky bottom-0 z-20 -mx-6 mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 bg-white px-6 py-3 shadow-[0_-8px_24px_-18px_rgba(20,20,30,0.35)] print:hidden">
      <div className="min-w-0">
        <p
          className={`text-xs ${
            editing && (missingReason || !position.balanced) ? 'text-red-700' : 'text-gray-500'
          }`}
        >
          {note}
        </p>
        <p className="text-sm font-semibold text-gray-900">{headline}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <button onClick={onCancel} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button
              onClick={onSave}
              className="btn-primary"
              disabled={saving || missingReason}
              title={
                missingReason
                  ? 'A corrected denomination count needs a reason before it can be saved'
                  : undefined
              }
            >
              {saving ? 'Saving…' : 'File the report'}
            </button>
          </>
        ) : (
          <button onClick={onFill} className={filed ? 'btn-secondary' : 'btn-primary'}>
            {filed ? 'Reopen count' : 'Fill in form'}
          </button>
        )}
      </div>
    </div>
  )
}
