'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  X,
  Loader2,
  UtensilsCrossed,
  Trash2,
  ChevronRight,
  Search,
  PackageOpen,
  AlertCircle,
  Pencil,
  Check,
} from 'lucide-react'
import {
  getMenuItems,
  createMenuItem,
  deleteMenuItem,
  updateMenuItemPrice,
  getIngredients,
  addIngredient,
  removeIngredient,
  getBundleComponents,
  addBundleComponent,
  removeBundleComponent,
  type MenuItem,
  type MenuItemIngredient,
  type BundleComponent,
} from './_actions/menu-item-actions'
import { itemLookup } from '../_actions/pos-actions'
import { getUnitsOfMeasure } from '../../inventory/items/_actions/get-lookup-data'

// ─── Types ────────────────────────────────────────────────────────────────────

type LookupItem = {
  id: string
  name: string
  sku?: string
  price: number
  uomCode?: string
}

// ─── Ingredient Picker ────────────────────────────────────────────────────────

function IngredientPicker({
  addedIds,
  onAdd,
}: {
  addedIds: Set<string>
  onAdd: (item: LookupItem, qty: number) => void
}) {
  const [allItems, setAllItems] = useState<LookupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<LookupItem | null>(null)
  const [qty, setQty] = useState('1')

  useEffect(() => {
    itemLookup().then((res) => {
      setAllItems(
        ((res.data ?? []) as Record<string, unknown>[])
          .filter((i) => !i.isBundle)
          .map((i) => ({
            id: i.id as string,
            name: i.name as string,
            sku: i.sku as string | undefined,
            price: Number(i.price ?? 0),
            uomCode: i.uomCode as string | undefined,
          }))
      )
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allItems.filter(
      (i) => !q || i.name.toLowerCase().includes(q) || (i.sku?.toLowerCase().includes(q) ?? false)
    )
  }, [allItems, query])

  const handleAdd = () => {
    if (!selected) return
    onAdd(selected, parseFloat(qty) || 1)
    setSelected(null)
    setQty('1')
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
            }}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            placeholder="Search inventory items…"
          />
        </div>
      </div>

      <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading items…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {query ? 'No items match your search' : 'No inventory items found'}
          </div>
        ) : (
          filtered.map((item) => {
            const alreadyAdded = addedIds.has(item.id)
            const isSelected = selected?.id === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={alreadyAdded}
                onClick={() => {
                  setSelected(isSelected ? null : item)
                  setQty('1')
                }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-purple-50'
                    : alreadyAdded
                      ? 'opacity-40 cursor-default'
                      : 'hover:bg-gray-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                  {item.sku && <p className="text-[11px] text-gray-400">{item.sku}</p>}
                </div>
                <span className="text-[11px] text-gray-400 ml-2 shrink-0">
                  {item.uomCode ?? 'pcs'}
                </span>
              </button>
            )
          })
        )}
      </div>

      {selected && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-purple-100 bg-purple-50">
          <span className="flex-1 text-xs font-medium text-gray-700 truncate">{selected.name}</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-right bg-white"
          />
          <span className="text-xs text-gray-400 shrink-0">{selected.uomCode ?? 'pcs'}</span>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Create Menu Item Modal ───────────────────────────────────────────────────

interface IngredientRow {
  itemId: string
  itemName: string
  qty: number
  unit: string
}

function CreateMenuItemModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [baseUnitId, setBaseUnitId] = useState('')
  const [uoms, setUoms] = useState<{ id: string; code: string; name: string }[]>([])
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getUnitsOfMeasure().then((res) => {
      const list = res.data?.data ?? []
      setUoms(list)
      if (list.length > 0) setBaseUnitId(list[0].id)
    })
  }, [])

  const addedIds = useMemo(() => new Set(ingredients.map((i) => i.itemId)), [ingredients])

  const handleAdd = (item: LookupItem, qty: number) => {
    setIngredients((prev) => {
      const existing = prev.find((r) => r.itemId === item.id)
      if (existing) return prev.map((r) => (r.itemId === item.id ? { ...r, qty } : r))
      return [...prev, { itemId: item.id, itemName: item.name, qty, unit: item.uomCode ?? 'pcs' }]
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError('')

    const created = await createMenuItem({
      name: name.trim(),
      sku: sku.trim() || undefined,
      sellingPrice: price ? parseFloat(price) : undefined,
      baseUnitId: baseUnitId || undefined,
    })

    if (!created.success || !created.data) {
      setError(created.error ?? 'Failed to create menu item')
      setSaving(false)
      return
    }

    await Promise.all(
      ingredients.map((ing) => addIngredient(created.data!.id, ing.itemId, ing.qty))
    )

    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">New Menu Item</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-600">Name *</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="Pasta Carbonara"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">SKU</span>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="MENU-001"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Selling Price (₱)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="0.00"
              />
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-600">Serving unit</span>
              <select
                value={baseUnitId}
                onChange={(e) => setBaseUnitId(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="">— none —</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Ingredients / Components</p>
            <IngredientPicker addedIds={addedIds} onAdd={handleAdd} />
            {ingredients.length > 0 && (
              <div className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Added ingredients
                  </p>
                </div>
                {ingredients.map((ing) => (
                  <div key={ing.itemId} className="flex items-center px-3 py-2 bg-white">
                    <span className="flex-1 text-xs text-gray-800 truncate">{ing.itemName}</span>
                    <span className="text-xs font-mono text-gray-600 mr-2">
                      {ing.qty} {ing.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setIngredients((p) => p.filter((r) => r.itemId !== ing.itemId))
                      }
                      className="p-1 text-red-400 hover:text-red-600 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Menu Item'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Ingredients Panel ────────────────────────────────────────────────────────

function IngredientsPanel({
  item,
  onClose,
  onChanged,
}: {
  item: MenuItem
  onClose: () => void
  onChanged: () => void
}) {
  // Unified row type — works for both pos and inventory sources
  type Row = { id: string; itemId: string; itemName: string; quantity: number }

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [itemNames, setItemNames] = useState<Record<string, string>>({})

  useEffect(() => {
    itemLookup().then((res) => {
      const map: Record<string, string> = {}
      for (const i of (res.data ?? []) as Record<string, unknown>[]) {
        if (i.id) map[i.id as string] = i.name as string
      }
      setItemNames(map)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    if (item.source === 'inventory') {
      const comps = await getBundleComponents(item.id)
      setRows(
        comps.map((c) => ({
          id: c.id ?? c.componentItemId ?? '',
          itemId: c.componentItem?.id ?? c.componentItemId ?? '',
          itemName: c.componentItem?.name ?? c.componentItemId ?? '—',
          quantity: Number(c.quantityPerBundle),
        }))
      )
    } else {
      const ings = await getIngredients(item.id)
      setRows(
        ings.map((i) => ({
          id: i.id,
          itemId: i.inventoryItemId,
          itemName: itemNames[i.inventoryItemId] ?? i.inventoryItemId,
          quantity: Number(i.quantity),
        }))
      )
    }
    setLoading(false)
  }, [item.id, item.source, itemNames])

  useEffect(() => {
    load()
  }, [load])

  const addedIds = useMemo(() => new Set(rows.map((r) => r.itemId)), [rows])

  const handleAdd = async (inv: LookupItem, qty: number) => {
    setAdding(true)
    setAddError('')
    const res =
      item.source === 'inventory'
        ? await addBundleComponent(item.id, inv.id, qty)
        : await addIngredient(item.id, inv.id, qty)
    if (!res.success) {
      setAddError(res.error ?? 'Failed to add')
      setAdding(false)
      return
    }
    await load()
    onChanged()
    setAdding(false)
  }

  const handleRemove = async (row: Row) => {
    setRemovingId(row.id)
    const res =
      item.source === 'inventory'
        ? await removeBundleComponent(item.id, row.id)
        : await removeIngredient(item.id, row.id)
    if (res.success) {
      await load()
      onChanged()
    }
    setRemovingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">{item.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Ingredients / Components</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Current ingredients
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                <PackageOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No ingredients added yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-center px-3 py-2.5 bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{row.itemName}</p>
                    </div>
                    <span className="text-sm font-mono text-gray-700 mx-3">{row.quantity}</span>
                    <button
                      onClick={() => handleRemove(row)}
                      disabled={removingId === row.id}
                      className="p-1 text-red-400 hover:text-red-600 rounded disabled:opacity-40"
                    >
                      {removingId === row.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Add ingredient
            </p>
            {adding && (
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…
              </div>
            )}
            {addError && <p className="text-xs text-red-500 mb-2">{addError}</p>}
            <IngredientPicker addedIds={addedIds} onAdd={handleAdd} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuItemsPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [viewItem, setViewItem] = useState<MenuItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [editPriceId, setEditPriceId] = useState<string | null>(null)
  const [editPriceVal, setEditPriceVal] = useState('')
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setItems(await getMenuItems())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startEditPrice = (item: MenuItem) => {
    setEditPriceId(item.id)
    setEditPriceVal(item.sellingPrice != null ? String(item.sellingPrice) : '')
  }

  const savePrice = async (item: MenuItem) => {
    const price = parseFloat(editPriceVal)
    if (isNaN(price) || price < 0) return
    setSavingPriceId(item.id)
    await updateMenuItemPrice(item.id, price, item.source)
    setSavingPriceId(null)
    setEditPriceId(null)
    load()
  }

  const handleDelete = async (item: MenuItem) => {
    setDeletingId(item.id)
    setDeleteError('')
    const res = await deleteMenuItem(item.id, item.source)
    setDeletingId(null)
    if (!res.success) {
      setDeleteError(res.error ?? 'Failed to delete menu item')
      return
    }
    setConfirmDeleteId(null)
    load()
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-3 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-purple-600" /> Menu Items
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            POS-only items whose ingredients are deducted from inventory when sold.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
        >
          <Plus className="w-4 h-4" /> New Menu Item
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {deleteError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {deleteError}
            <button
              onClick={() => setDeleteError('')}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <UtensilsCrossed className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No menu items yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Create your first menu item to get started.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
            >
              <Plus className="w-4 h-4" /> New Menu Item
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">SKU</th>
                  <th className="text-right px-4 py-3">Price</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.sku || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {editPriceId === item.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            step="0.01"
                            value={editPriceVal}
                            onChange={(e) => setEditPriceVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') savePrice(item)
                              if (e.key === 'Escape') setEditPriceId(null)
                            }}
                            className="w-28 px-2 py-1 text-sm text-right border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                          />
                          <button
                            onClick={() => savePrice(item)}
                            disabled={savingPriceId === item.id}
                            className="p-1 text-purple-600 hover:text-purple-800 disabled:opacity-40"
                          >
                            {savingPriceId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditPriceId(null)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 group">
                          <span className="text-gray-700 font-medium">
                            {item.sellingPrice != null
                              ? new Intl.NumberFormat('en-PH', {
                                  style: 'currency',
                                  currency: 'PHP',
                                }).format(item.sellingPrice)
                              : '—'}
                          </span>
                          <button
                            onClick={() => startEditPrice(item)}
                            className="p-1 text-gray-300 hover:text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewItem(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded-lg"
                        >
                          Ingredients <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === item.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                'Confirm'
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateMenuItemModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            load()
            setShowCreate(false)
          }}
        />
      )}
      {viewItem && (
        <IngredientsPanel item={viewItem} onClose={() => setViewItem(null)} onChanged={load} />
      )}
    </div>
  )
}
