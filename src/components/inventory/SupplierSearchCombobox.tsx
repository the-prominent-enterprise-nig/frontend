'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { getSuppliers } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-suppliers'
import { RepairProvidersFallbackNote } from './RepairProvidersFallbackNote'
import { getRepairProviders } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-repair-providers'

type Props = {
  value: string
  onChange: (id: string) => void
  /** Fires alongside onChange with the full picked option, for callers that
   * need the supplier's name as well as its id — a screen that has to label
   * the choice back to the user, or filter a second lookup by it. */
  onSelect?: (option: SearchComboboxOption) => void
  error?: string
  initialLabel?: string
  /** Lists only suppliers marked as service centers — the repair-provider
   * pickers (Create RR › From Service Center, a DR to a service center). */
  serviceCentersOnly?: boolean
}

export function SupplierSearchCombobox({
  value,
  onChange,
  onSelect,
  error,
  initialLabel,
  serviceCentersOnly = false,
}: Props): React.JSX.Element {
  const noun = serviceCentersOnly ? 'service center' : 'supplier'
  return (
    <>
      <SearchCombobox
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        error={error}
        initialLabel={initialLabel}
        queryKey={serviceCentersOnly ? 'service-centers-search' : 'suppliers-search'}
        placeholder={`Search ${noun}`}
        typeToSearchMessage={`Type to search ${noun}s…`}
        emptyMessage={`No ${noun}s found`}
        search={async (query) => {
          // Service centers are a short list: every one, A–Z, before typing —
          // every supplier until any is marked a service center.
          const res = serviceCentersOnly
            ? await getRepairProviders({ search: query || undefined })
            : await getSuppliers({ search: query || undefined, limit: 20 })
          return (res.data?.data ?? []).map((s) => ({
            id: s.id,
            primary: s.name,
            secondary: s.code,
          }))
        }}
      />
      {serviceCentersOnly && <RepairProvidersFallbackNote />}
    </>
  )
}
