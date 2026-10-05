'use client'

import { useEffect, useState } from 'react'
import {
  Controller,
  useFieldArray,
  useWatch,
  type ArrayPath,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormSetValue,
} from 'react-hook-form'
import { X } from 'lucide-react'
import { SerialNumberSearchCombobox } from '@/src/app/(app)/(dashboard)/pos/service-jobs/_components/SerialNumberSearchCombobox'
import {
  CreditApplicationItemSearchCombobox,
  type CreditApplicationItemMeta,
} from './CreditApplicationItemSearchCombobox'

function formatPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Generic over the host form's values so both the create form (items
// required, min 1) and the edit form (items optional, via .partial()) can
// share this block without a type mismatch on `control`/`errors` — items is
// declared optional here since the edit form's .partial() makes the array
// itself optional (though each present element still requires an itemId).
type ItemScopedFormValues = FieldValues & {
  items?: {
    itemId?: string
    estimatedPrice?: number
    itemLabel?: string
    serialNumberId?: string
    isSerialTracked?: boolean
    serialNumberLabel?: string
  }[]
}

export type InitialCreditApplicationItem = {
  itemId: string
  itemLabel: string
  itemMeta: CreditApplicationItemMeta
}

type RowProps<T extends ItemScopedFormValues> = {
  control: Control<T>
  setValue: UseFormSetValue<T>
  index: number
  errors: FieldErrors<T>
  onRemove: () => void
  canRemove: boolean
  initialItem?: InitialCreditApplicationItem
  unitBranchId?: string | null
}

type UnitFieldProps<T extends ItemScopedFormValues> = {
  control: Control<T>
  setValue: UseFormSetValue<T>
  index: number
  branchId: string
}

/** Scenario 64 item 29 — the unit for a serial item, picked here instead of
 * at the till. Optional, and never a hold: an application can wait days for
 * a decision, so the till re-checks that the unit is still in stock when the
 * application is sold, and asks for another when it is not. */
function CreditApplicationUnitField<T extends ItemScopedFormValues>({
  control,
  setValue,
  index,
  branchId,
}: UnitFieldProps<T>) {
  const serialNumberIdPath = `items.${index}.serialNumberId` as Path<T>
  const serialNumberLabelPath = `items.${index}.serialNumberLabel` as Path<T>
  const itemId = useWatch({ control, name: `items.${index}.itemId` as Path<T> }) as string
  const label = useWatch({ control, name: serialNumberLabelPath }) as string | undefined
  const serialNumberId = useWatch({ control, name: serialNumberIdPath }) as string | undefined

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        Unit (serial) <span className="font-normal text-zinc-400">— optional</span>
      </label>
      <Controller
        name={serialNumberIdPath}
        control={control}
        render={({ field }) => (
          <SerialNumberSearchCombobox
            // The picker reads its label once, on mount; a new item is a new
            // list of units, so it starts over.
            key={itemId}
            itemId={itemId}
            branchId={branchId}
            value={(field.value as string | undefined) ?? ''}
            onChange={(id) => {
              field.onChange((id || undefined) as never)
              if (!id) setValue(serialNumberLabelPath, undefined as never)
            }}
            onSelectSerial={(serial) => setValue(serialNumberLabelPath, serial as never)}
            // A draft written before the label was carried still has the id.
            initialLabel={label ?? (serialNumberId ? 'Unit picked at the till' : undefined)}
            placeholder="Search this branch's units in stock…"
            noUnitsMessage="None in stock at this branch — leave it blank and pick at the till"
          />
        )}
      />
      <p className="mt-1 text-xs text-zinc-500">
        Pick the unit now, or leave it blank and pick it at the till. Picking it does not hold it.
      </p>
    </div>
  )
}

