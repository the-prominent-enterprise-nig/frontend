'use client'

import { useEffect, useState } from 'react'
import {
  Controller,
  useFieldArray,
  type ArrayPath,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormSetValue,
} from 'react-hook-form'
import { X } from 'lucide-react'
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
  items?: { itemId?: string; estimatedPrice?: number }[]
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
}

function CreditApplicationItemRow<T extends ItemScopedFormValues>({
  control,
  setValue,
  index,
  errors,
  onRemove,
  canRemove,
  initialItem,
}: RowProps<T>) {
  const itemIdPath = `items.${index}.itemId` as Path<T>
  const estimatedPricePath = `items.${index}.estimatedPrice` as Path<T>

  const [itemMeta, setItemMeta] = useState<CreditApplicationItemMeta | null>(
    initialItem?.itemMeta ?? null
  )

  // Mirrors the resolved price into form state (not just this row's local
  // itemMeta) so the financing preview below can sum it via watch('items')
  // — index-safe across add/remove, unlike a separate index-keyed map would
  // be once useFieldArray shifts indices.
  function handleSelectItem(meta: CreditApplicationItemMeta) {
    setItemMeta(meta)
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
                onChange={field.onChange}
                onSelectItem={handleSelectItem}
                error={itemError}
                initialLabel={initialItem?.itemLabel}
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
