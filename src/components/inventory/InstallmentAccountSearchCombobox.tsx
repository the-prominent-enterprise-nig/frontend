'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getInstallmentAccounts } from '@/src/app/(app)/(dashboard)/inventory/goods-receiving/_actions/get-installment-accounts'

/** Carried through `onSelect`'s `option.meta` so the caller can auto-resolve
 * which of an item's sold serials belongs to this account's customer,
 * without a second round trip to re-fetch the account. */
export type InstallmentAccountMeta = {
  customerId: string
}

type Props = {
  value: string
  onChange: (id: string) => void
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
}

/** Scenario 55 Part 4 — picks the InstallmentAccount a repossessed unit came
 * from. Search matches the customer's name as well as the account number —
 * the receiver usually knows who they're dealing with, not the account
 * number off the top of their head. */
export function InstallmentAccountSearchCombobox({
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
      queryKey="installment-accounts-search"
      placeholder="Search by customer name or account number…"
      typeToSearchMessage="Type a name or account number to search…"
      emptyMessage="No installment accounts found"
      search={async (query) => {
        const res = await getInstallmentAccounts({ search: query || undefined, limit: 20 })
        return (res.data?.data ?? []).map((a) => ({
          id: a.id,
          primary: a.customer?.name ?? a.accountNumber,
          secondary: a.customer?.name ? a.accountNumber : undefined,
          meta: { customerId: a.customerId } satisfies InstallmentAccountMeta,
        }))
      }}
    />
  )
}
