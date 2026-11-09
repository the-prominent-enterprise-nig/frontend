'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import { showToast } from '@/src/components/ui/toast'
import type { ApiResponse } from '@/src/libs/api/client'
import type { SupplierListItem } from '@/src/schema/inventory/suppliers'
import type { ServiceCenterFormValues } from '@/src/schema/inventory/service-centers'
import { listSuppliers } from '../../../accounting/suppliers/_actions/list-suppliers'
import { createSupplier } from '../../../accounting/suppliers/_actions/create-supplier'
import { updateSupplier } from '../../../accounting/suppliers/_actions/update-supplier'

export const SERVICE_CENTERS_QUERY_KEY = ['service-centers'] as const

/** Every query that lists suppliers or repair providers — a new or edited
 * service center must show up in all of them straight away, not after their
 * stale time (5 min for the repair-provider lookups). */
const RELATED_KEYS = [
  SERVICE_CENTERS_QUERY_KEY,
  ['suppliers-directory'],
  ['suppliers-search'],
  // Repair-provider pickers (getRepairProviders / serviceCentersOnly).
  ['service-centers-search'], // SupplierSearchCombobox: Create RR, DR to service center
  ['repair-providers-fallback'], // "No service centers set" note under those pickers
  ['inventory-uds-repair-providers'], // UDS create / assess / set repair provider
  ['rr-service-center-suppliers'], // Receive Stock › From Service Center
]

/** The whole set fits on one page; it is filtered client-side like the directory. */
const PAGE_SIZE = 500

type SaveInput = { id: string | null; values: ServiceCenterFormValues }

function matches(sc: SupplierListItem, q: string): boolean {
  if (!q) return true
  return [sc.name, sc.address].filter(Boolean).join(' ').toLowerCase().includes(q)
}

/** Supplier.code is unique across every tenant, so no per-tenant counter —
 * a base36 timestamp plus a random tail, e.g. SC-MH8K2Q1A-7F. */
function generateCode(): string {
  const time = Date.now().toString(36).toUpperCase()
  const tail = Math.random().toString(36).slice(2, 4).toUpperCase()
  return `SC-${time}-${tail}`
}

/** Address is always sent (even '') so clearing it on edit actually clears it. */
function toPayload(values: ServiceCenterFormValues, isNew: boolean): Record<string, unknown> {
  return {
    ...(isNew && { code: generateCode() }),
    name: values.name.trim(),
    address: values.address?.trim() ?? '',
    status: values.status,
    isServiceCenter: true,
  }
}

async function save({ id, values }: SaveInput): Promise<ApiResponse<{ id: string }>> {
  const res = id
    ? await updateSupplier(id, toPayload(values, false))
    : await createSupplier(toPayload(values, true))
  if (!res.success) throw new Error(res.message || res.error || 'Failed to save service center')
  return res
}

type UseServiceCenters = {
  serviceCenters: SupplierListItem[]
  total: number
  isLoading: boolean
  isFetching: boolean
  error: string | undefined
  refetch: () => Promise<unknown>
  search: string
  setSearch: (value: string) => void
  saveServiceCenter: (input: SaveInput) => Promise<ApiResponse<{ id: string }>>
  isSaving: boolean
}

export function useServiceCenters(): UseServiceCenters {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: SERVICE_CENTERS_QUERY_KEY,
    queryFn: () => listSuppliers({ limit: PAGE_SIZE, isServiceCenter: true }),
    staleTime: STALE.OPERATIONAL,
  })

  const all = useMemo(() => query.data?.data?.data ?? [], [query.data])
  const serviceCenters = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((sc) => matches(sc, q)).sort((a, b) => a.name.localeCompare(b.name))
  }, [all, search])

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: (_res, { id }) => {
      RELATED_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      showToast({
        title: id ? 'Service center updated' : 'Service center added',
        status: 'success',
      })
    },
    onError: (err) => {
      showToast({
        title: 'Could not save service center',
        description: err.message,
        status: 'error',
      })
    },
  })

  return {
    serviceCenters,
    total: all.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error:
      query.data?.success === false ? query.data.message || query.data.error : query.error?.message,
    refetch: query.refetch,
    search,
    setSearch,
    saveServiceCenter: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}
