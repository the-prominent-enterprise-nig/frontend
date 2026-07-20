'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, LayoutList, Plus, Pencil, Trash2, X, Eye, EyeOff } from 'lucide-react'
import { QueueCategories } from '@/src/libs/data/QueueData'
import type { QueueCategory } from '@/src/libs/data/QueueData'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; category: QueueCategory }
  | { type: 'delete'; category: QueueCategory }

export default function QueueCategoriesClient() {
  const qc = useQueryClient()

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['queue-categories'],
    queryFn: () => QueueCategories.list(),
    staleTime: 2 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: Partial<QueueCategory>) => QueueCategories.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue-categories'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<QueueCategory> }) =>
      QueueCategories.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue-categories'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => QueueCategories.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue-categories'] }),
  })

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')

  const categories: QueueCategory[] = Array.isArray(data?.data)
    ? (data.data as QueueCategory[])
    : Array.isArray(data)
      ? (data as QueueCategory[])
      : []

  async function handleCreate(body: Partial<QueueCategory>): Promise<void> {
    setError('')
    const res = await createMutation.mutateAsync(body)
    if (!res.success) {
      setError(res.error ?? 'Failed to create category')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleUpdate(id: string, body: Partial<QueueCategory>): Promise<void> {
    setError('')
    const res = await updateMutation.mutateAsync({ id, body })
    if (!res.success) {
      setError(res.error ?? 'Failed to update category')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleDelete(id: string): Promise<void> {
    setError('')
    const res = await deleteMutation.mutateAsync(id)
    if (!res.success) {
      setError(res.error ?? 'Failed to delete category')
      return
    }
    setModal({ type: 'none' })
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Queue Categories</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure service windows and counters for the queue management system.
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
              New Category
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4">
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <LayoutList size={40} />
              <p className="text-sm">No queue categories configured.</p>
              <button
                onClick={() => {
                  setError('')
                  setModal({ type: 'create' })
                }}
                className="text-sm text-purple-600 hover:underline"
              >
                Add the first category
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Counter
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Description
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Visibility
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{cat.name}</td>
                    <td className="px-5 py-3 text-gray-600">{cat.counterName ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{cat.description ?? '—'}</td>
                    <td className="px-5 py-3">
                      {cat.visibility ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Eye size={13} />
                          <span className="text-xs font-medium">Visible</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <EyeOff size={13} />
                          <span className="text-xs font-medium">Hidden</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'edit', category: cat })
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'delete', category: cat })
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
        <CategoryModal
          title="New Queue Category"
          error={error}
          isLoading={createMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={handleCreate}
        />
      )}
      {modal.type === 'edit' && (
        <CategoryModal
          title="Edit Queue Category"
          initial={modal.category}
          error={error}
          isLoading={updateMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(body) => handleUpdate(modal.category.id, body)}
        />
      )}
      {modal.type === 'delete' && (
        <ConfirmModal
          message={`Delete category "${modal.category.name}"? All associated tickets will also be removed.`}
          error={error}
          isLoading={deleteMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onConfirm={() => handleDelete(modal.category.id)}
        />
      )}
    </div>
  )
}

function CategoryModal({
  title,
  initial,
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  title: string
  initial?: QueueCategory
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (body: Partial<QueueCategory>) => void
}): React.ReactElement {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    counterName: initial?.counterName ?? '',
    description: initial?.description ?? '',
    visibility: initial?.visibility ?? true,
  })

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      counterName: initial?.counterName ?? '',
      description: initial?.description ?? '',
      visibility: initial?.visibility ?? true,
    })
  }, [initial])

  function handleSubmit(): void {
    onSubmit({
      name: form.name.trim(),
      counterName: form.counterName.trim() || undefined,
      description: form.description.trim() || undefined,
      visibility: form.visibility,
    })
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        <Field label="Name *">
          <input
            className="input"
            placeholder="e.g. Regular Service"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>
        <Field label="Counter Name">
          <input
            className="input"
            placeholder="e.g. Window 1"
            value={form.counterName}
            onChange={(e) => setForm((p) => ({ ...p, counterName: e.target.value }))}
          />
        </Field>
        <Field label="Description">
          <textarea
            className="input min-h-[72px] resize-none"
            placeholder="Optional description for this queue category"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </Field>
        <Field label="Visibility">
          <label className="flex cursor-pointer items-center gap-3">
            <div
              onClick={() => setForm((p) => ({ ...p, visibility: !p.visibility }))}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                form.visibility ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  form.visibility ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-sm text-gray-700">
              {form.visibility ? 'Visible on queue display' : 'Hidden from queue display'}
            </span>
          </label>
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !form.name.trim()}
          className="btn-primary disabled:opacity-50"
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
}): React.ReactElement {
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

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}): React.ReactElement {
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}
