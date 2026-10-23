'use client'

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
import { MONO, SupplierAvatar, fmtDate as fmtPoDate, fmtPeso } from './procurementTokens'

// Draft and submitted are the only statuses with a next step left — a
// converted request lives on as its PO, and a cancelled one is done.
type OpenStatus = 'draft' | 'submitted'
const OPEN_LIMIT = 50

function openRequestsQuery(status: OpenStatus, enabled: boolean) {
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

export type OpenPurchaseRequestsState = {
  actions: PurchaseRequestActions
  items: PurchaseRequestSummary[]
  total: number
  isLoading: boolean
}

/**
 * Purchase requests still waiting on someone — drafts to submit, submitted
 * ones to convert — for the Purchase Orders list's "Requests" filter. Pass
 * null when the user can't read requests: nothing is fetched and every
 * action is off. Render `actions.modals` whichever filter is showing, so the
 * `?pr=<id>` detail view a PO's Source links to still opens.
 */
export function useOpenPurchaseRequests(session: SessionUser | null): OpenPurchaseRequestsState {
  const actions = usePurchaseRequestActions(session)
  const drafts = useQuery(openRequestsQuery('draft', !!session))
  const submitted = useQuery(openRequestsQuery('submitted', !!session))
  const pages = [drafts.data?.data, submitted.data?.data]
  return {
    actions,
    items: pages.flatMap((p) => p?.data ?? []),
    total: pages.reduce((sum, p) => sum + (p?.total ?? 0), 0),
    isLoading: drafts.isLoading || submitted.isLoading,
  }
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
          <PrRowActions pr={pr} actions={actions} />
        </div>
      </td>
    </tr>
  )
}

function RequestsEmpty(): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-13 text-center">
      <div className="h-[34px] w-[34px] rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb]" />
      <div className="mt-1 text-[15px] font-semibold">No requests awaiting action</div>
      <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
        Drafts and submitted purchase requests show here until they become purchase orders.
      </div>
    </div>
  )
}

/** The table body of the "Requests" filter — goes inside the list's table card. */
export function OpenRequestsTable({
  state,
}: {
  state: OpenPurchaseRequestsState
}): React.ReactElement {
  const { items, total, isLoading, actions } = state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#a3a3b2]" />
      </div>
    )
  }
  if (items.length === 0) return <RequestsEmpty />
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
