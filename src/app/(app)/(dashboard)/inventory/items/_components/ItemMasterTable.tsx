'use client'

import { useState, useEffect, useRef } from 'react'
import { Pencil, Trash2, ChevronDown, Layers, Palette, ExternalLink } from 'lucide-react'
import type { ItemSummary } from '@/src/schema/inventory/items'
import { useUIShell } from '@/src/stores/ui-shell.store'

const LIFECYCLE_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  discontinued: 'bg-orange-100 text-orange-700',
  archived: 'bg-zinc-100 text-zinc-600',
}

type DropdownPos = { top: number; right: number }

type Props = {
  items: ItemSummary[]
  isLoading: boolean
  isFetching: boolean
  canUpdate: boolean
  canDelete: boolean
  canManageLifecycle: boolean
  onEdit: (item: ItemSummary) => void
  onDelete: (item: ItemSummary) => void
  onLifecycleChange: (id: string, lifecycle: 'active' | 'discontinued' | 'archived') => void
  onViewBundle?: (item: ItemSummary) => void
  onViewVariants?: (item: ItemSummary) => void
}

function LifecycleDropdown({
  item,
  onLifecycleChange,
}: {
  item: ItemSummary
  onLifecycleChange: (id: string, lifecycle: 'active' | 'discontinued' | 'archived') => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<DropdownPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node))
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  function handleOpen() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    })
    setOpen(true)
  }

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_COLORS[item.lifecycle ?? 'active'] ?? LIFECYCLE_COLORS.active}`}
      >
        {item.lifecycle ?? 'active'}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {(['active', 'discontinued', 'archived'] as const).map((lc) => (
            <button
              key={lc}
              type="button"
              onClick={() => {
                onLifecycleChange(item.id, lc)
                setOpen(false)
              }}
              className="w-full px-3 py-1.5 text-left text-sm capitalize text-zinc-700 hover:bg-zinc-50"
            >
              {lc}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ItemMasterTable({
  items,
  isLoading,
  isFetching,
  canUpdate,
  canDelete,
  canManageLifecycle,
  onEdit,
  onDelete,
  onLifecycleChange,
  onViewBundle,
  onViewVariants,
}: Props) {
  const { pushPanel } = useUIShell()

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
        <p className="text-sm font-medium text-zinc-500">No items found</p>
        <p className="mt-1 text-xs text-zinc-400">Create your first item to get started.</p>
      </div>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Unit
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Cost Price
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </th>
              {(canUpdate || canDelete || !!onViewBundle || !!onViewVariants) && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer hover:bg-zinc-50"
                onClick={() => pushPanel({ type: 'item360', itemId: item.id, itemName: item.name })}
              >
                <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-700">
                  {item.sku}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">{item.name}</span>
                    {item.isBundle === true && (
                      <span className="rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-prominent-purple-700">
                        Bundle
                      </span>
                    )}
                    {item.hasVariants === true && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        Variants
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{item.primaryCategory?.name ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-500">{item.baseUnit?.code ?? '—'}</td>
                <td className="px-4 py-3 text-right text-zinc-700">
                  {item.costPrice != null
                    ? `₱${Number(item.costPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {canManageLifecycle ? (
                    <LifecycleDropdown item={item} onLifecycleChange={onLifecycleChange} />
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_COLORS[item.lifecycle ?? 'active'] ?? LIFECYCLE_COLORS.active}`}
                    >
                      {item.lifecycle ?? 'active'}
                    </span>
                  )}
                </td>
                {(canUpdate || canDelete || !!onViewBundle || !!onViewVariants) && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          pushPanel({ type: 'item360', itemId: item.id, itemName: item.name })
                        }}
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-700"
                        title="View item details"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      {item.isBundle === true && onViewBundle && (
                        <button
                          type="button"
                          onClick={() => onViewBundle(item)}
                          className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Components
                        </button>
                      )}
                      {!item.isBundle && onViewVariants && (
                        <button
                          type="button"
                          onClick={() => onViewVariants(item)}
                          className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                          <Palette className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
