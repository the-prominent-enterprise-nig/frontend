'use client'

import { fmtMoney } from '@/src/libs/data/AccountingV2Data'

/** An entry's lines as a table: account, what for, debit, credit, and the totals. */
export default function EntryTable({
  testId,
  lines,
}: {
  testId: string
  lines: {
    key: string
    account: string
    accountName: string
    description: string
    debit: number
    credit: number
  }[]
}) {
  const debit = lines.reduce((s, l) => s + l.debit, 0)
  const credit = lines.reduce((s, l) => s + l.credit, 0)
  // Debits first, then credits, each in account order: a posted entry comes back
  // from the ledger in no particular order, and it should read like its preview.
  const ordered = [...lines].sort(
    (a, b) =>
      Number(b.debit > 0) - Number(a.debit > 0) ||
      a.account.localeCompare(b.account, undefined, { numeric: true })
  )
  return (
    <div
      data-testid={testId}
      className="overflow-x-auto rounded-lg border border-gray-200 bg-white"
    >
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left">Account</th>
            <th className="px-3 py-2 text-left">What for</th>
            <th className="px-3 py-2 text-right">Debit</th>
            <th className="px-3 py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((l) => (
            <tr key={l.key} data-testid="entry-line" className="border-t border-gray-100">
              <td className="px-3 py-2">
                <span className="font-mono text-xs font-semibold text-purple-700">{l.account}</span>
                <span className="ml-2 text-gray-600">{l.accountName}</span>
              </td>
              <td className="px-3 py-2 text-gray-600">{l.description}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {l.debit > 0 ? fmtMoney(l.debit) : ''}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {l.credit > 0 ? fmtMoney(l.credit) : ''}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2" colSpan={2}>
              Total
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(debit)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(credit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
