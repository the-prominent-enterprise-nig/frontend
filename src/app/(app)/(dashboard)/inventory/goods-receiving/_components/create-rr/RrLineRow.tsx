'use client'

import type { Control } from 'react-hook-form'
import { ChevronDown, ChevronUp, Minus, Plus, Trash2 } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'
import { MONO, fmtPeso } from '../../../purchase-orders/_components/procurementTokens'
import { SerialCaptureDrawer } from '../../../purchase-orders/_components/receive-po/SerialCaptureDrawer'
import type {
  IssueFix,
  LineIssue,
} from '../../../purchase-orders/_components/receive-po/receiveIssues'
import type { LineDrawer } from '../../../purchase-orders/_components/receive-po/receiveSchema'
import { RrPricingDrawer } from './RrPricingDrawer'
import { RR_LINE_GRID } from './rrTokens'
import { lineTotal as computeLineTotal, type RrLine } from './rrTotals'

export type RrLineRowProps = {
  control: Control<ReceiveStockFormValues>
  lineIndex: number
  line: RrLine
  title: string
  sku?: string
  isSerialTracked: boolean
  /** "4 outstanding on PO-20260910-0001" when this line came off a purchase
   * order, so the row says what it is answering to. */
  poChip?: string
  canViewCost: boolean
  showErrors: boolean
  issues: LineIssue[]
  drawer: LineDrawer
  isDuplicateSerial: (unitIndex: number) => boolean
  onQtyChange: (raw: number) => void
  onOpenDrawer: (drawer: LineDrawer) => void
  onSerialChange: (unitIndex: number, value: string) => void
  onClearSerials: () => void
  onToggleFreebie: () => void
  onToggleQualityHold: () => void
  onQcReasonChange: (value: string) => void
  onRemove: () => void
  onFixIssue: (fix: IssueFix) => void
}

/**
 * One received line, as both a wide grid row and a narrow card.
 *
 * The two layouts are media-query siblings rather than one reflowed row: at
 * desk width the receiver is scanning a column of quantities, and on a
 * warehouse tablet they are working one item at a time with gloves on. Those
 * want genuinely different controls — hence the larger steppers and stacked
 * actions below.
 */
