'use client'

import type { Control } from 'react-hook-form'
import { Check, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { MONO } from '../procurementTokens'
import { LINE_GRID } from './receiveTokens'
import { fmtPeso } from './receiveTotals'
import { LinePricingDrawer } from './LinePricingDrawer'
import { SerialCaptureDrawer } from './SerialCaptureDrawer'
import type { LineIssue, IssueFix } from './receiveIssues'
import type { LineDrawer, ReceivePoFormValues, ReceivePoLine } from './receiveSchema'

export type ReceiveLineRowProps = {
  control: Control<ReceivePoFormValues>
  lineIndex: number
  line: ReceivePoLine
  title: string
  sku?: string
  ordered: number
  receivedToDate: number
  remaining: number
  canViewCost: boolean
  showErrors: boolean
  issues: LineIssue[]
  drawer: LineDrawer
  editingPricing: boolean
  isDuplicateSerial: (unitIndex: number) => boolean
  onToggleSelected: () => void
  onQtyChange: (raw: number) => void
  onFillMax: () => void
  onOpenDrawer: (drawer: LineDrawer) => void
  onToggleEditPricing: () => void
  onToggleQc: () => void
  onQcReasonChange: (value: string) => void
  onSerialChange: (unitIndex: number, value: string) => void
  onClearSerials: () => void
  onFixIssue: (fix: IssueFix) => void
}

/**
 * One PO line, as both a wide grid row and a narrow card.
 *
 * The two layouts are media-query siblings rather than one adaptive row: at
 * table width the receiver is scanning nine columns down a page, and on a
 * warehouse tablet they are working one item at a time with gloves on. Those
 * want genuinely different controls, not the same ones reflowed — hence the
 * larger steppers and stacked stats below.
 */
export function ReceiveLineRow(props: ReceiveLineRowProps) {
  const { line, remaining, issues, drawer, canViewCost } = props
  const closed = remaining <= 0
  const hasError = issues.some((i) => i.kind === 'error')
  const lineTotal = line.selected ? (line.unitCost ?? 0) * line.quantityReceived : 0

  return (
    <div
      className={`border-t border-[#f1f1f4] ${
        closed
          ? 'bg-[#fbfbfc] opacity-70'
          : hasError
            ? 'bg-[#fffbfa]'
            : drawer
              ? 'bg-[#fdfcff]'
              : 'bg-white'
      }`}
    >
      <WideRow {...props} closed={closed} lineTotal={lineTotal} />
      <NarrowCard {...props} closed={closed} lineTotal={lineTotal} />

      {issues.map((issue, n) => (
        <div
          key={n}
          className={`flex items-center gap-2 px-3.5 pb-2.5 text-[11.5px] lg:pl-12 lg:pr-4.5 ${
            issue.kind === 'error' ? 'text-[#b42318]' : 'text-[#8a4b06]'
          }`}
        >
          <span
            className={`inline-block h-[5px] w-[5px] shrink-0 rounded-full ${
              issue.kind === 'error' ? 'bg-[#b42318]' : 'bg-[#b25e09]'
            }`}
          />
          <span className="min-w-0 flex-1">{issue.text}</span>
          {issue.fix && (
            <button
              type="button"
              onClick={() => props.onFixIssue(issue.fix!)}
              className="shrink-0 text-[11.5px] text-[#5b21b6] underline hover:text-[#4a189b]"
            >
              {issue.fix === 'serials' ? 'Enter serials' : 'Fix'}
            </button>
          )}
        </div>
      ))}

      {line.qualityHold && !closed && (
        <div className="mx-3.5 mb-3 flex flex-wrap items-center gap-2.5 rounded-[9px] border border-[#f7dfc0] bg-[#fffdf8] px-3 py-2.5 lg:ml-12 lg:mr-4.5">
          <span
            className={`${MONO} shrink-0 text-[9.5px] uppercase tracking-[.09em] text-[#8a4b06]`}
          >
            QC hold reason
          </span>
          <input
            value={line.notes ?? ''}
            onChange={(e) => props.onQcReasonChange(e.target.value)}
            type="text"
            maxLength={500}
            placeholder="What should the inspector check?"
            aria-label={`QC hold reason for ${props.title}`}
            className={`w-full flex-1 rounded-[7px] border bg-white px-2.5 py-1.5 text-[12.5px] text-[#17171c] outline-none focus:border-[#b25e09] ${
              (line.notes ?? '').trim() ? 'border-[#f7dfc0]' : 'border-[#e4e4e9]'
            }`}
          />
        </div>
      )}

      {drawer === 'serials' && (
        <div className="mx-3.5 mb-3.5 lg:ml-12 lg:mr-4.5">
          <SerialCaptureDrawer
            quantity={line.quantityReceived}
            serials={line.serialNumbers ?? []}
            showErrors={props.showErrors}
            isDuplicate={props.isDuplicateSerial}
            onChange={props.onSerialChange}
            onClearAll={props.onClearSerials}
            onClose={() => props.onOpenDrawer(null)}
          />
        </div>
      )}

      {drawer === 'pricing' && canViewCost && (
        <div className="mx-3.5 mb-3.5 lg:ml-12 lg:mr-4.5">
          <LinePricingDrawer
            control={props.control}
            lineIndex={props.lineIndex}
            srp={line.srp}
            discounts={(line.discounts ?? []) as { type: 'percentage' | 'amount'; value: number }[]}
            unitCost={line.unitCost}
            lineTotal={lineTotal}
            editing={props.editingPricing}
            onToggleEdit={props.onToggleEditPricing}
            onClose={() => props.onOpenDrawer(null)}
          />
        </div>
      )}
    </div>
  )
}

type InnerProps = ReceiveLineRowProps & { closed: boolean; lineTotal: number }

function WideRow(props: InnerProps) {
  const { line, closed, remaining, lineTotal, canViewCost } = props
  return (
    <div className={`hidden px-4.5 py-3 lg:grid ${LINE_GRID}`}>
      <SelectBox {...props} />

      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[13px] font-medium leading-[1.35]">{props.title}</span>
        <div className="flex flex-wrap items-center gap-[7px]">
          {props.sku && <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>{props.sku}</span>}
          {line.isSerialTracked && !closed && <SerialBadge />}
        </div>
      </div>

      {/* h-[34px] + self-start is what lines these three up with the middle of
          the quantity stepper rather than with the taller cell it sits in —
          the stepper's own cell is self-start and carries "Fill max" under
          it, so plain grid centring drops the numbers below the input. The
          right padding on Remaining is the gutter before the stepper. */}
      <span
        className={`${MONO} flex h-[34px] items-center justify-center self-start text-[12.5px] text-[#3d3d4a]`}
      >
        {props.ordered}
      </span>
      <span
        className={`${MONO} flex h-[34px] items-center justify-center self-start text-[12.5px] text-[#8b8b9b]`}
      >
        {props.receivedToDate > 0 ? props.receivedToDate : '—'}
      </span>
      <span
        className={`${MONO} flex h-[34px] items-center justify-center self-start pr-3 text-[13px] font-semibold ${
          closed ? 'text-[#8b8b9b]' : 'text-[#b25e09]'
        }`}
      >
        {closed ? 'None' : remaining}
      </span>

      <div className="flex flex-col gap-[3px] self-start">
        <QtyStepper {...props} />
        <FillMaxButton {...props} />
      </div>

      <div className="min-w-0 self-start">
        <TrackingButton {...props} />
      </div>

      {/* Same h-[34px] self-start box as the stats: it centres the 17px
          checkbox on the serial button beside it rather than on the whole
          row, which is taller than either of them. */}
      <div className="flex h-[34px] items-center justify-center self-start">
        <QcToggle {...props} />
      </div>

      <div className="flex flex-col items-end gap-px">
        {canViewCost ? (
          <>
            <span
              className={`${MONO} text-right text-[13px] font-semibold ${
                line.selected && line.quantityReceived > 0 ? 'text-[#17171c]' : 'text-[#a3a3b2]'
              }`}
            >
              {fmtPeso(lineTotal)}
            </span>
            <button
              type="button"
              onClick={() => props.onOpenDrawer(props.drawer === 'pricing' ? null : 'pricing')}
              className={`${MONO} text-[10px] text-[#5b21b6] hover:underline`}
            >
              @ {fmtPeso(line.unitCost ?? 0)}
            </button>
          </>
        ) : (
          <span className="text-[11px] text-[#a3a3b2]">—</span>
        )}
      </div>
    </div>
  )
}

function NarrowCard(props: InnerProps) {
  const { line, closed, remaining, lineTotal, canViewCost } = props
  return (
    <div className="flex flex-col gap-3 p-3.5 lg:hidden">
      <div className="flex items-start gap-2.5">
        <SelectBox {...props} large />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-[13.5px] font-medium leading-[1.35]">{props.title}</span>
          <div className="flex flex-wrap items-center gap-[7px]">
            {props.sku && (
              <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>{props.sku}</span>
            )}
            {line.isSerialTracked && !closed && <SerialBadge />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Ordered" value={String(props.ordered)} />
        <MiniStat
          label="Received to date"
          value={props.receivedToDate > 0 ? String(props.receivedToDate) : '—'}
        />
        <MiniStat
          label="Remaining"
          value={closed ? 'None' : String(remaining)}
          highlight={!closed}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <QtyStepper {...props} large />
        <FillMaxButton {...props} large />
        {canViewCost && (
          <div className="ml-auto flex flex-col items-end gap-px">
            <span className={`${MONO} text-[13px] font-semibold`}>{fmtPeso(lineTotal)}</span>
            <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>
              @ {fmtPeso(line.unitCost ?? 0)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TrackingButton {...props} large />
        <QcToggle {...props} large />
        {canViewCost && (
          <button
            type="button"
            onClick={() => props.onOpenDrawer(props.drawer === 'pricing' ? null : 'pricing')}
            className="min-h-10 rounded-lg border border-[#d3d3db] bg-white px-3 py-2.5 text-[12.5px] font-medium text-[#5b21b6]"
          >
            Pricing
          </button>
        )}
      </div>
    </div>
  )
}

function SelectBox({ line, closed, onToggleSelected, large }: InnerProps & { large?: boolean }) {
  const on = line.selected && !closed
  return (
    <Tooltip
      label={
        closed ? 'This line is fully received' : on ? 'Exclude this line' : 'Include this line'
      }
      side="bottom"
      align="start"
    >
      <button
        type="button"
        onClick={onToggleSelected}
        disabled={closed}
        role="checkbox"
        aria-checked={on}
        aria-label={on ? 'Exclude this line' : 'Include this line'}
        className={`flex shrink-0 items-center justify-center ${
          large ? 'h-[26px] w-[26px] rounded-[7px]' : 'h-[17px] w-[17px] rounded-[4px]'
        } border ${
          closed
            ? 'border-[#e4e4e9] bg-[#f1f1f4]'
            : on
              ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
              : 'border-[#d3d3db] bg-white'
        } disabled:cursor-default`}
      >
        {on && <Check className={large ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />}
      </button>
    </Tooltip>
  )
}

function QtyStepper({
  line,
  closed,
  remaining,
  showErrors,
  onQtyChange,
  large,
}: InnerProps & { large?: boolean }) {
  const over = line.quantityReceived > remaining
  const bad = showErrors && line.selected && (line.quantityReceived <= 0 || over)
  const step = large ? 'h-10 w-10 text-[17px]' : 'h-7 w-6 text-[14px]'

  return (
    <div
      className={`flex items-center gap-0.5 rounded-lg border ${
        large ? 'h-[46px] p-[3px]' : 'h-[34px] w-full p-0.5'
      } ${
        bad
          ? 'border-[#b42318]'
          : line.quantityReceived > 0
            ? 'border-[#7c4fd1] shadow-[0_0_0_3px_#f4efff]'
            : 'border-[#d3d3db]'
      } ${closed ? 'bg-[#f7f7f8]' : 'bg-white'}`}
    >
      <button
        type="button"
        onClick={() => onQtyChange(line.quantityReceived - 1)}
        disabled={closed}
        aria-label="Decrease quantity"
        className={`flex shrink-0 items-center justify-center rounded-md text-[#5b5b6b] hover:bg-[#f1f1f4] disabled:opacity-40 ${step}`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={Number.isFinite(line.quantityReceived) ? line.quantityReceived : ''}
        onChange={(e) => onQtyChange(e.target.valueAsNumber)}
        disabled={closed}
        type="number"
        min="0"
        step="1"
        aria-label="Quantity to receive"
        className={`${MONO} w-full min-w-0 border-none bg-transparent p-0 text-center font-semibold text-[#17171c] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          large ? 'text-[15px]' : 'text-[13px]'
        }`}
      />
      <button
        type="button"
        onClick={() => onQtyChange(line.quantityReceived + 1)}
        disabled={closed}
        aria-label="Increase quantity"
        className={`flex shrink-0 items-center justify-center rounded-md text-[#5b5b6b] hover:bg-[#f1f1f4] disabled:opacity-40 ${step}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function FillMaxButton({
  line,
  closed,
  remaining,
  onFillMax,
  large,
}: InnerProps & { large?: boolean }) {
  const atMax = line.quantityReceived === remaining
  const label = closed ? 'Line closed' : atMax ? 'All remaining' : `Receive all ${remaining}`

  if (large) {
    return (
      <button
        type="button"
        onClick={onFillMax}
        disabled={closed || atMax}
        className="min-h-[46px] rounded-lg border border-[#d3d3db] bg-white px-3 py-2.5 text-[12.5px] text-[#17171c] disabled:text-[#a3a3b2]"
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onFillMax}
      disabled={closed || atMax}
      className={`text-left text-[10.5px] ${
        closed || atMax ? 'cursor-default text-[#8b8b9b]' : 'text-[#5b21b6] hover:underline'
      }`}
    >
      {label}
    </button>
  )
}

function TrackingButton({
  line,
  closed,
  drawer,
  onOpenDrawer,
  showErrors,
  isDuplicateSerial,
  large,
}: InnerProps & { large?: boolean }) {
  const tracked = !!line.isSerialTracked && !closed
  const slots = (line.serialNumbers ?? []).slice(0, line.quantityReceived)
  const filled = slots.filter((s) => (s ?? '').trim()).length
  // Judged here rather than read off `issues`: that list arrives already
  // filtered by showErrors, so before the receiver has tried to move on it is
  // empty — and the pill would have read green on a line with no serials at
  // all, which is the one moment it most needs not to.
  const ok = filled === line.quantityReceived && !slots.some((_, unit) => isDuplicateSerial(unit))

  const status = closed
    ? 'Fully received'
    : !tracked
      ? 'Untracked'
      : line.quantityReceived > 0
        ? `${filled} / ${line.quantityReceived} serials`
        : 'Serial-tracked'

  const tone = closed
    ? 'border-[#eeeef1] bg-[#f7f7f8] text-[#8b8b9b]'
    : !tracked
      ? 'border-[#dcefe5] bg-[#f4fbf7] text-[#0b6644]'
      : ok && line.quantityReceived > 0
        ? 'border-[#b6e0cd] bg-[#e7f5ef] text-[#0b6644]'
        : showErrors
          ? 'border-[#f3c9c5] bg-[#fdeceb] text-[#b42318]'
          : 'border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490]'

  return (
    <button
      type="button"
      onClick={() => tracked && onOpenDrawer(drawer === 'serials' ? null : 'serials')}
      disabled={!tracked}
      aria-expanded={drawer === 'serials'}
      className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium ${tone} ${
        large ? 'min-h-10 flex-1 py-2.5 text-left text-[12.5px]' : 'h-[34px] w-full'
      } ${tracked ? '' : 'cursor-default'}`}
    >
      <span className="min-w-0 truncate">{status}</span>
      {tracked &&
        (drawer === 'serials' ? (
          <ChevronUp className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ))}
    </button>
  )
}

function QcToggle({ line, closed, onToggleQc, large }: InnerProps & { large?: boolean }) {
  if (large) {
    return (
      <button
        type="button"
        onClick={onToggleQc}
        disabled={closed}
        aria-pressed={line.qualityHold}
        className={`min-h-10 shrink-0 rounded-lg border px-3 py-2.5 text-[12.5px] font-medium ${
          line.qualityHold
            ? 'border-[#f7dfc0] bg-[#fdf3e7] text-[#8a4b06]'
            : 'border-[#d3d3db] bg-white text-[#5b5b6b]'
        }`}
      >
        {line.qualityHold ? 'QC hold on' : 'QC hold'}
      </button>
    )
  }

  return (
    <Tooltip
      label={
        line.qualityHold ? 'On hold — lands in inspection, not sellable' : 'Hold for QC inspection'
      }
      side="top"
      align="end"
    >
      <button
        type="button"
        onClick={onToggleQc}
        disabled={closed}
        role="checkbox"
        aria-checked={line.qualityHold}
        aria-label="Hold for QC inspection"
        className={`flex h-[17px] w-[17px] items-center justify-center rounded-[4px] border text-[9px] font-bold ${
          line.qualityHold
            ? 'border-[#b25e09] bg-[#b25e09] text-white'
            : 'border-[#d3d3db] bg-white text-transparent'
        } disabled:opacity-40`}
      >
        !
      </button>
    </Tooltip>
  )
}

function SerialBadge() {
  return (
    <span
      className={`${MONO} rounded-[4px] bg-[#eaf0fb] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[.06em] text-[#1f4b99]`}
    >
      Serial-tracked
    </span>
  )
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 ${
        highlight ? 'border-[#f7dfc0] bg-[#fdf3e7]' : 'border-[#eeeef1] bg-[#fbfbfc]'
      }`}
    >
      <span className={`${MONO} text-[9.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
        {label}
      </span>
      <span
        className={`${MONO} text-[15px] font-semibold ${
          highlight ? 'text-[#b25e09]' : 'text-[#3d3d4a]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
