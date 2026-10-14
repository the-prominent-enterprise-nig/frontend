'use client'

import { Loader2 } from 'lucide-react'
import { coveringMonthly, dateInputFromToday, typedPlanProblem } from '../_utils/typed-plan'

type PlanFields = {
  manualTermInput?: string
  manualMonthlyInput?: string
  firstDueDateInput?: string
  downPaymentInput?: string
}

type Preview = {
  monthlyInstallment: number
  totalPayable: number
  lines: { lineNumber: number; dueDate: string; amount: number }[]
}

type Props = {
  line: PlanFields
  /** Every cart line this row stands for — the same figures go on each. */
  lineIds: string[]
  /** What the line sells for, to the centavo. */
  saleAmount: number
  downPayment: number
  preview: Preview | null
  previewLoading: boolean
  onPatch: (lineIds: string[], patch: PlanFields) => void
  onSixtyDay: (lineIds: string[]) => void
  onRateCard: (lineIds: string[]) => void
}

const money = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

const fieldClass =
  'w-32 rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-right text-[13px] outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100'

const linkClass =
  'text-xs font-medium text-prominent-purple-500 underline decoration-dotted underline-offset-2 hover:text-prominent-purple-700'

/** The plan a cashier typed in for an in-house installment row (Scenario 71):
 * months, down payment, monthly installment and the first due date. No
 * Financing Term, rate card or 10% floor stands behind it — the sale then
 * needs a reason and a note in the order summary, and shows up in the
 * end-of-day review. */
export default function TypedPlanPanel({
  line,
  lineIds,
  saleAmount,
  downPayment,
  preview,
  previewLoading,
  onPatch,
  onSixtyDay,
  onRateCard,
}: Props) {
  const problem = typedPlanProblem({
    months: line.manualTermInput,
    monthly: line.manualMonthlyInput,
    firstDueDate: line.firstDueDateInput,
    downPayment,
    saleAmount,
  })
  const months = Number(line.manualTermInput)
  const covering =
    Number.isInteger(months) && months >= 1 ? coveringMonthly(saleAmount, downPayment, months) : 0
  const monthlyNow = Number(line.manualMonthlyInput)
  const suggestionDiffers = covering > 0 && Math.abs(covering - monthlyNow) > 0.004

  return (
    <div
      data-testid="typed-plan"
      className="space-y-2 rounded-lg border border-prominent-purple-100 bg-prominent-purple-50 px-2.5 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-prominent-purple-700">Typed terms</span>
        <span className="shrink-0 rounded-full bg-prominent-purple-200 px-2 py-0.5 text-[10px] font-bold text-prominent-purple-700">
          Manual
        </span>
      </div>

      <label className="flex items-center justify-between gap-3 text-xs text-gray-700">
        Down payment
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          aria-label="Typed down payment"
          value={line.downPaymentInput ?? ''}
          onChange={(e) => onPatch(lineIds, { downPaymentInput: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-xs text-gray-700">
        Months
        <input
          type="number"
          min={1}
          max={60}
          step={1}
          inputMode="numeric"
          aria-label="Typed months"
          value={line.manualTermInput ?? ''}
          onChange={(e) => onPatch(lineIds, { manualTermInput: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-xs text-gray-700">
        Monthly installment
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          aria-label="Typed monthly installment"
          value={line.manualMonthlyInput ?? ''}
          onChange={(e) => onPatch(lineIds, { manualMonthlyInput: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-xs text-gray-700">
        First due date
        <input
          type="date"
          min={dateInputFromToday({})}
          aria-label="First due date"
          value={line.firstDueDateInput ?? ''}
          onChange={(e) => onPatch(lineIds, { firstDueDateInput: e.target.value })}
          className={fieldClass}
        />
      </label>

      {suggestionDiffers && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
          To cover the sale: {money(covering)}/mo.
          <button
            type="button"
            data-testid="use-covering-monthly"
            onClick={() => onPatch(lineIds, { manualMonthlyInput: covering.toFixed(2) })}
            className={linkClass}
          >
            Use it
          </button>
        </p>
      )}

      {problem ? (
        <p className="text-xs text-red-600" role="status" data-testid="typed-plan-problem">
          {problem}
        </p>
      ) : (
        <div className="rounded-lg bg-white px-2.5 py-1.5 text-[13px] text-prominent-purple-700">
          {previewLoading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" /> Calculating…
            </span>
          ) : preview ? (
            <div className="space-y-0.5" data-testid="typed-plan-summary">
              <div className="flex items-center justify-between">
                <span>
                  {money(preview.monthlyInstallment)}/mo × {preview.lines.length}
                </span>
                <span className="font-semibold">{money(preview.totalPayable)} total</span>
              </div>
              <div className="text-xs text-prominent-purple-500">
                First due{' '}
                {new Date(preview.lines[0].dueDate).toLocaleDateString('en-PH', {
                  timeZone: 'UTC',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          ) : (
            <span className="opacity-70">Preview unavailable.</span>
          )}
        </div>
      )}

      <p className="text-xs text-prominent-purple-500">
        No rate card or minimum down payment applies. Pick a reason and add a note in the order
        summary — management reviews typed terms at the end of the day.
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <button
          type="button"
          data-testid="sixty-day-plan"
          onClick={() => onSixtyDay(lineIds)}
          className={linkClass}
        >
          50% down · balance in 60 days
        </button>
        <button
          type="button"
          data-testid="use-rate-card"
          onClick={() => onRateCard(lineIds)}
          className={linkClass}
        >
          Use rate card values
        </button>
      </div>
    </div>
  )
}
