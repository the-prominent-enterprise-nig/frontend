'use client'

import { useState } from 'react'
import {
  useTerminals,
  useCreateTerminal,
  useUpdateTerminal,
  useDeleteTerminal,
  useBranches,
} from '../_hooks/usePos'
import { RefreshCw, Plus, ClipboardList, Pencil, Trash2, X, ChevronDown } from 'lucide-react'
import type { PosTerminal, CreateTerminalInput, UpdateTerminalInput } from '@/src/schema/pos'

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
}

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; terminal: PosTerminal }
  | { type: 'delete'; terminal: PosTerminal }

export default function TerminalsPage() {
  const { data, isLoading, isFetching, refetch } = useTerminals()
  const createMutation = useCreateTerminal()
  const updateMutation = useUpdateTerminal()
  const deleteMutation = useDeleteTerminal()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')

  const terminals: PosTerminal[] = data?.data ?? []

  async function handleCreate(form: CreateTerminalInput) {
    setError('')
    const res = await createMutation.mutateAsync(form)
    if (!res.success) {
      setError(res.error ?? 'Failed to create terminal')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleUpdate(id: string, form: UpdateTerminalInput) {
    setError('')
    const res = await updateMutation.mutateAsync({ id, input: form })
    if (!res.success) {
      setError(res.error ?? 'Failed to update terminal')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleDelete(id: string) {
    setError('')
    const res = await deleteMutation.mutateAsync(id)
    if (!res.success) {
      setError(res.error ?? 'Failed to delete terminal')
      return
    }
    setModal({ type: 'none' })
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Terminals</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your POS terminals.</p>
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
              New Terminal
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <Skeleton />
          ) : terminals.length === 0 ? (
            <Empty onAdd={() => setModal({ type: 'create' })} />
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
                    Branch
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {terminals.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-gray-700">{t.terminalCode}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{t.name}</td>
                    <td className="px-5 py-3 text-gray-600">{t.branch?.name ?? t.branchId}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[t.status]}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'edit', terminal: t })
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setError('')
                            setModal({ type: 'delete', terminal: t })
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

      {/* Create Modal */}
      {modal.type === 'create' && (
        <TerminalModal
          title="New Terminal"
          error={error}
          isLoading={createMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleCreate(f as CreateTerminalInput)}
        />
      )}

      {/* Edit Modal */}
      {modal.type === 'edit' && (
        <TerminalModal
          title="Edit Terminal"
          initial={modal.terminal}
          error={error}
          isLoading={updateMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleUpdate(modal.terminal.id, f)}
        />
      )}

      {/* Delete Modal */}
      {modal.type === 'delete' && (
        <ConfirmModal
          message={`Delete terminal "${modal.terminal.name}"? This cannot be undone.`}
          error={error}
          isLoading={deleteMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onConfirm={() => handleDelete(modal.terminal.id)}
        />
      )}
    </div>
  )
}

function TerminalModal({
  title,
  initial,
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  title: string
  initial?: PosTerminal
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: Partial<CreateTerminalInput>) => void
}) {
  const { data: branchesData } = useBranches()
  const branches = branchesData?.data ?? []

  const [form, setForm] = useState({
    terminalCode: initial?.terminalCode ?? '',
    name: initial?.name ?? '',
    branchId: initial?.branchId ?? '',
    status: (initial?.status ?? 'active') as 'active' | 'inactive',
    description: initial?.description ?? '',
  })

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        {!initial && (
          <Field label="Terminal Code">
            <input
              className="input"
              placeholder="TERM-001"
              value={form.terminalCode}
              onChange={(e) => setForm((p) => ({ ...p, terminalCode: e.target.value }))}
            />
          </Field>
        )}
        <Field label="Name">
          <input
            className="input"
            placeholder="Main Counter Terminal"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </Field>
        <Field label="Branch">
          <div className="relative">
            <select
              className="select"
              value={form.branchId}
              onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
            >
              <option value="">Select a branch…</option>
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
        <Field label="Status">
          <div className="relative">
            <select
              className="select"
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as 'active' | 'inactive' }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        </Field>
        <Field label="Description">
          <input
            className="input"
            placeholder="Optional description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() => {
            if (initial) {
              const { terminalCode: _code, ...rest } = form
              onSubmit(rest)
            } else {
              onSubmit(form)
            }
          }}
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

function Skeleton() {
  return (
    <div className="space-y-3 p-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex animate-pulse gap-4">
          <div className="h-4 w-1/6 rounded bg-gray-200" />
          <div className="h-4 w-1/4 rounded bg-gray-200" />
          <div className="h-4 w-1/5 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
      <ClipboardList size={40} />
      <p className="text-sm">No terminals yet.</p>
      <button onClick={onAdd} className="text-sm text-purple-600 hover:underline">
        Add the first terminal
      </button>
    </div>
  )
}