export function RrLineRow(props: RrLineRowProps): React.ReactElement {
  const { line, issues, drawer, canViewCost } = props
  const hasError = issues.some((issue) => issue.kind === 'error')
  const total = computeLineTotal(line)

  return (
    <div
      className={`border-t border-[#f1f1f4] ${
        hasError ? 'bg-[#fffbfa]' : drawer ? 'bg-[#fdfcff]' : 'bg-white'
      }`}
    >
      <WideRow {...props} total={total} />
      <NarrowCard {...props} total={total} />

      {issues.map((issue, n) => (
        <div
          key={n}
          className={`flex items-center gap-2 px-3.5 pb-2.5 text-[11.5px] lg:px-4.5 ${
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
              onClick={() => props.onFixIssue(issue.fix as IssueFix)}
              className="shrink-0 text-[11.5px] text-[#5b21b6] underline hover:text-[#4a189b]"
            >
              {issue.fix === 'serials' ? 'Enter serials' : 'Fix'}
            </button>
          )}
        </div>
      ))}

      {/* The reason rides beside the hold rather than inside the details
          drawer: a held line that cannot say WHY sends the inspector off to
          ask, and the whole point of holding it here is that the receiver is
          the one looking at the damage. */}
      {line.qualityHold && (
        <div className="mx-3.5 mb-3 flex flex-wrap items-center gap-2.5 rounded-[9px] border border-[#f7dfc0] bg-[#fffdf8] px-3 py-2.5 lg:mx-4.5">
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
        <div className="mx-3.5 mb-3.5 lg:mx-4.5">
          <SerialCaptureDrawer
            quantity={line.quantityReceived || 0}
            serials={line.serialNumbers ?? []}
            showErrors={props.showErrors}
            isDuplicate={props.isDuplicateSerial}
            onChange={props.onSerialChange}
            onClearAll={props.onClearSerials}
            onClose={() => props.onOpenDrawer(null)}
          />
        </div>
      )}

      {drawer === 'pricing' && (
        <div className="mx-3.5 mb-3.5 lg:mx-4.5">
          <RrPricingDrawer
            control={props.control}
            lineIndex={props.lineIndex}
            lineTotal={total}
            isFreebie={line.isFreebie ?? false}
            qualityHold={line.qualityHold ?? false}
            canViewCost={canViewCost}
            onToggleFreebie={props.onToggleFreebie}
            onToggleQualityHold={props.onToggleQualityHold}
            onClose={() => props.onOpenDrawer(null)}
          />
        </div>
      )}
    </div>
  )
}

type InnerProps = RrLineRowProps & { total: number }

function WideRow(props: InnerProps): React.ReactElement {
  const { line, canViewCost, total } = props
  return (
    <div className={`hidden px-4.5 py-3 lg:grid ${RR_LINE_GRID}`}>
      <ItemCell {...props} />
      <QtyStepper {...props} />
      <SerialButton {...props} />
      <DetailsButton {...props} />

      <div className="flex flex-col items-end gap-px self-center">
        {canViewCost ? (
          <>
            <span
              className={`${MONO} text-right text-[13px] font-semibold ${
                (line.quantityReceived || 0) > 0 ? 'text-[#17171c]' : 'text-[#a3a3b2]'
              }`}
            >
              {fmtPeso(total)}
            </span>
            <span className={`${MONO} text-[10px] text-[#8b8b9b]`}>
              @ {fmtPeso(line.isFreebie ? 0 : (line.unitCost ?? 0))}
            </span>
          </>
        ) : null}
      </div>

      <RemoveButton {...props} />
    </div>
  )
}

function NarrowCard(props: InnerProps): React.ReactElement {
  const { line, canViewCost, total } = props
  return (
    <div className="flex flex-col gap-3 p-3.5 lg:hidden">
      <div className="flex items-start justify-between gap-2.5">
        <ItemCell {...props} />
        <RemoveButton {...props} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <QtyStepper {...props} large />
        {canViewCost && (
          <div className="ml-auto flex flex-col items-end gap-px">
            <span className={`${MONO} text-[13px] font-semibold`}>{fmtPeso(total)}</span>
            <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>
              @ {fmtPeso(line.isFreebie ? 0 : (line.unitCost ?? 0))}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SerialButton {...props} large />
        <DetailsButton {...props} large />
      </div>
    </div>
  )
}

function ItemCell({ line, title, sku, isSerialTracked, poChip }: InnerProps): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] self-center">
      <span className="text-[13px] font-medium leading-[1.35]">{title}</span>
      <div className="flex flex-wrap items-center gap-[7px]">
        {sku && <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>{sku}</span>}
        {isSerialTracked && (
          <span
            className={`${MONO} rounded-[4px] bg-[#eaf0fb] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[.06em] text-[#1f4b99]`}
          >
            Serial-tracked
          </span>
        )}
        {poChip && (
          <span className="rounded-[4px] bg-[#f1ebfb] px-1.5 py-0.5 text-[10px] font-medium text-[#3f1490]">
            {poChip}
          </span>
        )}
        {line.isFreebie && (
          <span className="rounded-[4px] bg-[#e7f5ef] px-1.5 py-0.5 text-[10px] font-medium text-[#0b6644]">
            Freebie
          </span>
        )}
        {line.qualityHold && (
          <span className="rounded-[4px] bg-[#fdf3e7] px-1.5 py-0.5 text-[10px] font-medium text-[#8a4b06]">
            Quality hold
          </span>
        )}
      </div>
    </div>
  )
}

function QtyStepper({
  line,
  showErrors,
  onQtyChange,
  large,
}: InnerProps & { large?: boolean }): React.ReactElement {
  const qty = line.quantityReceived || 0
  const bad = showErrors && qty <= 0
  const step = large ? 'h-10 w-10' : 'h-7 w-6'

  return (
    <div
      className={`flex items-center gap-0.5 self-center rounded-lg border p-0.5 ${
        large ? 'h-[46px]' : 'h-[34px] w-full'
      } ${
        bad
          ? 'border-[#b42318] bg-[#fdeceb]'
          : qty > 0
            ? 'border-[#7c4fd1] bg-white shadow-[0_0_0_3px_#f4efff]'
            : 'border-[#d3d3db] bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => onQtyChange(qty - 1)}
        aria-label="Decrease quantity"
        className={`flex shrink-0 items-center justify-center rounded-md text-[#5b5b6b] hover:bg-[#f1f1f4] ${step}`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={Number.isFinite(qty) ? qty : ''}
        onChange={(e) => onQtyChange(e.target.valueAsNumber)}
        type="number"
        min="0"
        step="1"
        aria-label="Quantity received"
        className={`${MONO} w-full min-w-0 border-none bg-transparent p-0 text-center font-semibold text-[#17171c] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          large ? 'text-[15px]' : 'text-[13px]'
        }`}
      />
      <button
        type="button"
        onClick={() => onQtyChange(qty + 1)}
        aria-label="Increase quantity"
        className={`flex shrink-0 items-center justify-center rounded-md text-[#5b5b6b] hover:bg-[#f1f1f4] ${step}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function SerialButton({
  line,
  isSerialTracked,
  drawer,
  showErrors,
  isDuplicateSerial,
  onOpenDrawer,
  large,
}: InnerProps & { large?: boolean }): React.ReactElement {
  const qty = line.quantityReceived || 0
  const slots = (line.serialNumbers ?? []).slice(0, qty)
  const filled = slots.filter((serial) => (serial ?? '').trim()).length
  // Judged here rather than read off `issues`, which arrives already filtered
  // by showErrors: before the receiver has tried to post, that list is empty —
  // and the pill would have read green on a line with no serials at all.
  const ok = qty > 0 && filled === qty && !slots.some((_, unit) => isDuplicateSerial(unit))

  const tone = !isSerialTracked
    ? 'border-[#dcefe5] bg-[#f4fbf7] text-[#0b6644]'
    : ok
      ? 'border-[#b6e0cd] bg-[#e7f5ef] text-[#0b6644]'
      : showErrors
        ? 'border-[#f3c9c5] bg-[#fdeceb] text-[#b42318]'
        : 'border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490]'

  const label = !isSerialTracked
    ? 'Not tracked'
    : qty > 0
      ? `${filled} / ${qty} serials`
      : 'Serial-tracked'

  return (
    <button
      type="button"
      onClick={() => isSerialTracked && onOpenDrawer(drawer === 'serials' ? null : 'serials')}
      disabled={!isSerialTracked}
      aria-expanded={drawer === 'serials'}
      className={`flex items-center justify-between gap-1.5 self-center rounded-lg border px-2.5 text-[11.5px] font-medium ${tone} ${
        large ? 'min-h-10 flex-1 py-2.5 text-left text-[12.5px]' : 'h-[34px] w-full'
      } ${isSerialTracked ? '' : 'cursor-default'}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      {isSerialTracked &&
        (drawer === 'serials' ? (
          <ChevronUp className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ))}
    </button>
  )
}

function DetailsButton({
  drawer,
  onOpenDrawer,
  large,
}: InnerProps & { large?: boolean }): React.ReactElement {
  const open = drawer === 'pricing'
  return (
    <button
      type="button"
      onClick={() => onOpenDrawer(open ? null : 'pricing')}
      aria-expanded={open}
      className={`flex items-center justify-between gap-1.5 self-center rounded-lg border px-2.5 text-[11.5px] font-medium ${
        open
          ? 'border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490]'
          : 'border-[#d3d3db] bg-white text-[#5b5b6b]'
      } ${large ? 'min-h-10 flex-1 py-2.5 text-left text-[12.5px]' : 'h-[34px] w-full'}`}
    >
      <span className="min-w-0 truncate">Details</span>
      {open ? (
        <ChevronUp className="h-3 w-3 shrink-0" />
      ) : (
        <ChevronDown className="h-3 w-3 shrink-0" />
      )}
    </button>
  )
}

function RemoveButton({ onRemove, title }: InnerProps): React.ReactElement {
  return (
    <Tooltip label="Remove this line" side="top" align="end">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${title}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Tooltip>
  )
}
