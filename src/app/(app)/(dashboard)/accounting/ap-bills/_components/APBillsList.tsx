'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Inbox, PhilippinePeso, Download, Pencil, Trash2 } from 'lucide-react'
import { APBills, type APBill, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import Tooltip from '@/src/components/ui/Tooltip'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import { printAPBillDocument } from '@/src/libs/print/printInventoryDocument'

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  pending_online_approval: 'Pending Online Approval',
  pending_onsite_approval: 'Pending Onsite Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided',
}

// The statuses a bill can be paid from — received, part-paid, or overdue.
const PAYABLE = ['RECEIVED', 'PARTIAL', 'OVERDUE']

// Matches APBillDetail.tsx's own STATUS_BADGE map, ported here for the list view.
const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECEIVED: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default function APBillsList() {
  const router = useRouter()
  const [items, setItems] = useState<APBill[]>([])
  const [loading, setLoading] = useState(true)
  // Scenario 46 Part E — the list had no search box at all, though the API has
  // supported one since Scenario 10. Now also matches supplier name, reference
  // and voucher number, not just the bill number.
  const [search, setSearch] = useState('')
  // Scenario 46 — Gmail-style multi-select. Selection is held as ids so it
  // survives a search/filter change; the bar says when some of it is no longer
  // on screen rather than silently dropping it.
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await APBills.list({ search: search || undefined })
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [search])
  useEffect(() => {
    load()
  }, [load])

  const selected = items.filter((b) => selectedIds.includes(b.id))
  // What the current selection is FOR. Decided by the first row ticked.
  const mode: 'receive' | 'pay' | null = !selected.length
    ? null
    : selected[0].status === 'DRAFT'
      ? 'receive'
      : 'pay'
  // One cheque is payable to one entity, so the first pick locks the payee and
  // every other supplier's box goes disabled. Teaching the rule at selection
  // time beats letting someone tick five rows and fail at the end.
  const lockedSupplierId = selected[0]?.supplierId ?? null
  const lockedSupplierName = selected[0]?.supplier?.name ?? null
  const selectedTotal = selected.reduce(
    (sum, b) => sum + ((b.totalAmount ?? 0) - (b.amountPaid ?? 0)),
    0
  )
  const offscreenCount = selectedIds.length - selected.length

  /** Why this row can't be ticked, or null when it can. The tooltip and the
   * disabled state read from this one function, so they can never disagree.
   *
   * Selection has two modes because the list has two bulk actions: ticking a
   * DRAFT starts a receive, ticking a payable starts a payment, and the first
   * tick decides which — the other kind then disables, since one selection
   * can't be both. */
  const disabledReason = (b: APBill): string | null => {
    if (mode === 'receive') {
      if (b.status !== 'DRAFT')
        return `Receiving is selected — a ${b.status} invoice is already received. Clear the selection to pay instead.`
      return null
    }
    if (mode === 'pay') {
      if ((b.totalAmount ?? 0) - (b.amountPaid ?? 0) <= 0.005)
        return 'Nothing outstanding on this invoice.'
      if (!PAYABLE.includes(b.status)) return `A ${b.status} invoice can't be paid`
      if (lockedSupplierId && b.supplierId !== lockedSupplierId)
        return `One cheque pays one supplier. Clear the selection to pay ${b.supplier?.name ?? 'this supplier'}.`
      return null
    }
    // Nothing selected yet — anything actionable is fair game.
    if (b.status === 'DRAFT') return null
    if ((b.totalAmount ?? 0) - (b.amountPaid ?? 0) <= 0.005)
      return 'Nothing outstanding on this invoice.'
    if (!PAYABLE.includes(b.status)) return `A ${b.status} invoice can't be paid`
    return null
  }

  const toggleOne = (b: APBill, on: boolean) =>
    setSelectedIds((prev) => (on ? [...prev, b.id] : prev.filter((id) => id !== b.id)))

  const receiveOne = async (b: APBill) => {
    // Same confirm the detail page shows: receiving posts a journal entry, so
    // it names the amount before doing it.
    if (
      !confirm(
        `Receive ${b.billNumber ?? 'this bill'}? This posts a journal entry for ${fmtMoney(b.totalAmount)}.`
      )
    )
      return
    const res = await APBills.receive(b.id)
    if (!res.success)
      alert(res.message || res.error || 'Receive failed — check Account Mapping settings')
    load()
  }

  const printOne = async (b: APBill) => {
    const res = await APBills.getDocument(b.id)
    if (res.success && res.data) printAPBillDocument(res.data)
    else alert(res.message || res.error || 'Could not build the document')
  }

  const deleteOrRequest = async (b: APBill) => {
    if (b.status === 'DRAFT') {
      if (!confirm('Delete this bill?')) return
      const res = await APBills.remove(b.id)
      if (!res.success) alert(res.message || res.error || 'Delete failed')
      return load()
    }
    const reason = prompt(
      `This bill is ${b.status} and can't be deleted directly.\nGive a reason and it will be sent for approval:`
    )
    if (!reason?.trim()) return
    const res = await APBills.requestDeletion(b.id, reason.trim())
    if (!res.success) alert(res.message || res.error || 'Could not request deletion')
    else alert('Deletion requested — it needs approval before the bill is removed.')
    load()
  }

  /** The row's own actions, built from its state so a bill never offers
   * something it can't do. One menu rather than a row of coloured icons. */
  const rowMenu = (b: APBill): RowMenuItem[] => [
    ...(b.status === 'DRAFT'
      ? [{ label: 'Receive', icon: Inbox, onClick: () => receiveOne(b) }]
      : []),
    { label: 'Print / Download', icon: Download, onClick: () => printOne(b) },
    {
      label: 'Edit',
      icon: Pencil,
      onClick: () => router.push(`/accounting/ap-bills/${b.id}/edit`),
    },
    {
      label: b.deletionRequestedAt
        ? 'Deletion already requested'
        : b.status === 'DRAFT'
          ? 'Delete'
          : 'Request deletion',
      icon: Trash2,
      onClick: () => {
        if (b.deletionRequestedAt) return
        deleteOrRequest(b)
      },
      variant: 'danger' as const,
    },
  ]

  const receiveSelected = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Receive ${selectedIds.length} invoice(s)? Each posts its own journal entry.`))
      return
    const res = await APBills.receiveMany(selectedIds)
    if (!res.success) {
      alert(res.message || res.error || 'Receive failed')
    } else if (res.data?.failed.length) {
      // Each bill posts independently, so a partial result is a real outcome
      // rather than a failure — say exactly what landed and what didn't.
      alert(
        `Received ${res.data.received.length}. ${res.data.failed.length} could not be received:\n` +
          res.data.failed.map((f) => `• ${f.billNumber ?? f.id}: ${f.reason}`).join('\n')
      )
    }
    setSelectedIds([])
    load()
  }

  const paySelected = () => {
    if (!selectedIds.length) return
    const params = new URLSearchParams()
    if (lockedSupplierId) params.set('supplier', lockedSupplierId)
    params.set('bills', selectedIds.join(','))
    // Carried in the URL rather than in memory so a refresh or a shared link
    // still lands on the same prefilled form.
    router.push(`/accounting/ap-bills/payments/new?${params.toString()}`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AP Invoices</h2>
          <p className="text-sm text-gray-500">Supplier bills and payables.</p>
        </div>
        <div className="flex gap-2">
          {/* Scenario 46 — payment starts here, not on a row: one cheque can
              settle several of a supplier's invoices, so the bills are picked
              inside the form. */}
          <Link
            href="/accounting/ap-bills/payments/new"
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50"
          >
            <PhilippinePeso className="w-4 h-4" /> Record Payment
          </Link>
          <Link
            href="/accounting/ap-bills/payments"
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <PhilippinePeso className="w-4 h-4" /> Payments
          </Link>
          <Link
            href="/accounting/ap-bills/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Bill
          </Link>
        </div>
      </div>
      {/* The action bar takes the search row's place rather than pushing the
          table down, so nothing jumps when a selection starts. */}
      {selectedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="text-sm font-semibold text-emerald-900">
            {selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected
            {mode === 'pay' ? ` · ${fmtMoney(selectedTotal)}` : ' to receive'}
          </span>
          {mode === 'pay' && lockedSupplierName && (
            <span className="text-sm text-emerald-800">{lockedSupplierName}</span>
          )}
          {offscreenCount > 0 && (
            <span className="text-xs text-emerald-700">
              ({offscreenCount} not shown by the current search)
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {mode === 'receive' ? (
              <button
                onClick={receiveSelected}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <Inbox className="h-4 w-4" /> Receive {selectedIds.length}
              </button>
            ) : (
              <button
                onClick={paySelected}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <PhilippinePeso className="h-4 w-4" /> Record Payment
              </button>
            )}
            <button
              onClick={() => setSelectedIds([])}
              className="rounded-lg px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-80 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              {/* Scenario 46 — no select-all. The two bulk actions are both
                  scoped (receive applies only to drafts, payment only to one
                  supplier's payables), so "everything on this page" is never
                  the set someone actually wants. */}
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 text-left">Bill #</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Bill Date</th>
              <th className="px-3 py-2 text-left">Due Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                  No bills.
                </td>
              </tr>
            ) : (
              items.map((b, rowIdx) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/accounting/ap-bills/${b.id}`)}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    selectedIds.includes(b.id) ? 'bg-emerald-50/60' : ''
                  }`}
                >
                  {/* Stop the bubble so ticking a box doesn't also open the
                      bill behind the selection. */}
                  <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                    {(() => {
                      const reason = disabledReason(b)
                      const box = (
                        <input
                          type="checkbox"
                          aria-label={`Select ${b.billNumber ?? 'invoice'}`}
                          checked={selectedIds.includes(b.id)}
                          disabled={!!reason}
                          onChange={(e) => toggleOne(b, e.target.checked)}
                          className="disabled:opacity-30"
                        />
                      )
                      // A native `title` was unreliable here: a disabled input
                      // swallows pointer events in most browsers, so the
                      // tooltip showed only sometimes. Tooltip wraps it in a
                      // span that isn't disabled and drives off group-hover,
                      // so the reason always appears — which matters when most
                      // rows on screen are dimmed.
                      return reason ? (
                        <Tooltip
                          label={reason}
                          // This column sits hard against the edge of an
                          // overflow-auto container, which clips on BOTH axes
                          // (setting overflow-x makes overflow-y compute to
                          // auto as well) — the same trap that cut off the
                          // Category popup in Scenario 45. So: open rightward
                          // rather than centred, or the bubble loses its left
                          // half; and point the last row's upward, or it loses
                          // its bottom.
                          align="start"
                          side={rowIdx === items.length - 1 ? 'top' : 'bottom'}
                        >
                          {box}
                        </Tooltip>
                      ) : (
                        box
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {b.billNumber ?? (
                      <span
                        title="Received without the supplier's invoice number — still payable"
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                      >
                        No SI
                      </span>
                    )}
                    {b.deletionRequestedAt && (
                      <span
                        title={b.deletionReason ?? undefined}
                        className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600"
                      >
                        Deletion pending
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{b.supplier?.name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{fmtDate(b.billDate)}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(b.dueDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.totalAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.amountPaid)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.totalAmount - b.amountPaid)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {b.status}
                    </span>
                    {b.isAutoGenerated && b.status === 'DRAFT' && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">
                        From Receiving
                      </span>
                    )}
                    {b.voucherApprovalStatus && (
                      <div className="mt-1 text-xs text-gray-500">
                        Voucher: {VOUCHER_STATUS_LABEL[b.voucherApprovalStatus]}
                      </div>
                    )}
                  </td>
                  {/* Scenario 46 — one overflow menu rather than a row of
                      coloured icons. Bulk receive and payment still live in
                      the selection bar; this is the per-bill equivalent, and
                      it mirrors the same menu on the bill's detail page. */}
                  <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <RowActionsMenu items={rowMenu(b)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
