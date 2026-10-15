'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import { getItem } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item'
import type { ItemSummary } from '@/src/schema/inventory/items'
import { getStockBalances } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-stock-balances'
import { getSupplierItems } from '@/src/app/(app)/(dashboard)/inventory/suppliers/_actions/get-supplier-items'

export type ItemSearchMeta = {
  costPrice: number | null
  isSerialTracked: boolean
  isBatchTracked: boolean
  /** Scenario 72 — the Delivery Receipt's Model / Brand columns. */
  modelNumber?: string | null
  brandName?: string | null
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
  /** Lists this supplier's approved items (ItemSupplier) — for a PO, where
   * the client wants only what the chosen supplier carries. Falls back to
   * the whole catalog when the supplier has none on file, and when a typed
   * search matches none of theirs (tagged, so an off-list pick is a choice). */
  supplierId?: string
}

const OFF_LIST_BADGE = "Not on supplier's list"

async function searchSupplierFirst(
  query: string,
  supplierId: string,
  excludeSerialTracked?: boolean
): Promise<SearchComboboxOption[]> {
  // A caller without inventory:suppliers:read gets an error here — that
  // degrades to the full catalog rather than an empty picker.
  const res = await getSupplierItems(supplierId)
  const mapped = res.success ? (res.data ?? []) : []
  if (mapped.length === 0) return searchCatalog(query, excludeSerialTracked)

  const q = query.trim().toLowerCase()
  const matches = mapped
    .filter(
      (m) =>
        !q ||
        m.item.name.toLowerCase().includes(q) ||
        m.item.sku.toLowerCase().includes(q) ||
        !!m.supplierSku?.toLowerCase().includes(q)
    )
    .map((m) => ({ id: m.item.id, primary: m.item.name, secondary: m.item.sku }))
  if (matches.length > 0 || !q) return matches

  const catalog = await searchCatalog(query, excludeSerialTracked)
  return catalog.map((o) => ({ ...o, badge: OFF_LIST_BADGE }))
}

function toMeta(item: ItemSummary): ItemSearchMeta {
  return {
    // getItem is not schema-parsed, so a decimal can still be a string here.
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    isSerialTracked: Boolean(item.isSerialTracked),
    isBatchTracked: item.isBatchTracked ?? false,
    modelNumber: item.modelNumber ?? null,
    brandName: item.brand?.name ?? null,
  }
}

/** A stocked row outside the catalog's top 20 arrives with no meta; read the
 * item itself so a serialized unit is never treated as a plain one. */
async function withMeta(option: SearchComboboxOption): Promise<SearchComboboxOption> {
  if (option.meta) return option
  const res = await getItem(option.id)
  return res.success && res.data ? { ...option, meta: toMeta(res.data) } : option
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
      meta: toMeta(item),
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
  supplierId,
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect && ((o) => void withMeta(o).then(onSelect))}
      error={error}
      initialLabel={initialLabel}
      compact={compact}
      disabled={disabled}
      queryKey={
        supplierId
          ? `items-search-supplier-${supplierId}`
          : stockWarehouseId
            ? `items-search-stock-${stockWarehouseId}`
            : 'items-search'
      }
      placeholder={placeholder}
      typeToSearchMessage="Type to search items…"
      emptyMessage="No items found"
      search={(query) =>
        supplierId
          ? searchSupplierFirst(query, supplierId, excludeSerialTracked)
          : stockWarehouseId
            ? searchStockedFirst(query, stockWarehouseId, excludeSerialTracked)
            : searchCatalog(query, excludeSerialTracked)
      }
    />
  )
}
