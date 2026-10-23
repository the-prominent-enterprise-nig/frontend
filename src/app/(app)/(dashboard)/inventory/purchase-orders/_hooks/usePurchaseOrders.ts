'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getPurchaseOrders } from '../_actions/get-purchase-orders'
import { createPurchaseOrder } from '../_actions/create-purchase-order'
import { updatePurchaseOrder } from '../_actions/update-purchase-order'
import { convertPrToPo } from '../_actions/convert-pr-to-po'
import { approvePurchaseOrder } from '../_actions/approve-purchase-order'
import { sendPurchaseOrder } from '../_actions/send-purchase-order'
import { cancelPurchaseOrder } from '../_actions/cancel-purchase-order'
import { closePurchaseOrder } from '../_actions/close-purchase-order'
import type {
  ConvertPrToPoFormValues,
  CreatePoFormValues,
} from '@/src/schema/inventory/purchase-orders'

export function usePurchaseOrders() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Scenario 56 — the list AND any single PO opened by id (`?po=<id>`, cached
  // under ['purchase-order', id]). Clearing only the list left a PO reopened
  // after approve/send/close showing its old status for up to five minutes.
  const invalidatePurchaseOrders = (): void => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-order'] })
  }

  // Scenario 56 — the status pill lives in the URL (`?status=`), so leaving
  // for Inventory and coming back (or refreshing) lands on the same filter
  // instead of silently resetting to All.
  const statusFilter = searchParams.get('status') ?? undefined
  const setStatusFilter = (v: string | undefined): void => {
    const next = new URLSearchParams(searchParams.toString())
    if (v) next.set('status', v)
    else next.delete('status')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const [page, setPage] = useState(1)
  const [limit, setLimitState] = useState(25)
  const [search, setSearch] = useState('')
  // Both are server-side filters (PoFilterDto: supplierId, branchId) — they
  // narrow the whole result set, not just the page on screen, so the
  // pagination footer's totals stay truthful.
  const [supplierId, setSupplierIdState] = useState<string | undefined>(undefined)
  const [branchId, setBranchIdState] = useState<string | undefined>(undefined)
  // Newest first — the order this list has always used; the control just
  // makes the other direction reachable.
  const [sortDir, setSortDirState] = useState<'asc' | 'desc'>('desc')

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter,
      search: search || undefined,
      supplierId,
      branchId,
      sortDir,
    }),
    [page, limit, statusFilter, search, supplierId, branchId, sortDir]
  )

  const listQuery = useQuery({
    queryKey: ['purchase-orders', queryParams],
    queryFn: () => getPurchaseOrders(queryParams),
    placeholderData: keepPreviousData,
    staleTime: STALE.OPERATIONAL,
    // Scenario 26 — same gap found live in purchase requests and every
    // other maker-checker list this scenario touched: staleTime alone only
    // refetches on THIS tab's own refocus/remount, not when someone else's
    // approval changes the record in a different browser tab/session.
    refetchInterval: 10 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePoFormValues) => createPurchaseOrder(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order created',
          description: result.message,
          status: 'success',
        })
        invalidatePurchaseOrders()
      } else {
        showToast({
          title: 'Failed to create purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const convertMutation = useMutation({
    mutationFn: ({ prId, data }: { prId: string; data: ConvertPrToPoFormValues }) =>
      convertPrToPo(prId, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order created',
          description: result.message,
          status: 'success',
        })
        invalidatePurchaseOrders()
        queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
        // Same reasoning as the auto-convert-on-approve path in
        // usePurchaseRequests.ts — the source PR just left the default
        // (non-'converted') list, follow the new PO to where it landed.
        router.replace('/inventory/purchase-orders?tab=orders')
      } else {
        showToast({
          title: 'Failed to create purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreatePoFormValues }) =>
      updatePurchaseOrder(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order updated',
          description: result.message,
          status: 'success',
        })
        invalidatePurchaseOrders()
      } else {
        showToast({
          title: 'Failed to update purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvePurchaseOrder(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order approved',
          description: result.message,
          status: 'success',
        })
        invalidatePurchaseOrders()
      } else {
        showToast({
          title: 'Failed to approve purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendPurchaseOrder(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Purchase order sent', description: result.message, status: 'success' })
        invalidatePurchaseOrders()
      } else {
        showToast({
          title: 'Failed to send purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => closePurchaseOrder(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order closed',
          description: result.message,
          status: 'success',
        })
        invalidatePurchaseOrders()
      } else {
        showToast({
          title: 'Failed to close purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelPurchaseOrder(id, reason),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Purchase order cancelled',
          description: result.message,
          status: 'success',
        })
        invalidatePurchaseOrders()
      } else {
        showToast({
          title: 'Failed to cancel purchase order',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const items = listQuery.data?.data?.data ?? []
  const pagination = {
    total: listQuery.data?.data?.total ?? 0,
    page: listQuery.data?.data?.page ?? 1,
    limit: listQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((listQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    items,
    pagination,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,

    sortDir,
    setSortDir: (v: 'asc' | 'desc') => {
      setSortDirState(v)
      setPage(1)
    },
    statusFilter,
    setStatusFilter: (v: string | undefined) => {
      setStatusFilter(v)
      setPage(1)
    },

    search,
    setSearch: (v: string) => {
      setSearch(v)
      setPage(1)
    },

    supplierId,
    setSupplierId: (v: string | undefined) => {
      setSupplierIdState(v)
      setPage(1)
    },
    branchId,
    setBranchId: (v: string | undefined) => {
      setBranchIdState(v)
      setPage(1)
    },
    resetFilters: () => {
      setSearch('')
      setStatusFilter(undefined)
      setSupplierIdState(undefined)
      setBranchIdState(undefined)
      setPage(1)
    },

    page,
    setPage,
    limit,
    setLimit: (v: number) => {
      setLimitState(v)
      setPage(1)
    },

    createPO: (data: CreatePoFormValues) => createMutation.mutateAsync(data),
    isCreating: createMutation.isPending,

    updatePO: (id: string, data: CreatePoFormValues) => updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,

    convertFromPr: (prId: string, data: ConvertPrToPoFormValues) =>
      convertMutation.mutateAsync({ prId, data }),
    isConverting: convertMutation.isPending,

    approvePO: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,

    sendPO: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,

    closePO: closeMutation.mutateAsync,
    isClosing: closeMutation.isPending,

    cancelPO: ({ id, reason }: { id: string; reason: string }) =>
      cancelMutation.mutateAsync({ id, reason }),
    isCancelling: cancelMutation.isPending,

    refetch: invalidatePurchaseOrders,
  }
}
