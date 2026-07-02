'use client'

import { useState, useEffect } from 'react'
import {
  usePromoCodes,
  useCreatePromoCode,
  useUpdatePromoCode,
  useDeletePromoCode,
} from '../_hooks/usePos'
import { RefreshCw, Tag, Plus, Pencil, Trash2, X, ChevronDown } from 'lucide-react'
import { PosDate } from '../_components/PosDate'
import type { PromoCode, CreatePromoCodeInput, UpdatePromoCodeInput } from '@/src/schema/pos'

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-500',
}

const discountTypeLabel: Record<string, string> = {
  percentage: 'Percentage',
  fixed_amount: 'Fixed Amount',
  bogo: 'Buy One Get One',
}

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; promo: PromoCode }
  | { type: 'delete'; promo: PromoCode }

export default function PromoCodesPage() {
  const { data, isLoading, isFetching, refetch } = usePromoCodes()
  const createMutation = useCreatePromoCode()
  const updateMutation = useUpdatePromoCode()
  const deleteMutation = useDeletePromoCode()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')

  const promos: PromoCode[] = data?.data ?? []

  async function handleCreate(form: CreatePromoCodeInput) {
    setError('')
    const res = await createMutation.mutateAsync(form)
    if (!res.success) {
      setError(res.error ?? 'Failed')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleUpdate(id: string, form: UpdatePromoCodeInput) {
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
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
            <p className="mt-1 text-sm text-gray-500">Manage discount and promotional codes.</p>
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
              New Promo Code
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4">
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : promos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Tag size={40} />
              <p className="text-sm">No promo codes yet.</p>
              <button
                onClick={() => setModal({ type: 'create' })}
                className="text-sm text-purple-600 hover:underline"
              >
                Add the first promo code
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Code
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Discount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Valid Until
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Uses
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono font-semibold text-gray-800">{p.code}</td>
                    <td className="px-5 py-3 text-gray-700">{p.name}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.discountType === 'percentage'
                        ? `${p.discountValue}%`
                        : p.discountType === 'fixed_amount'
                          ? `₱${p.discountValue}`
                          : discountTypeLabel[p.discountType]}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <PosDate iso={p.validUntil} />
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.currentUses}
                      {p.maxUsesTotal ? `/${p.maxUsesTotal}` : ''}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'edit', promo: p })
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'delete', promo: p })
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
        <PromoModal
          title="New Promo Code"
          error={error}
          isLoading={createMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleCreate(f as CreatePromoCodeInput)}
        />
      )}
      {modal.type === 'edit' && (
        <PromoModal
          title="Edit Promo Code"
          initial={modal.promo}
          error={error}
          isLoading={updateMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleUpdate(modal.promo.id, f)}
        />
      )}
      {modal.type === 'delete' && (
        <ConfirmModal
          message={`Delete promo code "${modal.promo.code}"?`}
          error={error}
          isLoading={deleteMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onConfirm={() => handleDelete(modal.promo.id)}
        />
      )}
    </div>
  )
}

function PromoModal({
  title,
  initial,
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  title: string
  initial?: PromoCode
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: Partial<CreatePromoCodeInput>) => void
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    discountType: (initial?.discountType ?? 'percentage') as 'percentage' | 'fixed_amount' | 'bogo',
    discountValue: initial?.discountValue ?? 0,
    minPurchaseAmount: initial?.minPurchaseAmount ?? '',
    maxUsesTotal: initial?.maxUsesTotal ?? '',
    validFrom: initial?.validFrom?.slice(0, 10) ?? '',
    validUntil: initial?.validUntil?.slice(0, 10) ?? '',
    status: (initial?.status ?? 'active') as 'active' | 'paused' | 'expired',
  })

  useEffect(() => {
    setForm({
      code: initial?.code ?? '',
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      discountType: (initial?.discountType ?? 'percentage') as
        | 'percentage'
        | 'fixed_amount'
        | 'bogo',
      discountValue: initial?.discountValue ?? 0,
      minPurchaseAmount: initial?.minPurchaseAmount ?? '',
      maxUsesTotal: initial?.maxUsesTotal ?? '',
      validFrom: initial?.validFrom?.slice(0, 10) ?? '',
      validUntil: initial?.validUntil?.slice(0, 10) ?? '',
      status: (initial?.status ?? 'active') as 'active' | 'paused' | 'expired',
    })
  }, [initial])

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {!initial && (
          <Field label="Code">
            <input
              className="input"
              placeholder="SUMMER20"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            />
          </Field>
        )}
        <Field label="Name">
          <input
            className="input"
            placeholder="Summer 20% Off"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>
        <Field label="Discount Type">
          <div className="relative">
            <select
              className="select"
              value={form.discountType}
              onChange={(e) =>
                setForm((p) => ({ ...p, discountType: e.target.value as typeof form.discountType }))
              }
            >
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
              <option value="bogo">Buy One Get One</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </Field>
        <Field label="Discount Value">
          <input
            className="input"
            type="number"
            min={0}
            value={form.discountValue}
            onChange={(e) =>
              setForm((p) => ({ ...p, discountValue: parseFloat(e.target.value) || 0 }))
            }
          />
        </Field>
        <Field label="Min Purchase Amount">
          <input
            className="input"
            type="number"
            min={0}
            placeholder="Optional"
            value={form.minPurchaseAmount}
            onChange={(e) => setForm((p) => ({ ...p, minPurchaseAmount: e.target.value }))}
          />
        </Field>
        <Field label="Max Total Uses">
          <input
            className="input"
            type="number"
            min={1}
            placeholder="Unlimited"
            value={form.maxUsesTotal}
            onChange={(e) => setForm((p) => ({ ...p, maxUsesTotal: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valid From">
            <input
              className="input"
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
            />
          </Field>
          <Field label="Valid Until">
            <input
              className="input"
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Status">
          <div className="relative">
            <select
              className="select"
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as typeof form.status }))
              }
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
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
              minPurchaseAmount: form.minPurchaseAmount
                ? Number(form.minPurchaseAmount)
                : undefined,
              maxUsesTotal: form.maxUsesTotal ? Number(form.maxUsesTotal) : undefined,
              validFrom: form.validFrom || undefined,
              validUntil: form.validUntil || undefined,
            })
          }
          disabled={isLoading}
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
