'use client'

import type { DailyCollectionReport } from '@/src/schema/pos/daily-collection'
import type { SheetDraftController } from '../_hooks/useSheetDraft'

/**
 * The three people who stand behind the form, and the branch's remark.
 *
 * PREPARED BY is stamped from the session — whoever pulled the report. The
 * other two are typed and saved. Each card says whether it is settled yet, so
 * an unsigned form is obvious at a glance rather than only to whoever knows
 * which names ought to be there.
 */

const CARD = 'flex flex-col gap-1 px-5 py-4'
const LABEL = 'font-mono text-[10px] font-semibold uppercase tracking-wide text-gray-500'
const INPUT =
  'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm uppercase text-gray-900 outline-none focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100'

interface Props {
  report: DailyCollectionReport
  preparedBy: string
  /** Null for a read-only report. */
  edit: SheetDraftController | null
}

export default function DailyCollectionSignoffs({
  report,
  preparedBy,
  edit,
}: Props): React.JSX.Element {
  const checkedBy = edit ? (edit.draft?.checkedBy ?? '') : (report.sheet?.checkedBy ?? '')
  const certifiedBy = edit
    ? (edit.draft?.certifiedCorrectBy ?? '')
    : (report.sheet?.certifiedCorrectBy ?? '')

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="grid grid-cols-1 divide-y divide-gray-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className={CARD}>
          <span className={LABEL}>Prepared by</span>
          <span className="text-sm font-medium text-gray-900">{preparedBy || '—'}</span>
          <span className="text-xs text-gray-500">Pulled this report</span>
        </div>

        <SignatoryCard
          label="Checked by"
          value={checkedBy}
          meta={checkedBy ? 'Verified the count' : 'Awaiting the filed count'}
          onChange={edit ? (v) => edit.update('checkedBy', v) : null}
        />
        <SignatoryCard
          label="Certified correct by"
          value={certifiedBy}
          meta={certifiedBy ? 'Signed off' : 'Signs after checking'}
          onChange={edit ? (v) => edit.update('certifiedCorrectBy', v) : null}
        />
      </div>

      {(edit || report.sheet?.remarks) && (
        <div className="border-t border-gray-200 px-5 py-4">
          <span className={LABEL}>Remarks</span>
          {edit ? (
            <input
              className={`${INPUT} mt-1 w-full`}
              value={edit.draft?.remarks ?? ''}
              onChange={(e) => edit.update('remarks', e.target.value)}
              aria-label="Remarks"
              placeholder="Optional"
            />
          ) : (
            <p className="mt-0.5 text-sm text-gray-900">{report.sheet?.remarks}</p>
          )}
        </div>
      )}
    </section>
  )
}

function SignatoryCard({
  label,
  value,
  meta,
  onChange,
}: {
  label: string
  value: string
  meta: string
  onChange: ((value: string) => void) | null
}): React.JSX.Element {
  return (
    <div className={CARD}>
      <span className={LABEL}>{label}</span>
      {onChange ? (
        <input
          className={INPUT}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          placeholder="Name"
        />
      ) : (
        <span className={`text-sm ${value ? 'font-medium text-gray-900' : 'italic text-gray-400'}`}>
          {value || 'Pending'}
        </span>
      )}
      <span className={`text-xs ${value ? 'text-gray-500' : 'text-amber-700'}`}>{meta}</span>
    </div>
  )
}
