'use client'

import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import {
  ItemSearchCombobox,
  type ItemSearchMeta,
} from '../../purchase-requests/_components/ItemSearchCombobox'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import {
  isRepairPurpose,
  type DrFormValues,
  type DrLineFormValues,
} from '@/src/schema/inventory/delivery-receipts'
import { Field, FieldError, INPUT, Section, TEXTAREA } from './drFormUi'

export const EMPTY_LINE: DrLineFormValues = {
  itemId: '',
  itemLabel: '',
  isSerialTracked: false,
  serials: [],
  quantity: 1,
  modelNumber: '',
  brandName: '',
  unitCost: null,
  costTyped: false,
}

const GRID =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1.4fr)_minmax(90px,.8fr)_minmax(150px,1fr)_88px_110px_32px] md:items-start'

export function DrItemsSection(): React.JSX.Element {
  const { control, formState } = useFormContext<DrFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const warehouseId = useWatch({ control, name: 'warehouseId' })
  const purpose = useWatch({ control, name: 'purpose' })
  const linesError = formState.errors.lines?.root?.message ?? formState.errors.lines?.message
  if (isRepairPurpose(purpose)) return <DrRepairItems />
  return (
    <Section
      title="Items"
      description="Serial no. is required for serialized units such as TVs and aircons."
    >
      {fields.length > 0 && (
        <div
          className={`${GRID} hidden text-[11px] font-medium uppercase tracking-[.06em] text-[#8b8b9b] md:grid`}
        >
          <span>Model</span>
          <span>Brand</span>
          <span>Serial no.</span>
          <span>Qty</span>
          <span className="text-right">Unit cost</span>
          <span />
        </div>
      )}
      {fields.map((field, index) => (
        <DrLineRow
          key={field.id}
          index={index}
          warehouseId={warehouseId}
          onRemove={() => remove(index)}
        />
      ))}
      {linesError && <FieldError text={linesError} />}
      <div>
        <button
          type="button"
          disabled={!warehouseId}
          onClick={() => append({ ...EMPTY_LINE })}
          className="rounded-lg bg-[#f1ebfb] px-4 py-2 text-[13px] font-medium text-[#3f1490] hover:bg-[#e6dcf8] disabled:opacity-50"
        >
          Add item
        </button>
        {!warehouseId && (
          <span className="ml-3 text-[11.5px] text-[#8b8b9b]">Pick the issuing branch first.</span>
        )}
      </div>
      <Field label="Remarks">
        <Controller
          control={control}
          name="remarks"
          render={({ field }) => (
            <textarea
              {...field}
              className={TEXTAREA}
              placeholder="Anything the approver or warehouse should know…"
            />
          )}
        />
      </Field>
    </Section>
  )
}

