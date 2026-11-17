'use client'

import { useRouter } from 'next/navigation'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'
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

type CreateItemResult = Awaited<ReturnType<typeof createItem>>

type ItemLookups = {
  categories: CategorySelectOption[]
  uomOptions: UomOption[]
  brandOptions: ClassificationOption[]
  typeOptions: ClassificationOption[]
}

/** The UoM endpoint answers either a bare array or `{ data: [...] }`. */
function toUomOptions(d: unknown): UomOption[] {
  if (Array.isArray(d)) return d as UomOption[]
  const inner = (d as { data?: unknown } | undefined)?.data
  return Array.isArray(inner) ? (inner as UomOption[]) : []
}

/** Same cache keys as the Items list, so the lookups load once app-wide. */
function useItemLookups(): ItemLookups {
  const opts = { staleTime: LOOKUP_STALE }
  const categories = useQuery({
    ...opts,
    queryKey: ['inventory-categories-flat'],
    queryFn: () => getCategoriesFlat({ limit: 500 }),
  })
  const uom = useQuery({ ...opts, queryKey: ['inventory-uom'], queryFn: () => getUnitsOfMeasure() })
  const brands = useQuery({
    ...opts,
    queryKey: ['inventory-item-brands'],
    queryFn: () => getItemBrands(),
  })
  const types = useQuery({
    ...opts,
    queryKey: ['inventory-item-types'],
    queryFn: () => getItemTypes(),
  })
  return {
    categories: flatToCategorySelectOptions(categories.data?.data?.data ?? []),
    uomOptions: toUomOptions(uom.data?.data),
    brandOptions: (brands.data?.data ?? []) as ClassificationOption[],
    typeOptions: (types.data?.data ?? []) as ClassificationOption[],
  }
}

/** A new item refreshes the catalog and Stock Balance (initial stock may
 * have been recorded with it). */
function useCreateItem(): UseMutationResult<CreateItemResult, Error, CreateItemFormValues> {
  const queryClient = useQueryClient()
  return useMutation({
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
}

/**
 * Master Data's Add Item tab — the Add New Item form shown inline, the same
 * shape as Stock Transaction's Stock Request tab. Moved here from Item
 * Master's tab-strip button. A successful save (item + any initial stock and
 * prices) lands on Item Master, where the new item shows in the list.
 */
export default function AddItemTab(): React.JSX.Element {
  const router = useRouter()
  const lookups = useItemLookups()
  const create = useCreateItem()

  return (
    <CreateItemModal
      variant="page"
      isOpen
      onClose={() => router.push('/inventory/items')}
      onSubmit={(data) => create.mutateAsync(data)}
      isSubmitting={create.isPending}
      {...lookups}
    />
  )
}
