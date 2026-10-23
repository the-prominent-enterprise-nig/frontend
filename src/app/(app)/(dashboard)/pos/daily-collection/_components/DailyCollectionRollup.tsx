'use client'

import type {
  DailyCollectionBranchStatus,
  DailyCollectionBranchSummary,
  DailyCollectionRollup as Rollup,
} from '@/src/schema/pos/daily-collection'
import { formatFiledTime } from '../_utils/business-date'
import { peso } from './form-model'

/**
 * Every branch's day side by side, for whoever is not standing at one of the
 * drawers.
 *
 * The question this answers is not "what did the network take" — that is one
 * figure — but "which branch still owes me a count". So status leads and
 * carries the over/short verdict in a word; the peso figure behind it belongs
 * on the branch's own form, where the drawer that produced it is. Every row is
 * a way into that form.
 */

const HEAD =
  'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200'
const CELL = 'px-4 py-3 border-b border-gray-100 align-middle'
const NUM = `${CELL} text-right font-mono tabular-nums`

interface Props {
  rollup: Rollup
  onOpenBranch: (branch: { id: string; name: string }) => void
}

export default function DailyCollectionRollup({ rollup, onOpenBranch }: Props): React.JSX.Element {
  const { totals } = rollup
  const allFiled = totals.filedCount >= totals.tradingCount

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="Total collection"
          value={peso(totals.grandTotalCollection)}
          note={
            allFiled
              ? `${totals.tradingCount} of ${totals.branchCount} branches trading`
              : 'submitted branches only'
          }
          warn={!allFiled}
        />
        <Stat
          label="Reports filed"
          value={`${totals.filedCount} of ${totals.tradingCount}`}
          note={
            allFiled
              ? 'every trading branch has filed'
              : `${totals.tradingCount - totals.filedCount} still to count`
          }
          warn={!allFiled}
        />
        <Stat
          label="Entries"
          value={String(totals.entryCount)}
          note="cash ledger lines across the network"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Branches</h2>
          <p className="text-xs text-gray-500">
            Outstanding first. Open a branch for its collection report.
          </p>
        </header>

        {rollup.branches.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">No branches to report on.</p>
        ) : (
          <>
            <WideTable rollup={rollup} onOpenBranch={onOpenBranch} />
            <CardList rollup={rollup} onOpenBranch={onOpenBranch} />
          </>
        )}
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  warn = false,
}: {
  label: string
  value: string
  note: string
  warn?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="font-mono text-xl font-semibold tabular-nums text-gray-900">{value}</span>
      <span className={`text-xs ${warn ? 'text-amber-700' : 'text-gray-500'}`}>{note}</span>
    </div>
  )
}

function WideTable({ rollup, onOpenBranch }: Props): React.JSX.Element {
  const { totals } = rollup

  return (
    <div className="hidden md:block">
      <table className="w-full border-collapse text-sm text-gray-900">
        <thead className="bg-gray-50">
          <tr>
            <th className={`${HEAD} text-left`}>Branch</th>
            <th className={`${HEAD} text-right`}>Entries</th>
            <th className={`${HEAD} text-right`}>Total collection</th>
            <th className={`${HEAD} text-right`}>Cash counted</th>
            <th className={`${HEAD} text-left`}>Status</th>
            <th className={HEAD}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rollup.branches.map((branch) => (
            <tr key={branch.branchId}>
              <td className={CELL}>
                <button
                  onClick={() => onOpenBranch({ id: branch.branchId, name: branch.branchName })}
                  className="text-left font-medium text-gray-900 hover:text-prominent-purple-700 hover:underline"
                >
                  {branch.branchName}
                </button>
                <p className="text-xs text-gray-500">{openNote(branch)}</p>
              </td>
              <td className={`${NUM} text-gray-600`}>{branch.entryCount}</td>
              <td className={`${NUM} font-semibold`}>{money(branch.grandTotalCollection)}</td>
              <td
                className={`${NUM} ${branch.cashCounted === null ? 'text-gray-400' : 'text-gray-700'}`}
              >
                {money(branch.cashCounted)}
              </td>
              <td className={CELL}>
                <StatusChip status={branch.status} />
              </td>
              <td className={`${CELL} text-right`}>
                <button
                  onClick={() => onOpenBranch({ id: branch.branchId, name: branch.branchName })}
                  className={branch.filed ? 'btn-secondary' : 'btn-primary'}
                >
                  {branch.filed ? 'View' : 'Open'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td className="px-4 py-3">All branches</td>
            <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-600">
              {totals.entryCount}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums">
              {peso(totals.grandTotalCollection)}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
              {peso(totals.cashCounted)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CardList({ rollup, onOpenBranch }: Props): React.JSX.Element {
  return (
    <div className="md:hidden">
      {rollup.branches.map((branch) => (
        <div key={branch.branchId} className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{branch.branchName}</p>
              <p className="text-xs text-gray-500">
                {branch.entryCount} {branch.entryCount === 1 ? 'entry' : 'entries'} ·{' '}
                {openNote(branch)}
              </p>
            </div>
            <StatusChip status={branch.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Figure label="Total collection" value={money(branch.grandTotalCollection)} />
            <Figure
              label="Cash counted"
              value={money(branch.cashCounted)}
              tone={branch.cashCounted === null ? 'text-gray-400' : ''}
            />
          </div>

          <button
            onClick={() => onOpenBranch({ id: branch.branchId, name: branch.branchName })}
            className={`mt-3 w-full ${branch.filed ? 'btn-secondary' : 'btn-primary'}`}
          >
            {branch.filed ? 'View report' : 'Open report'}
          </button>
        </div>
      ))}
    </div>
  )
}

function Figure({
  label,
  value,
  tone = '',
}: {
  label: string
  value: string
  tone?: string
}): React.JSX.Element {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`font-mono text-sm font-semibold tabular-nums ${tone || 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}

/** A branch that has not submitted has no figures to show — the day is still
 * theirs to declare. An em dash rather than a zero, which would read as "this
 * branch took nothing". */
function money(amount: number | null): string {
  return amount === null ? '—' : peso(amount)
}

const STATUS_LABEL: Record<DailyCollectionBranchStatus, string> = {
  NO_TRADE: 'No trade',
  OPEN: 'Open',
  BALANCED: 'Balanced',
  OVER: 'Over',
  SHORT: 'Short',
}

const STATUS_TONE: Record<DailyCollectionBranchStatus, { chip: string; dot: string }> = {
  NO_TRADE: { chip: 'bg-gray-100 text-gray-600 ring-gray-200', dot: 'bg-gray-400' },
  OPEN: { chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  BALANCED: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  OVER: { chip: 'bg-blue-50 text-blue-800 ring-blue-200', dot: 'bg-blue-500' },
  SHORT: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500' },
}

function StatusChip({ status }: { status: DailyCollectionBranchStatus }): React.JSX.Element {
  const tone = STATUS_TONE[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** When it came in, or what is still holding the branch open. */
function openNote(branch: DailyCollectionBranchSummary): string {
  if (branch.filed) {
    const at = formatFiledTime(branch.filedAt)
    return at ? `Filed ${at}` : 'Filed'
  }
  if (branch.openSessionCount > 0) {
    return `${branch.openSessionCount} session${branch.openSessionCount > 1 ? 's' : ''} still open`
  }
  return branch.status === 'NO_TRADE' ? 'No trading recorded' : 'Awaiting the count'
}
