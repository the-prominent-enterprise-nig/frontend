'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Search,
  Inbox,
  PhilippinePeso,
  Pencil,
  Trash2,
  Printer,
  FileText,
} from 'lucide-react'
import {
  APBills,
  type APBill,
  type APDisbursementListItem,
  apOutstanding,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { getApDisbursementDocument } from '../_actions/get-ap-disbursement-document'
import { printAPPaymentVoucherDocument } from '@/src/libs/print/printInventoryDocument'
import Tooltip from '@/src/components/ui/Tooltip'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import { printAPBillDocument } from '@/src/libs/print/printInventoryDocument'

// The statuses a bill can be paid from — received, part-paid, or overdue.
const PAYABLE = ['RECEIVED', 'PARTIAL', 'OVERDUE']

// What this screen is for: the bills you can still act on. Receive and Record
// Payment both only apply to these, so a settled invoice is un-actionable noise
// in the default view — and at the client's data volume it would bury the few
// rows that matter. Never a hard hide: All is one click away, and search
// ignores the filter entirely.
const OPEN_STATUSES = 'DRAFT,RECEIVED,PARTIAL,OVERDUE'
const STATUS_VIEWS = [
  { value: OPEN_STATUSES, label: 'Open items' },
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'PARTIAL', label: 'Partly paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

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
  const [statusView, setStatusView] = useState(OPEN_STATUSES)
  // Scenario 46 — Gmail-style multi-select. Selection is held as ids so it
  // survives a search/filter change; the bar says when some of it is no longer
  // on screen rather than silently dropping it.
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Loaded not to be listed, but so each invoice knows which voucher holds it:
  // the "View voucher" button, and the guard that stops a bill already on an
  // unpaid voucher being vouchered or paid twice.
  const [vouchers, setVouchers] = useState<APDisbursementListItem[]>([])
  const [totalUnfiltered, setTotalUnfiltered] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const [billRes, voucherRes] = await Promise.all([
      APBills.list({
        search: search || undefined,
        status: statusView || undefined,
      }),
      APBills.listDisbursements(search ? { search } : undefined),
    ])
    setItems(billRes.data?.items ?? [])
    setTotalUnfiltered(billRes.data?.totalUnfiltered ?? 0)
    setVouchers(voucherRes.data?.items ?? [])
    setLoading(false)
  }, [search, statusView])
  useEffect(() => {
    load()
  }, [load])

  /** Just the invoices. Vouchers had their own rows here for a while; they are
   * gone because a voucher has none of the four statuses this list shows
   * (DRAFT/RECEIVED/PARTIAL/PAID) and inventing a fifth for it put the same
   * fact on screen twice — once as a voucher row, once on the invoice it
   * covered. The invoice's "View voucher" button is the way to it now, and the
   * Payments screen still lists vouchers in their own right. */
  const rows = items

  const printVoucher = async (disbursementId: string) => {
    const res = await getApDisbursementDocument(disbursementId)
    if (res.success && res.data) printAPPaymentVoucherDocument(res.data)
    else alert(res.message || res.error || 'Could not build the voucher')
  }

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
  const selectedTotal = selected.reduce((sum, b) => sum + apOutstanding(b), 0)
  const offscreenCount = selectedIds.length - selected.length

  /** The voucher covering an invoice, however it was paid.
   *
   * A settled invoice always has one — you cannot pay without cutting a
   * voucher — so a blank here on a PAID bill means the voucher is not
   * reachable, not that none exists. The legacy fallback is exactly that case:
   * bills paid through the retired per-bill route carry their number on
   * APBill.voucherNumber and have no allocation to read. */
  const voucherFor = (b: APBill) => {
    const alloc = (b.disbursementAllocations ?? []).find(
      (a) => a.disbursement.status !== 'CANCELLED'
    )
    if (alloc)
      return {
        id: alloc.disbursement.id,
        number: alloc.disbursement.voucherNumber,
        status: alloc.disbursement.status,
      }
    // Paid through the retired per-bill route: the number is on the bill and
    // there is no disbursement to open, so the button has nothing to point at.
    if (b.voucherNumber) return { id: null, number: b.voucherNumber, status: 'PAID' as const }
    return null
  }

  /** Invoice id -> how much of it is already committed to unpaid vouchers.
   *
   * Several open vouchers on one invoice are allowed — ₱1,000 on one and the
   * rest on another — so this is not a block. It only matters once they add up
   * to the whole balance, at which point there is nothing left to voucher or
   * pay. The server enforces the same cap; this is so the reason is visible
   * before someone builds a selection the save will refuse. */
  const committedByBill = new Map<string, number>()
  for (const v of vouchers) {
    if (v.status !== 'UNPAID' && v.status !== 'PARTIAL') continue
    for (const inv of v.invoices) {
      committedByBill.set(inv.billId, (committedByBill.get(inv.billId) ?? 0) + inv.amount)
    }
  }
  /** What is left to voucher or pay on an invoice, after open vouchers. */
  const uncommitted = (b: APBill) => apOutstanding(b) - (committedByBill.get(b.id) ?? 0)

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
      if (uncommitted(b) <= 0.005)
        return 'Fully committed to unpaid vouchers already — pay or cancel one first.'
      if (apOutstanding(b) <= 0.005) return 'Nothing outstanding on this invoice.'
      if (!PAYABLE.includes(b.status)) return `A ${b.status} invoice can't be paid`
      if (lockedSupplierId && b.supplierId !== lockedSupplierId)
        return `One cheque pays one supplier. Clear the selection to pay ${b.supplier?.name ?? 'this supplier'}.`
      return null
    }
    // Nothing selected yet — anything actionable is fair game.
    if (b.status === 'DRAFT') return null
    if (uncommitted(b) <= 0.005)
      return 'Fully committed to unpaid vouchers already — pay or cancel one first.'
    if (apOutstanding(b) <= 0.005) return 'Nothing outstanding on this invoice.'
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
    // Raise a voucher for this one invoice without going through the
    // selection bar first. Offered only where it can actually be done: the
    // bill has to be payable, still owe something, and not already be held by
    // an unpaid voucher — the same conditions disabledReason() applies to the
    // checkbox, and the server enforces regardless.
    ...(PAYABLE.includes(b.status) && uncommitted(b) > 0.005
      ? [
          {
            label: 'Create voucher',
            icon: FileText,
            onClick: () =>
              router.push(
                `/accounting/ap-bills/payments/new?supplier=${b.supplierId ?? ''}&bills=${b.id}&voucherOnly=1`
              ),
          },
        ]
      : []),
    { label: 'Print', icon: Printer, onClick: () => printOne(b) },
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

  /** Both selection actions open the same form; the only difference is whether
   * it starts with Pay now on. Two buttons rather than one, because "raise a
   * voucher for these five invoices" is a distinct intent from "pay them", and
   * hiding it behind a toggle inside a screen called Record Payment means
   * nobody finds it. */
  const openPaymentForm = (voucherOnly: boolean) => {
    if (!selectedIds.length) return
    const params = new URLSearchParams()
    if (lockedSupplierId) params.set('supplier', lockedSupplierId)
    params.set('bills', selectedIds.join(','))
    if (voucherOnly) params.set('voucherOnly', '1')
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
              inside the form.

              Hidden while a selection is active. The action bar shows its own
              Record Payment then, and that one carries the ticked invoices in
              the URL — two identically-labelled buttons where only one respects
              your selection is a trap, and this was the one that silently
              dropped it. */}
          {selectedIds.length === 0 && (
            <Link
              href="/accounting/ap-bills/payments/new"
              className="flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <PhilippinePeso className="w-4 h-4" /> Record Payment
            </Link>
          )}
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
              <>
                <button
                  onClick={() => openPaymentForm(true)}
                  className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  <FileText className="h-4 w-4" /> Create Voucher
                </button>
                <button
                  onClick={() => openPaymentForm(false)}
                  className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  <PhilippinePeso className="h-4 w-4" /> Record Payment
                </button>
              </>
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
          <select
            aria-label="Filter by status"
            value={statusView}
            onChange={(e) => setStatusView(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {STATUS_VIEWS.map((v) => (
              <option key={v.label} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          {/* Says what is being hidden and why, in words. A filtered list that
              only reports its own length reads as "you have 3 bills". */}
          <span className="self-center text-[13px] text-gray-500">
            {search ? (
              <>Search shows every status</>
            ) : statusView === '' ? (
              <>{items.length} bills</>
            ) : (
              <>
                {items.length} of {totalUnfiltered}
                {totalUnfiltered > items.length && (
                  <button
                    type="button"
                    onClick={() => setStatusView('')}
                    className="ml-2 font-medium text-purple-700 hover:underline"
                  >
                    Show all
                  </button>
                )}
              </>
            )}
          </span>
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
              {/* Without this column Total − Paid wouldn't equal Outstanding on
                  any bill with withholding, and the gap would look like a bug. */}
              <th className="px-3 py-2 text-right">Withheld</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                  No bills.
                </td>
              </tr>
            ) : (
              rows.map((b, rowIdx) => {
                return (
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
                            side={rowIdx >= rows.length - 2 ? 'top' : 'bottom'}
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
                          Pending SI
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
                    <td className="px-3 py-2 text-right text-gray-500">
                      {b.withholdingAmount ? fmtMoney(b.withholdingAmount) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtMoney(b.amountPaid)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(apOutstanding(b))}</td>
                    <td className="px-3 py-2">
                      {/* The invoice's own status and nothing else. A voucher
                          is a fact about the voucher, not a state of the bill,
                          so it gets a button rather than a word here — an
                          invoice part-paid and awaiting a voucher has to be
                          able to say both at once.

                          One nowrap flex row, because these were inline: the
                          wider words wrapped their button onto a second line
                          while the shorter ones did not, so RECEIVED and PAID
                          rows came out different heights down the same
                          column. */}
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {b.status}
                        </span>
                        {(() => {
                          const v = voucherFor(b)
                          if (!v?.id) return null
                          return (
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation()
                                printVoucher(v.id!)
                              }}
                              title={`Voucher ${v.number}${v.status === 'UNPAID' ? ' — raised, not yet paid' : ''}`}
                              className="rounded-full border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
                            >
                              View voucher
                            </button>
                          )
                        })()}
                        {b.isAutoGenerated && b.status === 'DRAFT' && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                            From Receiving
                          </span>
                        )}
                        {/* voucherApprovalStatus printed a second line here
                          ("Voucher: Approved") from the approve-then-pay flow
                          the client retired — "no need digital approval for
                          voucher". It survived only on bills raised before that,
                          so one row in eight grew an extra line saying something
                          no longer true, against a status column that is meant
                          to read DRAFT / RECEIVED / PARTIAL / PAID and nothing
                          else. */}
                      </div>
                    </td>
                    {/* Scenario 46 — one overflow menu rather than a row of
                      coloured icons. Bulk receive and payment still live in
                      the selection bar; this is the per-bill equivalent, and
                      it mirrors the same menu on the bill's detail page. */}
                    <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <RowActionsMenu items={rowMenu(b)} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
