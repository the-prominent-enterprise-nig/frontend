'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getValuation } from '../_actions/get-valuation'
import { issueStock } from '../_actions/issue-stock'
import { previewCogs } from '../_actions/preview-cogs'
import { createRevaluation } from '../_actions/create-revaluation'
import { updateItemCostingMethod } from '../_actions/update-item-costing-method'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type {
  IssueStockFormValues,
  CreateRevaluationFormValues,
  UpdateItemCostingMethodFormValues,
} from '@/src/schema/inventory/costing'

export function useCosting() {
  const queryClient = useQueryClient()
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>()

  // ─── Valuation ──────────────────────────────────────────────────────────────
  const valuationQuery = useQuery({
    queryKey: ['inventory-costing-valuation', warehouseFilter],
    queryFn: () => getValuation(warehouseFilter ? { warehouseId: warehouseFilter } : undefined),
    staleTime: 2 * 60 * 1000,
  })

  // ─── Lookup data ────────────────────────────────────────────────────────────
  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 10 * 60 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-costing-lookup'],
    queryFn: () => getItems({ limit: 200, lifecycle: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  // ─── Issue stock ────────────────────────────────────────────────────────────
  const issueMutation = useMutation({
    mutationFn: (data: IssueStockFormValues) => issueStock(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Stock issued',
          description: `COGS: ₱${result.data?.cogsAmount?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '—'}`,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-costing-valuation'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
      } else {
        showToast({ title: 'Issue failed', description: result.message, status: 'error' })
      }
    },
  })

  // ─── Revaluation ────────────────────────────────────────────────────────────
  const revaluationMutation = useMutation({
    mutationFn: (data: CreateRevaluationFormValues) => createRevaluation(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Revaluation recorded', status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-costing-config'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-costing-valuation'] })
      } else {
        showToast({ title: 'Revaluation failed', description: result.message, status: 'error' })
      }
    },
  })

  // ─── Per-item method override ────────────────────────────────────────────────
  const itemMethodMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateItemCostingMethodFormValues }) =>
      updateItemCostingMethod(itemId, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item costing method updated', status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-costing-valuation'] })
      } else {
        showToast({ title: 'Update failed', description: result.message, status: 'error' })
      }
    },
  })

  const warehouseOptions = (() => {
    const d = warehousesQuery.data?.data
    if (!d) return []
    const arr = Array.isArray(d)
      ? d
      : Array.isArray((d as { data?: unknown }).data)
        ? (d as { data: { id: string; code: string; name: string }[] }).data
        : []
    return arr
  })()

  const itemOptions = itemsQuery.data?.data?.data ?? []

  return {
    // Valuation
    valuation: valuationQuery.data?.data ?? null,
    isLoadingValuation: valuationQuery.isLoading,
    isFetchingValuation: valuationQuery.isFetching,
    valuationError: valuationQuery.error,
    warehouseFilter,
    setWarehouseFilter,

    // Lookup data
    warehouseOptions,
    itemOptions,

    // Issue stock
    issueStock: issueMutation.mutateAsync,
    isIssuing: issueMutation.isPending,

    // COGS preview (called ad-hoc, not a persistent query)
    previewCogs,

    // Revaluation
    createRevaluation: revaluationMutation.mutateAsync,
    isRevaluing: revaluationMutation.isPending,

    // Per-item method
    updateItemMethod: (itemId: string, data: UpdateItemCostingMethodFormValues) =>
      itemMethodMutation.mutateAsync({ itemId, data }),
    isUpdatingItemMethod: itemMethodMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-costing-valuation'] }),
  }
}
