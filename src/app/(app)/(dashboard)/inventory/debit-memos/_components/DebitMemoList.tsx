'use client'

import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, RefreshCw, Pencil, PackageX, Paperclip, Check, Ban } from 'lucide-react'
import {
  SupplierDebitMemos,
  fmtDate,
  fmtMoney,
  type SupplierDebitMemo,
  type SupplierDebitMemoStatus,
} from '@/src/libs/data/AccountingV2Data'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { showToast } from '@/src/components/ui/toast'
import DebitMemoFormModal from './DebitMemoFormModal'
import WaybillPanel from './WaybillPanel'

/** Inventory's word for a posted memo is "Approved": the warehouse approves
 * the return, and approving is what posts it. "Final" is accounting's word
 * for the very same row, and the Accounting hub still says Final — one
 * status, two audiences. Only the label differs; the stored value is always
 * FINAL, which is what the status filter and the API still exchange. */
type ShownStatus = Exclude<SupplierDebitMemoStatus, 'FINAL'>

function shownStatus(status: SupplierDebitMemoStatus): ShownStatus {
  return status === 'FINAL' ? 'APPROVED' : status
}

// DRAFT deliberately reads as "nothing has happened yet" — the colour
// only warms up once the memo has actually posted.
const STATUS_BADGE: Record<ShownStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  VOID: 'bg-gray-100 text-gray-500 ring-gray-200',
}

const STATUS_HINT: Record<ShownStatus, string> = {
  DRAFT: 'Not yet sent to accounting',
  APPROVED: 'Posted — stock moved and the invoice reduced',
  VOID: 'Reversed',
}

export default function DebitMemoList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_CREATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_APPROVE)
  const canVoid = hasPermission(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_VOID)
  const [busy, setBusy] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SupplierDebitMemoStatus | ''>('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierDebitMemo | null>(null)
  const [waybillFor, setWaybillFor] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['supplier-debit-memos', statusFilter, search],
    queryFn: () =>
      SupplierDebitMemos.list({
        ...(statusFilter && { status: statusFilter }),
        ...(search && { search }),
      }),
    staleTime: 30_000,
  })
  const memos = query.data?.data?.items ?? []

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(memo: SupplierDebitMemo) {
    setEditing(memo)
    setFormOpen(true)
  }

  async function run(id: string, action: 'approve' | 'void', confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setBusy(id)
    const res =
      action === 'approve'
        ? await SupplierDebitMemos.approve(id)
        : await SupplierDebitMemos.void(id)
    setBusy(null)

    if (!res.success) {
      showToast({
        title: `Could not ${action}`,
        description: res.message || res.error || `Failed to ${action} the memo`,
        status: 'error',
      })
      return
    }
    showToast({
      title: action === 'approve' ? 'Memo approved' : 'Memo voided',
      description:
        action === 'approve'
          ? 'Stock moved, the journal entry posted, and the invoice balance reduced. Accounting can see it now.'
          : 'Any posting, stock movement and invoice change has been reversed.',
      status: 'success',
    })
    query.refetch()
  }

  return (
    <div className="min-h-full w-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Debit Memos</h1>
            {/* Says "back out" because the Returns screen moves stock the
                opposite way and the two names can't tell them apart. Kept
                short so it never crowds the buttons. */}
            <p className="mt-1 text-sm text-zinc-500">
              Defective stock going <strong>back out</strong> to a supplier, deducted from one of
              their open invoices.
            </p>
          </div>
          {/* shrink-0 so a long heading can never squash these. */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={openNew}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Debit Memo
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memo no., DR no. or reason…"
            className="min-w-64 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SupplierDebitMemoStatus | '')}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="FINAL">Approved</option>
            <option value="VOID">Void</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Memo No.</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Invoice (SI)</th>
                  <th className="px-4 py-3">DR No.</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {query.isLoading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-zinc-400">
                      Loading…
                    </td>
                  </tr>
                )}
                {!query.isLoading && memos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <PackageX className="mx-auto h-8 w-8 text-zinc-300" />
                      <p className="mt-2 text-sm text-zinc-500">No debit memos yet.</p>
                      <p className="text-xs text-zinc-400">
                        Raise one when a supplier agrees to take defective stock back.
                      </p>
                    </td>
                  </tr>
                )}
                {memos.map((memo) => (
                  <Fragment key={memo.id}>
                    <tr className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                        {memo.memoNumber}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{fmtDate(memo.memoDate)}</td>
                      <td className="px-4 py-3 text-zinc-800">{memo.supplier?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{memo.apBill?.billNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {memo.deliveryReceiptNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                        {memo.lines?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                        {fmtMoney(memo.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          title={STATUS_HINT[shownStatus(memo.status)]}
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE[shownStatus(memo.status)]}`}
                        >
                          {shownStatus(memo.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setWaybillFor(waybillFor === memo.id ? null : memo.id)}
                            className={`rounded p-1.5 hover:bg-zinc-100 ${
                              waybillFor === memo.id
                                ? 'text-prominent-purple-700'
                                : 'text-zinc-400 hover:text-zinc-700'
                            }`}
                            aria-label="Waybill"
                            title="Waybill"
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                          {memo.status === 'DRAFT' && canCreate && (
                            <button
                              type="button"
                              onClick={() => openEdit(memo)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                              aria-label="Edit draft"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {memo.status === 'DRAFT' && canApprove && (
                            <button
                              type="button"
                              disabled={busy === memo.id}
                              onClick={() =>
                                run(
                                  memo.id,
                                  'approve',
                                  `Approve ${memo.memoNumber}? This posts it straight away — the stock moves, the journal entry is posted, and the invoice balance drops by ${fmtMoney(memo.amount)}.`
                                )
                              }
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                          )}
                          {memo.status !== 'VOID' && canVoid && (
                            <button
                              type="button"
                              disabled={busy === memo.id}
                              onClick={() =>
                                run(
                                  memo.id,
                                  'void',
                                  memo.status === 'FINAL'
                                    ? `Void ${memo.memoNumber}? This reverses its journal entry, restores the stock and rolls back the invoice balance.`
                                    : `Void ${memo.memoNumber}? It has posted nothing, so there is nothing to reverse.`
                                )
                              }
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {waybillFor === memo.id && (
                      <tr className="bg-zinc-50/60">
                        <td colSpan={9} className="px-6 py-3">
                          <WaybillPanel
                            memoId={memo.id}
                            readOnly={memo.status === 'FINAL' || memo.status === 'VOID'}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-zinc-400">
          Approving is the step that posts the memo — it moves the stock, posts the journal entry
          and reduces the invoice. Accounting sees it only once it is approved.
        </p>
      </div>

      <DebitMemoFormModal
        // Remounts per open so the form seeds cleanly from `editing` instead
        // of needing effects to re-sync its internal state.
        key={editing?.id ?? 'new'}
        open={formOpen}
        memo={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          query.refetch()
        }}
      />
    </div>
  )
}
