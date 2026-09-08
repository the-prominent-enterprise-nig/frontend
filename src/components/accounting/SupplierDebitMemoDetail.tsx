'use client'

import type { ReactNode } from 'react'
import { fmtMoney, type SupplierDebitMemo } from '@/src/libs/data/AccountingV2Data'
import { locationLabel } from '@/src/libs/format/locationLabel'

/**
 * What one supplier debit memo actually says, under its row: where the goods
 * left from, what went with them, and every line that makes up the deduction.
 *
 * Shared deliberately. Accounting reads these memos and Inventory raises them,
 * but the document is the same document, and two teams describing it two ways
 * is how a memo ends up meaning different things in the two rooms.
 */
export function SupplierDebitMemoDetail({
  memo,
  children,
}: {
  memo: SupplierDebitMemo
  /** Rendered under the lines — Inventory hangs the waybill panel here. */
  children?: ReactNode
}) {
  return (
    <>
      <dl className="mb-3 grid gap-x-8 gap-y-1 text-xs sm:grid-cols-4">
        <Fact label="Returned from" value={locationLabel(memo.warehouse)} />
        <Fact label="DR No." value={memo.deliveryReceiptNumber ?? '—'} />
        <Fact label="Journal entry" value={memo.journalEntryId ? 'Posted' : 'Not posted'} />
        <Fact label="Reason" value={memo.reason ?? '—'} />
      </dl>

      <table className="w-full text-xs">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1">Item / Description</th>
            <th className="py-1">Account</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Amount</th>
            <th className="py-1 text-right">Tax</th>
            <th className="py-1 text-right">Line Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {memo.lines?.map((line) => (
            <tr key={line.id}>
              {/* A line with no item is a supplier concession — support,
                  sponsorship, a freight recharge — named by its description. */}
              <td className="py-1.5 text-zinc-800">
                {line.item
                  ? `${line.item.sku} — ${line.item.name}`
                  : (line.description ?? 'Supplier concession')}
              </td>
              <td className="py-1.5 text-zinc-600">{line.account?.name ?? '—'}</td>
              <td className="py-1.5 text-right tabular-nums">{Number(line.quantity)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtMoney(line.unitPrice)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtMoney(line.taxAmount)}</td>
              {/* Negative on a support line, which nets off the claim. */}
              <td
                className={`py-1.5 text-right font-medium tabular-nums ${
                  line.lineTotal < 0 ? 'text-amber-700' : ''
                }`}
              >
                {fmtMoney(line.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {children && <div className="mt-3">{children}</div>}
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-800">{value}</dd>
    </div>
  )
}
