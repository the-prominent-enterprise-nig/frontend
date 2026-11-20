'use client'

import { X } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { ItemSearchCombobox } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_components/ItemSearchCombobox'
import { MONO } from '../procurementTokens'
import { fmtPeso } from './receiveTotals'
import { toArrivedItem } from './ArrivedItemPicker'
import type { ExtraUnit } from './receiveSchema'

const INPUT =
  'rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type Props = {
  units: ExtraUnit[]
  canViewCost: boolean
  showErrors: boolean
  supplierId?: string
  onAdd: () => void
  onChange: (index: number, patch: Partial<ExtraUnit>) => void
  onRemove: (index: number) => void
}

/** A blank row, the way the transfer receive form adds one. */
export const EMPTY_EXTRA_UNIT: ExtraUnit = {
  itemId: '',
  label: '',
  isSerialTracked: false,
  quantity: 1,
  serialNumbers: undefined,
  unitCost: undefined,
}

/**
 * Unlisted items — units the supplier delivered that weren't on the PO (an
 * extra item, or more than was ordered). Laid out like the transfer receive
 * form's own Unlisted Items, plus a unit cost: each goes onto the PO as a line
 * added at receiving, and onto its receipts and AP bill.
 */
export function ExtraUnitsCard(props: Props): React.ReactElement {
  const { units } = props
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-zinc-700">
          Unlisted Items{' '}
          <span className="font-normal text-zinc-400">(received but not on the PO)</span>
        </span>
        <button
          type="button"
          onClick={props.onAdd}
          className="text-[13px] font-medium text-prominent-purple-700 hover:text-prominent-purple-800"
        >
          + Add unlisted item
        </button>
      </div>
      {units.length > 0 && (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
          {units.map((unit, i) => (
            <ExtraUnitRow key={i} {...props} unit={unit} index={i} />
          ))}
        </div>
      )}
      <p className="text-xs text-zinc-400">
        A serial-tracked pick switches to serial entry — one box per unit, scanner ready.
      </p>
    </div>
  )
}

type RowProps = Props & { unit: ExtraUnit; index: number }

function ExtraUnitRow(props: RowProps): React.ReactElement {
  const { unit, index, onChange } = props
  const error = unitError(unit, props.showErrors)
  return (
    <div className="border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ItemSearchCombobox
            value={unit.itemId}
            onChange={(id) => onChange(index, { itemId: id })}
            onSelect={(option) => onChange(index, pickPatch(option))}
            initialLabel={unit.label || undefined}
            supplierId={props.supplierId}
            placeholder="Search item by name or SKU…"
          />
        </div>
        <input
          aria-label="Quantity"
          inputMode="numeric"
          value={unit.quantity || ''}
          onChange={(e) => onChange(index, quantityPatch(unit, e.target.value))}
          className={`${INPUT} ${MONO} w-20 shrink-0 text-right`}
        />
        {props.canViewCost && <CostInput {...props} />}
        <Tooltip label="Remove unlisted item" align="end">
          <button
            type="button"
            onClick={() => props.onRemove(index)}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Remove unlisted item"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
      {unit.isSerialTracked && unit.quantity > 0 && <SerialInputs {...props} />}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function CostInput({ unit, index, onChange }: RowProps): React.ReactElement {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <input
        aria-label="Unit cost"
        inputMode="decimal"
        placeholder="Unit cost"
        value={unit.unitCost ?? ''}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, '')
          onChange(index, { unitCost: raw === '' ? undefined : Number(raw) })
        }}
        className={`${INPUT} ${MONO} w-28 text-right`}
      />
      <span className={`${MONO} w-24 text-right text-xs text-zinc-500`}>
        {fmtPeso((unit.unitCost ?? 0) * unit.quantity)}
      </span>
    </span>
  )
}

function SerialInputs({ unit, index, onChange }: RowProps): React.ReactElement {
  const serials = unit.serialNumbers ?? []
  const set = (n: number, value: string): void => {
    const next = serials.slice()
    next[n] = value
    onChange(index, { serialNumbers: next })
  }
  return (
    <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
      {Array.from({ length: unit.quantity }, (_, n) => (
        <input
          key={n}
          aria-label={`Serial ${n + 1}`}
          placeholder={`Serial ${n + 1}`}
          value={serials[n] ?? ''}
          onChange={(e) => set(n, e.target.value)}
          className={`${INPUT} ${MONO}`}
        />
      ))}
    </div>
  )
}

/** The picked item, with serial entry switched on for a serial-tracked one. */
function pickPatch(option: Parameters<typeof toArrivedItem>[0]): Partial<ExtraUnit> {
  const item = toArrivedItem(option)
  return {
    itemId: item.id,
    label: item.label,
    sku: item.sku,
    isSerialTracked: item.isSerialTracked,
    serialNumbers: item.isSerialTracked ? [''] : undefined,
  }
}

/** A new quantity, with the serial boxes resized to match. */
function quantityPatch(unit: ExtraUnit, raw: string): Partial<ExtraUnit> {
  const quantity = Math.min(999, Number(raw.replace(/\D/g, '')) || 0)
  if (!unit.isSerialTracked) return { quantity }
  return { quantity, serialNumbers: (unit.serialNumbers ?? []).slice(0, quantity) }
}

/** What still stops this unit from posting — shown once the receiver tries. */
export function unitError(unit: ExtraUnit, show: boolean): string | null {
  if (!show) return null
  if (!unit.itemId) return 'Pick the item that arrived, or remove the row.'
  if (unit.quantity <= 0) return 'Enter how many arrived, or remove the row.'
  const filled = (unit.serialNumbers ?? []).filter((s) => s.trim() !== '').length
  if (unit.isSerialTracked && filled !== unit.quantity) {
    return `Enter a serial number for each unit (${filled} of ${unit.quantity}).`
  }
  return null
}
