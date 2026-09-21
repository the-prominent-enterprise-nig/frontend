'use client'

import Link from 'next/link'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { ReturnSummary } from '@/src/schema/inventory/returns'
import { CONDITION_CONFIG } from './returnDisplay'

type ReturnLine = NonNullable<ReturnSummary['lines']>[number]

/**
 * What the document actually says, line by line.
 *
 * The API has sent these since the return document shipped and the list
 * simply never read them, so a three-line return opened to a panel of
 * dashes — the header has no one item, no one serial and no one
 * disposition to report, by design. This is where those live.
 */
export default function ReturnLinesTable({ lines }: { lines: ReturnLine[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Item
            </th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Qty
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Unit price
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Disposition
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Unit
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Reason
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {lines.map((line) => {
            const tone = line.disposition ? CONDITION_CONFIG[line.disposition] : null
            return (
              <tr key={line.id} className="align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-zinc-900">{line.item?.name ?? '—'}</p>
                  {line.item?.sku && (
                    <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-center font-semibold text-zinc-900">
                  {line.quantity}
                </td>
                <td className="px-3 py-2 text-right text-zinc-700">
                  {line.unitPrice != null ? fmtMoney(line.unitPrice) : '—'}
                </td>
                <td className="px-3 py-2">
                  {tone ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone.className}`}
                    >
                      <tone.icon className="h-3 w-3" />
                      {tone.label}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                  {/* A repair line moves no stock at all — the unit stays the
                      customer's — so its custody sheet is the only record
                      there is of it, and it belongs on the line, not the
                      header: each repair line raises its own. */}
                  {line.uds && (
                    <Link
                      href="/inventory/uds"
                      className="mt-0.5 block font-mono text-xs text-prominent-purple-700 hover:underline"
                      title="Custody is recorded on this UDS — no stock moved"
                    >
                      {line.uds.code}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2">
                  {line.serialNumber ? (
                    <span className="font-mono text-xs text-zinc-700">{line.serialNumber}</span>
                  ) : (
                    <span className="text-xs text-zinc-400">Not serial-tracked</span>
                  )}
                  {/* The other half of an exchange: without the unit that went
                      out, the row reads as though we took one back and gave
                      nothing. */}
                  {line.replacementSerialNumber && (
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      swapped for{' '}
                      <span className="font-mono text-prominent-purple-700">
                        {line.replacementSerialNumber}
                      </span>
                    </p>
                  )}
                </td>
                <td className="max-w-[16rem] px-3 py-2 text-xs text-zinc-600">
                  {line.reason || <span className="text-zinc-400">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
