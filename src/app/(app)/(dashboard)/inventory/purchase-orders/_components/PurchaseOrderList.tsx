'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  Send,
  Archive,
  CheckCircle,
  ChevronDown,
  Download,
  Eye,
  FileText,
  PackagePlus,
  Pencil,
  Receipt,
  Search,
  X,
} from 'lucide-react'
import { usePurchaseOrders } from '../_hooks/usePurchaseOrders'
import { usePurchaseRequests } from '../../purchase-requests/_hooks/usePurchaseRequests'
import { CancelPoModal } from './CancelPoModal'
import { ConfirmActionModal } from '@/src/components/inventory/ConfirmActionModal'
import { CreatePoModal } from './CreatePoModal'
import { PoDetailModal } from './PoDetailModal'
import { PoReceiptsPanel } from './PoReceiptsPanel'
import { PoViewPanel } from './PoViewPanel'
import { ReceiveAgainstPoModal } from './ReceiveAgainstPoModal'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { getSuppliers } from '../_actions/get-suppliers'
import { getBranches } from '../../price-lists/_actions/get-branches'
import { getPurchaseOrder } from '../_actions/get-purchase-order'
import { getPurchaseOrderDocument } from '../_actions/get-purchase-order-document'
import { downloadReactNodeAsPdf } from '@/src/libs/print/htmlToPdf'
import PurchaseOrderSheet, { type PurchaseOrderPrintDocument } from './PurchaseOrderSheet'
import { showToast } from '@/src/components/ui/toast'
import {
  PLEX,
  MONO,
  CONTROL_CHROME,
  StatusBadge,
  SupplierAvatar,
  fmtPeso,
  fmtDate,
  receiptTotals,
  daysLate,
  type PoStatus,
} from './procurementTokens'

// ─── Design tokens ────────────────────────────────────────────────────────────
// PLEX/MONO and the status-badge/formatting helpers live in procurementTokens
// — shared with PoDetailModal so the same order reads identically whether
// it's on the row or open in its detail panel. The page ground is zinc-50
// rather than this design's own grey, so Purchase Orders and Purchase
// Requests sit on the same background.

const STATUS_FILTERS: { label: string; value: PoStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'draft' },
  { label: 'Approved', value: 'approved' },
  { label: 'Sent', value: 'sent' },
  { label: 'Partial', value: 'partially_received' },
  { label: 'Received', value: 'fully_received' },
  { label: 'Closed', value: 'closed' },
  { label: 'Cancelled', value: 'cancelled' },
]

/** The seven-column track the header, rows and skeletons all share. The last
 * track holds the row's action buttons and is sized for the widest run of
 * them — a partially-received order with an invoice: Download · Receive ·
 * Close · Receipts · Invoice, ~208px — so they never wrap to a second line.
 * The data columns were trimmed to pay for it rather than letting the grid
 * overflow its card at the 1080px breakpoint. */
const GRID =
  'grid grid-cols-[154px_minmax(0,1fr)_98px_106px_114px_132px_216px] gap-x-3 items-center'

const SORT_SELECT_CLASS =
  'h-[38px] cursor-pointer appearance-none rounded-lg border border-[#d3d3db] bg-white pl-[11px] pr-[30px] text-[12.5px] text-[#3d3d4a] transition-colors focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc] focus:outline-none'

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ code }: { code: string }): React.ReactElement {
  const copy = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await navigator.clipboard?.writeText(code)
    showToast({ title: `${code} copied`, status: 'success' })
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy PO code"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#a3a3b2] hover:bg-[#f1ebfb] hover:text-[#3f1490]"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
        <path d="M10.5 3.2A1.7 1.7 0 0 0 8.8 2.5H4.2A1.7 1.7 0 0 0 2.5 4.2v4.6c0 .74.47 1.37 1.13 1.6" />
      </svg>
    </button>
  )
}

