'use client'

import { useQuery } from '@tanstack/react-query'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { ItemTagLabel } from '@/src/schema/inventory/items'
import ItemImageGallery from '@/src/app/(app)/(dashboard)/inventory/items/_components/ItemImageGallery'
import { getItemTags } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/item-tags'
import { STALE } from '@/src/libs/query/stale-times'
import { displayClassificationLabel } from '@/src/libs/format/text'

const COSTING_LABELS: Record<string, string> = {
  fifo: 'FIFO',
  lifo: 'LIFO',
  weighted_average: 'Weighted Avg',
}

const TAG_COLORS: Record<ItemTagLabel, string> = {
  best_seller: 'bg-amber-100 text-amber-700',
  holiday: 'bg-red-100 text-red-700',
  clearance: 'bg-blue-100 text-blue-700',
  new_arrival: 'bg-green-100 text-green-700',
}

const TAG_LABELS: Record<ItemTagLabel, string> = {
  best_seller: 'Best Seller',
  holiday: 'Holiday',
  clearance: 'Clearance',
  new_arrival: 'New Arrival',
}

const VALID_TAGS: string[] = Object.keys(TAG_LABELS)

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-sm text-zinc-800">{value ?? '—'}</p>
    </div>
  )
}

export default function OverviewTab({ item }: { item: ItemSummary }) {
  const costPrice =
    item.costPrice != null
      ? `₱${Number(item.costPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
      : '—'
  const sellingPrice =
    item.sellingPrice != null
      ? `₱${Number(item.sellingPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
      : '—'

  const { data: tagsData } = useQuery({
    queryKey: ['item-tags', item.id],
    queryFn: () => getItemTags(item.id),
    staleTime: STALE.OPERATIONAL,
  })

  const rawTags = tagsData?.data
  const tags: ItemTagLabel[] = Array.isArray(rawTags)
    ? rawTags
        .map((entry: unknown) =>
          typeof entry === 'string' ? entry : (entry as { tag?: string })?.tag
        )
        .filter((t): t is ItemTagLabel => typeof t === 'string' && VALID_TAGS.includes(t))
    : []

  const hasPhysical =
    item.lengthCm != null ||
    item.widthCm != null ||
    item.heightCm != null ||
    item.weightKg != null ||
    item.warrantyPeriodDays != null

  const hasClassification = !!item.brand || !!item.type || !!item.modelNumber

  // Category doubles as "group/subgroup": primaryCategory is the leaf
  // (subgroup) when it has a parent, in which case the parent is the group.
  // When primaryCategory has no parent, it IS the group and there's no
  // subgroup chosen.
  const hasParentCategory = !!item.primaryCategory?.parentCategory
  const categoryName = hasParentCategory
    ? item.primaryCategory?.parentCategory?.name
    : item.primaryCategory?.name
  const subcategoryName = hasParentCategory ? item.primaryCategory?.name : undefined

  return (
    <div className="space-y-6 p-5">
      {/* Images */}
      <ItemImageGallery itemId={item.id} />

      {/* Identity */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" value={displayClassificationLabel(categoryName)} />
        <Field label="Subcategory" value={displayClassificationLabel(subcategoryName)} />
        <Field label="Unit of Measure" value={item.baseUnit?.name} />
        <Field label="Costing Method" value={COSTING_LABELS[(item as any).costingMethod] ?? '—'} />
      </div>

      {/* Classification */}
      {hasClassification && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Classification
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brand" value={displayClassificationLabel(item.brand?.name)} />
            <Field label="Model Number" value={item.modelNumber} />
            <Field label="Item Type" value={displayClassificationLabel(item.type?.name)} />
          </div>
        </div>
      )}

      {/* Pricing */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Pricing</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cost Price" value={costPrice} />
          <Field label="Selling Price" value={sellingPrice} />
        </div>
      </div>

      {/* Physical (INV-38 + INV-45) */}
      {hasPhysical && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Physical
          </p>
          <div className="grid grid-cols-2 gap-4">
            {(item.lengthCm != null || item.widthCm != null || item.heightCm != null) && (
              <Field
                label="Dimensions (L×W×H)"
                value={`${item.lengthCm ?? '—'} × ${item.widthCm ?? '—'} × ${item.heightCm ?? '—'} cm`}
              />
            )}
            {item.weightKg != null && <Field label="Weight" value={`${item.weightKg} kg`} />}
            {item.warrantyPeriodDays != null && (
              <Field
                label="Warranty"
                value={`${item.warrantyPeriodDays} day${item.warrantyPeriodDays !== 1 ? 's' : ''}`}
              />
            )}
          </div>
        </div>
      )}

      {/* Tags (INV-54) */}
      {tags.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Tags</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_COLORS[tag]}`}
              >
                {TAG_LABELS[tag]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {item.description && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Description
          </p>
          <p className="text-sm leading-relaxed text-zinc-600">{item.description}</p>
        </div>
      )}
    </div>
  )
}
