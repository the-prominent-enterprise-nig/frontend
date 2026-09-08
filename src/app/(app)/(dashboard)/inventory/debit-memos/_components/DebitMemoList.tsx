'use client'

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, RefreshCw, Pencil, PackageX, Check, Ban } from 'lucide-react'
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
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { MemoTable, type MemoColumn } from '@/src/components/accounting/MemoTable'
import { SupplierDebitMemoDetail } from '@/src/components/accounting/SupplierDebitMemoDetail'
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

/** A row action waiting on its confirmation. */
type PendingAction = { memo: SupplierDebitMemo; action: 'approve' | 'void' }

/** What each confirmation says. The three sit together rather than inline at
 * their buttons because the wording is the only thing that separates them,
 * and all three describe the same three consequences in the same order —
 * the GL, the stock and the invoice. */
function confirmCopy(pending: PendingAction): {
  title: string
  message: ReactNode
  confirmLabel: string
  destructive?: boolean
} {
  const { memo, action } = pending

  if (action === 'approve') {
    return {
      title: `Approve ${memo.memoNumber}?`,
      message: (
        <p>
          This posts it straight away — the stock moves, the journal entry is posted, and the
          invoice balance drops by <strong>{fmtMoney(memo.amount)}</strong>. Accounting can see it
          from then on.
        </p>
      ),
      confirmLabel: 'Approve',
    }
  }

  return {
    title: `Void ${memo.memoNumber}?`,
    message:
      memo.status === 'FINAL' ? (
        <p>
          This reverses its journal entry, restores the stock and rolls the invoice balance back by{' '}
          <strong>{fmtMoney(memo.amount)}</strong>.
        </p>
      ) : (
        <p>It has posted nothing, so there is nothing to reverse.</p>
      ),
    confirmLabel: 'Void',
    destructive: true,
  }
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
  // Every row action that cannot be undone routes through one dialog rather
  // than three: what is being confirmed is entirely a function of the memo
  // and the verb, so a single <ConfirmDialog/> reads them off `pending`.
  const [pending, setPending] = useState<PendingAction | null>(null)

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

  async function run(id: string, action: 'approve' | 'void') {
    setBusy(id)
    const res =
      action === 'approve'
        ? await SupplierDebitMemos.approve(id)
        : await SupplierDebitMemos.void(id)
    setBusy(null)
    setPending(null)

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

  // The same eight facts Accounting lists, minus its Party column — every row
  // here is a supplier — and with the status read in Inventory's words.
  const columns: MemoColumn<SupplierDebitMemo>[] = [
    {
      key: 'memoNumber',
      header: 'Memo No.',
      cellClassName: 'font-mono text-xs text-zinc-700',
      render: (m) => m.memoNumber,
    },
    { key: 'memoDate', header: 'Issue Date', render: (m) => fmtDate(m.memoDate) },
    { key: 'supplier', header: 'Supplier', render: (m) => m.supplier?.name ?? '—' },
    { key: 'apBill', header: 'Invoice (SI)', render: (m) => m.apBill?.billNumber ?? '—' },
    { key: 'dr', header: 'DR No.', render: (m) => m.deliveryReceiptNumber ?? '—' },
    { key: 'items', header: 'Items', align: 'right', render: (m) => m.lines?.length ?? 0 },
    {
      key: 'amount',
      header: 'Total',
      align: 'right',
      cellClassName: 'font-medium text-zinc-900',
      render: (m) => fmtMoney(m.amount),
    },
    {
      key: 'status',
      header: 'Status',
      // Not MemoStatusBadge: it paints APPROVED amber, meaning "waiting to
      // post". Here APPROVED is what posted, so it has to read as done.
      render: (m) => (
        <span
          title={STATUS_HINT[shownStatus(m.status)]}
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE[shownStatus(m.status)]}`}
        >
          {shownStatus(m.status)}
        </span>
      ),
    },
  ]

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
          <MemoTable
            rows={memos}
            columns={columns}
            getRowId={(m) => m.id}
            loading={query.isLoading}
            emptyState={
              <>
                <PackageX className="mx-auto h-8 w-8 text-zinc-300" />
                <p className="mt-2 text-sm text-zinc-500">No debit memos yet.</p>
                <p className="text-xs text-zinc-400">
                  Raise one when a supplier agrees to take defective stock back.
                </p>
              </>
            }
            renderExpanded={(memo) => (
              <SupplierDebitMemoDetail memo={memo}>
                {/* Attaching or replacing the waybill posts nothing, so a
                    posted memo stays open to it. A void one is closed, like
                    the rest of it. */}
                <WaybillPanel memoId={memo.id} readOnly={memo.status === 'VOID'} />
              </SupplierDebitMemoDetail>
            )}
            renderActions={(memo) => (
              <>
                {/* A posted memo is editable too — saving one re-posts it
                    rather than raising a second document. Only a void memo is
                    closed to edits. */}
                {memo.status !== 'VOID' && canCreate && (
                  <button
                    type="button"
                    onClick={() => openEdit(memo)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label={memo.status === 'DRAFT' ? 'Edit draft' : 'Edit memo'}
                    title={
                      memo.status === 'DRAFT' ? 'Edit draft' : 'Edit — saving re-posts this memo'
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {memo.status === 'DRAFT' && canApprove && (
                  <button
                    type="button"
                    disabled={busy === memo.id}
                    onClick={() => setPending({ memo, action: 'approve' })}
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
                    onClick={() => setPending({ memo, action: 'void' })}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Void
                  </button>
                )}
              </>
            )}
          />
        </div>

        <p className="text-xs text-zinc-400">
          Approving is the step that posts the memo — it moves the stock, posts the journal entry
          and reduces the invoice. Accounting sees it only once it is approved. Editing a memo that
          has already posted re-posts it — one memo under one number, with the correction visible in
          the ledger.
        </p>
      </div>

      {pending && (
        <ConfirmDialog
          open
          {...confirmCopy(pending)}
          loading={busy === pending.memo.id}
          onCancel={() => setPending(null)}
          onConfirm={() => run(pending.memo.id, pending.action)}
        />
      )}

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
