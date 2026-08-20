'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'

export type CreditApplicationItemMeta = {
  sellingPrice: number | null
  modelNumber: string | null
}

type Props = {
  value: string
  onChange: (id: string) => void
  /** Fires with the picked item's price info — lets the parent form preview
   * an amount. Not fired for a value arriving via `initialLabel` (edit-mode
   * prefill). */
  onSelectItem?: (meta: CreditApplicationItemMeta) => void
  error?: string
  initialLabel?: string
}

// Mirrors MaterialItemSearchCombobox — a credit application must reference a
// physical/stock item, never a service (no server-side isService filter on
// GET /inventory/items, so this filters the search results client-side).
export function CreditApplicationItemSearchCombobox({
  value,
  onChange,
  onSelectItem,
  error,
  initialLabel,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={(option) => onSelectItem?.(option.meta as CreditApplicationItemMeta)}
      error={error}
      initialLabel={initialLabel}
      queryKey="credit-application-item-search"
      placeholder="Search item by name, SKU, or model number…"
      typeToSearchMessage="Type to search items…"
      emptyMessage="No items found"
      search={async (query) => {
        const res = await getItems({ search: query || undefined, limit: 20, lifecycle: 'active' })
        return (res.data?.data ?? [])
          .filter((item) => item.isService !== true)
          .map((item) => ({
            id: item.id,
            primary: item.name,
            secondary: item.modelNumber ?? item.sku,
            meta: {
              sellingPrice: item.sellingPrice ?? null,
              modelNumber: item.modelNumber ?? null,
            } satisfies CreditApplicationItemMeta,
          }))
      }}
    />
  )
}
