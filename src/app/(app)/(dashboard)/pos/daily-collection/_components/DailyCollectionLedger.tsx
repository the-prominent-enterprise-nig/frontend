'use client'

import type { DailyCollectionReport } from '@/src/schema/pos/daily-collection'
import { formatFiledTime } from '../_utils/business-date'
import { buildFormLines, formatFormDate, peso, pesoOrDash, type FormLine } from './form-model'

/**
 * The ledger as a screen reads it, over the same `buildFormLines` the printed
 * facsimile uses — two renderers, one model, so a figure can never differ
 * between the screen and the paper a branch files.
 *
 * Wide screens get the client's own thirteen columns. Below `lg` the grid
 * stops being legible at all, so each collection becomes a card: a horizontal
 * scrollbar over a form people reconcile line by line is worse than a layout
 * change.
 */

const HEAD =
  'px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200'
const CELL = 'px-2 py-2 align-middle border-b border-gray-100'
const NUM = `${CELL} text-right font-mono tabular-nums`

interface Props {
  report: DailyCollectionReport
  companyName: string
}

export default function DailyCollectionLedger({ report, companyName }: Props): React.JSX.Element {
  const lines = buildFormLines(report)

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <Masthead report={report} companyName={companyName} />

      {lines.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-500">
          No collections recorded for this business date.
        </p>
      ) : (
        <>
          <WideLedger report={report} lines={lines} />
          <CardLedger lines={lines} />
        </>
      )}
    </section>
  )
}

/** The form's letterhead: who, what, where, when — and whether it is signed
 * off yet, which is the first thing anyone opening a past date wants. */
function Masthead({
  report,
  companyName,
}: {
  report: DailyCollectionReport
  companyName: string
}): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{companyName}</p>
        <p className="text-sm text-gray-600">Daily Collection Report</p>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-500">
          {report.branchName}
        </p>
      </div>
      <div className="flex items-center gap-5">
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-wide text-gray-500">
            Business date
          </p>
          <p className="font-mono text-sm font-semibold text-gray-900">
            {formatFormDate(report.date)}
          </p>
        </div>
        <StatusChip filedAt={report.sheet?.updatedAt ?? null} />
      </div>
    </header>
  )
}

/**
 * Filed means the branch has saved the form's handwritten half — the same
 * thing the paper carries three signatures for. It carries the time too:
 * whoever is waiting on this report wants "has it come in" and "when"
 * answered together.
 */
function StatusChip({ filedAt }: { filedAt: string | null }): React.JSX.Element {
  const filed = filedAt !== null
  const at = formatFiledTime(filedAt)
  const tone = filed
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : 'bg-amber-50 text-amber-800 ring-amber-200'
  const dot = filed ? 'bg-emerald-500' : 'bg-amber-500'

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {filed ? (at ? `Filed ${at}` : 'Filed') : 'Open'}
    </span>
  )
}