function CreditApplicationItemRow<T extends ItemScopedFormValues>({
  control,
  setValue,
  index,
  errors,
  onRemove,
  canRemove,
  initialItem,
  unitBranchId,
}: RowProps<T>) {
  const itemIdPath = `items.${index}.itemId` as Path<T>
  const estimatedPricePath = `items.${index}.estimatedPrice` as Path<T>
  const serialNumberIdPath = `items.${index}.serialNumberId` as Path<T>
  const serialNumberLabelPath = `items.${index}.serialNumberLabel` as Path<T>
  const isSerialTrackedPath = `items.${index}.isSerialTracked` as Path<T>
  const itemId = useWatch({ control, name: itemIdPath }) as string | undefined
  const isSerialTracked = useWatch({ control, name: isSerialTrackedPath }) as boolean | undefined
  const serialNumberId = useWatch({ control, name: serialNumberIdPath }) as string | undefined

  const [itemMeta, setItemMeta] = useState<CreditApplicationItemMeta | null>(
    initialItem?.itemMeta ?? null
  )

  // Mirrors the resolved price into form state (not just this row's local
  // itemMeta) so the financing preview below can sum it via watch('items')
  // — index-safe across add/remove, unlike a separate index-keyed map would
  // be once useFieldArray shifts indices.
  const itemLabelPath = `items.${index}.itemLabel` as Path<T>
  // Lets a restored draft redisplay its picker: the id alone can't produce
  // a label, and this row's own itemMeta is empty after a remount.
  const restoredLabel = useWatch({ control, name: itemLabelPath }) as string | undefined

  function handleSelectItem(meta: CreditApplicationItemMeta, label: string) {
    setItemMeta(meta)
    // Kept in form state so a draft restored from storage can redisplay the
    // picker — meta/label live only in this row otherwise.
    setValue(itemLabelPath, label as never)
    // In form state, like the label, so a restored draft still offers units.
    setValue(isSerialTrackedPath, (meta.isSerialTracked === true) as never)
    // Number() because the API serializes Decimal as a string.
    setValue(
      estimatedPricePath,
      (meta.sellingPrice != null ? Number(meta.sellingPrice) : undefined) as never
    )
  }

  // Edit mode prefills itemMeta from the loaded application but reset()'s
  // own defaultValues (built before this row exists) can't reach into a
  // specific row's estimatedPrice — backfill it once here instead, so the
  // financing preview's total is correct without a fresh item search.
  useEffect(() => {
    if (initialItem?.itemMeta.sellingPrice != null) {
      setValue(estimatedPricePath, Number(initialItem.itemMeta.sellingPrice) as never)
    }
    // Only ever run once per row on mount — initialItem is a stable seed,
    // not something that should re-fire this on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const itemsErrors = errors.items as { itemId?: { message?: string } }[] | undefined
  const itemError = itemsErrors?.[index]?.itemId?.message

  return (
    <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <div className="flex items-start gap-2">
        {/* min-w-0: without it this flex item keeps its automatic minimum
            and refuses to shrink below the combobox's min-content, which for
            nowrap text is the FULL label. 57% of the catalog has labels over
            80 chars (longest 148), so the row would widen the whole form
            instead of letting the combobox's own truncate take effect. */}
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Item / Model <span className="text-red-500">*</span>
          </label>
          <Controller
            name={itemIdPath}
            control={control}
            render={({ field }) => (
              <CreditApplicationItemSearchCombobox
                value={(field.value as string | undefined) ?? ''}
                onChange={(id) => {
                  // A unit remembered from the till (Scenario 64 item 28)
                  // belongs to the item it was picked for. Once the row holds
                  // a different item — or none — it must not ride along: the
                  // server refuses a serial recorded against another item.
                  // It is dropped; a serial item's unit can be picked again
                  // below (item 29), or at the till.
                  if (id !== field.value) {
                    setValue(serialNumberIdPath, undefined as never)
                    setValue(serialNumberLabelPath, undefined as never)
                    // Until the new item's search result says otherwise.
                    setValue(isSerialTrackedPath, false as never)
                  }
                  field.onChange(id)
                }}
                onSelectItem={(meta, label) => handleSelectItem(meta, label)}
                error={itemError}
                initialLabel={initialItem?.itemLabel ?? restoredLabel}
              />
            )}
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-7 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {itemIdPath && itemMeta && (
        <div className="rounded-lg bg-white px-3 py-2 text-sm text-zinc-600">
          Estimated amount:{' '}
          <span className="font-semibold text-zinc-900">
            {/* Number() for the same Decimal-as-string reason: a string has
                toLocaleString but ignores the options, so this rendered
                "₱10744.67" with no thousands separator. */}
            {itemMeta.sellingPrice != null ? formatPeso(Number(itemMeta.sellingPrice)) : '—'}
          </span>
        </div>
      )}

      {/* A unit remembered from the till marks the item as a serial item even
          on a draft that predates the flag. */}
      {unitBranchId && itemId && (isSerialTracked || serialNumberId) && (
        <CreditApplicationUnitField
          control={control}
          setValue={setValue}
          index={index}
          branchId={unitBranchId}
        />
      )}
    </div>
  )
}

type Props<T extends ItemScopedFormValues> = {
  control: Control<T>
  setValue: UseFormSetValue<T>
  errors: FieldErrors<T>
  /** Pre-fills each row's item combobox/meta without a fresh search — edit
   * mode only, indexed to match the initial `items` array passed to reset(). */
  initialItems?: InitialCreditApplicationItem[]
  /** Scenario 64 item 29 — the branch whose in-stock units a serial item's
   * row offers: the session's branch on a new application, the application's
   * own on the edit form. Left unset, no unit is offered — a user with no
   * branch raising one cannot be told which branch's till will sell it. */
  unitBranchId?: string | null
}

// Shared by NewCreditApplicationForm and the "edit financing request"
// flow on the detail page — an application can cover a bundle of models
// (2026-08-15, second pass), so this renders one row per item with add/
// remove controls instead of a single item picker.
export function CreditApplicationItemFields<T extends ItemScopedFormValues>({
  control,
  setValue,
  errors,
  initialItems,
  unitBranchId,
}: Props<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items' as ArrayPath<T>,
  })

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-700">
        Items / Models <span className="text-red-500">*</span>
      </label>
      {fields.map((field, index) => (
        <CreditApplicationItemRow
          key={field.id}
          control={control}
          setValue={setValue}
          index={index}
          errors={errors}
          onRemove={() => remove(index)}
          canRemove={fields.length > 1}
          initialItem={initialItems?.[index]}
          unitBranchId={unitBranchId}
        />
      ))}
      <button
        type="button"
        onClick={() => append({ itemId: '' } as never)}
        className="text-sm font-medium text-prominent-purple-700 hover:underline"
      >
        + Add another item
      </button>
      {errors.items?.message && (
        <p className="text-xs text-red-600">{errors.items.message as string}</p>
      )}
    </div>
  )
}
