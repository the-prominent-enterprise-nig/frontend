'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ExportButton from '@/src/components/common/ExportButton'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { showToast } from '@/src/components/ui/toast'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { getDailyCollection } from '../_actions/get-daily-collection'
import { getDailyCollectionRollup } from '../_actions/get-daily-collection-rollup'
import { saveDailyCollectionSheet } from '../_actions/save-daily-collection-sheet'
import { useSheetDraft } from '../_hooks/useSheetDraft'
import { todayIso } from '../_utils/business-date'
import type { DailyCollectionReport } from '@/src/schema/pos/daily-collection'
import DailyCollectionActionBar from './DailyCollectionActionBar'
import DailyCollectionForm from './DailyCollectionForm'
import DailyCollectionLedger from './DailyCollectionLedger'
import DailyCollectionRollup from './DailyCollectionRollup'
import DailyCollectionSignoffs from './DailyCollectionSignoffs'
import DailyCollectionTotals from './DailyCollectionTotals'
import DateStepper from './DateStepper'
import { cashPosition } from './form-model'

interface Props {
  companyName: string
  preparedBy: string
  /** Whether this user may fill in the form's handwritten half. */
  canEdit: boolean
  /** Set for a branch-assigned user — their own branch, which the API
   * enforces regardless of the branch switcher. Null for an owner or anyone
   * else who sees the whole network. */
  sessionBranchId: string | null
  sessionBranchName: string | null
}

/**
 * Scenario 53 Part 6 — the client's own Daily Collection Report.
 *
 * The toolbar is screen-only; what prints is DailyCollectionForm, a facsimile
 * of the paper form they handed over. Its ledger is cash only, as theirs is,
 * so the running BALANCE stays countable against the drawer; the day's
 * non-cash take is printed per provider in its own block below it.
 *
 * The derived half of the form is read-only by definition. The handwritten
 * half — signatories, remarks, and a corrected denomination count — is edited
 * in place here and saved against the branch and business date.
 */
