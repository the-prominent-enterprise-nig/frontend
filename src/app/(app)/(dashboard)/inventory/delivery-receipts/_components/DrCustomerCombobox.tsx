'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import type { DrCustomerLookup } from '@/src/schema/inventory/delivery-receipts'
import { searchDrCustomers } from '../_actions/dr-lookups'

type Props = {
  value: string
  initialLabel?: string
  error?: string
  /** The whole customer, so the form can fill Delivered to, Customer ID,
   * Address and Contact no. from CRM. Null when the pick is cleared. */
  onPick: (customer: DrCustomerLookup | null) => void
}

/** Scenario 72 — CRM customer search for the DR form, through the DR's own
 * lookup (a Stock Controller cannot read /customers). */
export function DrCustomerCombobox({
  value,
  initialLabel,
  error,
  onPick,
}: Props): React.JSX.Element {
  return (
    <SearchCombobox
      value={value}
      initialLabel={initialLabel}
      error={error}
      onChange={(id) => {
        if (!id) onPick(null)
      }}
      onSelect={(option) => onPick(option.meta as DrCustomerLookup)}
      queryKey="dr-customer-search"
      placeholder="Search customer by name, code or phone…"
      typeToSearchMessage="Type to search CRM customers…"
      emptyMessage="No customers found"
      search={async (query) => {
        const customers = await searchDrCustomers(query)
        return customers.map((c) => ({
          id: c.id,
          primary: c.name,
          secondary: [c.customerCode, c.phone].filter(Boolean).join(' · '),
          meta: c,
        }))
      }}
    />
  )
}
