'use client'

import { useState, useEffect, useRef } from 'react'
import {
  useBranchPricing,
  useCreateBranchPricing,
  useUpdateBranchPricing,
  useDeleteBranchPricing,
  useBranches,
} from '../_hooks/usePos'
import { itemLookup } from '../_actions/pos-actions'
import { DollarSign, Plus, Pencil, Trash2, X, RefreshCw, ChevronDown, Search } from 'lucide-react'
import type {
  BranchPricing,
  CreateBranchPricingInput,
  UpdateBranchPricingInput,
} from '@/src/schema/pos'

interface LookupItem {
  id: string
  name: string
  sku?: string
  price?: number
  taxRate?: number | null
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

function formatDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; record: BranchPricing }
  | { type: 'delete'; record: BranchPricing }

export default function BranchPricingPage() {
  const { data, isLoading, isFetching, refetch } = useBranchPricing()
  const createMutation = useCreateBranchPricing()
  const updateMutation = useUpdateBranchPricing()
  const deleteMutation = useDeleteBranchPricing()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')
  const [itemMap, setItemMap] = useState<Record<string, LookupItem>>({})

  useEffect(() => {
    itemLookup(undefined, undefined, 500).then((res) => {
      if (!res.success) return
      const map: Record<string, LookupItem> = {}
      for (const item of (res.data ?? []) as LookupItem[]) {
        map[item.id] = item
      }
      setItemMap(map)
    })
  }, [])

  const records: BranchPricing[] = data?.data ?? []

  async function handleCreate(form: CreateBranchPricingInput) {
    setError('')
    const res = await createMutation.mutateAsync(form)
    if (!res.success) {
      setError(res.error ?? 'Failed')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleUpdate(id: string, form: UpdateBranchPricingInput) {
    setError('')
    const res = await updateMutation.mutateAsync({ id, input: form })
    if (!res.success) {
      setError(res.error ?? 'Failed')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleDelete(id: string) {
    setError('')
    const res = await deleteMutation.mutateAsync(id)
    if (!res.success) {
      setError(res.error ?? 'Failed')
      return
    }
    setModal({ type: 'none' })
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Branch Pricing</h1>
            <p className="mt-1 text-sm text-gray-500">
              Override item prices per branch with effective date ranges.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => {
                setError('')
                setModal({ type: 'create' })
              }}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              <Plus size={14} />
              Add Override
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4">
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <DollarSign size={40} />
              <p className="text-sm">No branch price overrides yet.</p>
              <button
                onClick={() => setModal({ type: 'create' })}
                className="text-sm text-purple-600 hover:underline"
              >
                Add the first override
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Branch
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Item
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Price
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Tax Rate
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Pricing Mode
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Effective From
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Effective To
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 align-top font-medium text-gray-800">
                      {r.branch?.name ?? r.branchId}
                    </td>
                    <td className="px-5 py-3 align-top max-w-[220px]">
                      <div className="font-medium text-gray-800 truncate">
                        {itemMap[r.itemId]?.name ?? r.item?.name ?? '—'}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400 truncate">{r.itemId}</div>
                    </td>
                    <td className="px-5 py-3 align-top text-right font-semibold text-gray-900">
                      {formatCurrency(r.price)}
                    </td>
                    <td className="px-5 py-3 align-top text-right text-gray-600">
                      {r.taxRate != null ? `${r.taxRate}%` : '—'}
                    </td>
                    <td className="px-5 py-3 align-top">
                      {r.pricingMode ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.pricingMode === 'inclusive' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {r.pricingMode === 'inclusive' ? 'Incl.' : 'Excl.'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-gray-600">
                      {formatDate(r.effectiveFrom)}
                    </td>
                    <td className="px-5 py-3 align-top text-gray-600">
                      {formatDate(r.effectiveTo)}
                    </td>
                    <td className="px-5 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'edit', record: r })
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'delete', record: r })
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal.type === 'create' && (
        <PricingModal
          title="Add Price Override"
          itemMap={itemMap}
          error={error}
          isLoading={createMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleCreate(f as CreateBranchPricingInput)}
        />
      )}
      {modal.type === 'edit' && (
        <PricingModal
          title="Edit Price Override"
          initial={modal.record}
          itemMap={itemMap}
          error={error}
          isLoading={updateMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleUpdate(modal.record.id, f)}
        />
      )}
      {modal.type === 'delete' && (
        <ConfirmModal
          message={`Delete price override for item "${itemMap[modal.record.itemId]?.name ?? modal.record.item?.name ?? modal.record.itemId}"?`}
          error={error}
          isLoading={deleteMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onConfirm={() => handleDelete(modal.record.id)}
        />
      )}
    </div>
  )
}

function PricingModal({
  title,
  initial,
  itemMap,
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  title: string
  initial?: BranchPricing
  itemMap: Record<string, LookupItem>
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: Partial<CreateBranchPricingInput>) => void
}) {
  const { data: branchesData, isLoading: branchesLoading } = useBranches()
  const branches = (branchesData?.data ?? []) as Array<{ id: string; name: string }>

  const [form, setForm] = useState({
    branchId: initial?.branchId ?? '',
    itemId: initial?.itemId ?? '',
    price: initial?.price ?? 0,
    taxRate: initial?.taxRate != null ? String(initial.taxRate) : '',
    pricingMode: initial?.pricingMode ?? '',
    effectiveFrom: initial?.effectiveFrom?.slice(0, 10) ?? '',
    effectiveTo: initial?.effectiveTo?.slice(0, 10) ?? '',
    notes: initial?.notes ?? '',
  })

  // Item search state (create mode only)
  const [selectedItem, setSelectedItem] = useState<LookupItem | null>(
    initial?.item ? { id: initial.item.id, name: initial.item.name } : null
  )
  const [itemQuery, setItemQuery] = useState('')
  const [itemResults, setItemResults] = useState<LookupItem[]>([])
  const [itemSearchOpen, setItemSearchOpen] = useState(false)
  const itemTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (itemBlurTimer.current) clearTimeout(itemBlurTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!itemQuery.trim()) {
      setItemResults([])
      setItemSearchOpen(false)
      return
    }
    if (itemTimer.current) clearTimeout(itemTimer.current)
    itemTimer.current = setTimeout(async () => {
      const res = await itemLookup(itemQuery.trim(), undefined, 20)
      setItemResults((res.data ?? []) as LookupItem[])
      setItemSearchOpen(true)
    }, 300)
    return () => {
      if (itemTimer.current) clearTimeout(itemTimer.current)
    }
  }, [itemQuery])

  function pickItem(item: LookupItem) {
    setSelectedItem(item)
    setForm((p) => ({
      ...p,
      itemId: item.id,
      price: item.price ?? p.price,
      taxRate: item.taxRate != null ? String(item.taxRate) : p.taxRate,
    }))
    setItemQuery('')
    setItemResults([])
    setItemSearchOpen(false)
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        {!initial && (
          <>
            <Field label="Branch">
              <div className="relative">
                <select
                  className="select"
                  value={form.branchId}
                  onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                  disabled={branchesLoading}
                >
                  <option value="">
                    {branchesLoading ? 'Loading branches…' : 'Select a branch…'}
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </Field>
            <Field label="Item">
              {selectedItem ? (
                <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedItem.name}</p>
                    <p className="font-mono text-[10px] text-gray-400">{selectedItem.id}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedItem(null)
                      setForm((p) => ({ ...p, itemId: '' }))
                    }}
                    className="text-purple-300 hover:text-purple-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    className="input"
                    style={{ paddingLeft: '2.25rem' }}
                    placeholder="Search item by name or SKU…"
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    onBlur={() => {
                      itemBlurTimer.current = setTimeout(() => setItemSearchOpen(false), 150)
                    }}
                  />
                  {itemSearchOpen && itemResults.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                      {itemResults.map((item) => (
                        <button
                          key={item.id}
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-purple-50"
                          onMouseDown={() => pickItem(item)}
                        >
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-2">
                            {item.sku && <p className="text-[10px] text-gray-400">{item.sku}</p>}
                            <p className="font-mono text-[10px] text-gray-300">{item.id}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
          </>
        )}
        {initial && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-gray-500">Item</p>
            <p className="text-sm font-semibold text-gray-900">
              {itemMap[initial.itemId]?.name ?? initial.item?.name ?? '—'}
            </p>
            <p className="font-mono text-[10px] text-gray-400">{initial.itemId}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₱)">
            <input
              className="input"
              type="number"
              min={0}
              step={0.01}
              value={form.price === 0 ? '' : form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
            />
          </Field>
          <Field label="Tax Rate (%)">
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="e.g. 12"
              value={form.taxRate}
              onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Pricing Mode">
          <div className="relative">
            <select
              className="select"
              value={form.pricingMode}
              onChange={(e) => setForm((p) => ({ ...p, pricingMode: e.target.value }))}
            >
              <option value="">— Use tenant default —</option>
              <option value="inclusive">Inclusive (VAT already in price)</option>
              <option value="exclusive">Exclusive (VAT added at checkout)</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Effective From">
            <input
              className="input"
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
            />
          </Field>
          <Field label="Effective To">
            <input
              className="input"
              type="date"
              value={form.effectiveTo}
              onChange={(e) => setForm((p) => ({ ...p, effectiveTo: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Notes">
          <input
            className="input"
            placeholder="Optional"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() =>
            onSubmit({
              ...form,
              price: form.price,
              taxRate: form.taxRate !== '' ? parseFloat(form.taxRate) : undefined,
              pricingMode: (form.pricingMode as 'inclusive' | 'exclusive') || undefined,
              effectiveFrom: form.effectiveFrom || undefined,
              effectiveTo: form.effectiveTo || undefined,
              notes: form.notes || undefined,
            })
          }
          disabled={isLoading || (!initial && (!form.branchId || !selectedItem))}
          className="btn-primary"
        >
          {isLoading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Overlay>
  )
}

function ConfirmModal({
  message,
  error,
  isLoading,
  onClose,
  onConfirm,
}: {
  message: string
  error: string
  isLoading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Overlay onClose={onClose}>
      <p className="mb-4 text-gray-700">{message}</p>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          {children}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}
