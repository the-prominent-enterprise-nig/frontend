'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { getPriceListItems } from '../../_actions/get-price-list-items'
import { batchUpsertPriceListItems } from '../../_actions/batch-upsert-price-list-items'
import { removePriceListItem } from '../../_actions/remove-price-list-item'
import { removePriceListItems } from '../../_actions/remove-price-list-items'
import { humanizePriceListError } from '../../_lib/humanize-error'
import type { UpsertPriceListItemFormValues } from '@/src/schema/inventory/price-lists'

const LIMIT = 20

/**
 * `currentListStatus` is read fresh on every render (passed down from the
 * page view's own header query) purely to decide whether a mutation's
 * response reverted an 'active' list back to 'pending_approval' — see
 * notifyResult below, mirroring the old PriceListItemsModal's
 * notifyIfRevertedToPending banner/toast.
 */
export function usePriceListItemsPage(priceListId: string, currentListStatus: string | undefined) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const itemsQuery = useQuery({
    queryKey: ['inventory-price-list-items', priceListId, { page, search }],
    queryFn: async () => {
      const res = await getPriceListItems(priceListId, {
        page,
        limit: LIMIT,
        search: search || undefined,
      })
      if (!res.success) throw new Error(res.error ?? 'Failed to load items')
      return res.data
    },
    placeholderData: keepPreviousData,
    staleTime: 10 * 1000,
  })

  function refetchItems() {
    return queryClient.refetchQueries({ queryKey: ['inventory-price-list-items', priceListId] })
  }

  function refetchDetail() {
    return queryClient.refetchQueries({ queryKey: ['inventory-price-list-detail', priceListId] })
  }

  function refetchListTable() {
    return queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
  }

  function setSearchAndResetPage(value: string) {
    setSearch(value)
    setPage(1)
  }

  function notifyResult(verb: string, count: number, listStatus: unknown) {
    if (listStatus === 'pending_approval' && currentListStatus === 'active') {
      showToast({
        title: `${count} item${count === 1 ? '' : 's'} ${verb} — list back in Pending Approval`,
        description: 'This list was active and has stopped applying at checkout until re-approved.',
        status: 'success',
      })
    } else {
      showToast({ title: `${count} item${count === 1 ? '' : 's'} ${verb}`, status: 'success' })
    }
    refetchItems()
    refetchDetail()
    refetchListTable()
  }

  const addMutation = useMutation({
    mutationFn: (items: UpsertPriceListItemFormValues[]) =>
      batchUpsertPriceListItems(priceListId, items),
    onSuccess: (result) => {
      if (result.success) {
        const data = result.data as { upserted?: number; listStatus?: unknown } | undefined
        notifyResult('added', data?.upserted ?? 0, data?.listStatus)
      } else {
        showToast({
          title: 'Failed to add items',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const removeOneMutation = useMutation({
    mutationFn: (itemId: string) => removePriceListItem(priceListId, itemId),
    onSuccess: (result) => {
      if (result.success) {
        const data = result.data as { listStatus?: unknown } | undefined
        notifyResult('removed', 1, data?.listStatus)
      } else {
        showToast({
          title: 'Failed to remove item',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const removeManyMutation = useMutation({
    mutationFn: (itemIds: string[]) => removePriceListItems(priceListId, itemIds),
    onSuccess: (result) => {
      if (result.success) {
        const data = result.data as { deleted?: number; listStatus?: unknown } | undefined
        notifyResult('removed', data?.deleted ?? 0, data?.listStatus)
      } else {
        showToast({
          title: 'Failed to remove items',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const items = itemsQuery.data?.data ?? []
  const total = itemsQuery.data?.total ?? 0

  return {
    items,
    total,
    page,
    setPage,
    search,
    setSearch: setSearchAndResetPage,
    totalPages: Math.ceil(total / LIMIT),
    isLoading: itemsQuery.isLoading,
    isFetching: itemsQuery.isFetching,
    error: itemsQuery.error,
    addItems: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    removeItem: removeOneMutation.mutateAsync,
    removeItems: removeManyMutation.mutateAsync,
    isRemovingMany: removeManyMutation.isPending,
  }
}
