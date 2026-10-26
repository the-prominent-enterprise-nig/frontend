'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { agentsApi } from '@/src/libs/api/crm'
import type { Agent } from '@/src/schema/crm/types'
import type { CreateAgentInput } from '@/src/schema/crm/agent'
import { getBranches } from '../_actions/get-branches'
import { AgentFormFields, agentFormState, type AgentFormState } from './AgentFormFields'

// The API pages agents 20 at a time (AgentService.findAll's default). The
// whole roster is 150+ since the client's list was imported, so the list has
// to page rather than show the first 20 and stop.
const PAGE_SIZE = 20

interface Props {
  canCreate: boolean
}

export default function AgentsList({ canCreate }: Props) {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await agentsApi.list({
      search,
      branchId: branchFilter || undefined,
      page,
      limit: PAGE_SIZE,
    })
    if (res.success && res.data) {
      setAgents(res.data.data)
      setTotal(res.data.meta.total)
      setLastPage(Math.max(1, res.data.meta.lastPage))
    }
    setLoading(false)
  }, [search, branchFilter, page])

  useEffect(() => {
    load()
  }, [load])

  // Edit and Remove live on the agent's own page; the list only adds.
  const handleCreate = async (data: AgentFormState) => {
    const res = await agentsApi.create(data as CreateAgentInput)
    if (!res.success) {
      toast.error(res.message || res.error || 'Could not save agent')
      return
    }
    toast.success('Agent added')
    setDialogOpen(false)
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
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                <Plus className="h-4 w-4" /> Add Agent
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
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
                    Branch
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No sales agents yet
                    </td>
                  </tr>
                ) : (
                  agents.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => router.push(`/crm/agents/${a.id}`)}
                      className="cursor-pointer transition-colors hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{a.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{a.email || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {branchName(a.branchId) ?? (
                          <span className="text-zinc-400">All branches</span>
                        )}
                      </td>
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
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {a.commissionRate != null ? `${(a.commissionRate * 100).toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs text-zinc-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}{' '}
                {total === 1 ? 'agent' : 'agents'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-zinc-500">
                  {page} / {lastPage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage || loading}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {dialogOpen && (
        <AddAgentDialog
          branches={branches}
          onClose={() => setDialogOpen(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}

function AddAgentDialog({
  branches,
  onClose,
  onSave,
}: {
  branches: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: AgentFormState) => Promise<void> | void
}) {
  const [form, setForm] = useState<AgentFormState>(() => agentFormState())
  const [saving, setSaving] = useState(false)

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
          <h3 className="text-lg font-semibold text-gray-900">Add Agent</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <AgentFormFields form={form} onChange={setForm} branches={branches} />
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
