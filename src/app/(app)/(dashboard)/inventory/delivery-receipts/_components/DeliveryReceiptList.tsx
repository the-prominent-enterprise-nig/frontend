'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Truck } from 'lucide-react'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PLEX, MONO, STOCK_TABLE_HEAD } from '@/src/libs/design/plex'
import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import { drPurposeLabel } from '@/src/libs/inventory/delivery-receipt-purposes'
import type { DrStatus, DrSummary } from '@/src/schema/inventory/delivery-receipts'
import { getDeliveryReceipts } from '../_actions/get-delivery-receipts'
import { DR_STATUS_META, drStatusLabel, fmtDrDate } from '../_lib/dr-format'

const PAGE_SIZE = 20

const STATUS_PILLS: { value: DrStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'voided', label: 'Voided' },
]

/** Scenario 72 — the Delivery Receipt tab of the Stock Transaction hub. */
export default function DeliveryReceiptList({
  session,
}: {
  session: SessionUser
}): React.JSX.Element {
  const [status, setStatus] = useState<DrStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const canCreate = can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE)

  const query = useQuery({
    queryKey: ['delivery-receipts', status, search.trim(), page],
    queryFn: () =>
      getDeliveryReceipts({
        page,
        limit: PAGE_SIZE,
        status: status === 'all' ? undefined : status,
        search: search.trim() || undefined,
      }),
    staleTime: 15_000,
  })
  const rows = query.data?.data?.data ?? []
  const total = query.data?.data?.total ?? 0

  return (
    <div
      className={`min-h-full w-full bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px] ${PLEX}`}
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <ListHeader canCreate={canCreate} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b9b]" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search DR no., delivered to, or reference…"
              className="w-full rounded-lg border border-[#e4e4e9] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
            />
          </div>
        </div>
        <StatusPills
          value={status}
          onChange={(next) => {
            setStatus(next)
            setPage(1)
          }}
        />
        {query.data && !query.data.success && (
          <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-4 text-sm font-medium text-[#8f1c14]">
            Failed to load delivery receipts
          </div>
        )}
        <div
          className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white shadow-sm transition-opacity ${query.isFetching ? 'opacity-60' : ''}`}
        >
          {query.isLoading ? (
            <div className="p-8 text-center text-sm text-[#8b8b9b]">Loading delivery receipts…</div>
          ) : rows.length === 0 ? (
            <EmptyState filtered={status !== 'all' || !!search.trim()} canCreate={canCreate} />
          ) : (
            <>
              <DrTable rows={rows} />
              <ListFooterPager
                page={page}
                pageCount={Math.ceil(total / PAGE_SIZE)}
                shown={rows.length}
                total={total}
                noun={total === 1 ? 'delivery receipt' : 'delivery receipts'}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ListHeader({ canCreate }: { canCreate: boolean }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Delivery Receipts</h1>
        <p className="mt-1 text-sm text-[#5b5b6b]">
          Stock going out for office use, raffle prizes, giveaways and donations, or held for a
          sales invoice to follow.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{canCreate && <NewDrLink />}</div>
    </div>
  )
}

function NewDrLink(): React.JSX.Element {
  return (
    <Link
      href="/inventory/delivery-receipts/new"
      className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-3 py-2 text-sm font-medium text-white hover:bg-[#4a189b] sm:px-4"
    >
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">New delivery receipt</span>
      <span className="sm:hidden">New</span>
    </Link>
  )
}

function StatusPills({
  value,
  onChange,
}: {
  value: DrStatus | 'all'
  onChange: (v: DrStatus | 'all') => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_PILLS.map((pill) => {
        const isOn = value === pill.value
        return (
          <button
            key={pill.value}
            type="button"
            onClick={() => onChange(pill.value)}
            aria-pressed={isOn}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              isOn
                ? 'border-[#5b21b6] bg-[#5b21b6] text-white'
                : 'border-[#e4e4e9] bg-white text-[#3d3d4a] hover:border-[#d3d3db]'
            }`}
          >
            {pill.label}
          </button>
        )
      })}
    </div>
  )
}

function EmptyState({
  filtered,
  canCreate,
}: {
  filtered: boolean
  canCreate: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {filtered ? (
        <Search className="mb-3 h-8 w-8 text-[#c9c9d3]" />
      ) : (
        <Truck className="mb-3 h-10 w-10 text-[#c9c9d3]" />
      )}
      <p className="text-sm font-medium text-[#3d3d4a]">
        {filtered ? 'No delivery receipts match' : 'No delivery receipts yet'}
      </p>
      {!filtered && (
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-[#5b5b6b]">
          Raise one when a unit leaves for office use, a raffle, a giveaway or a donation. Saving a
          draft does not touch stock; submitting it posts its debit memo automatically.
        </p>
      )}
      {!filtered && canCreate && (
        <div className="mt-4">
          <NewDrLink />
        </div>
      )}
    </div>
  )
}

function DrTable({ rows }: { rows: DrSummary[] }): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-[13px]">
        <thead className={`border-b border-[#eeeef1] bg-[#fbfbfc] ${STOCK_TABLE_HEAD}`}>
          <tr>
            <th className="px-4 py-2.5">DR no.</th>
            <th className="px-4 py-2.5">Purpose</th>
            <th className="px-4 py-2.5">Delivered to</th>
            <th className="px-4 py-2.5">Issued from</th>
            <th className="px-4 py-2.5">Issue date</th>
            <th className="px-4 py-2.5 text-right">Items</th>
            <th className="px-4 py-2.5">Debit memo</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {rows.map((dr) => (
            <DrRow key={dr.id} dr={dr} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DrRow({ dr }: { dr: DrSummary }): React.JSX.Element {
  const href = `/inventory/delivery-receipts/${dr.id}`
  const cell = 'block px-4 py-3'
  return (
    <tr className="hover:bg-[#fbfbfc]">
      <td>
        <Link href={href} className={`${cell} ${MONO} font-medium text-[#3f1490]`}>
          {dr.drNumber}
        </Link>
      </td>
      <td>
        <Link href={href} className={cell}>
          {drPurposeLabel(dr.purpose)}
        </Link>
      </td>
      <td>
        <Link href={href} className={`${cell} text-[#3d3d4a]`}>
          {dr.deliveredTo || dr.department?.name || '—'}
        </Link>
      </td>
      <td>
        <Link href={href} className={`${cell} text-[#3d3d4a]`}>
          {dr.warehouse.name}
        </Link>
      </td>
      <td>
        <Link href={href} className={`${cell} text-[#3d3d4a]`}>
          {fmtDrDate(dr.issueDate)}
        </Link>
      </td>
      <td>
        <Link href={href} className={`${cell} text-right tabular-nums`}>
          {dr._count.lines}
        </Link>
      </td>
      <td>
        <Link href={href} className={`${cell} ${MONO} text-[#5b5b6b]`}>
          {(dr.debitMemo ?? dr.supplierDebitMemo)?.memoNumber ?? '—'}
        </Link>
      </td>
      <td>
        <Link href={href} className={cell}>
          <span
            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ${DR_STATUS_META[dr.status].badge}`}
          >
            {drStatusLabel(dr.status, dr.purpose)}
          </span>
        </Link>
      </td>
    </tr>
  )
}
