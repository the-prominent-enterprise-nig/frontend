'use client'

import { Fragment } from 'react'
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
} from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { CONTROL_CHROME } from '@/src/libs/design/plex'
import {
  EMPTY_BRANCH_ROW,
  parseSerialList,
  type AddUnitsFormValues,
  type BranchRow,
} from '@/src/schema/inventory/items/add-units'
import {
  UNIT_CLASSIFICATION_LABELS,
  UnitClassificationSchema,
} from '@/src/schema/inventory/reports'
import { NumericInput } from './item-form-shared'
import { errorClass, inputClass } from './itemFormChrome'
import { useCountingUnits, type CountingUnit } from './useCountingUnits'

type Warehouse = { id: string; name: string; branch?: { name: string } | null }
type Option = { value: string; label: string }
type FormControl = Control<AddUnitsFormValues>
type FormErrors = FieldErrors<AddUnitsFormValues>

type Props = {
  control: FormControl
  errors: FormErrors
  warehouses: Warehouse[]
  /** The item's base unit, e.g. KG — what a non-serial quantity is put on hand in. */
  baseUnit: { id: string; code: string } | null
  /** Suppliers + WHSE. */
  originOptions: Option[]
  /** A serial item lists each branch's units by serial; a non-serial one
   * (rice) gives a quantity. */
  isSerialTracked: boolean
}

const HEAD = 'px-3 py-2.5 text-left text-[12px] font-medium text-ink-muted whitespace-nowrap'
const CELL = 'px-3 py-2.5'
const REQUIRED = <span className="text-[#b42318]">*</span>
const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const CLASSIFICATION_OPTIONS: Option[] = UnitClassificationSchema.options.map((c) => ({
  value: c,
  label: UNIT_CLASSIFICATION_LABELS[c],
}))

/** An item's stock per branch — one row each, each its own receipt with its
 * own date in, origin, cost and RR #. A serial item lists the branch's units
 * by serial (and their Classification); a non-serial one (rice) gives a
 * quantity. A new row starts from the one above, so a batch that came in
 * together is typed once. */
