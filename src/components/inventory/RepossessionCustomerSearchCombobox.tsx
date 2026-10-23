'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { searchCustomers } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'

/** How many recent customers the field offers before anyone types — mirrors
 * pos/service-jobs's own CustomerSearchCombobox exactly. */
const RECENT_COUNT = 5

function customerDisplayName(c: { name?: string; firstName?: string; lastName?: string }) {
  return c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'
}

type Props = {
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
}

/** Repossession, Create RR — "Repossessed From": which customer a
 * repossession line is being taken back from, picked before the installment
 * account it drives (see InstallmentAccountSearchCombobox's own customerId
 * prop). Reuses the POS checkout customer search (not /crm/customers) so a
 * Stock Controller without crm:customers:read can still search — same
 * reasoning as pos/service-jobs's own CustomerSearchCombobox. */
export function RepossessionCustomerSearchCombobox({
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
      queryKey="repossession-customer-search"
      placeholder="Search customer by name or phone…"
      typeToSearchMessage="Type a name or phone number to search…"
      emptyMessage="No customers found"
      search={async (query) => {
        const res = await searchCustomers(query.trim())
        const rows = res.data ?? []
        return (query.trim() ? rows : rows.slice(0, RECENT_COUNT)).map((c) => ({
          id: c.id,
          primary: customerDisplayName(c),
          secondary: c.phone ?? c.email,
        }))
      }}
    />
  )
}