function WideLedger({
  report,
  lines,
}: {
  report: DailyCollectionReport
  lines: FormLine[]
}): React.JSX.Element {
  const collectionCount = lines.filter((l) => l.type === 'collection').length

  return (
    <div className="hidden lg:block">
      <table className="w-full border-collapse text-xs text-gray-900">
        <thead className="bg-gray-50">
          <tr>
            <th rowSpan={2} className={`${HEAD} text-left`}>
              Date
            </th>
            <th rowSpan={2} className={`${HEAD} text-left`}>
              SI#
            </th>
            <th rowSpan={2} className={`${HEAD} text-left`}>
              Customer
            </th>
            <th rowSpan={2} className={`${HEAD} text-left`}>
              Desc
            </th>
            <th colSpan={3} className={`${HEAD} text-center`}>
              Collection receipts
            </th>
            <th rowSpan={2} className={`${HEAD} text-center`}>
              Cash invoice
            </th>
            <th rowSpan={2} className={`${HEAD} text-right`}>
              PPD
            </th>
            <th rowSpan={2} className={`${HEAD} text-right`}>
              Pen
            </th>
            <th rowSpan={2} className={`${HEAD} text-right`}>
              Amount / debit
            </th>
            <th rowSpan={2} className={`${HEAD} text-right`}>
              Credit
            </th>
            <th rowSpan={2} className={`${HEAD} text-right`}>
              Balance
            </th>
          </tr>
          <tr>
            <th className={`${HEAD} text-center font-normal`}>Office</th>
            <th className={`${HEAD} text-center font-normal`}>Field</th>
            <th className={`${HEAD} text-center font-normal`}>Others</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={`line-${i}`} className={line.type === 'deposit' ? 'bg-gray-50' : undefined}>
              {line.type === 'deposit' ? (
                <td className={`${CELL} whitespace-nowrap font-semibold`}>Deposit:</td>
              ) : (
                i === 0 && (
                  <td
                    rowSpan={collectionCount}
                    className={`${CELL} whitespace-nowrap text-center align-top font-mono text-gray-600`}
                  >
                    {formatFormDate(report.date)}
                  </td>
                )
              )}
              {line.span > 0 && (
                <>
                  <td rowSpan={line.span} className={`${CELL} text-center font-mono text-gray-600`}>
                    {line.si}
                  </td>
                  <td
                    rowSpan={line.span}
                    colSpan={line.type === 'deposit' ? 2 : 1}
                    className={`${CELL} ${line.type === 'deposit' ? 'font-medium uppercase' : ''}`}
                  >
                    {line.customer}
                  </td>
                </>
              )}
              {line.type !== 'deposit' && (
                <td className={CELL}>
                  <DescChip desc={line.desc} />
                </td>
              )}
              <td className={`${CELL} text-center font-mono text-gray-600`}>{line.office}</td>
              <td className={`${CELL} text-center font-mono text-gray-600`}>{line.field}</td>
              <td className={`${CELL} text-center font-mono text-gray-600`}>{line.others}</td>
              <td className={`${CELL} text-center font-mono text-gray-600`}>{line.cashInvoice}</td>
              <td className={`${NUM} text-gray-500`}>{line.ppd ? peso(line.ppd) : ''}</td>
              <td className={`${NUM} text-gray-500`}>{line.penalty ? peso(line.penalty) : ''}</td>
              <td className={`${NUM} font-medium`}>
                {line.debit === null ? '' : peso(line.debit)}
              </td>
              <td className={NUM}>{line.credit === null ? '' : peso(line.credit)}</td>
              <td className={`${NUM} font-semibold`}>{pesoOrDash(line.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Below `lg`: one card per line, the figures that matter kept at the right
 * edge where they can still be scanned down the column. */
function CardLedger({ lines }: { lines: FormLine[] }): React.JSX.Element {
  return (
    <div className="lg:hidden">
      {lines.map((line, i) => {
        const receipt = line.office || line.field || line.others || line.cashInvoice
        const isDeposit = line.type === 'deposit'

        return (
          <div
            key={`card-${i}`}
            className={`flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 ${
              isDeposit ? 'bg-gray-50' : ''
            }`}
          >
            <div className="min-w-0">
              <p className={`text-sm ${isDeposit ? 'font-semibold uppercase' : 'font-medium'}`}>
                {isDeposit ? `Deposit: ${line.customer}` : line.customer || '↳ same customer'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {line.si && (
                  <span className="font-mono text-[11px] text-gray-500">SI {line.si}</span>
                )}
                {receipt && (
                  <span className="font-mono text-[11px] text-gray-500">CR {receipt}</span>
                )}
                {line.desc && <DescChip desc={line.desc} />}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-semibold tabular-nums">
                {line.debit === null ? `(${peso(line.credit ?? 0)})` : peso(line.debit)}
              </p>
              <p className="font-mono text-[11px] tabular-nums text-gray-500">
                bal {pesoOrDash(line.balance)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The DESC code, which is the one column a reader scans for. */
function DescChip({ desc }: { desc: string }): React.JSX.Element | null {
  if (!desc) return null
  return (
    <span className="inline-block rounded bg-prominent-purple-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-prominent-purple-900">
      {desc}
    </span>
  )
}
