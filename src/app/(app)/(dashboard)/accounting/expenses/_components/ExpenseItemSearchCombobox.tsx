'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'

// Supplier line's Item picker — picking one prefills the line's Category
// (from whichever default account the item has) and Unit Price (its cost,
// since this is money going out to acquire it, not sellingPrice which is
// what we charge customers).
export type ExpenseItemSearchMeta = {
  costPrice: number | null
  revenueAccountId: string | null
  cogsAccountId: string | null
  inventoryAccountId: string | null
}

type Props = {
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
}

export function ExpenseItemSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      queryKey="expense-line-items-search"
      placeholder="— None —"
      typeToSearchMessage="Type to search items…"
      emptyMessage="No items found"
      search={async (query) => {
        const res = await getItems({ search: query || undefined, limit: 20, lifecycle: 'active' })
        return (res.data?.data ?? []).map((item) => ({
          id: item.id,
          primary: item.name,
          secondary: item.sku,
          meta: {
            costPrice: item.costPrice ?? null,
            revenueAccountId: item.revenueAccountId ?? null,
            cogsAccountId: item.cogsAccountId ?? null,
            inventoryAccountId: item.inventoryAccountId ?? null,
          } satisfies ExpenseItemSearchMeta,
        }))
      }}
    />
  )
}
