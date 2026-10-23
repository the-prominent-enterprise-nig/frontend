'use client'

import Link from 'next/link'
import { MONO } from '@/src/libs/design/plex'
import { drPurposeLabel } from '@/src/libs/inventory/delivery-receipt-purposes'
import type { IdmDetail } from '@/src/schema/accounting/inventory-debit-memos'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { PrintMemoIconButton } from './PrintMemoIconButton'

// Scenario 72 — an internal DMINV memo as a row of the Debit Memos list,
// beside the supplier returns. Read-only here: accounting edits and posts it
// in Accounting → Debit Memos, so the row links there (for accounting) and to
// its delivery receipt (for everyone).

const STATUS: Record<IdmDetail['status'], { label: string; badge: string }> = {
  DRAFT: { label: 'With accounting', badge: 'bg-[#fdf3e7] text-[#8a4b06]' },
  POSTED: { label: 'Posted', badge: 'bg-[#e7f5ef] text-[#0b6644]' },
  VOID: { label: 'Void', badge: 'bg-[#f1f1f4] text-[#8b8b9b] line-through' },
}

export function TypeChip({ internal }: { internal: boolean }): React.JSX.Element {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
        internal ? 'bg-[#e7f5ef] text-[#0b6644]' : 'bg-[#f1ebfb] text-[#3f1490]'
      }`}
    >
      {internal ? 'Internal' : 'Supplier'}
    </span>
  )
}

function MemoNumber({ memo, canOpenMemo }: { memo: IdmDetail; canOpenMemo: boolean }) {
  const cls = `${MONO} block max-w-full truncate text-[12.5px] font-semibold`
  return canOpenMemo ? (
    <Link
      href={`/accounting/debit-memos/inventory/${memo.id}`}
      className={`${cls} text-[#17171c] hover:text-[#3f1490]`}
    >
      {memo.memoNumber}
    </Link>
  ) : (
    <span className={`${cls} text-[#17171c]`}>{memo.memoNumber}</span>
  )
}

function DrLink({ memo }: { memo: IdmDetail }) {
  if (!memo.deliveryReceipt) {
    return <span className="text-[12px] text-[#8b8b9b]">Standalone</span>
  }
  return (
    <Link
      href={`/inventory/delivery-receipts/${memo.deliveryReceipt.id}`}
      className={`${MONO} text-[12px] text-[#3f1490] hover:underline`}
    >
      {memo.deliveryReceipt.drNumber}
    </Link>
  )
}

function StatusChip({ status }: { status: IdmDetail['status'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ${STATUS[status].badge}`}
    >
      {STATUS[status].label}
    </span>
  )
}

/** Desktop row, matching the supplier rows' eight columns. */
export function InternalMemoRow({
  memo,
  canOpenMemo,
}: {
  memo: IdmDetail
  canOpenMemo: boolean
}): React.JSX.Element {
  return (
    <tr className="align-top hover:bg-[#fbfbfc]">
      <td className="px-2 py-3" />
      <td className="px-4 py-3">
        <MemoNumber memo={memo} canOpenMemo={canOpenMemo} />
        <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[#8b8b9b]">
          <TypeChip internal />
          {fmtDate(memo.memoDate)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="block truncate text-[12.5px] font-medium text-[#17171c]">
          {memo.purpose ? drPurposeLabel(memo.purpose) : 'Internal memo'}
        </span>
        <span className="mt-0.5 block truncate text-[10.5px] text-[#8b8b9b]">
          {memo.branch?.name ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <DrLink memo={memo} />
      </td>
      <td className="px-4 py-3">
        <span className="block truncate text-[12.5px] text-[#3d3d4a]">
          {memo.department?.name ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`${MONO} block text-[13.5px] font-semibold text-[#17171c]`}>
          {fmtMoney(memo.totalDebit)}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <StatusChip status={memo.status} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right text-[11.5px] text-[#8b8b9b]">
        <span className="inline-flex items-center justify-end gap-2">
          <PrintMemoIconButton kind="internal" id={memo.id} />
          {canOpenMemo ? (
            <Link
              href={`/accounting/debit-memos/inventory/${memo.id}`}
              className="font-medium text-[#3f1490] hover:underline"
            >
              {memo.status === 'DRAFT' ? 'Edit & post' : 'Open'}
            </Link>
          ) : (
            'Accounting posts'
          )}
        </span>
      </td>
    </tr>
  )
}

/** Phone card. */
export function InternalMemoCard({
  memo,
  canOpenMemo,
}: {
  memo: IdmDetail
  canOpenMemo: boolean
}): React.JSX.Element {
  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MemoNumber memo={memo} canOpenMemo={canOpenMemo} />
          <span className="mt-0.5 block truncate text-xs text-[#3d3d4a]">
            {memo.purpose ? drPurposeLabel(memo.purpose) : 'Internal memo'} ·{' '}
            {memo.deliveryReceipt?.drNumber ?? 'Standalone'}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8b8b9b]">
            <TypeChip internal />
            {fmtDate(memo.memoDate)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusChip status={memo.status} />
          <span className={`${MONO} text-[13px] font-semibold text-[#17171c]`}>
            {fmtMoney(memo.totalDebit)}
          </span>
          <PrintMemoIconButton kind="internal" id={memo.id} />
        </div>
      </div>
    </li>
  )
}
