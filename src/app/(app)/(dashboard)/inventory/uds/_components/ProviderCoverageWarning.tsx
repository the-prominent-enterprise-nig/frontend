'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { checkUdsProvider, getUdsProviderOptions } from '../_actions/check-uds-provider'
import type { SearchableSelectOption } from '@/src/components/ui/SearchableSelect'

type Props = { supplierId?: string | null; serialIds: string[] }

/**
 * Scenario 72 — warns, without blocking, when the chosen repair provider is
 * not on file (Item Master → suppliers) for an item on the ticket. Silent
 * until both a provider and at least one unit are chosen.
 */
export function ProviderCoverageWarning({
  supplierId,
  serialIds,
}: Props): React.JSX.Element | null {
  const ids = serialIds.filter(Boolean)
  const { data } = useQuery({
    queryKey: ['uds-provider-check', supplierId, ids],
    queryFn: () => checkUdsProvider(supplierId!, ids),
    enabled: !!supplierId && ids.length > 0,
    staleTime: 60 * 1000,
  })
  const uncovered = data?.success ? (data.data?.uncovered ?? []) : []
  if (!supplierId || uncovered.length === 0) return null

  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="text-xs text-amber-800">
        <p className="font-medium">This provider isn&apos;t on file as a supplier of:</p>
        <ul className="mt-1 list-disc pl-4">
          {uncovered.map((u) => (
            <li key={u.serialNumber}>
              {u.itemName} <span className="font-mono">({u.serialNumber})</span>
              {!u.hasSuppliersOnFile && ' — no supplier on file for this item'}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-amber-700">
          You can still save. Check the Item Master if this looks wrong.
        </p>
      </div>
    </div>
  )
}

type SupplierOption = { id: string; code: string; name: string }

/**
 * The repair-provider picker's options: only the suppliers on file (Item
 * Master) for every item on the ticket. If none is on file the full list
 * comes back with `noneOnFile`, so a unit nobody has mapped can still get a
 * provider. Unfiltered until a unit is chosen, or while the lookup runs.
 */
export function useProviderOptions(
  suppliers: SupplierOption[],
  serialIds: string[]
): { options: SearchableSelectOption[]; noneOnFile: boolean } {
  const ids = serialIds.filter(Boolean)
  const { data } = useQuery({
    queryKey: ['uds-provider-options', ids],
    queryFn: () => getUdsProviderOptions(ids),
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
  })
  const all = suppliers.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))
  const covering = ids.length && data?.success ? new Set(data.data?.supplierIds ?? []) : null
  if (!covering) return { options: all, noneOnFile: false }
  if (covering.size === 0) return { options: all, noneOnFile: true }
  return { options: all.filter((o) => covering.has(o.value)), noneOnFile: false }
}

/** Shown under the picker when no supplier is on file for the ticket's items. */
export function NoSupplierOnFileNote({ show }: { show: boolean }): React.JSX.Element | null {
  if (!show) return null
  return (
    <p className="mt-1 text-xs text-amber-700">
      No supplier is on file for these items in the Item Master — showing every supplier.
    </p>
  )
}