/** A repair DR moves the ticket's units, as they are — nothing to pick. */
function DrRepairItems(): React.JSX.Element {
  const { control } = useFormContext<DrFormValues>()
  const lines = useWatch({ control, name: 'lines' })
  return (
    <Section
      title="Items"
      description="The units on the repair ticket. They cannot be changed here."
    >
      {lines.length === 0 ? (
        <p className="text-[12.5px] text-[#8b8b9b]">Pick the repair ticket to see its units.</p>
      ) : (
        <div className="divide-y divide-[#eeeef1] rounded-lg border border-[#eeeef1]">
          {lines.map((l) => (
            <div
              key={l.serials[0]?.id || l.itemId}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
            >
              <span className="font-medium text-[#1f1f2b]">
                {l.itemLabel}
                {l.brandName && <span className="ml-2 text-[#8b8b9b]">{l.brandName}</span>}
              </span>
              <span className="font-mono text-[12px] text-[#5b5b6b]">
                {l.serials.map((s) => s.label).join(', ') || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
      <Field label="Remarks">
        <Controller
          control={control}
          name="remarks"
          render={({ field }) => (
            <textarea
              {...field}
              className={TEXTAREA}
              placeholder="Anything the approver should know…"
            />
          )}
        />
      </Field>
    </Section>
  )
}

function DrLineRow({
  index,
  warehouseId,
  onRemove,
}: {
  index: number
  warehouseId: string
  onRemove: () => void
}): React.JSX.Element {
  const { control, setValue, formState } = useFormContext<DrFormValues>()
  const line = useWatch({ control, name: `lines.${index}` })
  const errors = formState.errors.lines?.[index]

  function pickItem(id: string, label: string, meta: ItemSearchMeta | undefined): void {
    setValue(
      `lines.${index}`,
      {
        itemId: id,
        itemLabel: label,
        isSerialTracked: meta?.isSerialTracked ?? false,
        serials: [],
        quantity: 1,
        modelNumber: meta?.modelNumber ?? '',
        brandName: meta?.brandName ?? '',
        unitCost: meta?.costPrice ?? null,
        costTyped: false,
      },
      { shouldDirty: true, shouldValidate: formState.isSubmitted }
    )
  }

  return (
    <div className={`${GRID} rounded-lg border border-[#eeeef1] p-2 md:border-0 md:p-0`}>
      <div className="flex flex-col gap-1">
        <ItemSearchCombobox
          value={line.itemId}
          initialLabel={line.itemLabel}
          stockWarehouseId={warehouseId}
          error={errors?.itemId?.message}
          placeholder="Search item…"
          // The id lands at once; brand, serials and cost follow in onSelect,
          // which can wait on a fetch of the item (ItemSearchCombobox).
          onChange={(id) => setValue(`lines.${index}.itemId`, id, { shouldDirty: true })}
          onSelect={(o) => pickItem(o.id, o.primary, o.meta as ItemSearchMeta | undefined)}
        />
        {line.modelNumber && <span className="text-[11px] text-[#8b8b9b]">{line.modelNumber}</span>}
      </div>
      <div className={`${INPUT} flex items-center text-[#5b5b6b]`}>{line.brandName || '—'}</div>
      <SerialCell index={index} warehouseId={warehouseId} />
      <div className="flex flex-col gap-1">
        <Controller
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field }) => (
            <input
              type="number"
              min={1}
              // Whole units for a serialized item.
              step={line.isSerialTracked ? 1 : 'any'}
              // Empty while retyping, so the box never shows a 0 that can't be
              // deleted; save's "more than 0" check catches one left empty.
              value={field.value || ''}
              onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
              // Lowered below the serials picked: keep the first ones, drop
              // the rest. On blur, not per keystroke — typing "10" passes "1".
              onBlur={() => {
                field.onBlur()
                if (line.isSerialTracked && field.value > 0 && line.serials.length > field.value) {
                  setValue(`lines.${index}.serials`, line.serials.slice(0, field.value), {
                    shouldDirty: true,
                  })
                }
              }}
              className={INPUT}
              aria-label="Quantity"
            />
          )}
        />
        {errors?.quantity?.message && <FieldError text={errors.quantity.message} />}
      </div>
      <UnitCostCell index={index} />
      <Tooltip label="Remove item">
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove item"
          className="flex h-[38px] w-8 items-center justify-center rounded-lg border border-[#e4e4e9] text-[#5b5b6b] hover:border-[#d3d3db] hover:text-[#b42318]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  )
}

/** Starts at the system estimate; whatever is typed here is the cost the
 * line leaves at, in the stock ledger, the debit memo and the journal entry. */
function UnitCostCell({ index }: { index: number }): React.JSX.Element {
  const { control, setValue, formState } = useFormContext<DrFormValues>()
  const error = formState.errors.lines?.[index]?.unitCost?.message
  return (
    <div className="flex flex-col gap-1">
      <Controller
        control={control}
        name={`lines.${index}.unitCost`}
        render={({ field }) => (
          <input
            type="number"
            min={0}
            step="0.01"
            value={field.value ?? ''}
            onChange={(e) => {
              field.onChange(e.target.value === '' ? null : Number(e.target.value))
              setValue(`lines.${index}.costTyped`, e.target.value !== '', { shouldDirty: true })
            }}
            className={`${INPUT} text-right tabular-nums`}
            aria-label="Unit cost"
          />
        )}
      />
      {error && <FieldError text={error} />}
    </div>
  )
}

/** The units themselves, from what is on the issuing warehouse's shelf,
 * minus the units already picked on this DR's other lines. Several at once,
 * as many as the line's quantity. */
function SerialCell({
  index,
  warehouseId,
}: {
  index: number
  warehouseId: string
}): React.JSX.Element {
  const { control, setValue, formState } = useFormContext<DrFormValues>()
  const lines = useWatch({ control, name: 'lines' })
  const line = lines[index]
  const serials = useQuery({
    queryKey: ['dr-serials-in-stock', warehouseId, line.itemId],
    queryFn: () =>
      getSerialNumbers({ warehouseId, itemId: line.itemId, status: 'in_stock', limit: 500 }),
    enabled: line.isSerialTracked && !!warehouseId && !!line.itemId,
    staleTime: 30_000,
  })
  if (!line.isSerialTracked) {
    return <div className={`${INPUT} flex items-center text-[#a3a3b2]`}>Not serialized</div>
  }
  const pickedElsewhere = new Set(
    lines.flatMap((l, i) => (i === index ? [] : l.serials.map((s) => s.id)))
  )
  const onShelf = (serials.data?.data?.data ?? [])
    .filter((s) => !pickedElsewhere.has(s.id))
    .map((s) => ({ value: s.id, label: s.serialNumber }))
  // A picked unit stays listed even if the shelf query no longer returns it.
  const shelfIds = new Set(onShelf.map((o) => o.value))
  const options = [
    ...line.serials
      .filter((s) => !shelfIds.has(s.id))
      .map((s) => ({ value: s.id, label: s.label })),
    ...onShelf,
  ]
  const labelOf = new Map(options.map((o) => [o.value, o.label]))
  const error = formState.errors.lines?.[index]?.serials?.message
  return (
    <div className="flex flex-col gap-1">
      <SearchableSelect
        multiple
        value={line.serials.map((s) => s.id)}
        onChange={(ids) => {
          const picked = ids.map((id) => ({ id, label: labelOf.get(id) ?? id }))
          setValue(`lines.${index}.serials`, picked, {
            shouldDirty: true,
            shouldValidate: formState.isSubmitted,
          })
          // Picking past the quantity raises it; never lowers it.
          if (picked.length > line.quantity) setValue(`lines.${index}.quantity`, picked.length)
        }}
        options={options}
        loading={serials.isLoading}
        loadingLabel="Loading units…"
        placeholder="Pick serials…"
        summaryNoun={`of ${line.quantity} serials`}
        ariaLabel="Serial numbers"
        portal
        pickOnScan
      />
      {error && <FieldError text={error} />}
    </div>
  )
}
