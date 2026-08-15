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
  type PathValue,
  type UseFormSetValue,
} from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import {
  CreditApplicationItemSearchCombobox,
  type CreditApplicationItemMeta,
} from './CreditApplicationItemSearchCombobox'
import { getVariants } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-variants'

function formatPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

// Generic over the host form's values so both the create form (items
// required, min 1) and the edit form (items optional, via .partial()) can
// share this block without a type mismatch on `control`/`errors` — items is
// declared optional here since the edit form's .partial() makes the array
// itself optional (though each present element still requires an itemId).
type ItemScopedFormValues = FieldValues & {
  items?: { itemId?: string; variantId?: string }[]
}

export type InitialCreditApplicationItem = {
  itemId: string
  variantId?: string | null
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
  const variantIdPath = `items.${index}.variantId` as Path<T>
  const itemId = useWatch({ control, name: itemIdPath }) as string | undefined
  const variantId = useWatch({ control, name: variantIdPath }) as string | undefined

  const [itemMeta, setItemMeta] = useState<CreditApplicationItemMeta | null>(
    initialItem?.itemMeta ?? null
  )
  // Guards the very first effect run in edit mode — itemId/variantId both
  // arrive together as the existing line's saved values and must NOT be
  // cleared the way a genuine user-driven item change should.
  const [skipNextVariantReset, setSkipNextVariantReset] = useState(!!initialItem)

  const variantsQuery = useQuery({
    queryKey: ['credit-application-item-variants', itemId],
    queryFn: () => getVariants(itemId as string),
    enabled: !!itemId && !!itemMeta?.hasVariants,
  })
  const variants = variantsQuery.data?.data?.data ?? []
  const selectedVariant = variants.find((v) => v.id === variantId)

  useEffect(() => {
    if (skipNextVariantReset) {
      setSkipNextVariantReset(false)
      return
    }
    // Selecting a new item invalidates whichever variant was picked for the previous one
    setValue(variantIdPath, undefined as PathValue<T, Path<T>>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  const previewAmount = selectedVariant
    ? (selectedVariant.priceOverride ?? itemMeta?.sellingPrice ?? null)
    : (itemMeta?.sellingPrice ?? null)

  const itemsErrors = errors.items as
    | { itemId?: { message?: string }; variantId?: { message?: string } }[]
    | undefined
  const itemError = itemsErrors?.[index]?.itemId?.message
  const variantError = itemsErrors?.[index]?.variantId?.message

  return (
    <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
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
                onSelectItem={setItemMeta}
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

      {itemMeta?.hasVariants && (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Variant <span className="text-red-500">*</span>
          </label>
          <Controller
            name={variantIdPath}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={(field.value as string | undefined) ?? ''}
                disabled={variantsQuery.isLoading}
                className={`${fieldClass} bg-white disabled:bg-zinc-50 disabled:text-zinc-400`}
              >
                <option value="">
                  {variantsQuery.isLoading ? 'Loading variants…' : 'Select variant…'}
                </option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.variantSku}
                    {v.attributes
                      ? ` (${Object.values(v.attributes).filter(Boolean).join(', ')})`
                      : ''}
                  </option>
                ))}
              </select>
            )}
          />
          {variantError && <p className="mt-1 text-xs text-red-600">{variantError}</p>}
        </div>
      )}

      {itemId && (
        <div className="rounded-lg bg-white px-3 py-2 text-sm text-zinc-600">
          Estimated amount:{' '}
          <span className="font-semibold text-zinc-900">
            {previewAmount != null ? formatPeso(previewAmount) : '—'}
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

// Shared by CreateCreditApplicationModal and the "edit financing request"
// flow on the detail page — an application can cover a bundle of models
// (2026-08-15, second pass), so this renders one row per item with add/
// remove controls instead of a single item/variant picker.
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
        onClick={() => append({ itemId: '', variantId: undefined } as never)}
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
