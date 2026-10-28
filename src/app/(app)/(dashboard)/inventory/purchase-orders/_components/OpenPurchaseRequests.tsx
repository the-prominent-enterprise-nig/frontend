'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { STALE } from '@/src/libs/query/stale-times'
import { STOCK_TABLE_HEAD } from '@/src/libs/design/plex'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import { getPurchaseRequests } from '../../purchase-requests/_actions/get-purchase-requests'
import {
  usePurchaseRequestActions,
  type PurchaseRequestActions,
} from '../../purchase-requests/_hooks/usePurchaseRequestActions'
import {
  PrRowActions,
  StatusBadge,
  fmtDate,
  fmtPHP,
  prTotal,
} from '../../purchase-requests/_components/PurchaseRequestList'
import { procurementHref } from '../_lib/procurementHref'
import {
  MONO,
  STATUS_META,
  SupplierAvatar,
  fmtDate as fmtPoDate,
  fmtPeso,
  type PoStatus,
} from './procurementTokens'

// Draft and submitted are the only statuses with a next step left — a
// converted request lives on as its PO, and a cancelled one is done. Those
// two stay reachable as history, so a branch can follow its request after
// it leaves the open list.
const OPEN_LIMIT = 50

/** Which requests the Requests filter lists. */
export type RequestsView = 'open' | 'converted' | 'cancelled'

const REQUEST_VIEWS: { label: string; value: RequestsView }[] = [
  { label: 'Awaiting action', value: 'open' },
  { label: 'Converted', value: 'converted' },
  { label: 'Cancelled', value: 'cancelled' },
]

function openRequestsQuery(status: PurchaseRequestSummary['status'], enabled: boolean) {
  const params = { status, limit: OPEN_LIMIT }
  return {
    queryKey: ['purchase-requests', params],
    queryFn: () => getPurchaseRequests(params),
    enabled,
    staleTime: STALE.OPERATIONAL,
    // Same 10s poll the requests list uses — someone else submitting or
    // converting one has to show up here without a refocus.
    refetchInterval: 10 * 1000,
  }
}

type RequestPage = {
  items: PurchaseRequestSummary[]
  total: number
  isLoading: boolean
}

export type OpenPurchaseRequestsState = RequestPage & {
  actions: PurchaseRequestActions
  view: RequestsView
  setView: (view: RequestsView) => void
  /** Converted or cancelled requests — fetched only while `view` asks for them. */
  history: RequestPage
}

/**
 * Purchase requests still waiting on someone — drafts to submit, submitted
 * ones to convert — for the Purchase Orders list's "Requests" filter. Pass
 * null when the user can't read requests: nothing is fetched and every
 * action is off. Render `actions.modals` whichever filter is showing, so the
 * `?pr=<id>` detail view a PO's Source links to still opens.
 */
export function useOpenPurchaseRequests(
  session: SessionUser | null,
  /** The list's own switch back to its orders — see usePurchaseRequestActions. */
  onConverted?: () => void,
  /** The list's own switch to this Requests filter — a submit that
   * auto-converted lands on its Converted view. */
  onShowRequests?: () => void
): OpenPurchaseRequestsState {
  const [view, setView] = useState<RequestsView>('open')
  const actions = usePurchaseRequestActions(session, onConverted, () => {
    setView('converted')
    onShowRequests?.()
  })
  const drafts = useQuery(openRequestsQuery('draft', !!session))
  const submitted = useQuery(openRequestsQuery('submitted', !!session))
  const past = useQuery(
    openRequestsQuery(
      view === 'cancelled' ? 'cancelled' : 'converted',
      !!session && view !== 'open'
    )
  )
  const pages = [drafts.data?.data, submitted.data?.data]
  return {
    actions,
    items: pages.flatMap((p) => p?.data ?? []),
    total: pages.reduce((sum, p) => sum + (p?.total ?? 0), 0),
    isLoading: drafts.isLoading || submitted.isLoading,
    view,
    setView,
    history: {
      items: past.data?.data?.data ?? [],
      total: past.data?.data?.total ?? 0,
      isLoading: past.isLoading,
    },
  }
}

/** A converted request's PO and where it stands now — e.g. still pending on
 * the Inventory OIC — opening that PO's detail. */
