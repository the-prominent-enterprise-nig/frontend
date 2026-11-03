import {
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  type AgingReportLeanResponse,
} from '@/src/schema/crm/types'
import { fmt } from '../_format'

/** Scenario 47 — branch x aging bucket: the management summary above the per-branch detail. */
export function AgingMatrix({ report }: { report: AgingReportLeanResponse }): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
          <tr>
            <th className="px-4 py-2 font-semibold">Branch</th>
            <th className="px-4 py-2 text-right font-semibold">Accounts</th>
            {AGING_BUCKETS.map((b) => (
              <th key={b} className="px-4 py-2 text-right font-semibold">
                {AGING_BUCKET_LABELS[b]}
              </th>
            ))}
            <th className="px-4 py-2 text-right font-semibold">Unknown</th>
            <th className="px-4 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {report.branches.map((branch) => (
            <tr key={branch.branchId ?? 'unassigned'} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-900">{branch.branchName}</td>
              <td className="px-4 py-2 text-right tabular-nums">{branch.subtotal.count}</td>
              {AGING_BUCKETS.map((b) => (
                <td key={b} className="px-4 py-2 text-right tabular-nums">
                  {fmt(branch.subtotal.buckets[b])}
                </td>
              ))}
              <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                {fmt(branch.subtotal.buckets.unknown)}
              </td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">
                {fmt(branch.subtotal.ob)}
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <td className="px-4 py-2">TOTAL</td>
            <td className="px-4 py-2 text-right tabular-nums">{report.grandTotal.count}</td>
            {AGING_BUCKETS.map((b) => (
              <td key={b} className="px-4 py-2 text-right tabular-nums">
                {fmt(report.grandTotal.buckets[b])}
              </td>
            ))}
            <td className="px-4 py-2 text-right tabular-nums">
              {fmt(report.grandTotal.buckets.unknown)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(report.grandTotal.ob)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
