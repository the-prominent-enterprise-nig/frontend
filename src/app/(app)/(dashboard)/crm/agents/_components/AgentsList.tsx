'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, RefreshCw, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { agentsApi } from '@/src/libs/api/crm'
import type { Agent } from '@/src/schema/crm/types'
import type { CreateAgentInput } from '@/src/schema/crm/agent'

const FIELD_LIMITS = { name: 255, phone: 50, email: 255 } as const

interface Props {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export default function AgentsList({ canCreate, canUpdate, canDelete }: Props) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await agentsApi.list({ search })
    if (res.success && res.data) setAgents(res.data.data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (data: Partial<CreateAgentInput>) => {
    const res = editing
      ? await agentsApi.update(editing.id, data)
      : await agentsApi.create(data as CreateAgentInput)
    if (!res.success) {
      toast.error(res.message || res.error || 'Could not save agent')
      return
    }
    toast.success(editing ? 'Agent updated' : 'Agent added')
    setDialogOpen(false)
    setEditing(null)
    load()
  }

  const handleRemove = async (a: Agent) => {
    if (!confirm(`Remove agent "${a.name}"?`)) return
    const res = await agentsApi.remove(a.id)
    if (!res.success) {
      toast.error(res.message || res.error || 'Could not remove agent')
      return
    }
    toast.success('Agent removed')
    load()
  }

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Sales Agents</h2>
            <p className="text-sm text-gray-500 mt-1">
              CRM-owned agent list — separate from system user accounts. Selectable at POS checkout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {canCreate && (
              <button
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                <Plus className="h-4 w-4" /> Add Agent
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Phone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      No sales agents yet
                    </td>
                  </tr>
                ) : (
                  agents.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{a.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{a.email || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            a.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => {
                                setEditing(a)
                                setDialogOpen(true)
                              }}
                              className="p-1.5 text-purple-700 hover:bg-purple-50 rounded"
                              title="Edit agent"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleRemove(a)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Remove agent"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dialogOpen && (
        <AgentFormDialog
          agent={editing}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function AgentFormDialog({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent | null
  onClose: () => void
  onSave: (data: Partial<CreateAgentInput>) => Promise<void> | void
}) {
  const [form, setForm] = useState<Partial<CreateAgentInput>>({
    name: agent?.name ?? '',
    phone: agent?.phone ?? '',
    email: agent?.email ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof CreateAgentInput>(k: K, v: CreateAgentInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {agent ? 'Edit Agent' : 'Add Agent'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <Field label="Name *">
            <input
              required
              maxLength={FIELD_LIMITS.name}
              value={form.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Phone">
            <input
              maxLength={FIELD_LIMITS.phone}
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              maxLength={FIELD_LIMITS.email}
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
