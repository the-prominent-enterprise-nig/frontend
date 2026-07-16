'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getItems } from '../../items/_actions/get-items'
import { getItemBarcodes } from '../_actions/get-item-barcodes'
import { generateBarcode } from '../_actions/generate-barcode'
import { createBarcode } from '../_actions/create-barcode'
import { deleteBarcode } from '../_actions/delete-barcode'
import { bulkGenerateBarcodes } from '../_actions/bulk-generate-barcodes'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { BarcodeType, CreateBarcodeFormValues } from '@/src/schema/inventory/barcodes'

export function useBarcodeManager() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const itemsQuery = useQuery({
    queryKey: ['barcode-items', { page, search }],
    queryFn: () => getItems({ page, limit: 20, search: search || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const barcodesQuery = useQuery({
    queryKey: ['item-barcodes', selectedItem?.id],
    queryFn: () => getItemBarcodes(selectedItem!.id),
    enabled: !!selectedItem,
    staleTime: 30 * 1000,
  })

  const generateMutation = useMutation({
    mutationFn: ({ itemId, barcodeType }: { itemId: string; barcodeType: BarcodeType }) =>
      generateBarcode(itemId, { barcodeType }),
    onSuccess: (result, { itemId }) => {
      if (result.success) {
        showToast({ title: 'Barcode generated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['item-barcodes', itemId] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: CreateBarcodeFormValues }) =>
      createBarcode(itemId, data),
    onSuccess: (result, { itemId }) => {
      if (result.success) {
        showToast({ title: 'Barcode added', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['item-barcodes', itemId] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ itemId, barcodeId }: { itemId: string; barcodeId: string }) =>
      deleteBarcode(itemId, barcodeId),
    onSuccess: (result, { itemId }) => {
      if (result.success) {
        showToast({ title: 'Barcode deleted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['item-barcodes', itemId] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const bulkMutation = useMutation({
    mutationFn: ({ itemIds, barcodeType }: { itemIds: string[]; barcodeType: BarcodeType }) =>
      bulkGenerateBarcodes({ itemIds, barcodeType }),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Barcodes generated', description: result.message, status: 'success' })
        setSelectedIds(new Set())
        queryClient.invalidateQueries({ queryKey: ['barcode-items'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll(items: ItemSummary[]) {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)))
    }
  }

  const items = itemsQuery.data?.data?.data ?? []
  const pagination = {
    total: itemsQuery.data?.data?.total ?? 0,
    page: itemsQuery.data?.data?.page ?? 1,
    limit: itemsQuery.data?.data?.limit ?? 20,
    totalPages: Math.ceil((itemsQuery.data?.data?.total ?? 0) / 20),
  }

  return {
    items,
    pagination,
    isLoading: itemsQuery.isLoading,
    isFetching: itemsQuery.isFetching,
    search,
    setSearch,
    page,
    setPage,
    selectedItem,
    setSelectedItem,
    itemBarcodes: barcodesQuery.data?.data ?? [],
    isLoadingBarcodes: barcodesQuery.isLoading,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    generateBarcode: (itemId: string, barcodeType: BarcodeType) =>
      generateMutation.mutateAsync({ itemId, barcodeType }),
    isGenerating: generateMutation.isPending,
    addBarcode: (itemId: string, data: CreateBarcodeFormValues) =>
      createMutation.mutateAsync({ itemId, data }),
    isAdding: createMutation.isPending,
    deleteBarcode: (itemId: string, barcodeId: string) =>
      deleteMutation.mutateAsync({ itemId, barcodeId }),
    isDeleting: deleteMutation.isPending,
    bulkGenerate: (itemIds: string[], barcodeType: BarcodeType) =>
      bulkMutation.mutateAsync({ itemIds, barcodeType }),
    isBulkGenerating: bulkMutation.isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['barcode-items'] }),
  }
}