function ConvertedPoLink({ pr }: { pr: PurchaseRequestSummary }): React.ReactElement | null {
  const router = useRouter()
  const pathname = usePathname()
  const po = pr.convertedToPo
  if (pr.status !== 'converted' || !po) return null
  const meta = STATUS_META[po.status as PoStatus] ?? STATUS_META.draft
  return (
    <button
      type="button"
      onClick={() => router.push(procurementHref(pathname, 'orders', { po: po.id }))}
      className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 hover:bg-[#f1ebfb]"
    >
      <span className={`${MONO} text-[11.5px] font-medium text-[#5b21b6]`}>{po.code}</span>
      <span className={`rounded-[5px] px-[7px] py-[2px] text-[11px] font-medium ${meta.badge}`}>
        {meta.label}
      </span>
    </button>
  )
}

function OpenRequestRow({
  pr,
  actions,
}: {
  pr: PurchaseRequestSummary
  actions: PurchaseRequestActions
}): React.ReactElement {
  return (
    <tr
      onClick={() => actions.view(pr)}
      className="cursor-pointer transition-colors hover:bg-[#fcfcfd]"
    >
      <td className="px-4 py-[10px]">
        <span className={`${MONO} text-[12.5px] font-medium text-[#17171c]`}>{pr.code}</span>
      </td>
      <td className="px-4 py-[10px] text-[12.5px] text-[#3d3d4a]">
        {pr.supplier?.name ?? <span className="text-[#a3a3b2]">—</span>}
      </td>
      <td className="px-4 py-[10px]">
        <StatusBadge status={pr.status} />
      </td>
      <td className="px-4 py-[10px] text-[12.5px] text-[#3d3d4a]">
        {pr.branch?.name ?? <span className="text-[#a3a3b2]">—</span>}
      </td>
      <td className={`${MONO} px-4 py-[10px] text-right text-[13px] font-semibold`}>
        {fmtPHP(prTotal(pr))}
      </td>
      <td className="px-4 py-[10px] text-[11.5px] text-[#8b8b9b]">{fmtDate(pr.createdAt)}</td>
      <td className="px-4 py-[10px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          <ConvertedPoLink pr={pr} />
          <PrRowActions pr={pr} actions={actions} />
        </div>
      </td>
    </tr>
  )
}

const EMPTY_COPY: Record<RequestsView, { title: string; body: string }> = {
  open: {
    title: 'No requests awaiting action',
    body: 'Drafts and submitted purchase requests show here until they become purchase orders.',
  },
  converted: {
    title: 'No converted requests',
    body: 'A request shows here once it becomes a purchase order, with that order’s status.',
  },
  cancelled: {
    title: 'No cancelled requests',
    body: 'Requests cancelled before they became purchase orders show here.',
  },
}

function RequestsEmpty({ view }: { view: RequestsView }): React.ReactElement {
  const copy = EMPTY_COPY[view]
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-13 text-center">
      <div className="h-[34px] w-[34px] rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb]" />
      <div className="mt-1 text-[15px] font-semibold">{copy.title}</div>
      <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">{copy.body}</div>
    </div>
  )
}

