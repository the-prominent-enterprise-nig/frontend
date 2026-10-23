'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getInstallmentAccounts } from '@/src/app/(app)/(dashboard)/inventory/goods-receiving/_actions/get-installment-accounts'

/** Carried through `onSelect`'s `option.meta` so the caller can auto-resolve
 * which of an item's sold serials belongs to this account's customer,
 * without a second round trip to re-fetch the account — and, for the
 * repossession picker, so picking the account this way can also fill in
 * "Repossessed From" (customerName) without a separate customer search. */
export type InstallmentAccountMeta = {
  customerId: string
  customerName?: string
}

type Props = {
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
  /** Scopes the search to one customer's accounts — set once "Repossessed
   * From" is picked. Left unset, the field searches every account (matching
   * this component's original, customer-agnostic behavior). */
  customerId?: string
  /** Overrides for a caller framing this same search around one particular
   * way in — e.g. the repossession picker's own "Invoice #" field reuses
   * this component verbatim, just with copy that says so. */
  placeholder?: string
  typeToSearchMessage?: string
}

/** Picks the InstallmentAccount a repossessed unit came from. `search`
 * matches the account number, the customer's name, the item name, a serial
 * number, or the AR invoice number — the receiver usually knows one of
 * those, not the account number off the top of their head. Always shows the
 * item(s) sold under the account (when known) so a search by customer still
 * confirms which item is which before picking. */
export function InstallmentAccountSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
  customerId,
  placeholder = 'Search by item, serial, invoice #, customer name, or account number…',
  typeToSearchMessage = 'Type an item, serial, invoice #, name, or account number to search…',
}: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      error={error}
      initialLabel={initialLabel}
      queryKey={`installment-accounts-search-${customerId ?? 'any'}`}
      placeholder={placeholder}
      typeToSearchMessage={typeToSearchMessage}
      emptyMessage="No installment accounts found"
      search={async (query) => {
        const res = await getInstallmentAccounts({
          search: query || undefined,
          customerId,
          repossessable: true,
          limit: 20,
        })
        return (res.data?.data ?? []).map((a) => {
          const items = a.itemNames ?? []
          const secondaryParts = [
            a.accountNumber,
            a.invoiceNumber ? `INV ${a.invoiceNumber}` : undefined,
            items.length > 0 ? a.customer?.name : undefined,
          ].filter(Boolean)
          return {
            id: a.id,
            primary: items.length > 0 ? items.join(', ') : (a.customer?.name ?? a.accountNumber),
            secondary: secondaryParts.length > 0 ? secondaryParts.join(' · ') : undefined,
            meta: {
              customerId: a.customerId,
              customerName: a.customer?.name,
            } satisfies InstallmentAccountMeta,
          }
        })
      }}
    />
  )
}