export default function DailyCollectionView({
  companyName,
  preparedBy,
  canEdit,
  sessionBranchId,
  sessionBranchName,
}: Props): React.JSX.Element {
  const { branchId, branchName, setBranch } = usePosBranchContext()

  // Deep link from elsewhere in POS — the sessions list sends a supervisor
  // straight to the day and branch they were looking at, rather than to
  // today's report for whichever branch the switcher happened to hold.
  const params = useSearchParams()
  const linkedDate = params.get('date')
  const linkedBranchId = params.get('branchId')
  const linkedBranchName = params.get('branchName')

  const [date, setDate] = useState(
    linkedDate && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate) ? linkedDate : todayIso()
  )

  // Runs once per link, not on every render: after this the switcher is the
  // user's again, and re-applying the URL would fight them.
  useEffect(() => {
    if (linkedBranchId && linkedBranchId !== branchId) {
      setBranch({ id: linkedBranchId, name: linkedBranchName ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedBranchId])
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()

  // A branch-assigned user is pinned to their own branch — the switcher
  // cannot move them and neither can the roll-up, because the API would hand
  // back their branch anyway. Everyone else follows the switcher, and no
  // branch picked means the owner's roll-up rather than a merged ledger
  // nobody signs: the question at that level is which branch still owes a
  // count.
  const scopedBranchId = sessionBranchId ?? branchId
  const showRollup = sessionBranchId === null && branchId === null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pos-daily-collection', date, scopedBranchId],
    queryFn: () => getDailyCollection({ date, branchId: scopedBranchId ?? undefined }),
    enabled: !showRollup,
  })

  const rollupQuery = useQuery({
    queryKey: ['pos-daily-collection-rollup', date],
    queryFn: () => getDailyCollectionRollup({ date }),
    enabled: showRollup,
  })
  const rollup = rollupQuery.data?.success ? rollupQuery.data.data : undefined

  const report: DailyCollectionReport | undefined = data?.success ? data.data : undefined
  const sheet = useSheetDraft(report, date)

  const save = useMutation({
    mutationFn: () => saveDailyCollectionSheet(sheet.toPayload()),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({
          title: 'Could not save the form',
          description: result.message,
          status: 'error',
        })
        return
      }
      showToast({ title: 'Form saved', description: result.message, status: 'success' })
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['pos-daily-collection'] })
    },
  })

  // A corrected count has to say why before it can be saved — the same rule the
  // API enforces, surfaced here so the button explains itself rather than
  // failing on submit.
  const missingReason = sheet.countsChanged && !sheet.draft?.denominationOverrideReason.trim()

  // The drawer against the day's cash, over the counts being typed right now
  // when there are any — the same helper the printed form reconciles with.
  const draftCounts =
    editing && sheet.draft
      ? Object.fromEntries(
          Object.entries(sheet.draft.denominations).map(([face, raw]) => [face, Number(raw) || 0])
        )
      : undefined
  const position = report ? cashPosition(report, draftCounts ?? report.denominations) : null
  const reportCompanyName = report?.companyName || companyName

  // A date ahead of today has no closed sessions behind it by definition, so
  // the page says so rather than presenting an empty form as a finding.
  const subhead =
    date > todayIso()
      ? 'No trading recorded for this date yet — the report covers closed sessions only.'
      : showRollup
        ? 'Every branch on one business day, and the cash each one counted against it.'
        : 'Every collection taken at this branch on one business day, with the denomination count that reconciles the cash.'

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.09em] text-gray-500">
            Point of Sale &middot; {sessionBranchName ?? branchName ?? 'All branches'}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-prominent-purple-900">
            Daily Collection Report
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{subhead}</p>
        </div>
        <div className="flex items-end gap-3">
          <DateStepper value={date} onChange={setDate} disabled={editing} />
          {/* Both act on one branch's form: there is no sheet to print and no
              workbook to pull while the roll-up is what is on screen. */}
          {!showRollup && !report?.withheld && (
            <>
              <button onClick={() => window.print()} className="btn-secondary">
                Print
              </button>
              <ExportButton
                endpoint="/pos/reports/daily-collection/export"
                params={{ date, branchId: scopedBranchId ?? undefined }}
                // A day that took only cards still has a form worth exporting.
                disabled={!report || (report.rows.length === 0 && report.nonCash.length === 0)}
              />
            </>
          )}
        </div>
      </div>

      {showRollup ? (
        rollupQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rollupQuery.isError || !rollup ? (
          <LoadError />
        ) : (
          <DailyCollectionRollup rollup={rollup} onOpenBranch={(branch) => setBranch(branch)} />
        )
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError || !report ? (
        <LoadError />
      ) : (
        <>
          {sessionBranchId === null && (
            <button
              onClick={() => setBranch(null)}
              className="mb-3 text-sm text-prominent-purple-700 hover:underline"
            >
              ← All branches
            </button>
          )}
          {report.withheld ? (
            <NotSubmitted report={report} />
          ) : (
            <>
              {editing && <EditingNote />}
              {/* Above the figures, not below them: the caveat has to land before
              someone reads them, not after. */}
              <OpenSessionNote report={report} />

              {/* The report carries the letterhead so the screen, the print sheet
              and the exported workbook can never disagree; the session's own
              copy is only a fallback for an enterprise with no trading name
              set. */}
              <DailyCollectionLedger report={report} companyName={reportCompanyName} />
              <DailyCollectionTotals report={report} edit={editing ? sheet : null} />
              <DailyCollectionSignoffs
                report={report}
                preparedBy={preparedBy}
                edit={editing ? sheet : null}
              />

              {/* A missing bar is a question — "why can't I file this?" — and an
              unanswered one sends someone hunting through a form they cannot
              change. Say it instead. */}
              {!canEdit && (
                <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 print:hidden">
                  You can view, print and export this report. Filing it — the signatories, the
                  remarks and the denomination count — needs the Daily Collection update permission.
                </p>
              )}

              {canEdit && report.editable && position && (
                <DailyCollectionActionBar
                  editing={editing}
                  filed={report.sheet !== null}
                  saving={save.isPending}
                  missingReason={missingReason}
                  position={position}
                  totalCollection={report.totalCollection}
                  onFill={() => setEditing(true)}
                  onCancel={() => {
                    sheet.reset()
                    setEditing(false)
                  }}
                  onSave={() => save.mutate()}
                />
              )}

              {/* Screen-hidden, and the only thing that prints: the facsimile of
              the client's own paper form, which a branch files in the same
              binder as the original. The global `.print-sheet` rules force
              every ancestor of the sheet back to a plain block, so `hidden`
              here costs the printout nothing. */}
              <div className="hidden print:block">
                <DailyCollectionForm
                  report={report}
                  companyName={reportCompanyName}
                  preparedBy={preparedBy}
                  edit={editing ? sheet : null}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/**
 * What an owner sees before the branch has submitted.
 *
 * The day's collections are the branch's to declare: until the cashier files,
 * what exists is a count in progress, and showing it would turn an unfinished
 * drawer into a figure someone acts on. The API withholds the figures — this
 * says why, and says what is still holding the branch open, which is the one
 * thing the owner can actually do something about.
 */
function NotSubmitted({ report }: { report: DailyCollectionReport }): React.JSX.Element {
  const open = report.openSessionCount

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {report.branchName}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-gray-900">Not submitted yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        {report.branchName} has not filed its Daily Collection Report for this date. The day&apos;s
        figures are the branch&apos;s to declare, so there is nothing to read here until the cashier
        files the form.
      </p>
      {open > 0 && (
        <p className="mx-auto mt-3 max-w-md rounded-xl border border-prominent-orange-200 bg-prominent-orange-50 px-4 py-2.5 text-sm text-prominent-orange-900">
          {open} session{open > 1 ? 's are' : ' is'} still open at this branch — the count cannot be
          taken until {open > 1 ? 'they close' : 'it closes'}.
        </p>
      )}
    </section>
  )
}

function LoadError(): React.JSX.Element {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      Unable to load the Daily Collection Report.
    </p>
  )
}

/** Says what is and is not editable, so nobody hunts for a way to correct a
 * figure that is derived on purpose. */
function EditingNote(): React.JSX.Element {
  return (
    <p className="mb-3 rounded-xl border border-prominent-orange-200 bg-prominent-orange-50 px-4 py-3 text-sm text-prominent-orange-900 print:hidden">
      Editing the form&apos;s handwritten half: the two signatories, the remarks line and the
      denomination count — including the COINS amount, which is typed as pesos rather than a piece
      count. The collections, deposits and totals are read from the day&apos;s transactions and
      cannot be typed over.
    </p>
  )
}

/**
 * Screen-only: the report counts closed sessions only, so while one is still
 * open the form is not yet the whole day and the screen has to say so.
 *
 * Leaving an open session off is what keeps the form honest — every
 * collection on it has a drawer count behind it — but a figure that is
 * deliberately low is still a figure someone will act on. The note goes as
 * soon as the last session closes, which is when the form gets signed.
 */
function OpenSessionNote({ report }: { report: DailyCollectionReport }): React.JSX.Element | null {
  if (report.openSessionCount < 1) return null

  const many = report.openSessionCount > 1
  return (
    <p className="mb-3 rounded-xl border border-prominent-orange-200 bg-prominent-orange-50 px-4 py-3 text-sm text-prominent-orange-900 print:hidden">
      <span className="font-semibold">
        {report.openSessionCount} session{many ? 's are' : ' is'} still open.
      </span>{' '}
      This report counts closed sessions only, so nothing {many ? 'they have' : 'it has'} taken is
      on it yet — the figures below will grow as {many ? 'those sessions close' : 'it closes'}.
      Print it once the day&apos;s sessions have all closed.
    </p>
  )
}
