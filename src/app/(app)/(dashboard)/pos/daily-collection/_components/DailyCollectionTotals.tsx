'use client'

import {
  COLLECTION_KINDS,
  type CollectionKind,
  type DailyCollectionReport,
} from '@/src/schema/pos/daily-collection'
import type { SheetDraftController } from '../_hooks/useSheetDraft'
import {
  buildDenominationLines,
  cashPosition,
  footerAmount,
  peso,
  type DenominationLine,
} from './form-model'

/**
 * The two blocks the paper form prints inside the bottom of its grid, given
 * room to breathe on screen.
 *
 * Left proves what was collected and where it went; right proves the drawer
 * holds what the left claims. They meet at CASH COLLECTED against TOTAL
 * COLLECTION (CASH), and the verdict box states the result in words rather
 * than leaving a reader to subtract two figures themselves.
 */

/** The DESC codes spelled out — the form assumes you already know them, a
 * screen has room not to. */
const KIND_NOTES: Record<CollectionKind, string> = {
  COD: 'Cash on delivery',
  DP: 'Down payment',
  DC: 'Daily collection',
  MI: 'Monthly instalment',
  'MI-PARTIAL': 'Partial instalment',
}

const PANE_HEAD =
  'border-b border-gray-200 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-gray-500'
const ROW = 'flex items-baseline justify-between gap-3 px-4 py-2 text-sm'
const FIGURE = 'font-mono tabular-nums'
const INPUT =
  'w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-right font-mono text-xs tabular-nums outline-none focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100'

interface Props {
  report: DailyCollectionReport
  /** Null for a read-only report. */
  edit: SheetDraftController | null
}

export default function DailyCollectionTotals({ report, edit }: Props): React.JSX.Element {
  const draft = edit?.draft ?? null
  // While editing, the blocks add up what is being typed, so the totals and
  // the verdict move as the cashier counts rather than only after a save.
  const counts = draft
    ? Object.fromEntries(
        Object.entries(draft.denominations).map(([face, raw]) => [face, Number(raw) || 0])
      )
    : undefined
  const denominations = buildDenominationLines(report, counts)
  const position = cashPosition(report, counts ?? report.denominations)

  return (
    <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ByTypePane report={report} />
      <DenominationPane
        report={report}
        denominations={denominations}
        edit={edit}
        position={position}
      />
    </section>
  )
}

function ByTypePane({ report }: { report: DailyCollectionReport }): React.JSX.Element {
  const nonCash = report.nonCash ?? []

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <p className={PANE_HEAD}>Collection by type</p>

      {COLLECTION_KINDS.map((kind) => {
        const amount = report.byKind[kind] ?? 0
        return (
          <div key={kind} className={`${ROW} border-b border-gray-100`}>
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                className={`font-mono text-xs font-semibold ${
                  amount ? 'text-prominent-purple-900' : 'text-gray-400'
                }`}
              >
                {kind}
              </span>
              <span className="truncate text-xs text-gray-500">{KIND_NOTES[kind]}</span>
            </span>
            <span className={`${FIGURE} ${amount ? 'text-gray-900' : 'text-gray-400'}`}>
              {amount ? peso(amount) : '—'}
            </span>
          </div>
        )
      })}

      <div className={`${ROW} border-b border-gray-100`}>
        <span className="text-gray-600">Cash collections</span>
        <span className={`${FIGURE} font-medium`}>{peso(report.totalCollection)}</span>
      </div>
      <div className={`${ROW} border-b border-gray-100`}>
        <span className="text-gray-600">Less: deposited</span>
        <span className={`${FIGURE} text-gray-600`}>({peso(report.totalDeposited)})</span>
      </div>
      <div className={`${ROW} border-b border-gray-100`}>
        <span className="font-medium text-gray-900">Balance (undeposited)</span>
        <span className={`${FIGURE} font-semibold`}>{peso(report.balance)}</span>
      </div>

      {/* A heading over nothing is worse than no heading: on a cash-only day
          the pane stays exactly the client's own cash-only block. */}
      {nonCash.length > 0 && (
        <>
          <p className={`${PANE_HEAD} border-t bg-gray-50`}>Non-cash collections</p>
          {nonCash.map((tender) => (
            <div key={tender.tender} className={`${ROW} border-b border-gray-100`}>
              <span className="min-w-0 truncate pl-3 text-gray-600">{tender.label}</span>
              <span className={FIGURE}>{peso(tender.amount)}</span>
            </div>
          ))}
          <div className={`${ROW} border-b border-gray-100`}>
            <span className="text-gray-600">Subtotal</span>
            <span className={`${FIGURE} font-medium`}>{peso(report.nonCashCollection)}</span>
          </div>
        </>
      )}

      <div className={`${ROW} mt-auto border-t border-gray-200 bg-gray-50 py-3`}>
        <span className="font-semibold text-gray-900">
          {nonCash.length > 0 ? 'Grand total collected' : 'Total collection'}
        </span>
        <span className={`${FIGURE} text-base font-semibold`}>
          {peso(nonCash.length > 0 ? report.grandTotalCollection : report.totalCollection)}
        </span>
      </div>
    </div>
  )
}

