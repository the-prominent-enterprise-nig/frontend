'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import { getStockBalances } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-stock-balances'

export type ItemSearchMeta = {
  costPrice: number | null
  isSerialTracked: boolean
  isBatchTracked: boolean
}

type Props = {
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
  /** Dense row height, to match the other controls on a line-item row. */
  compact?: boolean
  /** Overrides the default, which is too long for a narrow grid column. */
  placeholder?: string
  /** Greys the box out — for a picker whose surrounding context (supplier,
   * invoice, warehouse) has to be settled before an item can mean anything. */
  disabled?: boolean
  /** Lists items with available stock at this warehouse first, each with
   * its count — for pickers that draw from one source (Stock Transfer). */
  stockWarehouseId?: string
  /** Drops serial-tracked items from the results — for a picker whose flow
   * has no way to capture the arriving unit's actual serial (e.g. a
   * transfer's unlisted-item receipt line, which only records a bare
   * quantity). Without this, a serial-tracked pick either silently
   * fabricates stock with no addressable serial, or gets rejected by the
   * backend after the rest of the form is filled in. */
  excludeSerialTracked?: boolean
}

async function searchCatalog(
  query: string,
  excludeSerialTracked?: boolean
): Promise<SearchComboboxOption[]> {
  const res = await getItems({ search: query || undefined, limit: 20, lifecycle: 'active' })
  return (res.data?.data ?? [])
    .filter((item) => !excludeSerialTracked || !item.isSerialTracked)
    .map((item) => ({
      id: item.id,
      primary: item.name,
      secondary: item.sku,
      meta: {
        costPrice: item.costPrice ?? null,
        isSerialTracked: item.isSerialTracked ?? false,
        isBatchTracked: item.isBatchTracked ?? false,
      } satisfies ItemSearchMeta,
    }))
}

/** Items with available stock at the warehouse, most units first. Serial-
 * tracked filtering happens later in searchStockedFirst against the catalog,
 * since the stock balance row's item shape doesn't carry isSerialTracked. */
async function searchStocked(query: string, warehouseId: string): Promise<SearchComboboxOption[]> {
  const res = await getStockBalances({ warehouseId, search: query || undefined, limit: 50 })
  const stocked = new Map<string, SearchComboboxOption & { qty: number }>()
  for (const row of res.data?.data ?? []) {
    if (!row.item || row.availableQty <= 0 || stocked.has(row.item.id)) continue
    stocked.set(row.item.id, {
      id: row.item.id,
      primary: row.item.name,
      secondary: row.item.sku,
      badge: `${row.availableQty} in stock`,
      qty: row.availableQty,
    })
  }
  return [...stocked.values()].sort((a, b) => b.qty - a.qty).map(({ qty: _qty, ...o }) => o)
}

async function searchStockedFirst(
  query: string,
  warehouseId: string,
  excludeSerialTracked?: boolean
): Promise<SearchComboboxOption[]> {
  const [stocked, catalog] = await Promise.all([
    searchStocked(query, warehouseId),
    searchCatalog(query, excludeSerialTracked),
  ])
  const catalogById = new Map(catalog.map((o) => [o.id, o]))
  // Catalog is already filtered when excludeSerialTracked is on, so gate
  // stocked rows on catalog membership to inherit the same filter.
  const stockedFiltered = excludeSerialTracked
    ? stocked.filter((o) => catalogById.has(o.id))
    : stocked
  const stockedIds = new Set(stockedFiltered.map((o) => o.id))
  return [
    ...stockedFiltered.map((o) => ({ ...o, meta: catalogById.get(o.id)?.meta })),
    ...catalog.filter((o) => !stockedIds.has(o.id)),
  ]
}

export function ItemSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
  compact,
  placeholder = 'Search item by name or SKU…',
  disabled,
  stockWarehouseId,
  excludeSerialTracked,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      compact={compact}
      disabled={disabled}
      queryKey={stockWarehouseId ? `items-search-stock-${stockWarehouseId}` : 'items-search'}
      placeholder={placeholder}
      typeToSearchMessage="Type to search items…"
      emptyMessage="No items found"
      search={(query) =>
        stockWarehouseId
          ? searchStockedFirst(query, stockWarehouseId, excludeSerialTracked)
          : searchCatalog(query, excludeSerialTracked)
      }
    />
  )
}