function ReceivingCell({ po }: { po: PurchaseOrderSummary }): React.ReactElement {
  const { received, ordered, pct } = receiptTotals(po.lines)
  const full = ordered > 0 && received >= ordered
  const bar =
    po.status === 'cancelled'
      ? 'bg-[#d3d3db]'
      : full
        ? 'bg-[#0f7b52]'
        : received > 0
          ? 'bg-[#d18b1d]'
          : 'bg-[#e4e4e9]'
  const pctTone = full ? 'text-[#0b6644]' : received > 0 ? 'text-[#8a4b06]' : 'text-[#5b5b6b]'
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`${MONO} text-[11.5px] text-[#3d3d4a]`}>
          {received} / {ordered}
        </span>
        <span className={`${MONO} text-[11.5px] font-semibold ${pctTone}`}>{pct}%</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#eeeef1]">
        <div className={`h-full rounded-[3px] ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

type RowActionSpec = {
  key: string
  label: string
  /** Accessible name, when the visible label is a shortened form of it. */
  ariaLabel?: string
  icon: React.ReactElement
  /** Purple reads as "this moves the order along" (receive, receipts, the
   * invoice); green is settlement — Close, matching the green this screen
   * already uses for a fully-received order; neutral is for the incidental
   * ones (download, edit). Orange is deliberately not used: on this screen it
   * already means late or partially received, so it would read as a warning
   * rather than as an action. */
  tone?: 'default' | 'purple' | 'green'
  /** 'primary' spells the label out as a filled button — one per status, for
   * the step that status is actually waiting on (Pending → View, Partial →
   * Receive, Received → Close). Everything else stays an icon. */
  variant?: 'icon' | 'primary'
  disabled?: boolean
  run: () => void
}

/** Icon-only action button. It carries no visible text, so the label goes
 * through the shared Tooltip as well as aria-label. */
function IconBtn({ action }: { action: RowActionSpec }): React.ReactElement {
  const tone =
    action.tone === 'purple'
      ? 'border-[#ddd0f7] text-[#5b21b6] hover:bg-[#f1ebfb] hover:text-[#3f1490]'
      : action.tone === 'green'
        ? 'border-[#c3e5d6] text-[#0b6644] hover:bg-[#e7f5ef]'
        : 'border-[#e4e4e9] text-[#5b5b6b] hover:border-[#d3d3db] hover:bg-[#f6f6f8] hover:text-[#17171c]'
  return (
    <Tooltip label={action.label} align="end" className="shrink-0">
      <button
        type="button"
        onClick={action.run}
        disabled={action.disabled}
        aria-label={action.label}
        className={`flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border bg-white transition-colors disabled:opacity-40 ${tone}`}
      >
        {action.icon}
      </button>
    </Tooltip>
  )
}

/** The status's own next step, written out. Filled purple for the ones that
 * move the order forward, green for Close — it settles an order whose stock
 * is already fully in. */
function PrimaryBtn({ action }: { action: RowActionSpec }): React.ReactElement {
  const tone =
    action.tone === 'purple'
      ? 'bg-[#5b21b6] hover:bg-[#4a189b]'
      : action.tone === 'green'
        ? 'bg-[#0f7b52] hover:bg-[#0b6644]'
        : 'bg-[#3d3d4a] hover:bg-[#17171c]'
  return (
    <button
      type="button"
      onClick={action.run}
      disabled={action.disabled}
      aria-label={action.ariaLabel}
      title={action.ariaLabel}
      className={`flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-[10px] text-[12px] font-medium text-white transition-colors disabled:opacity-40 ${tone}`}
    >
      {action.icon}
      {action.label}
    </button>
  )
}

/** The row's actions, laid out inline on a single line — the action track is
 * sized for the longest run, so nothing here wraps or shrinks. */
function RowActions({ actions }: { actions: RowActionSpec[] }): React.ReactElement {
  return (
    <span
      className="flex shrink-0 flex-nowrap items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      role="presentation"
    >
      {actions.map((a) =>
        a.variant === 'primary' ? (
          <PrimaryBtn key={a.key} action={a} />
        ) : (
          <IconBtn key={a.key} action={a} />
        )
      )}
    </span>
  )
}

function SkeletonBar({ wide }: { wide?: boolean }): React.ReactElement {
  return (
    <span
      className={`block animate-pulse rounded-[3px] bg-[#eeeef1] ${
        wide ? 'h-[18px] w-[70px] rounded-[5px]' : 'h-[10px]'
      }`}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PurchaseOrderList({
  canCreate,
  canApprove,
  canSend,
  canCancel,
  canClose,
  canEdit,
  canReceive,
  canViewCost,
  canViewApBill,
  currentUserBranchId,
}: {
  /** Gates the "+ New Purchase" button — creating always drafts a Purchase
   * Request (pending approval) now, so this reflects PR_CREATE, not
   * PO_CREATE. A PO only exists once that PR is approved and converted. */
  canCreate: boolean
  canApprove: boolean
  canSend: boolean
  canCancel: boolean
  canClose: boolean
  /** Scenario 29 PO-06/PO-08 — same PO_UPDATE permission as canClose. */
  canEdit: boolean
  canReceive: boolean
  canViewCost: boolean
  /** Scenario 41 Part 3 — gates "View Invoice" so a role without AP
   * Invoices access doesn't get a link into a page it'll then be denied on. */
  canViewApBill: boolean
  /** Sent as branchId attribution on a created PR — the create modal has no
   * visible branch field (Scenario 27: destination is the Warehouse
   * field), this just flows through to the backend's own server-side
   * force for a branch-scoped creator. */
  currentUserBranchId?: string | null
}): React.ReactElement {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {
    items,
    pagination,
    isLoading,
    statusFilter,
    setStatusFilter,
    sortDir,
    setSortDir,
    search,
    setSearch,
    supplierId,
    setSupplierId,
    branchId,
    setBranchId,
    resetFilters,
    page,
    setPage,
    limit,
    setLimit,
    approvePO,
    isApproving,
    sendPO,
    isSending,
    closePO,
    isClosing,
    cancelPO,
    isCancelling,
    updatePO,
    isUpdating,
    refetch,
  } = usePurchaseOrders()

  const { createPR, isCreating } = usePurchaseRequests()

  const [showCreatePo, setShowCreatePo] = useState(false)
  const [editingPo, setEditingPo] = useState<PurchaseOrderSummary | null>(null)
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrderSummary | null>(null)
  const [approveTarget, setApproveTarget] = useState<PurchaseOrderSummary | null>(null)
  const [sendTarget, setSendTarget] = useState<PurchaseOrderSummary | null>(null)
  const [closeTarget, setCloseTarget] = useState<PurchaseOrderSummary | null>(null)
  const [receiptsTarget, setReceiptsTarget] = useState<PurchaseOrderSummary | null>(null)
  const [poViewTarget, setPoViewTarget] = useState<PurchaseOrderSummary | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrderSummary | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<PurchaseOrderSummary | null>(null)

  // Deep link from a converted PR's "PO: <code>" reference (?po=<id>).
  // Fetched on its own rather than looked up in `items`: the linked order
  // may sit behind whatever status filter/page this screen currently has
  // applied, or not be loaded yet. Same pattern PurchaseRequestList uses
  // for its own `?pr=<id>` link.
  const linkedPoId = searchParams.get('po')
  const linkedPoQuery = useQuery({
    queryKey: ['purchase-order', linkedPoId],
    queryFn: () => getPurchaseOrder(linkedPoId as string),
    enabled: !!linkedPoId,
  })
  const effectiveDetailsTarget = detailsTarget ?? (linkedPoId ? (linkedPoQuery.data ?? null) : null)
  const closeDetailsTarget = (): void => {
    setDetailsTarget(null)
    if (!linkedPoId) return
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('po')
    const query = rest.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  // Deep link from a supplier's own screen (?newFor=<supplierId>): open the
  // create form with them already picked. The name rides along purely as the
  // picker's display label — the id is what is submitted — so this needs no
  // second round trip to name a supplier the caller was just looking at.
  const newForSupplierId = searchParams.get('newFor')
  const deepLinkSupplier =
    canCreate && newForSupplierId
      ? { id: newForSupplierId, name: searchParams.get('supplierName') ?? '' }
      : null
  const clearDeepLinkSupplier = (): void => {
    if (!newForSupplierId) return
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('newFor')
    rest.delete('supplierName')
    const query = rest.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const [overdueOnly, setOverdueOnly] = useState(false)
  const [searchFocus, setSearchFocus] = useState(false)
  /** Guards the row's own Download button against a second click while its
   * document is still being fetched. */
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const isActing = isApproving || isSending || isClosing || isCancelling || isUpdating

  const suppliersQuery = useQuery({
    queryKey: ['po-filter-suppliers'],
    queryFn: () => getSuppliers({ limit: 200 }),
  })
  const branchesQuery = useQuery({ queryKey: ['po-filter-branches'], queryFn: () => getBranches() })

  const supplierOptions = useMemo(
    () =>
      (suppliersQuery.data?.success ? (suppliersQuery.data.data?.data ?? []) : []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [suppliersQuery.data]
  )
  const branchOptions = useMemo(
    () => (branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branchesQuery.data]
  )

  // The overdue banner and its toggle are scoped to the rows on screen —
  // the list endpoint has no "overdue" filter or count, so claiming a
  // figure for the whole result set would be a guess.
  const overdueOnPage = useMemo(() => items.filter((po) => daysLate(po) > 0).length, [items])
  const rows = useMemo(
    () => (overdueOnly ? items.filter((po) => daysLate(po) > 0) : items),
    [items, overdueOnly]
  )

  const activeFilterCount = [
    search !== '',
    statusFilter !== undefined,
    supplierId !== undefined,
    branchId !== undefined,
    overdueOnly,
  ].filter(Boolean).length
  const filtersActive = activeFilterCount > 0

  const clearAll = (): void => {
    resetFilters()
    setOverdueOnly(false)
  }

  const downloadPdf = async (po: PurchaseOrderSummary): Promise<void> => {
    setDownloadingId(po.id)
    try {
      await buildAndDownloadPdf(po)
    } finally {
      setDownloadingId(null)
    }
  }

  const buildAndDownloadPdf = async (po: PurchaseOrderSummary): Promise<void> => {
    const docRes = await getPurchaseOrderDocument(po.id)
    if (!docRes.success || !docRes.data) return
    await downloadReactNodeAsPdf(
      <PurchaseOrderSheet doc={docRes.data as PurchaseOrderPrintDocument} />,
      po.code
    )
  }

  /** The per-status action set the list carried before the row overflow menu.
   * Approve and Cancel are deliberately absent: both live in PoDetailModal so
   * the decision is made against the full order, not a row. */
  const rowActions = (po: PurchaseOrderSummary): RowActionSpec[] => {
    // Approved orders must be sent before Receive is offered — the backend
    // still accepts a receipt posted directly against an approved PO (a
    // defensive allowance for edge cases, not the intended path), but the
    // UI only exposes it once the order has actually gone out the door.
    const receivable: PoStatus[] = ['sent', 'partially_received']
    const closable: PoStatus[] = ['sent', 'partially_received', 'fully_received']
    const editable: PoStatus[] = ['draft', 'approved']
    const receipted: PoStatus[] = ['partially_received', 'fully_received', 'closed']
    const downloading = downloadingId === po.id
    const icon = 'h-3.5 w-3.5'
    return [
      {
        key: 'pdf',
        label: 'Download PDF',
        icon: downloading ? (
          <Loader2 className={`${icon} animate-spin`} />
        ) : (
          <Download className={icon} />
        ),
        disabled: downloading,
        run: () => void downloadPdf(po),
      },
      ...(canEdit && editable.includes(po.status)
        ? [
            {
              key: 'edit',
              label: 'Edit order',
              icon: <Pencil className={icon} />,
              disabled: isActing,
              run: () => setEditingPo(po),
            },
          ]
        : []),
      ...(canReceive && receivable.includes(po.status)
        ? [
            {
              key: 'receive',
              label: 'Receive',
              icon: <PackagePlus className={icon} />,
              tone: 'purple' as const,
              // Both statuses left in `receivable` (sent, partially_received)
              // spell the action out — approved was dropped from this array
              // entirely, so there's no longer an icon-only Receive to fall
              // back to here.
              variant: 'primary' as const,
              run: () => setReceiveTarget(po),
            },
          ]
        : []),
      ...(canSend && po.status === 'approved'
        ? [
            {
              key: 'send',
              label: 'Send',
              // The button reads just "Send" — there's no column width to
              // spare for the full phrase — but the accessible name and the
              // hover title stay explicit about what it sends.
              ariaLabel: 'Send to Supplier',
              icon: <Send className={icon} />,
              tone: 'purple' as const,
              variant: 'primary' as const,
              disabled: isActing,
              run: () => setSendTarget(po),
            },
          ]
        : []),
      ...(canClose && closable.includes(po.status)
        ? [
            {
              key: 'close',
              label: po.status === 'fully_received' ? 'Close' : 'Close order',
              icon: isClosing ? (
                <Loader2 className={`${icon} animate-spin`} />
              ) : (
                <Archive className={icon} />
              ),
              tone: 'green' as const,
              variant: po.status === 'fully_received' ? ('primary' as const) : ('icon' as const),
              disabled: isActing,
              run: () => setCloseTarget(po),
            },
          ]
        : []),
      ...(receipted.includes(po.status)
        ? [
            {
              key: 'receipts',
              label: 'View delivery receipts',
              icon: <FileText className={icon} />,
              tone: 'purple' as const,
              run: () => setReceiptsTarget(po),
            },
          ]
        : []),
      ...(canViewApBill && po.apBills.length > 0
        ? [
            {
              key: 'bill',
              label: 'View invoice',
              icon: <Receipt className={icon} />,
              tone: 'purple' as const,
              run: () =>
                router.push(`/accounting/ap-bills/${po.apBills[0].id}?from=purchase-orders`),
            },
          ]
        : []),
      // Pending is the one status whose next step is a decision rather than a
      // task, so it gets the spelled-out way in. Every other row opens the
      // same drawer by clicking the row, which is why there is no View icon.
      ...(po.status === 'draft'
        ? [
            {
              key: 'view',
              label: 'View',
              icon: <Eye className={icon} />,
              tone: 'purple' as const,
              variant: 'primary' as const,
              run: () => setDetailsTarget(po),
            },
          ]
        : []),
    ]
  }

  const showTable = !isLoading && rows.length > 0
  const isNoResults = !isLoading && rows.length === 0

  return (
    <div className={`${PLEX} min-h-screen bg-zinc-50 text-[#17171c] antialiased`}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[14px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Purchase Orders</h1>
            <p className="text-[13px] text-[#5b5b6b]">
              Manage and track purchase orders across your organisation
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreatePo(true)}
              className="rounded-lg bg-[#5b21b6] px-4 py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]"
            >
              + New Purchase
            </button>
          )}
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────────
            Search, the two type-ahead pickers and sort live in one card so
            the controls read as a single unit against the page's grey; the
            status pills sit under a divider in the same card as the coarse
            first cut at the same result set. */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#e4e4e9] bg-white p-3">
          <div className="flex flex-wrap items-center gap-[10px]">
            <div
              className={`flex h-[38px] min-w-[240px] flex-[1_1_300px] items-center gap-[9px] rounded-lg border px-3 transition-colors ${
                searchFocus ? CONTROL_CHROME.focused : CONTROL_CHROME.idle
              }`}
            >
              <Search className="h-3.25 w-3.25 shrink-0 text-[#8b8b9b]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                placeholder="Search PO number, supplier, or PR number…"
                className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
              />
              {search !== '' && (
                <Tooltip label="Clear search" side="bottom" align="end">
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Type-ahead pickers rather than native <select>s — the supplier
                list runs long enough that scrolling it is the slow way to a
                known name, and locations use the same control so the pair
                behaves identically. */}
            <SearchableSelect
              className="w-[200px]"
              value={supplierId ?? ''}
              onChange={(v) => setSupplierId(v || undefined)}
              placeholder="All suppliers"
              loading={suppliersQuery.isLoading}
              chrome={CONTROL_CHROME}
              clearable
              options={supplierOptions}
            />

            {/* "All locations" filters by destination — the branch whose
                warehouse the order is headed to (PoFilterDto.branchId maps
                to warehouse.branchId server-side), not by which branch
                requested it. Those can differ (a tenant-wide/HQ order still
                ships to one branch's warehouse), so this intentionally
                isn't the same as the 'Requested By' field shown in the
                detail panel. */}
            <SearchableSelect
              className="w-[188px]"
              value={branchId ?? ''}
              onChange={(v) => setBranchId(v || undefined)}
              placeholder="All locations"
              loading={branchesQuery.isLoading}
              chrome={CONTROL_CHROME}
              clearable
              options={branchOptions}
            />

            <div className="ml-auto flex items-center gap-2">
              <span className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
                Sort
              </span>
              <div className="relative">
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                  aria-label="Sort order"
                  className={SORT_SELECT_CLASS}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-[9px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b8b9b]" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-[7px] border-t border-[#f1f1f4] pt-3">
            {STATUS_FILTERS.map((f) => {
              const on = statusFilter === f.value
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-[20px] border px-3 py-[6px] text-[12.5px] transition-colors ${
                    on
                      ? 'border-[#5b21b6] bg-[#5b21b6] font-medium text-white'
                      : 'border-transparent bg-[#f4f4f6] text-[#3d3d4a] hover:bg-[#eeeef1]'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}

            {filtersActive && (
              <button
                type="button"
                onClick={clearAll}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
              >
                <X className="h-3.5 w-3.5" />
                Clear {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
              </button>
            )}
          </div>
        </div>

        {/* ── Action-required strip ────────────────────────────────────────── */}
        {!isLoading && overdueOnPage > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-[14px] rounded-[9px] border border-[#f7dfc0] bg-[#fdf3e7] px-[14px] py-[10px]">
            <span className="flex items-center gap-[9px] text-[12.5px] text-[#8a4b06]">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#b25e09]" />
              {overdueOnPage === 1
                ? '1 order on this page is past its expected delivery date'
                : `${overdueOnPage} orders on this page are past their expected delivery date`}
            </span>
            <button
              type="button"
              onClick={() => setOverdueOnly((v) => !v)}
              className={`rounded-[7px] border px-[11px] py-1.5 text-[12.5px] font-medium ${
                overdueOnly
                  ? 'border-[#b25e09] bg-[#b25e09] text-white'
                  : 'border-[#f7dfc0] bg-white text-[#8a4b06]'
              }`}
            >
              {overdueOnly ? 'Show all orders' : 'Show only these'}
            </button>
          </div>
        )}

        {/* ── Table card ───────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
          {/* Wide: table. The design's layout is a CSS grid rather than a
              <table>, so the table semantics the markup used to carry are
              declared explicitly — assistive tech and the e2e specs both
              rely on them. */}
          {showTable && (
            <div role="table" aria-label="Purchase orders" className="hidden min-[1080px]:block">
              <div
                role="row"
                className={`${GRID} ${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
              >
                <span role="columnheader">PO code</span>
                <span role="columnheader" className="pl-1.5">
                  Supplier
                </span>
                <span role="columnheader">Status</span>
                <span role="columnheader" className="text-right">
                  Total
                </span>
                <span role="columnheader">Source</span>
                <span role="columnheader">Receiving</span>
                <span role="columnheader" className="text-right">
                  Actions
                </span>
              </div>

              {rows.map((po) => {
                const late = daysLate(po)
                return (
                  <div
                    key={po.id}
                    onClick={() => setDetailsTarget(po)}
                    className="cursor-pointer border-t border-[#f4f4f6] bg-white hover:bg-[#fcfcfd]"
                  >
                    <div role="row" className={`${GRID} px-4 py-[11px]`}>
                      <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={`${MONO} whitespace-nowrap text-[12.5px] font-medium text-[#17171c]`}
                          >
                            {po.code}
                          </span>
                          <CopyButton code={po.code} />
                        </div>
                        <span className="text-[11px] text-[#8b8b9b]">{fmtDate(po.createdAt)}</span>
                      </div>

                      <div role="cell" className="flex min-w-0 items-center gap-[9px] pl-1.5">
                        <SupplierAvatar name={po.supplier.name} />
                        <div className="flex min-w-0 flex-col gap-px">
                          <span className="truncate text-[12.5px] font-medium">
                            {po.supplier.name}
                          </span>
                          {po.supplier.taxId && (
                            <span className={`${MONO} truncate text-[10.5px] text-[#8b8b9b]`}>
                              TIN {po.supplier.taxId}
                            </span>
                          )}
                        </div>
                      </div>

                      <div role="cell" className="flex flex-col items-start gap-[3px]">
                        <StatusBadge status={po.status} />
                        {late > 0 && (
                          <span className="text-[10.5px] text-[#b25e09]">
                            {late === 1 ? '1 day late' : `${late} days late`}
                          </span>
                        )}
                      </div>

                      <span role="cell" className={`${MONO} text-right text-[13px] font-semibold`}>
                        {fmtPeso(Number(po.totalAmount))}
                      </span>

                      <span role="cell" className="flex min-w-0">
                        {po.fromPr ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(
                                `/inventory/purchase-orders?tab=requests&pr=${po.fromPr?.id}`
                              )
                            }}
                            title={`Open ${po.fromPr.code}`}
                            className={`${MONO} min-w-0 truncate text-left text-[11.5px] text-[#5b21b6] underline decoration-transparent underline-offset-2 hover:decoration-current`}
                          >
                            {po.fromPr.code}
                          </button>
                        ) : (
                          <span className={`${MONO} truncate text-[11.5px] text-[#8b8b9b]`}>
                            Direct
                          </span>
                        )}
                      </span>

                      <span role="cell" className="min-w-0">
                        <ReceivingCell po={po} />
                      </span>

                      <span role="cell">
                        <RowActions actions={rowActions(po)} />
                      </span>
                    </div>
                  </div>
                )
              })}

              <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px]">
                <span className="text-[11.5px] text-[#8b8b9b]">
                  Showing {(page - 1) * pagination.limit + 1}–
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} orders
                </span>
                <div className="flex items-center gap-[10px]">
                  <span className="text-[11.5px] text-[#8b8b9b]">Rows</span>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="rounded-[7px] border border-[#d3d3db] bg-white px-[9px] py-1.5 text-[12px] text-[#3d3d4a]"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      className="rounded-[7px] border border-[#e4e4e9] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] disabled:text-[#a3a3b2]"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= pagination.totalPages}
                      className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:text-[#a3a3b2]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Narrow: cards */}
          {showTable && (
            <div className="flex flex-col gap-[10px] p-3 min-[1080px]:hidden">
              {rows.map((po) => {
                const late = daysLate(po)
                const { received, ordered, pct } = receiptTotals(po.lines)
                const full = ordered > 0 && received >= ordered
                return (
                  <div
                    key={po.id}
                    onClick={() => setDetailsTarget(po)}
                    className={`flex flex-col gap-[10px] rounded-[11px] border bg-white p-3 ${
                      late > 0 ? 'border-[#f7dfc0]' : 'border-[#e4e4e9]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-[10px]">
                      <div className="flex min-w-0 flex-col gap-[3px]">
                        <div className="flex items-center gap-[7px]">
                          <span className={`${MONO} text-[13px] font-medium`}>{po.code}</span>
                          <CopyButton code={po.code} />
                        </div>
                        <span className="text-[11.5px] text-[#8b8b9b]">
                          {fmtDate(po.createdAt)}
                        </span>
                      </div>
                      <StatusBadge status={po.status} />
                    </div>

                    <div className="flex min-w-0 items-center gap-[9px]">
                      <SupplierAvatar name={po.supplier.name} />
                      <div className="flex min-w-0 flex-col gap-px">
                        <span className="truncate text-[13px] font-medium">{po.supplier.name}</span>
                        {po.supplier.taxId && (
                          <span className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>
                            TIN {po.supplier.taxId}
                          </span>
                        )}
                      </div>
                      <span className={`${MONO} ml-auto text-[14px] font-semibold`}>
                        {fmtPeso(Number(po.totalAmount))}
                      </span>
                    </div>

                    <div className="flex flex-col gap-[5px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11.5px] text-[#8b8b9b]">
                          Received {received} / {ordered}
                        </span>
                        <span
                          className={`${MONO} text-[11.5px] font-semibold ${
                            full
                              ? 'text-[#0b6644]'
                              : received > 0
                                ? 'text-[#8a4b06]'
                                : 'text-[#5b5b6b]'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-[3px] bg-[#eeeef1]">
                        <div
                          className={`h-full rounded-[3px] ${
                            full ? 'bg-[#0f7b52]' : received > 0 ? 'bg-[#d18b1d]' : 'bg-[#e4e4e9]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-[10px] border-t border-[#f1f1f4] pt-[9px]">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {po.fromPr ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(
                                `/inventory/purchase-orders?tab=requests&pr=${po.fromPr?.id}`
                              )
                            }}
                            className={`${MONO} truncate text-left text-[11.5px] text-[#5b21b6] underline underline-offset-2`}
                          >
                            {po.fromPr.code}
                          </button>
                        ) : (
                          <span className={`${MONO} truncate text-[11.5px] text-[#8b8b9b]`}>
                            Direct
                          </span>
                        )}
                        <span
                          className={`truncate text-[11.5px] ${late > 0 ? 'font-medium text-[#b25e09]' : 'text-[#5b5b6b]'}`}
                        >
                          {po.expectedDeliveryDate
                            ? `Expected ${fmtDate(po.expectedDeliveryDate)}`
                            : 'No expected date'}
                        </span>
                      </div>
                      <RowActions actions={rowActions(po)} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div>
              <div
                className={`${GRID} ${MONO} hidden border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] min-[1080px]:grid`}
              >
                <span>PO code</span>
                <span>Supplier</span>
                <span>Status</span>
                <span className="text-right">Total</span>
                <span>Source</span>
                <span>Receiving</span>
                <span className="text-right">Actions</span>
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${GRID} border-t border-[#f4f4f6] px-4 py-[14px]`}>
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar wide />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar />
                  <SkeletonBar wide />
                </div>
              ))}
              <div className="border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px] text-[11.5px] text-[#8b8b9b]">
                Loading purchase orders…
              </div>
            </div>
          )}

          {/* No results / empty */}
          {isNoResults &&
            (filtersActive ? (
              <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
                <div className="h-[30px] w-[30px] rounded-lg border border-[#e4e4e9] bg-[#fbfbfc]" />
                <div className="mt-1 text-[14px] font-semibold">
                  No purchase orders match your filters
                </div>
                <div className="max-w-[420px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                  {search
                    ? `Nothing matches “${search}”. Check the PO or PR number, or search by supplier name instead.`
                    : 'No orders match the filters you have applied. Clear a filter to see more.'}
                </div>
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-3 rounded-lg border border-[#d3d3db] bg-white px-[15px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2]"
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-13 text-center">
                <div className="h-[34px] w-[34px] rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb]" />
                <div className="mt-1 text-[15px] font-semibold">No purchase orders yet</div>
                <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                  Purchase orders appear here once you raise one from a purchase request or create
                  one directly. Approved orders can then be received against.
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => setShowCreatePo(true)}
                    className="mt-3.5 rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b]"
                  >
                    + New Purchase
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* ── Modals & panels ────────────────────────────────────────────────── */}

      <CreatePoModal
        open={showCreatePo || editingPo !== null || deepLinkSupplier !== null}
        onClose={() => {
          setShowCreatePo(false)
          setEditingPo(null)
          clearDeepLinkSupplier()
        }}
        initialSupplier={editingPo ? null : deepLinkSupplier}
        onCreate={async (data) => {
          await createPR(data)
          // Creating here always drafts a Purchase Request, not a Purchase
          // Order — this list never shows it, so without this it looks
          // like the submission vanished. Switch to the tab that actually
          // has it.
          router.replace('/inventory/purchase-orders?tab=requests')
        }}
        isCreating={isCreating}
        po={editingPo}
        onUpdatePo={async (id, data) => {
          await updatePO(id, data)
        }}
        isSavingPo={isUpdating}
        currentUserBranchId={currentUserBranchId}
      />

      <CancelPoModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        po={cancelTarget}
        onCancel={async (id, reason) => {
          await cancelPO({ id, reason })
          setCancelTarget(null)
        }}
        isCancelling={isCancelling}
      />

      <ConfirmActionModal
        open={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        title="Approve Purchase Order"
        icon={<CheckCircle className="h-5 w-5" />}
        iconColorClass="text-emerald-600"
        summary={<p className="text-sm font-medium text-zinc-900">{approveTarget?.code}</p>}
        message="This purchase order will move to Approved and can then be sent to the supplier or received against."
        confirmLabel="Approve"
        confirmingLabel="Approving…"
        confirmButtonClass="bg-emerald-600 hover:bg-emerald-700"
        onConfirm={async () => {
          if (approveTarget) await approvePO(approveTarget.id)
        }}
        isConfirming={isApproving}
      />

      <ConfirmActionModal
        open={sendTarget !== null}
        onClose={() => setSendTarget(null)}
        title="Send to Supplier"
        icon={<Send className="h-5 w-5" />}
        iconColorClass="text-zinc-600"
        summary={<p className="text-sm font-medium text-zinc-900">{sendTarget?.code}</p>}
        message="This marks the purchase order as sent to the supplier."
        confirmLabel="Send"
        confirmingLabel="Sending…"
        confirmButtonClass="bg-zinc-800 hover:bg-zinc-900"
        onConfirm={async () => {
          if (sendTarget) await sendPO(sendTarget.id)
        }}
        isConfirming={isSending}
      />

      <ConfirmActionModal
        open={closeTarget !== null}
        onClose={() => setCloseTarget(null)}
        title="Close Purchase Order"
        icon={<Archive className="h-5 w-5" />}
        iconColorClass="text-zinc-600"
        summary={<p className="text-sm font-medium text-zinc-900">{closeTarget?.code}</p>}
        message="Closing this purchase order marks it as complete — no further receiving can happen against it."
        confirmLabel="Close"
        confirmingLabel="Closing…"
        confirmButtonClass="bg-zinc-800 hover:bg-zinc-900"
        onConfirm={async () => {
          if (closeTarget) await closePO(closeTarget.id)
        }}
        isConfirming={isClosing}
      />

      <PoDetailModal
        po={effectiveDetailsTarget}
        onClose={closeDetailsTarget}
        canApprove={canApprove}
        canCancel={canCancel}
        canSend={canSend}
        canReceive={canReceive}
        canClose={canClose}
        canEdit={canEdit}
        isDownloading={
          effectiveDetailsTarget != null && downloadingId === effectiveDetailsTarget.id
        }
        onApprove={(po) => {
          closeDetailsTarget()
          setApproveTarget(po)
        }}
        onCancel={(po) => {
          closeDetailsTarget()
          setCancelTarget(po)
        }}
        onSend={(po) => {
          closeDetailsTarget()
          setSendTarget(po)
        }}
        onReceive={(po) => {
          closeDetailsTarget()
          setReceiveTarget(po)
        }}
        onCloseOrder={(po) => {
          closeDetailsTarget()
          setCloseTarget(po)
        }}
        onEdit={(po) => {
          closeDetailsTarget()
          setEditingPo(po)
        }}
        onViewReceipts={(po) => {
          closeDetailsTarget()
          setReceiptsTarget(po)
        }}
        onViewPo={(po) => {
          closeDetailsTarget()
          setPoViewTarget(po)
        }}
        onDownload={(po) => void downloadPdf(po)}
      />

      <PoReceiptsPanel po={receiptsTarget} onClose={() => setReceiptsTarget(null)} />
      <PoViewPanel po={poViewTarget} onClose={() => setPoViewTarget(null)} />

      {/* The receive screen stays open after posting to show the receipt it
          created (its RR number, what was posted, whether the PO is closed),
          so the list refreshes underneath rather than the screen closing. */}
      <ReceiveAgainstPoModal
        po={receiveTarget}
        onClose={() => {
          setReceiveTarget(null)
          refetch()
        }}
        onPosted={() => refetch()}
        canViewCost={canViewCost}
      />

      {isActing && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-[10px] bg-[#17171c] px-4 py-3 text-white shadow-[0_18px_40px_-12px_rgba(20,20,30,.5)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-[13px]">Working…</span>
        </div>
      )}
    </div>
  )
}
