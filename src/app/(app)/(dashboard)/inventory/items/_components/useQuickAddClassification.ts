'use client'

import { useQueryClient } from '@tanstack/react-query'
import type { ApiResponse } from '@/src/libs/api/client'
import type { SearchableSelectEmptyAction } from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { useMe } from '@/src/hooks/useMe'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { createBrand } from '../../brands/_actions/create-brand'
import { deleteBrand } from '../../brands/_actions/delete-brand'
import { createType } from '../../types/_actions/create-type'
import { deleteType } from '../../types/_actions/delete-type'
import { createCategory } from '../../categories/_actions/create-category'
import { deleteCategory } from '../../categories/_actions/delete-category'

export type QuickAddKind = 'brand' | 'type' | 'category'

type Added = { id: string; name: string }

/** Creates the record and answers it, or undefined after toasting why not.
 * The success toast offers Undo, which deletes it again and then calls
 * onUndone so the form can let go of it. */
export type QuickAdd = (typed: string, onUndone: (id: string) => void) => Promise<Added | undefined>

type KindConfig = {
  permission: string
  /** The Add Item / Edit Item lookups share these cache keys. */
  queryKey: string[]
  /** Brands are kept in capitals (KOLIN, PHILIPS…); the rest as typed. */
  normalize: (typed: string) => string
  create: (name: string) => Promise<ApiResponse<unknown>>
  remove: (id: string) => Promise<ApiResponse<void>>
}

const KINDS: Record<QuickAddKind, KindConfig> = {
  brand: {
    permission: INVENTORY_PERMISSIONS.ITEMS_MANAGE_CLASSIFICATION,
    queryKey: ['inventory-item-brands'],
    normalize: (t) => t.trim().toUpperCase(),
    create: (name) => createBrand({ name }),
    remove: deleteBrand,
  },
  type: {
    permission: INVENTORY_PERMISSIONS.ITEMS_MANAGE_CLASSIFICATION,
    queryKey: ['inventory-item-types'],
    normalize: (t) => t.trim(),
    create: (name) => createType({ name }),
    remove: deleteType,
  },
  category: {
    permission: INVENTORY_PERMISSIONS.CATEGORIES_CREATE,
    queryKey: ['inventory-categories-flat'],
    normalize: (t) => t.trim(),
    // A top-level Category, active, with the master-data page's defaults.
    create: (name) =>
      createCategory({ name, displayOrder: 0, status: 'active', allowsCustomAttributes: false }),
    remove: deleteCategory,
  },
}

function newId(result: ApiResponse<unknown>): string | undefined {
  const id = (result.data as { id?: unknown } | undefined)?.id
  return typeof id === 'string' ? id : undefined
}

/**
 * Adds a brand, type or category straight from an item form's picker, then
 * waits for that picker's list to refetch so the new record can be selected.
 * Undefined when the user isn't allowed to create it — no add option shown.
 */
export function useQuickAddClassification(kind: QuickAddKind): QuickAdd | undefined {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const config = KINDS[kind]
  if (!hasPermission(me ?? null, config.permission)) return undefined

  /** Undo — a record nothing uses yet can be deleted; the backend refuses
   * once an item has been saved with it, and that reason is shown. */
  async function undo({ id, name }: Added, onUndone: (id: string) => void): Promise<void> {
    const result = await config.remove(id)
    if (!result.success) {
      showToast({ title: `Couldn't remove ${kind}`, description: result.message, status: 'error' })
      return
    }
    await queryClient.invalidateQueries({ queryKey: config.queryKey })
    onUndone(id)
    showToast({ title: `Removed ${kind} "${name}"`, status: 'info' })
  }

  return async (typed, onUndone) => {
    const name = config.normalize(typed)
    const result = await config.create(name)
    const id = newId(result)
    if (!result.success || !id) {
      showToast({ title: `Couldn't add ${kind}`, description: result.message, status: 'error' })
      return undefined
    }
    await queryClient.invalidateQueries({ queryKey: config.queryKey })
    const added = { id, name }
    showToast({
      title: `Added ${kind} "${name}"`,
      status: 'success',
      action: { label: 'Undo', onClick: () => void undo(added, onUndone) },
    })
    return added
  }
}

/** The picker's "No results — Add …" option for a quick-add, or undefined. */
export function quickAddAction(
  add: QuickAdd | undefined,
  kind: QuickAddKind,
  onAdded: (added: Added) => void,
  onUndone: (id: string) => void
): SearchableSelectEmptyAction | undefined {
  if (!add) return undefined
  return {
    label: (typed) => `Add "${KINDS[kind].normalize(typed)}" as a new ${kind}`,
    onSelect: async (typed) => {
      const added = await add(typed, onUndone)
      if (added) onAdded(added)
    },
  }
}
