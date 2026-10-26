'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, RefreshCw, Pencil, Trash2, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { agentsApi } from '@/src/libs/api/crm'
import type { Agent, AgentInvoice, AgentSaleType } from '@/src/schema/crm/types'
import type { CreateAgentInput } from '@/src/schema/crm/agent'
import { getBranches } from '../_actions/get-branches'

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
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [invoicesTarget, setInvoicesTarget] = useState<Agent | null>(null)

  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await agentsApi.list({ search, branchId: branchFilter || undefined })
    if (res.success && res.data) setAgents(res.data.data)
    setLoading(false)
  }, [search, branchFilter])

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

        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
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
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      Loading...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      No sales agents yet
                    </td>
                  </tr>
                ) : (
                  agents.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50">
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setInvoicesTarget(a)}
                            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded"
                            title="View invoices"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
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
          branches={branches}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {invoicesTarget && (
        <AgentInvoicesDialog agent={invoicesTarget} onClose={() => setInvoicesTarget(null)} />
      )}
    </div>
  )
}

function AgentFormDialog({
  agent,
  branches,
  onClose,
  onSave,
}: {
  agent: Agent | null
  branches: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: Partial<CreateAgentInput>) => Promise<void> | void
}) {
  const [form, setForm] = useState<Partial<CreateAgentInput>>({
    name: agent?.name ?? '',
    phone: agent?.phone ?? '',
    email: agent?.email ?? '',
    commissionRate: agent?.commissionRate ?? null,
    branchId: agent?.branchId ?? null,
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
          <Field label="Branch">
            <select
              value={form.branchId ?? ''}
              onChange={(e) => set('branchId', e.target.value || null)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="">All branches (tenant-wide)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Commission Rate (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="e.g. 5 for 5%. Leave blank for no commission."
              value={form.commissionRate != null ? form.commissionRate * 100 : ''}
              onChange={(e) =>
                set('commissionRate', e.target.value === '' ? null : Number(e.target.value) / 100)
              }
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

function fmtMoney(n: number): string {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const SALE_TYPE_LABEL: Record<AgentSaleType, string> = {
  installment: 'Installment',
  tpf: 'TPF',
  cash: 'Cash',
  charge: 'Charge',
  mixed: 'Mixed',
}

// Scenario 78 — every invoice the agent sold, with its commission and the
// Commissions - Sales voucher that released it. Replaces the Scenario-01
// commission-only list: that one was driven by AgentCommission, so an agent
// with no rate set (the whole imported roster) showed nothing, and it named
// the POS number rather than the SI.
function AgentInvoicesDialog({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [invoices, setInvoices] = useState<AgentInvoice[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await agentsApi.invoices(agent.id)
      if (cancelled) return
      if (res.success && res.data) {
        setInvoices(res.data)
      } else {
        toast.error(res.message || res.error || 'Could not load invoices')
        setInvoices([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agent.id])

  const rows = invoices ?? []
  const totalCommission = rows.reduce((sum, r) => sum + (r.commission ?? 0), 0)
  // A draft voucher already holds the sale but hasn't paid anything out yet.
  const totalReleased = rows.reduce(
    (sum, r) => sum + (r.released && !r.released.isDraft ? r.released.amount : 0),
    0
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Invoices — {agent.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {agent.commissionRate != null
                ? `${(agent.commissionRate * 100).toFixed(2)}% rate`
                : 'No commission rate configured'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {invoices === null ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-400">No invoices sold yet.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-600 uppercase">
                    Date
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-600 uppercase">
                    SI No.
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-600 uppercase">
                    Customer
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-600 uppercase">
                    Type
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-zinc-600 uppercase">
                    Amount
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-zinc-600 uppercase">
                    Commission
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-600 uppercase">
                    Released
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-4 py-2 text-sm whitespace-nowrap">
                      <span className="font-medium text-zinc-800">
                        {r.salesInvoiceNumber ?? '-'}
                      </span>
                      <span className="block text-xs text-zinc-400">{r.transactionNumber}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-700">{r.customerName ?? '-'}</td>
                    <td className="px-4 py-2 text-sm text-zinc-700">{SALE_TYPE_LABEL[r.type]}</td>
                    <td className="px-4 py-2 text-sm text-right text-zinc-700 whitespace-nowrap">
                      {fmtMoney(r.totalAmount)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {r.commission != null ? fmtMoney(r.commission) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm whitespace-nowrap">
                      {r.released ? (
                        <>
                          <Link
                            href={`/accounting/expenses/${r.released.expenseId}`}
                            className="font-medium text-purple-700 hover:underline"
                          >
                            {r.released.voucherNumber}
                          </Link>
                          {r.released.isDraft && (
                            <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Draft
                            </span>
                          )}
                          <span className="block text-xs text-zinc-500">
                            {fmtMoney(r.released.amount)} · {fmtDate(r.released.date)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">Not released</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 border-t border-zinc-200 bg-zinc-50">
            <span className="text-sm font-medium text-zinc-600">
              {rows.length} invoice{rows.length === 1 ? '' : 's'}
            </span>
            <div className="flex gap-6 text-sm">
              <span className="text-zinc-600">
                Commission:{' '}
                <span className="font-bold text-zinc-900">{fmtMoney(totalCommission)}</span>
              </span>
              <span className="text-zinc-600">
                Released: <span className="font-bold text-zinc-900">{fmtMoney(totalReleased)}</span>
              </span>
            </div>
          </div>
        )}
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
