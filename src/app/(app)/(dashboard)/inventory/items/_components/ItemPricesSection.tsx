'use client'

import { Controller, useFieldArray, type Control, type FieldErrors } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Plus, Tag, Trash2 } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { CONTROL_CHROME } from '@/src/libs/design/plex'
import type { CreateItemFormValues } from '@/src/schema/inventory/items'
import {
  emptyItemPriceEntry,
  PRICE_TERM_MONTHS,
  type PriceTermMonths,
} from '@/src/schema/inventory/items/item-prices'
import { getPriceUseTypes } from '../../price-use-types/_actions/get-price-use-types'
import { NumericInput } from './item-form-shared'
import { errorClass, inputClass, labelClass } from './itemFormChrome'

type Props = {
  control: Control<CreateItemFormValues>
  errors: FieldErrors<CreateItemFormValues>
}

type MoneyField = 'price' | 'downPayment' | 'credit' | 'cm'

const MONEY_FIELDS: { name: MoneyField; label: string }[] = [
  { name: 'price', label: 'Price (₱)' },
  { name: 'downPayment', label: 'Down Payment' },
  { name: 'credit', label: 'Credit' },
  { name: 'cm', label: 'CM' },
]

function usePriceUseOptions(): { value: string; label: string }[] {
  const query = useQuery({
    queryKey: ['inventory-price-use-types'],
    queryFn: getPriceUseTypes,
    staleTime: 5 * 60 * 1000,
  })
  return (query.data ?? []).filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }))
}

/** The Add Item form's prices — one card per price use with the same cells
 * as a price list upload row. Saved to each price use's list once the item
 * exists; a live list goes back to pending approval. */
export default function ItemPricesSection({ control, errors }: Props): React.JSX.Element {
  const { fields, append, remove } = useFieldArray({ control, name: 'prices' })
  const priceUseOptions = usePriceUseOptions()

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="-mt-1 flex items-start gap-2 rounded-lg border border-[#eeeef1] bg-[#fbfbfc] px-3 py-2 text-[12px] text-[#4b4b5a]">
        <Tag className="h-4 w-4 shrink-0 text-ink-faint" />
        Put the item on the price list for each price use. A live list that gets a new price goes
        back to pending approval.
      </div>
      {fields.map((field, index) => (
        <PriceEntryCard
          key={field.id}
          index={index}
          control={control}
          errors={errors}
          priceUseOptions={priceUseOptions}
          onRemove={() => remove(index)}
        />
      ))}
      <button
        type="button"
        onClick={() => append(emptyItemPriceEntry())}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#d3d3db] px-3 py-2 text-[13px] font-medium text-[#5b21b6] hover:border-[#5b21b6] hover:bg-[#f8f5fd]"
      >
        <Plus className="h-4 w-4" />
        Add price use
      </button>
    </div>
  )
}

function PriceEntryCard({
  index,
  control,
  errors,
  priceUseOptions,
  onRemove,
}: Props & {
  index: number
  priceUseOptions: { value: string; label: string }[]
  onRemove: () => void
}): React.JSX.Element {
  const entryErrors = errors.prices?.[index]
  return (
    <div className="rounded-lg border border-[#e4e4e9] bg-white p-3">
      <div className="mb-3 flex items-end gap-2">
        <div className="flex-1">
          <label className={labelClass}>Price Use</label>
          <Controller
            name={`prices.${index}.priceUse`}
            control={control}
            render={({ field }) => (
              <SearchableSelect
                chrome={CONTROL_CHROME}
                portal
                value={field.value ?? ''}
                onChange={field.onChange}
                options={priceUseOptions}
                placeholder="Select price use…"
              />
            )}
          />
        </div>
        <Tooltip label="Remove price use" align="end">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove price use"
            className="rounded-md p-2 text-ink-faint hover:bg-[#fdeceb] hover:text-[#b42318]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
      {entryErrors?.priceUse && <p className={errorClass}>{entryErrors.priceUse.message}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MONEY_FIELDS.map((m) => (
          <MoneyCell key={m.name} control={control} index={index} {...m} />
        ))}
      </div>
      {entryErrors?.price && <p className={errorClass}>{entryErrors.price.message}</p>}
      <TermsGrid control={control} index={index} errors={errors} />
    </div>
  )
}

function MoneyCell({
  control,
  index,
  name,
  label,
}: {
  control: Control<CreateItemFormValues>
  index: number
  name: MoneyField
  label: string
}): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <Controller
        name={`prices.${index}.${name}`}
        control={control}
        render={({ field }) => (
          <NumericInput
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            fieldRef={field.ref}
            placeholder="0.00"
            className={inputClass}
          />
        )}
      />
    </div>
  )
}

/** 3 / 6 / 9 / 12 months — monthly installment and prompt-payment discount,
 * both or neither per term (the upload's rule). */
function TermsGrid({ control, index, errors }: Props & { index: number }): React.JSX.Element {
  const termErrors = errors.prices?.[index]?.terms
  return (
    <div className="mt-3">
      <p className={labelClass}>Installment terms (optional)</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {PRICE_TERM_MONTHS.map((months) => (
          <div key={months} className="rounded-md border border-[#eeeef1] p-2">
            <p className="mb-1.5 text-[12px] font-medium text-[#3d3d4a]">{months} mos</p>
            <div className="grid grid-cols-2 gap-1.5">
              <TermCell control={control} index={index} months={months} cell="mi" />
              <TermCell control={control} index={index} months={months} cell="ppd" />
            </div>
            {termErrors?.[`t${months}`] && (
              <p className={errorClass}>{termErrors[`t${months}`]?.message}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TermCell({
  control,
  index,
  months,
  cell,
}: {
  control: Control<CreateItemFormValues>
  index: number
  months: PriceTermMonths
  cell: 'mi' | 'ppd'
}): React.JSX.Element {
  return (
    <Controller
      name={`prices.${index}.terms.t${months}.${cell}`}
      control={control}
      render={({ field }) => (
        <NumericInput
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          fieldRef={field.ref}
          placeholder={cell === 'mi' ? 'MI' : 'PPD'}
          aria-label={`${months} months ${cell.toUpperCase()}`}
          className={inputClass}
        />
      )}
    />
  )
}