export default function BranchQuantitiesTable({
  control,
  errors,
  warehouses,
  baseUnit,
  originOptions,
  isSerialTracked,
}: Props): React.JSX.Element {
  const { fields, append, remove } = useFieldArray({ control, name: 'branches' })
  const units = useCountingUnits(isSerialTracked ? undefined : baseUnit?.id)
  const unitCode = baseUnit?.code ?? null
  const rows = useWatch({ control, name: 'branches' }) ?? []
  const rootError = errors.branches?.root?.message ?? errors.branches?.message
  const ctx: RowContext = { control, errors, originOptions, units, unitCode, isSerialTracked }

  return (
    <div className="sm:col-span-2">
      <div className="overflow-x-auto rounded-lg border border-[#e4e4e9]">
        <table className="w-full min-w-[980px] table-fixed border-collapse">
          <TableHead isSerialTracked={isSerialTracked} unitCode={unitCode} />
          <tbody>
            {fields.map((field, index) => (
              <BranchRowView
                key={field.id}
                index={index}
                ctx={ctx}
                branchOptions={branchOptions(warehouses, rows, index)}
                canRemove={fields.length > 1}
                onRemove={() => remove(index)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {rootError && <p className={errorClass}>{rootError}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => append(nextRow(rows))}
          disabled={fields.length >= warehouses.length}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#c4b5fd] px-3 py-1.5 text-[13px] font-medium text-[#5b21b6] hover:bg-[#f5f3ff] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add branch
        </button>
        <Totals rows={rows} ctx={ctx} />
      </div>
    </div>
  )
}

type RowContext = {
  control: FormControl
  errors: FormErrors
  originOptions: Option[]
  units: CountingUnit[]
  unitCode: string | null
  isSerialTracked: boolean
}

function TableHead({
  isSerialTracked,
  unitCode,
}: {
  isSerialTracked: boolean
  unitCode: string | null
}): React.JSX.Element {
  return (
    <>
      <colgroup>
        <col className="w-[22%]" />
        <col className="w-[14%]" />
        <col className="w-[19%]" />
        <col className={isSerialTracked ? 'w-[15%]' : 'w-[22%]'} />
        <col className={isSerialTracked ? 'w-[13%]' : 'w-[11%]'} />
        <col className="w-[12%]" />
        <col className="w-11" />
      </colgroup>
      <thead className="bg-[#fbfbfc]">
        <tr>
          <th className={HEAD}>Branch {REQUIRED}</th>
          <th className={HEAD}>Date In</th>
          <th className={HEAD}>Origin</th>
          {isSerialTracked ? (
            <th className={HEAD}>Classification</th>
          ) : (
            <th className={HEAD}>Quantity {REQUIRED}</th>
          )}
          <th className={HEAD}>
            {isSerialTracked ? 'Unit Cost' : `Cost${unitCode ? ` / ${unitCode}` : ''}`}
          </th>
          <th className={HEAD}>RR #</th>
          <th aria-label="Remove" />
        </tr>
      </thead>
    </>
  )
}

function BranchRowView({
  index,
  ctx,
  branchOptions,
  canRemove,
  onRemove,
}: {
  index: number
  ctx: RowContext
  branchOptions: Option[]
  canRemove: boolean
  onRemove: () => void
}): React.JSX.Element {
  const { control, errors, isSerialTracked } = ctx
  const rowErrors = errors.branches?.[index]
  // A serial row's units sit on a line of their own under it, so the main
  // line drops its bottom border and the serials line closes the row.
  const border = isSerialTracked ? '' : 'border-b border-[#e4e4e9]'
  return (
    <Fragment>
      <tr className={`${border} align-top`}>
        <td className={CELL}>
          <SelectCell
            control={control}
            name={`branches.${index}.warehouseId`}
            options={branchOptions}
            placeholder="Select branch…"
          />
          {rowErrors?.warehouseId && <p className={errorClass}>{rowErrors.warehouseId.message}</p>}
        </td>
        <td className={CELL}>
          <Controller
            name={`branches.${index}.dateIn`}
            control={control}
            render={({ field }) => (
              <input {...field} value={field.value ?? ''} type="date" className={inputClass} />
            )}
          />
          <p className="mt-1 text-[11px] text-ink-faint">Blank = today</p>
        </td>
        <td className={CELL}>
          <SelectCell
            control={control}
            name={`branches.${index}.origin`}
            options={ctx.originOptions}
            placeholder="WHSE"
          />
        </td>
        <td className={CELL}>
          {isSerialTracked ? (
            <SelectCell
              control={control}
              name={`branches.${index}.classification`}
              options={CLASSIFICATION_OPTIONS}
              placeholder="Brand New"
            />
          ) : (
            <>
              <QuantityCell index={index} ctx={ctx} />
              {rowErrors?.quantity && <p className={errorClass}>{rowErrors.quantity.message}</p>}
            </>
          )}
        </td>
        <td className={CELL}>
          <NumberCell control={control} name={`branches.${index}.price`} placeholder="0.00" />
        </td>
        <td className={CELL}>
          <Controller
            name={`branches.${index}.rr`}
            control={control}
            render={({ field }) => <input {...field} placeholder="Auto" className={inputClass} />}
          />
          {rowErrors?.rr && <p className={errorClass}>{rowErrors.rr.message}</p>}
        </td>
        <td className="py-2.5 pr-2">
          <RemoveRowButton disabled={!canRemove} onClick={onRemove} />
        </td>
      </tr>
      {isSerialTracked && (
        <SerialsLine index={index} control={control} error={rowErrors?.serialsText?.message} />
      )}
    </Fragment>
  )
}

/** A serial row's units — one serial per line, or comma-separated. */
function SerialsLine({
  index,
  control,
  error,
}: {
  index: number
  control: FormControl
  error?: string
}): React.JSX.Element {
  const text = useWatch({ control, name: `branches.${index}.serialsText` })
  const count = parseSerialList(text ?? '').length
  return (
    <tr className="border-b border-[#e4e4e9]">
      <td colSpan={7} className="px-3 pb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12px] font-medium text-ink-muted">Serial Numbers {REQUIRED}</span>
          <span className="text-[12px] text-ink-subtle">
            {count} unit{count === 1 ? '' : 's'}
          </span>
        </div>
        <Controller
          name={`branches.${index}.serialsText`}
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              rows={3}
              placeholder="One per line, or comma-separated — e.g. 3ECT-0001, 3ECT-0002"
              className={`${inputClass} font-mono`}
            />
          )}
        />
        {error && <p className={errorClass}>{error}</p>}
      </td>
    </tr>
  )
}

type SelectField = `branches.${number}.${'warehouseId' | 'origin' | 'unitId' | 'classification'}`

function SelectCell({
  control,
  name,
  options,
  placeholder,
}: {
  control: FormControl
  name: SelectField
  options: Option[]
  placeholder: string
}): React.JSX.Element {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <SearchableSelect
          chrome={CONTROL_CHROME}
          portal
          value={field.value ?? ''}
          onChange={(v) => field.onChange(v)}
          options={options}
          placeholder={placeholder}
        />
      )}
    />
  )
}

