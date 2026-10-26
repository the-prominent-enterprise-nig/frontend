'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { agentsApi } from '@/src/libs/api/crm'
import type {
  Agent,
  AgentInvoice,
  AgentInvoiceRelease,
  AgentSaleType,
} from '@/src/schema/crm/types'
import type { UpdateAgentInput } from '@/src/schema/crm/agent'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { getBranches } from '../../_actions/get-branches'
import {
  AgentFormFields,
  agentFormState,
  agentPayload,
  type AgentFormState,
} from '../../_components/AgentFormFields'

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
// commission-only dialog: that one was driven by AgentCommission, so an agent
// with no rate set (the whole imported roster) showed nothing, and it named
// the POS number rather than the SI. A page rather than a dialog so the list
// has room to grow and can be linked to. The agent's Edit and Remove live
// here too, so the list stays a plain click-through.
export default function AgentInvoices({
  id,
  canUpdate,
  canDelete,
}: {
  id: string
  canUpdate: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [invoices, setInvoices] = useState<AgentInvoice[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  // Inline edit — the header turns into the agent form in place.
  const [editForm, setEditForm] = useState<AgentFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  // Where the user was heading when an unsaved edit stopped them.
  const [leaveTo, setLeaveTo] = useState<string | null>(null)

  const isDirty = !!agent && !!editForm && !sameAgentForm(editForm, agentFormState(agent))

  // A refresh or closed tab can't be caught in-app, so the browser asks.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  /** onClick for links off this page — holds the navigation while the Edit
   * form has unsaved changes and asks first. */
  const guardLeave = (href: string) => (e: React.MouseEvent) => {
    if (!isDirty) return
    e.preventDefault()
    setLeaveTo(href)
  }

  const branchName = agent?.branchId
    ? (branches.find((b) => b.id === agent.branchId)?.name ?? null)
    : null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [agentRes, invoicesRes, branchesRes] = await Promise.all([
        agentsApi.get(id),
        agentsApi.invoices(id),
        getBranches(),
      ])
      if (cancelled) return
      if (!agentRes.success || !agentRes.data) {
        setNotFound(true)
        return
      }
      setAgent(agentRes.data)
      if (branchesRes.success && branchesRes.data) setBranches(branchesRes.data.data)
      if (invoicesRes.success && invoicesRes.data) {
        setInvoices(invoicesRes.data)
      } else {
        toast.error(invoicesRes.message || invoicesRes.error || 'Could not load invoices')
        setInvoices([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const rows = invoices ?? []
  const totalCommission = rows.reduce((sum, r) => sum + (r.commission ?? 0), 0)
  // A draft voucher already holds the sale but hasn't paid anything out yet.
  const paidOut = (rel: AgentInvoiceRelease | null) => (rel && !rel.isDraft ? rel.amount : 0)
  const totalReleased = rows.reduce((sum, r) => sum + paidOut(r.released), 0)
  const totalSmiReleased = rows.reduce((sum, r) => sum + paidOut(r.smiReleased), 0)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    setSaving(true)
    const res = await agentsApi.update(id, agentPayload(editForm) as unknown as UpdateAgentInput)
    setSaving(false)
    if (!res.success) {
      toast.error(res.message || res.error || 'Could not save agent')
      return
    }
    toast.success('Agent updated')
    setAgent((prev) => (res.data ? res.data : prev ? { ...prev, ...editForm } : prev) as Agent)
    setEditForm(null)
  }

  const handleRemove = async () => {
    setRemoving(true)
    const res = await agentsApi.remove(id)
    setRemoving(false)
    if (!res.success) {
      toast.error(res.message || res.error || 'Could not remove agent')
      return
    }
    toast.success('Agent removed')
    router.push('/crm/agents')
  }

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <Link
        href="/crm/agents"
        onClick={guardLeave('/crm/agents')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sales agents
      </Link>

      {notFound ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          Sales agent not found.
        </div>
      ) : (
        <>
          {agent && editForm ? (
            <form
              onSubmit={handleSave}
              className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Agent</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AgentFormFields form={editForm} onChange={setEditForm} branches={branches} />
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                A new commission rate applies to sales from now on — commissions already recorded
                keep the rate they were earned at.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm(null)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
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
          ) : (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {agent?.name ?? 'Loading...'}
                </h2>
                {agent && (
                  <p className="mt-1 text-sm text-gray-500">
                    {branchName ?? 'All branches'} ·{' '}
                    {agent.commissionRate != null
                      ? `${(agent.commissionRate * 100).toFixed(2)}% rate`
                      : 'No commission rate configured'}{' '}
                    · <span className="capitalize">{agent.status}</span>
                    {(agent.phone || agent.email) && (
                      <span className="block mt-0.5">
                        {[agent.phone, agent.email].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {agent && (canUpdate || canDelete) && (
                <div className="flex gap-2">
                  {canUpdate && (
                    <button
                      onClick={() => setEditForm(agentFormState(agent))}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Invoices" value={invoices === null ? '-' : String(rows.length)} />
            <Stat label="Commission" value={invoices === null ? '-' : fmtMoney(totalCommission)} />
            <Stat label="Released" value={invoices === null ? '-' : fmtMoney(totalReleased)} />
            <Stat
              label="SMI Released"
              value={invoices === null ? '-' : fmtMoney(totalSmiReleased)}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              {invoices === null ? (
                <div className="p-8 text-center text-sm text-zinc-400">Loading...</div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">No invoices sold yet.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        SI No.
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Customer
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Type
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Amount
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Commission
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Released
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        SMI Released
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">
                          {fmtDate(r.date)}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="font-medium text-zinc-800">
                            {r.salesInvoiceNumber ?? '-'}
                          </span>
                          <span className="block text-xs text-zinc-400">{r.transactionNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">{r.customerName ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {SALE_TYPE_LABEL[r.type]}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-zinc-700 whitespace-nowrap">
                          {fmtMoney(r.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {r.commission != null ? fmtMoney(r.commission) : '-'}
                        </td>
                        <ReleaseCell
                          release={r.released}
                          emptyLabel="Commission not released"
                          guardLeave={guardLeave}
                        />
                        <ReleaseCell
                          release={r.smiReleased}
                          emptyLabel="SMI not released"
                          guardLeave={guardLeave}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove agent"
        message={
          <>
            <p>
              Remove <strong>{agent?.name}</strong>? They will no longer show in the POS Selling
              Agent picker.
            </p>
            <p className="mt-2">Their past invoices and commissions are kept.</p>
          </>
        }
        confirmLabel="Remove"
        destructive
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />

      <ConfirmDialog
        open={leaveTo !== null}
        title="Discard changes?"
        message={
          <p>
            You have unsaved changes to <strong>{agent?.name}</strong>. Leave this page without
            saving them?
          </p>
        }
        confirmLabel="Discard and leave"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          const to = leaveTo
          setLeaveTo(null)
          setEditForm(null)
          if (to) router.push(to)
        }}
        onCancel={() => setLeaveTo(null)}
      />
    </div>
  )
}

/** Whether the Edit form still holds exactly the agent's saved values. */
function sameAgentForm(a: AgentFormState, b: AgentFormState): boolean {
  const norm = (f: AgentFormState) => ({
    name: (f.name ?? '').trim(),
    phone: (f.phone ?? '').trim(),
    email: (f.email ?? '').trim(),
    branchId: f.branchId ?? null,
    commissionRate: f.commissionRate ?? null,
  })
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

/** The voucher that released a sale's commission or SMI — linked to the
 * expense, with a Draft badge while it is still a draft. */
function ReleaseCell({
  release,
  emptyLabel,
  guardLeave,
}: {
  release: AgentInvoiceRelease | null
  /** What an unreleased cell says — names which release it is, so the
   * commission and SMI columns don't read the same. */
  emptyLabel: string
  guardLeave: (href: string) => (e: React.MouseEvent) => void
}) {
  if (!release) {
    return (
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span className="text-xs text-zinc-400">{emptyLabel}</span>
      </td>
    )
  }
  const href = `/accounting/expenses/${release.expenseId}`
  return (
    <td className="px-4 py-3 text-sm whitespace-nowrap">
      <Link
        href={href}
        onClick={guardLeave(href)}
        className="font-medium text-purple-700 hover:underline"
      >
        {release.voucherNumber}
      </Link>
      {release.isDraft && (
        <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          Draft
        </span>
      )}
      <span className="block text-xs text-zinc-500">
        {fmtMoney(release.amount)} · {fmtDate(release.date)}
      </span>
    </td>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
