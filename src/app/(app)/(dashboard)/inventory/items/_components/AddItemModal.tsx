'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type {
  ClassificationOption,
  CreateItemFormValues,
  UomOption,
} from '@/src/schema/inventory/items'
import { createItem } from '../_actions/create-item'
import { getUnitsOfMeasure, getItemBrands, getItemTypes } from '../_actions/get-lookup-data'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import CreateItemModal from './CreateItemModal'

const LOOKUP_STALE = 10 * 60 * 1000

/** The UoM endpoint answers either a bare array or `{ data: [...] }`. */
function toUomOptions(d: unknown): UomOption[] {
  if (Array.isArray(d)) return d as UomOption[]
  const inner = (d as { data?: unknown } | undefined)?.data
  return Array.isArray(inner) ? (inner as UomOption[]) : []
}

/**
 * Item Master's Add Item (WH-03 moved it there from Stock Ledger). Opened by
 * the button in the hub's tab strip, but rendered by the hub itself rather
 * than beside that button: CreateItemModal fills its nearest positioned
 * ancestor, and inside the sticky strip that is the strip. Same modal and
 * action as the Items list; its lookups share that list's cache keys and only
 * load once opened. A new item refreshes both the catalog and Stock Balance
 * (initial stock may have been recorded with it).
 */
export function AddItemModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.ReactElement {
  const queryClient = useQueryClient()

  const categories = useQuery({
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
    staleTime: LOOKUP_STALE,
    enabled: open,
  })
  const uom = useQuery({
    queryKey: ['inventory-uom'],
    queryFn: () => getUnitsOfMeasure(),
    staleTime: LOOKUP_STALE,
    enabled: open,
  })
  const brands = useQuery({
    queryKey: ['inventory-item-brands'],
    queryFn: () => getItemBrands(),
    staleTime: LOOKUP_STALE,
    enabled: open,
  })

  const types = useQuery({
    queryKey: ['inventory-item-types'],
    queryFn: () => getItemTypes(),
    staleTime: LOOKUP_STALE,
    enabled: open,
  })

  const create = useMutation({
    mutationFn: (data: CreateItemFormValues) => createItem(data),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed to create item', description: result.message, status: 'error' })
        return
      }
      showToast({ title: 'Item created', description: result.message, status: 'success' })
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
    },
  })

  return (
    <CreateItemModal
      isOpen={open}
      onClose={onClose}
      onSubmit={(data) => create.mutateAsync(data)}
      isSubmitting={create.isPending}
      categories={flatToCategorySelectOptions(categories.data?.data?.data ?? [])}
      uomOptions={toUomOptions(uom.data?.data)}
      brandOptions={(brands.data?.data ?? []) as ClassificationOption[]}
      typeOptions={(types.data?.data ?? []) as ClassificationOption[]}
    />
  )
}
