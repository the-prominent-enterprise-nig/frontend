'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getRepairIntakeSales, type RepairIntakeSale } from '../../_actions/get-repair-intake-sales'

type Props = {
  value: string
  onChange: (id: string) => void
  /** The whole sale rides along as `option.meta`, so picking one fills the
   * customer and lists its units without a second request. */
  onSelect: (sale: RepairIntakeSale) => void
  error?: string
  initialLabel?: string
  /** Scopes the search to one customer — set once Returned by is picked. */
  customerId?: string
}

/** The Invoice # picker on a Repair/Return RR: any sale, cash or financed,
 * found by the Sales Invoice No. the customer holds (or the POS number, their
 * name or code, the item, or the serial). Each option leads with the SI No.,
 * the item(s) and customer beneath it. */
export function RepairIntakeSaleSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
  customerId,
}: Props): React.JSX.Element {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={(option: SearchComboboxOption) => onSelect(option.meta as RepairIntakeSale)}
      error={error}
      initialLabel={initialLabel}
      queryKey={`repair-intake-sales-${customerId ?? 'any'}`}
      placeholder="Search by invoice number…"
      // Shown only when nothing is typed and no sale has a unit out — the
      // latest sales list as soon as the field opens.
      typeToSearchMessage="No sales with a unit still out with a customer"
      emptyMessage="No sales found with a unit still out with the customer"
      search={async (query) => {
        const res = await getRepairIntakeSales({ search: query || undefined, customerId })
        return (res.data ?? []).map((sale) => {
          const items = [...new Set(sale.unitItems.map((u) => u.itemName).filter(Boolean))]
          const secondary = [items.join(', '), sale.customer?.name].filter(Boolean).join(' · ')
          return {
            id: sale.id,
            primary: sale.siNumber,
            secondary: secondary || undefined,
            meta: sale,
          }
        })
      }}
    />
  )
}