function NumberCell({
  control,
  name,
  placeholder,
}: {
  control: FormControl
  name: `branches.${number}.${'price' | 'quantity'}`
  placeholder: string
}): React.JSX.Element {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <NumericInput
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          fieldRef={field.ref}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    />
  )
}

/** The count, and — when the UOM master has units built on the item's own
 * (SACK = 5 KG) — what it was counted in, with the KG it comes to. */
function QuantityCell({ index, ctx }: { index: number; ctx: RowContext }): React.JSX.Element {
  const { control, units, unitCode } = ctx
  const row = useWatch({ control, name: `branches.${index}` })
  const unit = units.find((u) => u.id === row?.unitId)
  const unitOptions: Option[] = [
    { value: '', label: unitCode ?? 'Base unit' },
    ...units.map((u) => ({
      value: u.id,
      label: `${u.code} (${u.factor} ${unitCode ?? ''})`.trim(),
    })),
  ]
  return (
    <>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <NumberCell control={control} name={`branches.${index}.quantity`} placeholder="0" />
        </div>
        {units.length > 0 ? (
          <div className="w-28 shrink-0">
            <SelectCell
              control={control}
              name={`branches.${index}.unitId`}
              options={unitOptions}
              placeholder={unitCode ?? 'Unit'}
            />
          </div>
        ) : (
          unitCode && <span className="self-center text-[13px] text-ink-muted">{unitCode}</span>
        )}
      </div>
      {unit && row?.quantity ? (
        <p className="mt-1 text-[11px] text-ink-subtle">
          = {inBaseUnit(row, units)} {unitCode}
        </p>
      ) : null}
    </>
  )
}

function RemoveRowButton({
  disabled,
  onClick,
}: {
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Tooltip label={disabled ? 'At least one branch is needed' : 'Remove branch'} align="end">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Remove branch"
        className="mt-1 rounded p-1.5 text-ink-subtle hover:bg-red-50 hover:text-[#b42318] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Tooltip>
  )
}

/** "3 branches · 12 units · ₱456,000.00" (serial) or "6 branches · 980 KG ·
 * ₱50,960.00" (non-serial) — the cost only once one is typed. */
function Totals({ rows, ctx }: { rows: BranchRow[]; ctx: RowContext }): React.JSX.Element {
  const { units, unitCode, isSerialTracked } = ctx
  const qtyOf = (r: BranchRow): number =>
    isSerialTracked ? parseSerialList(r.serialsText).length : inBaseUnit(r, units)
  const qty = round4(rows.reduce((sum, r) => sum + qtyOf(r), 0))
  const cost = rows.reduce((sum, r) => sum + qtyOf(r) * (r.price ?? 0), 0)
  const n = rows.length
  const qtyLabel = isSerialTracked
    ? `${qty} unit${qty === 1 ? '' : 's'}`
    : `${qty}${unitCode ? ` ${unitCode}` : ''}`
  return (
    <p className="text-[13px] text-ink-muted">
      {n} branch{n === 1 ? '' : 'es'} ·{' '}
      <span className="font-semibold text-[#17171c]">{qtyLabel}</span>
      {cost > 0 && <> · {PESO.format(cost)}</>}
    </p>
  )
}

/** A new row starts from the last one — same date in, origin, cost,
 * classification and unit — since opening stock is usually one batch.
 * Serials and quantity are the branch's own, so they start empty. */
function nextRow(rows: BranchRow[]): BranchRow {
  const last = rows[rows.length - 1]
  if (!last) return { ...EMPTY_BRANCH_ROW }
  return {
    ...EMPTY_BRANCH_ROW,
    dateIn: last.dateIn,
    origin: last.origin,
    price: last.price,
    classification: last.classification,
    unitId: last.unitId,
  }
}

/** A branch already picked on another row isn't offered again. */
function branchOptions(warehouses: Warehouse[], rows: BranchRow[], index: number): Option[] {
  const takenElsewhere = new Set(
    rows
      .filter((_, i) => i !== index)
      .map((r) => r.warehouseId)
      .filter(Boolean)
  )
  return warehouses
    .filter((w) => !takenElsewhere.has(w.id))
    .map((w) => ({ value: w.id, label: w.branch?.name ?? w.name }))
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/** 13 SACK at 5 KG → 65; kept to 4 decimals like the backend. */
function inBaseUnit(row: BranchRow, units: CountingUnit[]): number {
  const factor = units.find((u) => u.id === row.unitId)?.factor ?? 1
  return round4((row.quantity ?? 0) * factor)
}