function DenominationPane({
  report,
  denominations,
  edit,
  position,
}: {
  report: DailyCollectionReport
  denominations: DenominationLine[]
  edit: SheetDraftController | null
  position: ReturnType<typeof cashPosition>
}): React.JSX.Element {
  // Note rows carry a face value; COINS, TOTAL and the float line do not.
  const isFace = (label: string) => /^\d+$/.test(label)
  const pieces = denominations
    .filter((l) => isFace(l.label))
    .reduce((sum, l) => sum + (l.count ?? 0), 0)

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Denomination
        </p>
        <p className="text-xs text-gray-500">
          {edit ? 'Enter pieces' : `${pieces} ${pieces === 1 ? 'note' : 'notes'} counted`}
        </p>
      </div>

      {denominations.map((line) => {
        const face = isFace(line.label)
        const coins = line.label === 'COINS'
        const summary = !face && !coins

        return (
          <div
            key={line.label}
            className={`${ROW} border-b border-gray-100 ${summary ? 'bg-gray-50/60' : ''}`}
          >
            <span
              className={`font-mono text-xs ${
                line.emphasis ? 'font-semibold text-gray-900' : 'text-gray-600'
              }`}
            >
              {line.label}
            </span>
            <span className="flex items-center gap-3">
              {face &&
                (edit ? (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Count of ${line.label} notes`}
                    className={INPUT}
                    value={edit.draft?.denominations[line.label] ?? ''}
                    onChange={(e) => edit.setDenomination(line.label, e.target.value)}
                  />
                ) : (
                  <span className={`${FIGURE} text-xs text-gray-500`}>{line.count ?? ''}</span>
                ))}
              {coins && edit ? (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  aria-label="Total amount in coins"
                  className={`${INPUT} w-28`}
                  value={edit.draft?.denominations.coins ?? ''}
                  onChange={(e) => edit.setDenomination('coins', e.target.value)}
                />
              ) : (
                <span
                  className={`${FIGURE} w-28 text-right ${
                    line.emphasis ? 'font-semibold' : 'text-gray-700'
                  }`}
                >
                  {footerAmount(line)}
                </span>
              )}
            </span>
          </div>
        )
      })}

      <Verdict report={report} position={position} edit={edit} />
    </div>
  )
}

/**
 * The result in words. A gap here is a real cash over/short — the float is
 * already backed out above and the day's non-cash take never passed through
 * the drawer, so neither can explain it away.
 *
 * When the typed count contradicts the day's session closings, the reason
 * lives here too: it is the field that blocks the save, so it belongs beside
 * the figure that triggered it rather than three sections away.
 */
function Verdict({
  report,
  position,
  edit,
}: {
  report: DailyCollectionReport
  position: ReturnType<typeof cashPosition>
  edit: SheetDraftController | null
}): React.JSX.Element {
  const { variance, balanced } = position
  const over = variance > 0
  const tone = balanced
    ? 'bg-emerald-50 text-emerald-900'
    : over
      ? 'bg-blue-50 text-blue-900'
      : 'bg-red-50 text-red-900'
  const title = balanced
    ? 'Cash balances'
    : `${over ? 'Over' : 'Short'} by ${peso(Math.abs(variance))}`
  const hasNonCash = report.nonCashCollection > 0.005

  return (
    <div className={`mt-auto border-t border-gray-200 px-4 py-3 ${tone}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed">
        {peso(position.denominationTotal)} counted, less {peso(report.openingFloat)} opening float —{' '}
        {peso(position.cashCollected)} against {peso(report.totalCollection)} collected in cash.
        {!balanced && ' Recount and check the day’s sessions before this is signed.'}
        {!balanced && hasNonCash && (
          <>
            {' '}
            The {peso(report.nonCashCollection)} taken on non-cash tenders is not part of this gap —
            it never passed through the drawer.
          </>
        )}
      </p>

      {edit?.countsChanged && (
        <label className="mt-3 block">
          <span className="text-xs font-semibold">
            This count no longer matches the day’s session closings — say why:
          </span>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100"
            value={edit.draft?.denominationOverrideReason ?? ''}
            onChange={(e) => edit.update('denominationOverrideReason', e.target.value)}
            placeholder="Reason (required before this can be saved)"
            aria-label="Reason for the corrected denomination count"
          />
        </label>
      )}
    </div>
  )
}
