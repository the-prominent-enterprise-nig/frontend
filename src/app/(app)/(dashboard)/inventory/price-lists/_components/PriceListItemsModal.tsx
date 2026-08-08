'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import { getPriceList } from '../_actions/get-price-list'
import { upsertPriceListItem } from '../_actions/upsert-price-list-items'
import { removePriceListItem } from '../_actions/remove-price-list-item'
import { humanizePriceListError } from '../_lib/humanize-error'
import type { PriceList, PriceListItem } from '@/src/schema/inventory/price-lists'

type Props = {
  open: boolean
  onClose: () => void
  priceList: PriceList | null
  canEdit: boolean
  /** Called after a successful add/remove — refreshes the outer price-lists
   * table's own (separately-cached) query, since an edit here can change
   * this list's status server-side and that table shows the status badge. */
  onItemsChanged?: () => void
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const emptyForm = { itemId: '', price: '', floorPrice: '', minQty: '' }

export function PriceListItemsModal({ open, onClose, priceList, canEdit, onItemsChanged }: Props) {
  const [items, setItems] = useState<PriceListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  // Tracks this list's status independently of the `priceList` prop, which
  // is a snapshot taken when the parent opened this modal and never updates
  // afterward — without this, a second edit in the same still-open session
  // would still think the list is 'active' even after a first edit already
  // reverted it, showing the wrong banner/toast on that second edit.
  // Resynced during render (not an effect) whenever a genuinely different
  // list is opened, per React's "adjusting state when a prop changes"
  // pattern — avoids an extra render pass and the set-state-in-effect lint.
  const [localStatus, setLocalStatus] = useState(priceList?.status)
  const [syncedForId, setSyncedForId] = useState(priceList?.id)
  if (priceList?.id !== syncedForId) {
    setSyncedForId(priceList?.id)
    setLocalStatus(priceList?.status)
  }

  const load = useCallback(async () => {
    if (!priceList) return
    setIsLoading(true)
    const res = await getPriceList(priceList.id)
    setItems(res.data?.items ?? [])
    setIsLoading(false)
  }, [priceList])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  if (!open || !priceList) return null

  function handleClose() {
    setShowAddForm(false)
    setForm(emptyForm)
    onClose()
  }

  // Both item actions can flip an active list back to pending_approval
  // server-side (see revertToPendingIfActive on the backend) — surface that
  // as its own toast rather than a generic "saved", since it means the
  // change doesn't affect checkout until someone re-approves it.
  function notifyIfRevertedToPending(listStatus: unknown, verb: string) {
    if (listStatus === 'pending_approval' && localStatus === 'active') {
      setLocalStatus('pending_approval')
      showToast({
        title: `Item ${verb} — list back in Pending Approval`,
        description: 'This list was active and has stopped applying at checkout until re-approved.',
        status: 'success',
      })
    } else {
      showToast({ title: `Item ${verb}`, status: 'success' })
    }
  }

  // `keepFormOpen` powers "Save & Add Another" — pricing a whole list is
  // normally many items in a row, and closing the form after every single
  // one meant reopening it (and re-searching) for each. Keeping it open just
  // skips that round-trip; the save itself is identical either way.
  async function handleAdd(keepFormOpen: boolean) {
    if (!form.itemId || form.price === '') return
    setIsSaving(true)
    const res = await upsertPriceListItem(priceList!.id, {
      itemId: form.itemId,
      price: Number(form.price),
      floorPrice: form.floorPrice ? Number(form.floorPrice) : undefined,
      minQty: form.minQty ? Number(form.minQty) : undefined,
    })
    setIsSaving(false)
    if (res.success) {
      const data = res.data as { listStatus?: string } | undefined
      notifyIfRevertedToPending(data?.listStatus, 'saved')
      setForm(emptyForm)
      setShowAddForm(keepFormOpen)
      await load()
      onItemsChanged?.()
    } else {
      showToast({
        title: 'Failed to save item',
        description: humanizePriceListError(res.message),
        status: 'error',
      })
    }
  }

  async function handleRemove(item: PriceListItem) {
    if (!confirm(`Remove ${item.item.name} from this price list?`)) return
    const res = await removePriceListItem(priceList!.id, item.itemId)
    if (res.success) {
      const data = res.data as { listStatus?: string } | undefined
      notifyIfRevertedToPending(data?.listStatus, 'removed')
      await load()
      onItemsChanged?.()
    } else {
      showToast({
        title: 'Failed to remove',
        description: humanizePriceListError(res.message),
        status: 'error',
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Manage Items</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{priceList.name}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!canEdit && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              This list is {priceList.status.replace('_', ' ')} — items are read-only. Create a new
              version to make changes.
            </div>
          )}
          {canEdit && localStatus === 'active' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
              This list is currently active. Saving a change here moves the whole list back to
              Pending Approval — it stops applying at checkout entirely (not just this item) until
              someone re-approves it.
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{items.length} item(s) in this list</p>
            {canEdit && !showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="space-y-3 rounded-xl border border-prominent-purple-200 bg-prominent-purple-50 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Item <span className="text-red-500">*</span>
                </label>
                <ItemSearchCombobox
                  value={form.itemId}
                  onChange={(itemId) => setForm((f) => ({ ...f, itemId }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Floor Price <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.floorPrice}
                    onChange={(e) => setForm((f) => ({ ...f, floorPrice: e.target.value }))}
                    placeholder="0.00"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Min Qty <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.minQty}
                    onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
                    placeholder="1"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setForm(emptyForm)
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAdd(true)}
                  disabled={isSaving || !form.itemId || form.price === ''}
                  className="flex items-center gap-1.5 rounded-lg border border-prominent-purple-200 px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save & Add Another
                </button>
                <button
                  type="button"
                  onClick={() => handleAdd(false)}
                  disabled={isSaving || !form.itemId || form.price === ''}
                  className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400">
              No items yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2">Floor Price</th>
                    <th className="px-4 py-2">Min Qty</th>
                    {canEdit && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((i) => (
                    <tr key={i.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-zinc-800">{i.item.name}</div>
                        <div className="text-xs text-zinc-400">
                          {i.variant?.variantSku ?? i.item.sku}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        ₱{Number(i.price).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        {i.floorPrice != null ? `₱${Number(i.floorPrice).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{i.minQty ?? '—'}</td>
                      {canEdit && (
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => handleRemove(i)}
                            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
