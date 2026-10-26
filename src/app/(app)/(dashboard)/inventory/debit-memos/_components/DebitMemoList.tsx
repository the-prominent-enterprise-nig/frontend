'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  PackageX,
  Pencil,
  Printer,
  Search,
} from 'lucide-react'
import { printMemo } from '../_lib/print-memo'
import { fmtDate, fmtMoney, SupplierDebitMemos } from '@/src/libs/data/AccountingV2Data'
import type { SupplierDebitMemo } from '@/src/libs/data/AccountingV2Data'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { showToast } from '@/src/components/ui/toast'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import { Select } from '@/src/components/ui/Select'
import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import { MONO, PLEX, STOCK_TABLE_HEAD } from '@/src/libs/design/plex'
import {
  appliedLabel,
  linesLabel,
  returningLabel,
  shownStatus,
  STATUS_META,
} from '../_lib/debit-memo-format'
import { MEMO_PAGE_SIZE, useDebitMemos, type DebitMemoStatusFilter } from '../_hooks/useDebitMemos'
import {
  MEMO_TYPE_OPTIONS,
  SUPPLIER_PURPOSE,
  useInternalMemos,
  type MemoTypeFilter,
} from '../_hooks/useInternalMemos'
import type { IdmDetail } from '@/src/schema/accounting/inventory-debit-memos'
import { MemoDetailPanel } from './MemoDetailPanel'
import DebitMemoFormModal from './DebitMemoFormModal'
import { InternalMemoCard, InternalMemoRow, TypeChip } from './InternalMemoRows'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import WaybillPanel from './WaybillPanel'

// Hand-rolled rather than built on the shared MemoTable: this list carries
// two-line cells and a primary action per row, and it has to stack into cards
// on a phone — neither of which that table models. MemoTable still serves the
// four Accounting memo screens, whose shape it does fit.

/** A row action waiting on its confirmation. */
type PendingAction = { memo: SupplierDebitMemo; action: 'approve' | 'void' }

/** One row of the merged list — a supplier return or an internal memo. */
type MemoRow = { kind: 'supplier'; memo: SupplierDebitMemo } | { kind: 'internal'; memo: IdmDetail }

/** What each confirmation says. The two sit together rather than inline at
 * their buttons because the wording is the only thing that separates them,
 * and both describe the same consequences in the same order — the stock and
 * the GL. No invoice moves here: accounting applies the memo to one from the
 * AP voucher (Scenario 72 Part 8). */
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
          This posts it straight away — the stock moves and the journal entry is posted, holding{' '}
          <strong>{fmtMoney(memo.amount)}</strong> as due from the supplier. Accounting can see it
          from then on, and applies it to one of the supplier&apos;s invoices from the AP voucher.
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
          This reverses its journal entry and restores the stock
          {memo.apBill ? (
            <>
              {' '}
              and rolls the invoice balance back by <strong>{fmtMoney(memo.amount)}</strong>
            </>
          ) : null}
          .{memo.deliveryReceipt ? ` ${memo.deliveryReceipt.drNumber} is voided with it.` : ''}
        </p>
      ) : (
        <p>It has posted nothing, so there is nothing to reverse.</p>
      ),
    confirmLabel: 'Void',
    destructive: true,
  }
}

