'use client'

import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import {
  ItemSearchCombobox,
  type ItemSearchMeta,
} from '../../purchase-requests/_components/ItemSearchCombobox'
import { SerialSearchCombobox } from '../../transfers/_components/SerialSearchCombobox'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import type { DrFormValues, DrLineFormValues } from '@/src/schema/inventory/delivery-receipts'
import { fmtPeso } from '../_lib/dr-format'
import { Field, FieldError, INPUT, Section, TEXTAREA } from './drFormUi'

export const EMPTY_LINE: DrLineFormValues = {
  itemId: '',
  itemLabel: '',
  isSerialTracked: false,
  serialNumberId: '',
  serialLabel: '',
  quantity: 1,
  modelNumber: '',
  brandName: '',
  unitCost: null,
}

const GRID =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1.4fr)_minmax(90px,.8fr)_minmax(150px,1fr)_88px_110px_32px] md:items-start'

export function DrItemsSection(): React.JSX.Element {
  const { control, formState } = useFormContext<DrFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const warehouseId = useWatch({ control, name: 'warehouseId' })
  const linesError = formState.errors.lines?.root?.message ?? formState.errors.lines?.message
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
        serialNumberId: '',
        serialLabel: '',
        quantity: 1,
        modelNumber: meta?.modelNumber ?? '',
        brandName: meta?.brandName ?? '',
        unitCost: meta?.costPrice ?? null,
      },
      { shouldDirty: true, shouldValidate: formState.isSubmitted }
    )
  }

  return (
    <div className={`${GRID} rounded-lg border border-[#eeeef1] p-2 md:border-0 md:p-0`}>
      <div className="flex flex-col gap-1">
        <ItemSearchCombobox
          compact
          value={line.itemId}
          initialLabel={line.itemLabel}
          stockWarehouseId={warehouseId}
          error={errors?.itemId?.message}
          placeholder="Search item…"
          onChange={() => undefined}
          onSelect={(o) => pickItem(o.id, o.primary, o.meta as ItemSearchMeta | undefined)}
        />
        {line.modelNumber && <span className="text-[11px] text-[#8b8b9b]">{line.modelNumber}</span>}
      </div>
      <div className={`${INPUT} flex items-center text-[#5b5b6b]`}>{line.brandName || '—'}</div>
      <SerialCell index={index} warehouseId={warehouseId} />
      {line.isSerialTracked ? (
        <div className={`${INPUT} flex items-center text-[#8b8b9b]`}>1</div>
      ) : (
        <Controller
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field }) => (
            <input
              type="number"
              min={1}
              step="any"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className={INPUT}
              aria-label="Quantity"
            />
          )}
        />
      )}
      <Tooltip label="System cost — stamped when the stock actually leaves">
        <div className={`${INPUT} flex items-center justify-end tabular-nums text-[#5b5b6b]`}>
          {line.unitCost != null ? fmtPeso(line.unitCost) : '—'}
        </div>
      </Tooltip>
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

/** The unit itself, from what is on the issuing warehouse's shelf, minus the
 * units already picked on this DR's other lines. */
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
  const pickedElsewhere = lines.filter((_, i) => i !== index).map((l) => l.serialNumberId)
  const options = (serials.data?.data?.data ?? []).filter((s) => !pickedElsewhere.includes(s.id))
  return (
    <SerialSearchCombobox
      value={line.serialNumberId}
      initialLabel={line.serialLabel}
      options={options}
      queryKey={`dr-serial-${index}-${line.itemId}-${options.length}`}
      error={formState.errors.lines?.[index]?.serialNumberId?.message}
      placeholder={serials.isLoading ? 'Loading units…' : 'Pick serial…'}
      onChange={(id) => setValue(`lines.${index}.serialNumberId`, id, { shouldDirty: true })}
      onSelect={(o) => setValue(`lines.${index}.serialLabel`, o.primary)}
    />
  )
}
