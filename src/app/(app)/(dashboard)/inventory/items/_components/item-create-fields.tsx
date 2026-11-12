'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { CONTROL_CHROME } from '@/src/libs/design/plex'
import type { ClassificationOption, CreateItemFormValues } from '@/src/schema/inventory/items'
import { getSuppliers } from '../../purchase-orders/_actions/get-suppliers'
import { errorClass, labelClass } from './itemFormChrome'

type SelectOption = { value: string; label: string }

type CategoryTree = {
  roots: CategorySelectOption[]
  children: Map<string, CategorySelectOption[]>
}

/** Category = root ItemCategory, Subgroup = its child (see the Type /
 * Category / Subgroup labels). The options arrive in tree order, so each
 * depth-1 entry belongs to the last root above it. */
function toCategoryTree(options: CategorySelectOption[]): CategoryTree {
  const roots: CategorySelectOption[] = []
  const children = new Map<string, CategorySelectOption[]>()
  let rootId: string | null = null
  for (const option of options) {
    if (option.depth === 0) {
      roots.push(option)
      children.set(option.id, [])
      rootId = option.id
    } else if (option.depth === 1 && rootId) {
      children.get(rootId)?.push(option)
    }
  }
  return { roots, children }
}

const toSelect = (o: { id: string; name: string }): SelectOption => ({ value: o.id, label: o.name })

/** The root a stored primaryCategoryId belongs to: itself when it is a
 * Category, its parent when it is a Subgroup. */
function rootOf(tree: CategoryTree, id: string): string {
  if (tree.children.has(id)) return id
  for (const [rootId, kids] of tree.children) {
    if (kids.some((k) => k.id === id)) return rootId
  }
  return ''
}

/**
 * Category and Subgroup as two pickers, matching Item Master's columns. The
 * item is filed under the Subgroup (primaryCategoryId); a Category with no
 * subgroups files it under the Category itself. An existing item's value
 * (Edit Item) opens with its Category already picked.
 */
export function CategorySubgroupFields({
  value,
  onChange,
  categories,
  error,
  onCategoryNameChange,
}: {
  value: string
  onChange: (id: string) => void
  categories: CategorySelectOption[]
  error?: string
  onCategoryNameChange?: (name: string) => void
}): React.ReactElement {
  const tree = useMemo(() => toCategoryTree(categories), [categories])
  const [pickedRootId, setRootId] = useState('')
  // Until a Category is picked here, follow the stored value's own root — an
  // existing item (Edit Item) opens with its Category already selected.
  const rootId = pickedRootId || rootOf(tree, value)
  const subgroups = tree.children.get(rootId) ?? []

  function pickRoot(id: string): void {
    setRootId(id)
    onCategoryNameChange?.(tree.roots.find((r) => r.id === id)?.name ?? '')
    onChange((tree.children.get(id) ?? []).length ? '' : id)
  }

  return (
    <>
      <div>
        <label className={labelClass}>
          Category <span className="text-[#b42318]">*</span>
        </label>
        <SearchableSelect
          chrome={CONTROL_CHROME}
          portal
          value={rootId}
          onChange={pickRoot}
          options={tree.roots.map(toSelect)}
          placeholder="Select category…"
          loading={categories.length === 0}
          loadingLabel="Loading categories…"
        />
        {error && !rootId && <p className={errorClass}>{error}</p>}
      </div>
      <div>
        <label className={labelClass}>
          Subgroup {subgroups.length > 0 && <span className="text-[#b42318]">*</span>}
        </label>
        <SearchableSelect
          chrome={CONTROL_CHROME}
          portal
          value={value === rootId ? '' : value}
          onChange={onChange}
          options={subgroups.map(toSelect)}
          disabled={subgroups.length === 0}
          placeholder={rootId && subgroups.length === 0 ? 'No subgroups' : 'Select subgroup…'}
        />
        {error && rootId && <p className={errorClass}>Subgroup is required</p>}
      </div>
    </>
  )
}

/**
 * Item Name defaults to how the ledgers title an item — Brand · Category ·
 * Model — and follows those fields until someone types their own name.
 */
export function useAutoItemName({
  control,
  setValue,
  brandOptions,
  categoryName,
  validate,
  active,
}: {
  control: Control<CreateItemFormValues>
  setValue: UseFormSetValue<CreateItemFormValues>
  brandOptions: ClassificationOption[]
  categoryName: string
  validate: boolean
  /** The overlay stays mounted while closed — start over on each open. */
  active: boolean
}): { onNameTyped: (value: string) => void } {
  const [edited, setEdited] = useState(false)
  const brandId = useWatch({ control, name: 'brandId' })
  const model = useWatch({ control, name: 'modelNumber' })
  const brandName = brandOptions.find((b) => b.id === brandId)?.name

  useEffect(() => {
    if (!active) setEdited(false)
  }, [active])

  useEffect(() => {
    if (edited) return
    const name = [brandName, categoryName, model?.trim()].filter(Boolean).join(' ')
    setValue('name', name, { shouldValidate: validate })
  }, [edited, brandName, categoryName, model, setValue, validate])

  // Clearing the box hands the name back to the auto-fill.
  return { onNameTyped: (value) => setEdited(value.trim() !== '') }
}

/** Initial stock's Origin — a real supplier (the backend links the unit to
 * it by name), or WHSE for internal stock with no trading partner. */
export function useOriginOptions(enabled: boolean): SelectOption[] {
  const suppliers = useQuery({
    queryKey: ['inventory-suppliers-origin'],
    queryFn: () => getSuppliers({ limit: 1000 }),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
  return useMemo(
    () => [
      { value: 'WHSE', label: 'WHSE — internal stock' },
      ...(suppliers.data?.data?.data ?? []).map((s) => ({ value: s.name, label: s.name })),
    ],
    [suppliers.data]
  )
}
