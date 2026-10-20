'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ExportButton from '@/src/components/common/ExportButton'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { showToast } from '@/src/components/ui/toast'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { getDailyCollection } from '../_actions/get-daily-collection'
import { getDailyCollectionRollup } from '../_actions/get-daily-collection-rollup'
import { getDailySalesMonitoring } from '../_actions/get-daily-sales-monitoring'
import { saveDailyCollectionSheet } from '../_actions/save-daily-collection-sheet'
import { useSheetDraft } from '../_hooks/useSheetDraft'
import { todayIso } from '../_utils/business-date'
import type { DailyCollectionReport, SheetLink } from '@/src/schema/pos/daily-collection'
import type { DailySalesMonitoringReport } from '@/src/schema/pos/daily-sales-monitoring'
import DailyCollectionActionBar from './DailyCollectionActionBar'
import DailyCollectionForm from './DailyCollectionForm'
import DailyCollectionLedger from './DailyCollectionLedger'
import DailyCollectionPrintPages from './DailyCollectionPrintPages'
import DailyCollectionRollup from './DailyCollectionRollup'
import DailyCollectionRollupPrintSheet from './DailyCollectionRollupPrintSheet'
import DailyCollectionSignoffs from './DailyCollectionSignoffs'
import DailyCollectionTotals from './DailyCollectionTotals'
import DailySalesMonitoringSheet from './DailySalesMonitoringSheet'
import DateStepper from './DateStepper'
import { cashPosition } from './form-model'

/** The two forms a branch files for one business day. */
type SheetView = 'collection' | 'sales'

const SHEET_TITLES: Record<SheetView, string> = {
  collection: 'Daily Collection Report',
  sales: 'Daily Sales & Collection Monitoring',
}