function StatusChip({ status }: { status: SupplierDebitMemo['status'] }) {
  const meta = STATUS_META[shownStatus(status)]
  return (
    <span
      title={meta.hint}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${meta.chip}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

/** Primary action plus the overflow, shared by the desktop row and the mobile
 * card so the two can't drift over which buttons show for which status.
 *
 * Only one verb is ever promoted to a button: approving a draft is the
 * time-sensitive one, so it takes the slot when it applies and editing takes
 * it otherwise. Whatever the button already does is left out of the menu. */
function MemoRowActions({
  memo,
  canCreate,
  canApprove,
  canVoid,
  busy,
  full,
  onEdit,
  onApprove,
  onVoid,
}: {
  memo: SupplierDebitMemo
  canCreate: boolean
  canApprove: boolean
  canVoid: boolean
  busy: boolean
  /** Stretches the button across a mobile card instead of sizing to its text. */
  full?: boolean
  onEdit: () => void
  onApprove: () => void
  onVoid: () => void
}) {
  const isVoid = memo.status === 'VOID'
  const isDraft = memo.status === 'DRAFT'
  // Applied on an AP voucher: the voucher's deduction carries its amount, so
  // the memo is locked until the voucher lets go of it (Scenario 72 Part 8).
  const isApplied = !!memo.appliedDeduction
  // Drafted with its "Return units to supplier" DR, a memo waits on the
  // Branch Manager: it can be repriced now, but posts (or is withdrawn) only
  // once the DR is approved (Scenario 72 Part 8).
  const drStatus = memo.deliveryReceipt?.status
  const awaitingDr = drStatus === 'draft' || drStatus === 'pending_approval'
  // A posted memo is editable too — saving one re-posts it rather than
  // raising a second document. A void or applied memo is closed to edits.
  const editable = !isVoid && !isApplied && canCreate
  const primary = isDraft && canApprove && !awaitingDr ? 'approve' : editable ? 'edit' : null

  const menuItems: RowMenuItem[] = [
    // Every memo prints, whatever its state — a draft carries a watermark.
    { label: 'Print', icon: Printer, onClick: () => void printMemo('supplier', memo.id) },
    ...(editable && primary !== 'edit'
      ? [
          {
            label: memo.status === 'DRAFT' ? 'Edit draft' : 'Edit — saving re-posts this memo',
            icon: Pencil,
            onClick: onEdit,
          },
        ]
      : []),
    ...(!isVoid && !isApplied && !awaitingDr && canVoid
      ? [{ label: 'Void', icon: Ban, onClick: onVoid, variant: 'danger' as const }]
      : []),
  ]

  if (!primary && menuItems.length === 0) {
    return <span className="text-xs text-[#a3a3b2]">—</span>
  }

  return (
    <div className={`flex items-center gap-1 ${full ? '' : 'justify-end'}`}>
      {primary === 'approve' && (
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#5b21b6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4a189b] disabled:opacity-50 ${full ? 'flex-1 py-2.5 text-sm' : ''}`}
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
      )}
      {primary === 'edit' && (
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          title={memo.status === 'DRAFT' ? 'Edit draft' : 'Edit — saving re-posts this memo'}
          className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d3d3db] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3d4a] hover:border-[#a3a3b2] hover:bg-[#fbfbfc] disabled:opacity-50 ${full ? 'flex-1 py-2.5 text-sm' : ''}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          {memo.status === 'DRAFT' ? 'Continue' : 'Edit'}
        </button>
      )}
      {menuItems.length > 0 && <RowActionsMenu items={menuItems} />}
    </div>
  )
}

/**
 * Every debit memo in one list (Scenario 72): supplier returns, raised and
 * approved here, and the internal DMINV memos delivery receipts draft, read
 * here and posted by accounting. Two documents underneath, told apart by a
 * Type filter and chip. Nothing is raised here (client): every memo comes
 * from its delivery receipt — a return to supplier, or an approved DR.
 */
export default function DebitMemoList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_CREATE)
  const canApprove = hasPermission(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_APPROVE)
  const canVoid = hasPermission(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_VOID)

  const {
    memos,
    allMemos,
    stats,
    suppliers,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useDebitMemos()

  const [type, setType] = useState<MemoTypeFilter>('all')
  const [requestedPage, setRequestedPage] = useState(1)
  const canOpenMemo = hasPermission(session, ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_READ)
  const internal = useInternalMemos(filters, type)

  const rows: MemoRow[] = useMemo(() => {
    const supplierRows: MemoRow[] =
      type === 'all' || type === SUPPLIER_PURPOSE
        ? memos.map((memo) => ({ kind: 'supplier', memo }))
        : []
    const internalRows: MemoRow[] = internal.memos.map((memo) => ({ kind: 'internal', memo }))
    return [...supplierRows, ...internalRows].sort((a, b) => {
      const byDate = new Date(b.memo.memoDate).getTime() - new Date(a.memo.memoDate).getTime()
      return byDate !== 0 ? byDate : b.memo.memoNumber.localeCompare(a.memo.memoNumber)
    })
  }, [memos, internal.memos, type])

  // Paged after merging, same as the hook pages the supplier memos alone.
  const pageCount = Math.max(1, Math.ceil(rows.length / MEMO_PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const pageStart = (page - 1) * MEMO_PAGE_SIZE
  const pageRows = rows.slice(pageStart, pageStart + MEMO_PAGE_SIZE)

  function applyFilters(patch: Parameters<typeof setFilters>[0]) {
    setFilters(patch)
    setRequestedPage(1)
  }
  function clearFilters() {
    resetFilters()
    setType('all')
    setRequestedPage(1)
  }
  const anyFilter = hasActiveFilters || type !== 'all'

  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierDebitMemo | null>(null)
  // Every row action that cannot be undone routes through one dialog rather
  // than two: what is being confirmed is entirely a function of the memo and
  // the verb, so a single <ConfirmDialog/> reads them off `pending`.
  const [pending, setPending] = useState<PendingAction | null>(null)

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
          ? 'Stock moved and the journal entry posted. Accounting can see it now and applies it to an invoice from the AP voucher.'
          : 'Any posting and stock movement has been reversed.',
      status: 'success',
    })
    refetch()
  }

  const pills: { value: DebitMemoStatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: stats.total + internal.stats.total },
    { value: 'DRAFT', label: 'Draft', count: stats.drafts + internal.stats.drafts },
    { value: 'FINAL', label: 'Approved / posted', count: stats.approved + internal.stats.approved },
    { value: 'VOID', label: 'Void', count: stats.voided + internal.stats.voided },
  ]

  const loading = isLoading || internal.isLoading
  const isEmptyOverall = !loading && allMemos.length === 0 && internal.all.length === 0
  const isFilteredEmpty = !loading && !isEmptyOverall && rows.length === 0

  return (
    <div
      className={`min-h-full w-full bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px] ${PLEX}`}
    >
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Debit Memos</h1>
            {/* Says "back out" because the Returns screen moves stock the
                opposite way and the two names can't tell them apart. */}
            <p className="mt-1 text-sm text-[#5b5b6b]">
              Supplier returns going <strong>back out</strong> to a supplier, and the internal memos
              approved delivery receipts post.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b9b]" />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => applyFilters({ query: e.target.value })}
              placeholder="Search memo no., invoice, DR, supplier, or item…"
              className="w-full rounded-lg border border-[#e4e4e9] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
            />
          </div>
          <div className="w-60">
            <Select
              value={type}
              onChange={(value) => {
                setType(value as MemoTypeFilter)
                setRequestedPage(1)
              }}
              options={MEMO_TYPE_OPTIONS}
              compact
            />
          </div>
          <div className="w-56">
            <Select
              value={filters.supplierId}
              onChange={(value) => applyFilters({ supplierId: value })}
              options={[
                { value: 'all', label: 'All suppliers' },
                ...suppliers.map((s) => ({ value: s.id, label: s.name })),
              ]}
              compact
            />
          </div>
          {anyFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#3f1490] hover:bg-[#f1ebfb]"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          {pills.map((pill) => {
            const isOn = filters.status === pill.value
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => applyFilters({ status: pill.value })}
                aria-pressed={isOn}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  isOn
                    ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
                    : 'border-[#e4e4e9] bg-white text-[#3d3d4a] hover:border-[#d3d3db]'
                }`}
              >
                {pill.label}
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${isOn ? 'bg-white/20' : 'bg-[#f1f1f4] text-[#5b5b6b]'}`}
                >
                  {pill.count}
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-4">
            <p className="text-sm font-medium text-[#8f1c14]">Failed to load debit memos</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white shadow-sm transition-opacity ${isFetching || internal.isFetching ? 'opacity-60' : ''}`}
        >
          {loading ? (
            <div className="p-8 text-center text-sm text-[#8b8b9b]">Loading debit memos…</div>
          ) : isEmptyOverall ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <PackageX className="mb-3 h-10 w-10 text-[#c9c9d3]" />
              <p className="text-sm font-medium text-[#3d3d4a]">No debit memos yet</p>
              <p className="mt-1 max-w-lg text-xs leading-relaxed text-[#5b5b6b]">
                Memos come from delivery receipts: a &quot;Return units to supplier&quot; DR drafts
                a supplier memo, and an approved DR with a debit memo drafts an internal one for
                accounting.
              </p>
            </div>
          ) : isFilteredEmpty ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <Search className="mb-3 h-8 w-8 text-[#c9c9d3]" />
              <p className="text-sm font-medium text-[#3d3d4a]">No memos match</p>
              <p className="mt-1 max-w-md text-xs text-[#5b5b6b]">
                {filters.query
                  ? `Nothing matches “${filters.query}” inside the current filters.`
                  : 'No memo falls inside these filters.'}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg border border-[#e4e4e9] px-4 py-2 text-sm font-medium text-[#3d3d4a] hover:border-[#d3d3db] hover:bg-[#fbfbfc]"
              >
                Clear search and filters
              </button>
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <ul className="divide-y divide-[#eeeef1] md:hidden">
                {pageRows.map((row) => {
                  if (row.kind === 'internal') {
                    return (
                      <InternalMemoCard
                        key={row.memo.id}
                        memo={row.memo}
                        canOpenMemo={canOpenMemo}
                      />
                    )
                  }
                  const memo = row.memo
                  const isOpen = expanded === memo.id
                  return (
                    <li key={memo.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : memo.id)}
                          aria-expanded={isOpen}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span
                            className={`${MONO} block truncate text-[13px] font-semibold text-[#17171c]`}
                          >
                            {memo.memoNumber}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[#3d3d4a]">
                            {memo.supplier?.name ?? '—'} · {appliedLabel(memo).text}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[#8b8b9b]">
                            {fmtDate(memo.memoDate)} · {returningLabel(memo)}
                          </span>
                        </button>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <StatusChip status={memo.status} />
                          <span className={`${MONO} text-[13px] font-semibold text-[#17171c]`}>
                            {fmtMoney(memo.amount)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-[11px] text-[#8b8b9b]">{linesLabel(memo)}</span>
                      </div>
                      <div className="mt-3 border-t border-[#eeeef1] pt-3">
                        <MemoRowActions
                          memo={memo}
                          canCreate={canCreate}
                          canApprove={canApprove}
                          canVoid={canVoid}
                          busy={busy === memo.id}
                          full
                          onEdit={() => openEdit(memo)}
                          onApprove={() => setPending({ memo, action: 'approve' })}
                          onVoid={() => setPending({ memo, action: 'void' })}
                        />
                      </div>
                      {isOpen && (
                        <div className="mt-3">
                          <MemoDetailPanel memo={memo}>
                            <WaybillPanel memoId={memo.id} readOnly={memo.status === 'VOID'} />
                          </MemoDetailPanel>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                {/* table-fixed, so every column has to be wide enough for its
                    own content: an overflowing cell spills over the one beside
                    it rather than wrapping. Status and Actions are sized around
                    their widest real content — a status chip, and an Edit
                    button next to the overflow menu — and carry tighter side
                    padding to buy it. */}
                <table className="w-full min-w-[72rem] table-fixed text-sm">
                  <thead>
                    {/* align-bottom so a heading that wraps to two lines still
                        sits on the same baseline as the ones that don't. */}
                    <tr
                      className={`border-b border-[#eeeef1] bg-[#fbfbfc] text-left align-bottom ${STOCK_TABLE_HEAD}`}
                    >
                      <th className="w-[4%] px-2 py-3" />
                      <th className="w-[16%] px-4 py-3">Memo</th>
                      <th className="w-[14%] px-4 py-3">Supplier / purpose</th>
                      <th className="w-[13%] whitespace-nowrap px-4 py-3">Applied to / DR</th>
                      <th className="w-[14%] px-4 py-3">Returning / dept.</th>
                      <th className="w-[13%] px-4 py-3 text-right">Value</th>
                      <th className="w-[12%] px-3 py-3">Status</th>
                      <th className="w-[14%] px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeeef1]">
                    {pageRows.map((row) => {
                      if (row.kind === 'internal') {
                        return (
                          <InternalMemoRow
                            key={row.memo.id}
                            memo={row.memo}
                            canOpenMemo={canOpenMemo}
                          />
                        )
                      }
                      const memo = row.memo
                      const isOpen = expanded === memo.id
                      return (
                        <Fragment key={memo.id}>
                          <tr
                            className={`align-top ${isOpen ? 'bg-[#fdfcff]' : 'hover:bg-[#fbfbfc]'}`}
                          >
                            <td className="px-2 py-3">
                              <button
                                type="button"
                                onClick={() => setExpanded(isOpen ? null : memo.id)}
                                aria-expanded={isOpen}
                                aria-label={isOpen ? 'Collapse memo' : 'Expand memo'}
                                className={`rounded-md p-1.5 ${isOpen ? 'bg-[#f1ebfb] text-[#3f1490]' : 'text-[#8b8b9b] hover:bg-[#f1f1f4]'}`}
                              >
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setExpanded(isOpen ? null : memo.id)}
                                className={`${MONO} block max-w-full truncate text-[12.5px] font-semibold text-[#17171c] hover:text-[#3f1490]`}
                              >
                                {memo.memoNumber}
                              </button>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[#8b8b9b]">
                                <TypeChip internal={false} />
                                {fmtDate(memo.memoDate)}
                                {memo.finalizedAt && ` · posted ${fmtDate(memo.finalizedAt)}`}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="block truncate text-[12.5px] font-medium text-[#17171c]">
                                {memo.supplier?.name ?? '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {/* The supplier invoice accounting applied the
                                  memo to from the AP voucher — none until then
                                  (Scenario 72 Part 8). */}
                              <span
                                className={`${MONO} block truncate text-[12px] ${appliedLabel(memo).pending ? 'text-[#8a4b06]' : 'text-[#3d3d4a]'}`}
                                title={appliedLabel(memo).text}
                              >
                                {appliedLabel(memo).text}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="block truncate text-[12.5px] text-[#3d3d4a]">
                                {returningLabel(memo)}
                              </span>
                              <span className="mt-0.5 block truncate text-[10.5px] text-[#8b8b9b]">
                                {linesLabel(memo)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`${MONO} block text-[13.5px] font-semibold text-[#17171c]`}
                              >
                                {fmtMoney(memo.amount)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <StatusChip status={memo.status} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <MemoRowActions
                                memo={memo}
                                canCreate={canCreate}
                                canApprove={canApprove}
                                canVoid={canVoid}
                                busy={busy === memo.id}
                                onEdit={() => openEdit(memo)}
                                onApprove={() => setPending({ memo, action: 'approve' })}
                                onVoid={() => setPending({ memo, action: 'void' })}
                              />
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-[#fdfcff]">
                              <td colSpan={8} className="px-6 pb-5 pt-1">
                                <MemoDetailPanel memo={memo}>
                                  {/* Attaching or replacing the waybill posts
                                      nothing, so a posted memo stays open to
                                      it. A void one is closed, like the rest
                                      of it. */}
                                  <WaybillPanel
                                    memoId={memo.id}
                                    readOnly={memo.status === 'VOID'}
                                  />
                                </MemoDetailPanel>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ListFooterPager
                page={page}
                pageCount={pageCount}
                shown={pageRows.length}
                total={rows.length}
                noun={rows.length === 1 ? 'memo' : 'memos'}
                onPageChange={setRequestedPage}
              />
            </>
          )}
        </div>
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
          refetch()
        }}
      />
    </div>
  )
}
