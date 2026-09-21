'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type {
  ClassificationOption,
  CreateItemFormValues,
  UomOption,
} from '@/src/schema/inventory/items'
import { createItem } from '../_actions/create-item'
import { getUnitsOfMeasure, getItemBrands } from '../_actions/get-lookup-data'
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
 * Scenario 56 — "Add Item" wherever stock is looked at, not only on the
 * Catalog. Same CreateItemModal and action as Item Master; its lookups share
 * Item Master's cache keys and only load once the modal is opened. A new item
 * refreshes both the catalog and Stock Balance (initial stock may have been
 * recorded with it).
 */
export function AddItemButton({ className }: { className?: string }): React.ReactElement {
  const [open, setOpen] = useState(false)
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'flex items-center gap-2 rounded-lg bg-[#5b21b6] px-3 py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]'
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Add Item
      </button>
      <CreateItemModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmit={(data) => create.mutateAsync(data)}
        isSubmitting={create.isPending}
        categories={flatToCategorySelectOptions(categories.data?.data?.data ?? [])}
        uomOptions={toUomOptions(uom.data?.data)}
        brandOptions={(brands.data?.data ?? []) as ClassificationOption[]}
      />
    </>
  )
}
