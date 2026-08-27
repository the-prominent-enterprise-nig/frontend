'use client'

import { useEffect } from 'react'
import { useFieldArray, useWatch, Controller } from 'react-hook-form'
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormGetValues,
  FieldErrors,
} from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import type { CreatePoFormValues } from '@/src/schema/inventory/purchase-orders'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'

type Props = {
  control: Control<CreatePoFormValues>
  register: UseFormRegister<CreatePoFormValues>
  errors: FieldErrors<CreatePoFormValues>
  setValue: UseFormSetValue<CreatePoFormValues>
  getValues: UseFormGetValues<CreatePoFormValues>
  open: boolean
  // Edit mode only — the already-selected item's display name per line
  // index, since the form itself only carries itemId. See CreatePoModal.tsx.
  initialItemLabels?: (string | undefined)[]
  initialSupplierLabel?: string
}

// The Supplier/Warehouse/Expected Delivery/Delivery Instructions/Notes/Line
// Items fields rendered by CreatePoModal — the single "+ New Purchase"
// modal used from both the Purchase Orders and Purchase Requests tabs.
// Creating always drafts a Purchase Request pending approval; a PO only
// exists once that's approved and converted. Keeping this as one component
// is what stops the two tabs' create flows drifting apart again.
export function PurchaseOrderFormFields({
  control,
  register,
  errors,
  setValue,
  getValues,
  open,
  initialItemLabels,
  initialSupplierLabel,
}: Props) {
  // Scenario 27 — a PO's destination is always one of the 2 real warehouses,
  // decided once here at creation and carried through unedited to receiving
  // (see ReceiveAgainstPoModal, which locks the field once this is set).
  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup', 'standalone'],
    queryFn: () => getWarehouses({ limit: 10, status: 'active', standaloneOnly: true }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const warehouses = warehousesQuery.data?.data?.data ?? []

  // Location is a native, uncontrolled <select> (register(), not Controller)
  // — on edit, reset() sets warehouseId in RHF's internal state as soon as
  // the modal opens, almost always before this async query resolves. Setting
  // a <select>'s DOM value to an id with no matching <option> yet doesn't
  // retroactively apply once the real option appears; RHF's own state is
  // still correct throughout, only the visible selection is stale. Re-apply
  // once the options actually exist to force the DOM back in sync.
  useEffect(() => {
    if (warehousesQuery.data) {
      setValue('warehouseId', getValues('warehouseId'))
    }
  }, [warehousesQuery.data, setValue, getValues])

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const lines = useWatch({ control, name: 'lines' })

  const subtotal = lines.reduce((sum, line) => {
    if (line.isFreebie) return sum
    const qty = Number(line.quantity) || 0
    const price = Number(line.unitPrice) || 0
    return sum + qty * price
  }, 0)

  const fmtAmount = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

  return (
    <>
      {/* Supplier */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Supplier <span className="text-red-500">*</span>
        </label>
        <Controller
          name="supplierId"
          control={control}
          render={({ field }) => (
            <SupplierSearchCombobox
              value={field.value}
              onChange={field.onChange}
              error={errors.supplierId?.message}
              initialLabel={initialSupplierLabel}
            />
          )}
        />
        {errors.supplierId && (
          <p className="mt-1 text-xs text-red-500">{errors.supplierId.message}</p>
        )}
      </div>

      {/* Location */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Location <span className="text-red-500">*</span>
        </label>
        <select
          {...register('warehouseId')}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
        >
          <option value="">Select location…</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.branch?.name ?? wh.name}
            </option>
          ))}
        </select>
        {errors.warehouseId && (
          <p className="mt-1 text-xs text-red-500">{errors.warehouseId.message}</p>
        )}
      </div>

      {/* Expected Delivery Date */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Expected Delivery Date
        </label>
        <input
          type="date"
          {...register('expectedDeliveryDate')}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
        />
      </div>

      {/* Delivery Instructions */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Delivery Instructions
        </label>
        <textarea
          rows={2}
          {...register('deliveryInstructions')}
          className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
        />
        {errors.deliveryInstructions && (
          <p className="mt-1 text-xs text-red-500">{errors.deliveryInstructions.message}</p>
        )}
      </div>

      {/* Line Items */}
      <div>
        <div className="mb-2">
          <label className="text-sm font-medium text-zinc-700">
            Line Items <span className="text-red-500">*</span>
          </label>
        </div>

        {errors.lines && !Array.isArray(errors.lines) && (
          <p className="mb-2 text-xs text-red-500">{errors.lines.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <PurchaseOrderLineCard
              key={field.id}
              control={control}
              register={register}
              setValue={setValue}
              errors={errors}
              index={index}
              line={lines[index]}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              fmtAmount={fmtAmount}
              initialItemLabel={initialItemLabels?.[index]}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            append({
              itemId: '',
              quantity: 1,
              unitPrice: 0,
              description: undefined,
              notes: undefined,
              srp: undefined,
              discounts: [{ name: undefined, type: 'percentage', value: 0 }],
              isFreebie: false,
            })
          }
          className="mt-3 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Line
        </button>
      </div>

      {/* Subtotal */}
      <div className="flex items-center justify-end rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <span className="text-sm font-medium text-zinc-700">Subtotal:&nbsp;</span>
        <span className="text-base font-semibold text-zinc-900">{fmtAmount(subtotal)}</span>
      </div>
    </>
  )
}

type LineCardProps = {
  control: Control<CreatePoFormValues>
  register: UseFormRegister<CreatePoFormValues>
  setValue: UseFormSetValue<CreatePoFormValues>
  errors: FieldErrors<CreatePoFormValues>
  index: number
  line: CreatePoFormValues['lines'][number] | undefined
  canRemove: boolean
  onRemove: () => void
  fmtAmount: (n: number) => string
  initialItemLabel?: string
}

// One line's whole card — Item/Quantity/SRP/discount chain/Unit Price/
// Description. Its own component (not inlined in the parent's .map()) so
// the discount chain's own useFieldArray can be called per line, which the
// Rules of Hooks don't allow inside a loop within a single component.
function PurchaseOrderLineCard({
  control,
  register,
  setValue,
  errors,
  index,
  line,
  canRemove,
  onRemove,
  fmtAmount,
  initialItemLabel,
}: LineCardProps) {
  const {
    fields: discountFields,
    append: appendDiscount,
    remove: removeDiscount,
  } = useFieldArray({
    control,
    name: `lines.${index}.discounts` as `lines.${number}.discounts`,
  })

  // Unit Price defaults to srp with every discount step applied
  // sequentially (each step's output feeds the next — 30% then 20% off,
  // not 30+20=50% off in one step), but stays a normal editable input —
  // reacting to srp/discounts via useWatch (not a setValue() call chained
  // off this field's own onChange) so typing in SRP/a discount value never
  // fires a cross-field form update synchronously inside its own change
  // event — that re-entrant update was what caused the input to drop focus
  // after every keystroke.
  const srp = useWatch({ control, name: `lines.${index}.srp` })
  const discounts = useWatch({ control, name: `lines.${index}.discounts` })

  useEffect(() => {
    const srpNum = Number(srp)
    if (!srp || !discounts || discounts.length === 0) return
    const computed = discounts.reduce((price, d) => {
      const val = Number(d?.value)
      if (!d?.type || d.value == null || isNaN(val)) return price
      return d.type === 'percentage' ? price * (1 - val / 100) : price - val
    }, srpNum)
    setValue(`lines.${index}.unitPrice`, Math.max(0, Number(computed.toFixed(2))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srp, discounts, index])

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        {/* Freebie (Scenario 10 Part 8) */}
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={Boolean(line?.isFreebie)}
            onChange={(e) => {
              setValue(`lines.${index}.isFreebie`, e.target.checked)
              if (e.target.checked) setValue(`lines.${index}.unitPrice`, 0)
            }}
          />
          Freebie (supplier-given free unit — no cost)
        </label>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">
          Item <span className="text-red-500">*</span>
        </label>
        <Controller
          name={`lines.${index}.itemId`}
          control={control}
          render={({ field: f }) => (
            <ItemSearchCombobox
              value={f.value}
              onChange={f.onChange}
              error={errors.lines?.[index]?.itemId?.message}
              initialLabel={initialItemLabel}
            />
          )}
        />
        {errors.lines?.[index]?.itemId && (
          <p className="mt-1 text-xs text-red-500">{errors.lines[index]?.itemId?.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            step={1}
            placeholder="0"
            {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
          />
          {errors.lines?.[index]?.quantity && (
            <p className="mt-1 text-xs text-red-500">{errors.lines[index]?.quantity?.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Supplier SRP</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            {...register(`lines.${index}.srp`, {
              setValueAs: (v) => (v === '' ? undefined : Number(v)),
            })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>
      </div>

      {/* Supplier discount chain (Scenario 10 Part 6, revised) — Unit
          Price comes last since it's computed from these, applied in
          order (each step's output feeds the next). */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-600">Discounts (off SRP)</label>
        {discountFields.map((discountField, discountIndex) => {
          return (
            <div key={discountField.id} className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Discount name"
                  maxLength={100}
                  {...register(`lines.${index}.discounts.${discountIndex}.name`)}
                  className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
                <select
                  {...register(`lines.${index}.discounts.${discountIndex}.type`)}
                  className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                >
                  <option value="percentage">Percentage</option>
                  <option value="amount">Flat amount</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={
                    line?.discounts?.[discountIndex]?.type === 'amount' ? 'Amount' : 'Percent'
                  }
                  {...register(`lines.${index}.discounts.${discountIndex}.value`, {
                    valueAsNumber: true,
                  })}
                  className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
                />
              </div>
              <button
                type="button"
                onClick={() => removeDiscount(discountIndex)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
                aria-label="Remove discount"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => appendDiscount({ name: undefined, type: 'percentage', value: 0 })}
          className="flex items-center gap-1 text-xs font-medium text-prominent-purple-700 hover:underline"
        >
          <Plus className="h-3 w-3" />
          Add another discount
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">
          Unit Price <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={0}
          step={0.01}
          placeholder="0.00"
          disabled={line?.isFreebie}
          {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500 disabled:bg-zinc-100 disabled:text-zinc-400"
        />
        {errors.lines?.[index]?.unitPrice && (
          <p className="mt-1 text-xs text-red-500">{errors.lines[index]?.unitPrice?.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Description</label>
        <input
          type="text"
          placeholder="Optional line description"
          {...register(`lines.${index}.description`)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-purple-500 focus:outline-none focus:ring-1 focus:ring-prominent-purple-500"
        />
      </div>

      {/* Running line total */}
      <div className="text-right text-xs text-zinc-500">
        Line total:{' '}
        <span className="font-medium text-zinc-800">
          {fmtAmount((Number(line?.quantity) || 0) * (Number(line?.unitPrice) || 0))}
        </span>
      </div>
    </div>
  )
}