function RequestsViewPills({
  view,
  setView,
}: Pick<OpenPurchaseRequestsState, 'view' | 'setView'>): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-[7px] border-b border-[#eeeef1] px-4 py-[10px]">
      {REQUEST_VIEWS.map((v) => (
        <button
          key={v.value}
          type="button"
          aria-pressed={view === v.value}
          onClick={() => setView(v.value)}
          className={`rounded-[20px] border px-3 py-[5px] text-[12px] transition-colors ${
            view === v.value
              ? 'border-[#5b21b6] bg-[#f1ebfb] font-medium text-[#3f1490]'
              : 'border-transparent bg-[#f4f4f6] text-[#3d3d4a] hover:bg-[#eeeef1]'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

/** The "Requests" filter — view pills above the table, inside the list's table card. */
export function OpenRequestsTable({
  state,
}: {
  state: OpenPurchaseRequestsState
}): React.ReactElement {
  return (
    <>
      <RequestsViewPills view={state.view} setView={state.setView} />
      <RequestsTableBody
        page={state.view === 'open' ? state : state.history}
        view={state.view}
        actions={state.actions}
      />
    </>
  )
}

function RequestsTableBody({
  page,
  view,
  actions,
}: {
  page: RequestPage
  view: RequestsView
  actions: PurchaseRequestActions
}): React.ReactElement {
  const { items, total, isLoading } = page
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#a3a3b2]" />
      </div>
    )
  }
  if (items.length === 0) return <RequestsEmpty view={view} />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Purchase requests">
        <thead>
          <tr className={`${STOCK_TABLE_HEAD} border-b border-[#eeeef1] bg-[#fbfbfc]`}>
            <th className="px-4 py-[9px] text-left">Code</th>
            <th className="px-4 py-[9px] text-left">Supplier</th>
            <th className="px-4 py-[9px] text-left">Status</th>
            <th className="px-4 py-[9px] text-left">Branch</th>
            <th className="px-4 py-[9px] text-right">Total</th>
            <th className="px-4 py-[9px] text-left">Created</th>
            <th className="px-4 py-[9px] text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f4f4f6]">
          {items.map((pr) => (
            <OpenRequestRow key={pr.id} pr={pr} actions={actions} />
          ))}
        </tbody>
      </table>
      {total > items.length && (
        <div className="border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px] text-[11.5px] text-[#8b8b9b]">
          Showing {items.length} of {total} requests
        </div>
      )}
    </div>
  )
}

/** "Request" tag plus the PR's own status — marks a request row among orders. */
function RequestStatus({ pr }: { pr: PurchaseRequestSummary }): React.ReactElement {
  return (
    <div className="flex flex-col items-start gap-[3px]">
      <StatusBadge status={pr.status} />
      <span className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]`}>
        Request
      </span>
    </div>
  )
}

function RequestSupplier({ pr }: { pr: PurchaseRequestSummary }): React.ReactElement {
  if (!pr.supplier) return <span className="text-[12.5px] text-[#a3a3b2]">No supplier yet</span>
  return (
    <>
      <SupplierAvatar name={pr.supplier.name} />
      <span className="truncate text-[12.5px] font-medium">{pr.supplier.name}</span>
    </>
  )
}

/**
 * Open requests as rows of the orders grid, for the "All" filter — same
 * columns, with Source showing the requesting branch and no receiving yet.
 */
export function RequestGridRows({
  items,
  actions,
  gridClass,
}: {
  items: PurchaseRequestSummary[]
  actions: PurchaseRequestActions
  gridClass: string
}): React.ReactElement {
  return (
    <>
      {items.map((pr) => (
        <div
          key={pr.id}
          onClick={() => actions.view(pr)}
          className="cursor-pointer border-t border-[#f4f4f6] bg-[#fcfaff] hover:bg-[#f7f2fe]"
        >
          <div role="row" className={`${gridClass} px-4 py-[11px]`}>
            <div role="cell" className="flex min-w-0 flex-col gap-0.5">
              <span className={`${MONO} whitespace-nowrap text-[12.5px] font-medium`}>
                {pr.code}
              </span>
              <span className="text-[11px] text-[#8b8b9b]">{fmtPoDate(pr.createdAt)}</span>
            </div>
            <div role="cell" className="flex min-w-0 items-center gap-[9px] pl-1.5">
              <RequestSupplier pr={pr} />
            </div>
            <div role="cell">
              <RequestStatus pr={pr} />
            </div>
            <span role="cell" className={`${MONO} text-right text-[13px] font-semibold`}>
              {fmtPeso(prTotal(pr))}
            </span>
            <span role="cell" className="truncate text-[11.5px] text-[#5b5b6b]">
              {pr.branch?.name ?? '—'}
            </span>
            <span role="cell" className="text-[11.5px] text-[#a3a3b2]">
              Not ordered yet
            </span>
            <span
              role="cell"
              className="flex items-center justify-end gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <PrRowActions pr={pr} actions={actions} />
            </span>
          </div>
        </div>
      ))}
    </>
  )
}

/** Narrow-screen cards for the same rows. */
export function RequestCards({
  items,
  actions,
}: {
  items: PurchaseRequestSummary[]
  actions: PurchaseRequestActions
}): React.ReactElement {
  return (
    <>
      {items.map((pr) => (
        <div
          key={pr.id}
          onClick={() => actions.view(pr)}
          className="flex flex-col gap-[10px] rounded-[11px] border border-[#ddd0f7] bg-[#fcfaff] p-3"
        >
          <div className="flex items-start justify-between gap-[10px]">
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className={`${MONO} text-[13px] font-medium`}>{pr.code}</span>
              <span className="text-[11.5px] text-[#8b8b9b]">{fmtPoDate(pr.createdAt)}</span>
            </div>
            <RequestStatus pr={pr} />
          </div>
          <div className="flex min-w-0 items-center gap-[9px]">
            <RequestSupplier pr={pr} />
            <span className={`${MONO} ml-auto text-[14px] font-semibold`}>
              {fmtPeso(prTotal(pr))}
            </span>
          </div>
          <div
            className="flex items-center justify-end gap-2 border-t border-[#f1f1f4] pt-[9px]"
            onClick={(e) => e.stopPropagation()}
          >
            <PrRowActions pr={pr} actions={actions} />
          </div>
        </div>
      ))}
    </>
  )
}