/** Left to right in the switcher. */
const SHEET_TABS: SheetView[] = ['sales', 'collection']

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
 * of the paper form they handed over. Its ledger lists cash and non-cash
 * sales, with the running BALANCE counting cash only, so it stays countable
 * against the drawer; the day's non-cash take is printed per provider in its
 * own block below it.
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
  const [sheetView, setSheetView] = useState<SheetView>(
    params.get('view') === 'sales' ? 'sales' : 'collection'
  )

  const [date, setDate] = useState(
    linkedDate && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate) ? linkedDate : todayIso()
  )

  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  // A branch-assigned user's pick among their branch's caravans, each of which
  // files its own sheet. Null is their own branch's.
  const [caravanId, setCaravanId] = useState<string | null>(null)

  // Runs once per link, not on every render: after this the switcher is the
  // user's again, and re-applying the URL would fight them. A branch-assigned
  // user can only be linked to a caravan their branch runs — the API answers
  // with their own branch's sheet for anything else.
  useEffect(() => {
    if (!linkedBranchId) return
    if (sessionBranchId) {
      setCaravanId(linkedBranchId === sessionBranchId ? null : linkedBranchId)
    } else if (linkedBranchId !== branchId) {
      setBranch({ id: linkedBranchId, name: linkedBranchName ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedBranchId])

  // A branch-assigned user is pinned to their own branch — the switcher
  // cannot move them and neither can the roll-up, because the API would hand
  // back their branch anyway — or to a caravan it hosts. Everyone else
  // follows the switcher, and no branch picked means the owner's roll-up
  // rather than a merged ledger nobody signs: the question at that level is
  // which branch still owes a count.
  const scopedBranchId = sessionBranchId ? (caravanId ?? sessionBranchId) : branchId
  const showRollup = sessionBranchId === null && branchId === null

  // Moves between a host's sheet and its caravans'. A branch-assigned user
  // stays on their own branch's family, so their pick is local; everyone else
  // moves the POS switcher, as the roll-up does.
  function openSheet(link: SheetLink, isHost: boolean): void {
    if (sessionBranchId) setCaravanId(isHost ? null : link.id)
    else setBranch(link)
  }

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

  const salesQuery = useQuery({
    queryKey: ['pos-daily-sales-monitoring', date, scopedBranchId],
    queryFn: () => getDailySalesMonitoring({ date, branchId: scopedBranchId ?? undefined }),
    enabled: !showRollup,
  })
  const salesReport = salesQuery.data?.success ? salesQuery.data.data : undefined
  const onSalesView = !showRollup && sheetView === 'sales'

  const report: DailyCollectionReport | undefined = data?.success ? data.data : undefined
  const sheet = useSheetDraft(report, date)
  // Both forms print in one job from either tab, so the sales sheet is fetched
  // alongside the collection report rather than only on its own tab.
  const canPrint =
    !showRollup && (salesReport !== undefined || (report !== undefined && !report.withheld))
  // Scenario 74 — the all-branches roll-up prints too: it is what an owner
  // opens by default, and it used to have no Print at all.
  const canPrintRollup = showRollup && rollup !== undefined

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

  // Whichever branch the report came back for wins over the POS switcher's
  // own label: a satellite office has no Daily Collection of its own, and the
  // API answers with the branch it files under, so the chrome has to name
  // that branch too. A caravan files its own and comes back as itself.
  const reportBranchName =
    report?.branchName ?? salesReport?.branchName ?? sessionBranchName ?? branchName

  // A date ahead of today has no closed sessions behind it by definition, so
  // the page says so rather than presenting an empty form as a finding.
  const subhead =
    date > todayIso()
      ? 'No trading recorded for this date yet — the report covers closed sessions only.'
      : showRollup
        ? 'Every branch on one business day, and the cash each one counted against it.'
        : onSalesView
          ? "The day's sales by category, channel and invoice type."
          : 'Every collection taken at this branch on one business day, with the denomination count that reconciles the cash.'

  return (
    <>
      <div className="mx-auto max-w-[1400px] p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.09em] text-gray-500">
              Point of Sale &middot; {reportBranchName ?? 'All branches'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-prominent-purple-900">
              {showRollup ? SHEET_TITLES.collection : SHEET_TITLES[sheetView]}
            </h1>
            {/* Two lines tall whichever tab is open, so the toggle below it stays put. */}
            <p className="mt-0.5 min-h-10 text-sm text-gray-500">{subhead}</p>
            {!showRollup && (
              <div className="mt-3 flex flex-col items-start gap-2">
                <SheetTabs value={sheetView} onChange={setSheetView} disabled={editing} />
                {report && (
                  <SheetFamilyPicker report={report} onOpen={openSheet} disabled={editing} />
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <DateStepper value={date} onChange={setDate} disabled={editing} />
            {/* Prints the day's two forms together, from either tab — or, on the
              roll-up, the all-branches summary. */}
            {(canPrint || canPrintRollup) && (
              <button onClick={() => window.print()} className="btn-secondary">
                Print
              </button>
            )}
            {!showRollup && !onSalesView && !report?.withheld && (
              <ExportButton
                endpoint="/pos/reports/daily-collection/export"
                params={{ date, branchId: scopedBranchId ?? undefined }}
                // A day that took only cards still has a form worth exporting.
                disabled={!report || (report.rows.length === 0 && report.nonCash.length === 0)}
              />
            )}
          </div>
        </div>

        {onSalesView ? (
          <SalesMonitoringBody
            isLoading={salesQuery.isLoading}
            report={salesReport}
            showAllBranchesLink={sessionBranchId === null}
            onAllBranches={() => setBranch(null)}
          />
        ) : showRollup ? (
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
                    remarks and the denomination count — needs the Daily Collection update
                    permission.
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
              </>
            )}
          </>
        )}
      </div>

      {/* Off-screen, and the only thing that prints: the sales monitoring sheet
          on page one and the client's paper facsimile on page two. Kept outside
          the padded page container so the print page starts at the paper's edge. */}
      {canPrintRollup && rollup && (
        <DailyCollectionPrintPages
          pages={[
            <DailyCollectionRollupPrintSheet
              key="rollup"
              rollup={rollup}
              companyName={companyName}
            />,
          ]}
        />
      )}
      {canPrint && (
        <DailyCollectionPrintPages
          pages={[
            salesReport ? <DailySalesMonitoringSheet key="sales" report={salesReport} /> : null,
            report && !report.withheld ? (
              <DailyCollectionForm key="collection" report={report} preparedBy={preparedBy} />
            ) : null,
          ]}
        />
      )}
    </>
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
function NotSubmitted({
  report,
}: {
  report: Pick<DailyCollectionReport, 'branchName' | 'openSessionCount'>
}): React.JSX.Element {
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

function LoadError({ title = SHEET_TITLES.collection }: { title?: string }): React.JSX.Element {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      Unable to load the {title}.
    </p>
  )
}

/** Switches between the day's two forms. Locked while the collection form's
 * handwritten half is being edited, so a draft is never left behind a tab. */
function SheetTabs({
  value,
  onChange,
  disabled,
}: {
  value: SheetView
  onChange: (view: SheetView) => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
      {SHEET_TABS.map((view) => (
        <button
          key={view}
          role="tab"
          aria-selected={value === view}
          disabled={disabled}
          onClick={() => onChange(view)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            value === view
              ? 'bg-prominent-purple-700 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {view === 'collection' ? 'Collection report' : 'Sales monitoring'}
        </button>
      ))}
    </div>
  )
}

/**
 * A host branch and the caravans it runs, each filing its own sheet
 * (2026-10-13), as one dropdown: the branch first, then its caravans under
 * their own heading. A dropdown rather than buttons because caravan labels
 * are long ("Dumalag Public Market — Dumalag Caravan") and a host can run
 * several at once; it is searchable for the same reason. Shown only when the
 * host has a caravan trading that day, so an ordinary branch's header is
 * unchanged.
 */
function SheetFamilyPicker({
  report,
  onOpen,
  disabled,
}: {
  report: DailyCollectionReport
  onOpen: (link: SheetLink, isHost: boolean) => void
  disabled: boolean
}): React.JSX.Element | null {
  const host: SheetLink | null = report.isCaravan
    ? report.hostBranch
    : report.branchId
      ? { id: report.branchId, name: report.branchName }
      : null
  const caravans = report.hostedCaravans
  if (!host || caravans.length === 0) return null

  return (
    <SearchableSelect
      value={report.branchId ?? ''}
      onChange={(id) => {
        if (id === host.id) onOpen(host, true)
        const caravan = caravans.find((c) => c.id === id)
        if (caravan) onOpen(caravan, false)
      }}
      options={[
        { value: host.id, label: host.name, group: 'Branch' },
        ...caravans.map((c) => ({ value: c.id, label: c.name, group: 'Caravans' })),
      ]}
      placeholder="Choose a sheet"
      disabled={disabled}
      portal
      className="w-96 max-w-full text-sm text-gray-700"
    />
  )
}

/**
 * Scenario 61 — the Daily Sales Monitoring sheet. Printed and signed by the
 * Cashier and Branch Manager; nothing on it is typed in, so there is no
 * filing step of its own. Unlike the collection report it is not withheld
 * until the branch files — the owner can read it at any time.
 */
function SalesMonitoringBody({
  isLoading,
  report,
  showAllBranchesLink,
  onAllBranches,
}: {
  isLoading: boolean
  report: DailySalesMonitoringReport | undefined
  showAllBranchesLink: boolean
  onAllBranches: () => void
}): React.JSX.Element {
  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!report) return <LoadError title={SHEET_TITLES.sales} />
  return (
    <>
      {showAllBranchesLink && (
        <button
          onClick={onAllBranches}
          className="mb-3 text-sm text-prominent-purple-700 hover:underline print:hidden"
        >
          ← All branches
        </button>
      )}
      <DailySalesMonitoringSheet report={report} printable={false} />
    </>
  )
}

/** Says what is and is not editable, so nobody hunts for a way to correct a
 * figure that is derived on purpose. */
function EditingNote(): React.JSX.Element {
  return (
    <p className="mb-3 rounded-xl border border-prominent-orange-200 bg-prominent-orange-50 px-4 py-3 text-sm text-prominent-orange-900 print:hidden">
      You can edit the signatories, remarks and cash count. Collections, deposits and totals come
      from the day&apos;s transactions and can&apos;t be changed here.
    </p>
  )
}
