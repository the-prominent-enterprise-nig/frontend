'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { flatToCategorySelectOptions } from '@/src/libs/format/category-tree'
import type {
  ClassificationOption,
  ItemSummary,
  UomOption,
  UpdateItemFormValues,
} from '@/src/schema/inventory/items'
import { getItem } from '../_actions/get-item'
import { updateItem } from '../_actions/update-item'
import { updateItemAttributes } from '../_actions/update-item-attributes'
import { getItemBrands, getItemTypes, getUnitsOfMeasure } from '../_actions/get-lookup-data'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'

/**
 * Everything the Edit item form needs for ONE item, outside the Item Master
 * list — the POS Product Catalog opens it from a row. The lookups share their
 * cache keys with useItemMaster, so whichever screen loads them first serves
 * both. A save refreshes `invalidates` (e.g. the POS catalog) and the Item
 * Master list.
 */
export function useItemEditor(itemId: string | null, invalidates: readonly unknown[][] = []) {
  const queryClient = useQueryClient()
  const enabled = !!itemId
  const lookup = { staleTime: 10 * 60 * 1000, enabled }

  const item = useQuery({
    queryKey: ['inventory-item', itemId],
    queryFn: () => getItem(itemId!),
    enabled,
    staleTime: 0,
  })
  const categories = useQuery({
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
    ...lookup,
  })
  const uom = useQuery({
    queryKey: ['inventory-uom'],
    queryFn: () => getUnitsOfMeasure(),
    ...lookup,
  })
  const brands = useQuery({
    queryKey: ['inventory-item-brands'],
    queryFn: () => getItemBrands(),
    ...lookup,
  })
  const types = useQuery({
    queryKey: ['inventory-item-types'],
    queryFn: () => getItemTypes(),
    ...lookup,
  })

  const refresh = (): void => {
    for (const key of [['inventory-items'], ['inventory-item', itemId], ...invalidates]) {
      void queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const update = useMutation({
    mutationFn: (data: UpdateItemFormValues) => updateItem(itemId!, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Item updated', description: result.message, status: 'success' })
        refresh()
      } else {
        showToast({ title: 'Failed to update item', description: result.message, status: 'error' })
      }
    },
  })
  const updateAttributes = useMutation({
    mutationFn: (attributes: Record<string, string>) => updateItemAttributes(itemId!, attributes),
    onSuccess: (result) => {
      if (result.success) refresh()
    },
  })

  return {
    item: (item.data?.data ?? null) as ItemSummary | null,
    isLoading: item.isLoading,
    categories: flatToCategorySelectOptions(categories.data?.data?.data ?? []),
    uomOptions: uomOptionsOf(uom.data?.data),
    brandOptions: (brands.data?.data ?? []) as ClassificationOption[],
    typeOptions: (types.data?.data ?? []) as ClassificationOption[],
    update: update.mutateAsync,
    isUpdating: update.isPending,
    updateAttributes: updateAttributes.mutateAsync,
    isUpdatingAttributes: updateAttributes.isPending,
  }
}

/** The units endpoint answers with a bare array or `{ data: [...] }`. */
function uomOptionsOf(d: unknown): UomOption[] {
  if (!d) return []
  if (Array.isArray(d)) return d as UomOption[]
  const nested = (d as { data?: unknown }).data
  return Array.isArray(nested) ? (nested as UomOption[]) : []
}
