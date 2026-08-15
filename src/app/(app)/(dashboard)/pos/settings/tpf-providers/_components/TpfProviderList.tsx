'use client'

import { useState } from 'react'
import { Landmark, Plus, X, Pencil, Trash2 } from 'lucide-react'
import {
  useTpfProviders,
  useCreateTpfProvider,
  useUpdateTpfProvider,
  useDeleteTpfProvider,
} from '../../../_hooks/usePos'
import type { CreateTpfProviderInput, UpdateTpfProviderInput, TpfProvider } from '@/src/schema/pos'
import { Skeleton } from '@/src/components/ui/Skeleton'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; provider: TpfProvider }
  | { type: 'delete'; provider: TpfProvider }

export function TpfProviderList({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useTpfProviders()
  const createMutation = useCreateTpfProvider()
  const updateMutation = useUpdateTpfProvider()
  const deleteMutation = useDeleteTpfProvider()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')

  const providers: TpfProvider[] = data?.data ?? []

  async function handleCreate(input: CreateTpfProviderInput) {
    setError('')
    const res = await createMutation.mutateAsync(input)
    if (!res.success) {
      setError(res.error ?? 'Failed to create TPF provider')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleUpdate(id: string, input: UpdateTpfProviderInput) {
    setError('')
    const res = await updateMutation.mutateAsync({ id, input })
    if (!res.success) {
      setError(res.error ?? 'Failed to update TPF provider')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleDelete(id: string) {
    setError('')
    const res = await deleteMutation.mutateAsync(id)
    if (!res.success) {
      setError(res.error ?? 'Failed to delete TPF provider')
      return
    }
    setModal({ type: 'none' })
  }

  async function toggleActive(provider: TpfProvider) {
    setError('')
    const res = await updateMutation.mutateAsync({
      id: provider.id,
      input: { isActive: !provider.isActive },
    })
    if (!res.success) {
      setError(res.error ?? 'Failed to update TPF provider')
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-prominent-purple-900">TPF Providers</h1>
            <p className="mt-1 text-sm text-gray-500">
              The third-party financing companies cashiers can attribute a TPF installment sale to
              at checkout.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setError('')
                setModal({ type: 'create' })
              }}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              <Plus size={14} />
              New Provider
            </button>
          )}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="divide-y divide-gray-100 p-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="ml-auto h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Landmark size={40} />
              <p className="text-sm">No TPF providers configured yet.</p>
              {canManage && (
                <button
                  onClick={() => setModal({ type: 'create' })}
                  className="text-sm text-purple-600 hover:underline"
                >
                  Add the first provider
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  {canManage && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={updateMutation.isPending}
                            onClick={() => toggleActive(p)}
                            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {p.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => {
                              setError('')
                              setModal({ type: 'edit', provider: p })
                            }}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Edit provider"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setError('')
                              setModal({ type: 'delete', provider: p })
                            }}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete provider"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal.type === 'create' && (
        <TpfProviderModal
          title="New TPF Provider"
          error={error}
          isSubmitting={createMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(input) => handleCreate(input as CreateTpfProviderInput)}
        />
      )}
      {modal.type === 'edit' && (
        <TpfProviderModal
          title="Edit TPF Provider"
          initial={modal.provider}
          error={error}
          isSubmitting={updateMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(input) => handleUpdate(modal.provider.id, input)}
        />
      )}
      {modal.type === 'delete' && (
        <ConfirmDeleteModal
          provider={modal.provider}
          error={error}
          isLoading={deleteMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onConfirm={() => handleDelete(modal.provider.id)}
        />
      )}
    </div>
  )
}

function TpfProviderModal({
  title,
  initial,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  title: string
  initial?: TpfProvider
  error: string
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (input: CreateTpfProviderInput | UpdateTpfProviderInput) => Promise<void>
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-prominent-purple-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="e.g. Home Credit"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(isEdit ? { name } : { name })}
              disabled={isSubmitting || !name.trim()}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Provider'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ConfirmDeleteModal({
  provider,
  error,
  isLoading,
  onClose,
  onConfirm,
}: {
  provider: TpfProvider
  error: string
  isLoading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
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
          <h2 className="mb-2 text-lg font-bold text-gray-900">Delete TPF Provider</h2>
          <p className="mb-4 text-sm text-gray-600">
            Delete &quot;{provider.name}&quot;? This can&apos;t be undone. Providers already used in
            a sale can&apos;t be deleted — deactivate instead.
          </p>
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
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
        </div>
      </div>
    </>
  )
}
