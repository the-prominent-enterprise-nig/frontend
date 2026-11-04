import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { fmtMoney, type ARInvoiceCustomerRollup } from '@/src/libs/data/AccountingV2Data'
import type { Settled } from '@/src/libs/api/unwrap'
import { ClickableRow } from '@/src/components/ssr/ClickableRow'
import { SectionError } from '@/src/components/ssr/SectionError'
import { UrlPagination } from '@/src/components/ssr/UrlPagination'
import { fixedPages } from '@/src/components/ssr/paginate'
import { PER_PAGE } from './params'

const HEADERS: { label: string; align: 'left' | 'right' }[] = [
  { label: 'Invoice #', align: 'left' },
  { label: 'Customer', align: 'left' },
  { label: 'Invoice Date', align: 'left' },
  { label: 'Due Date', align: 'left' },
  { label: 'Terms', align: 'right' },
  { label: 'Total', align: 'right' },
  { label: 'Paid', align: 'right' },
  { label: 'Outstanding', align: 'right' },
  { label: 'Status', align: 'left' },
  { label: 'Actions', align: 'right' },
]

/**
 * One row per customer, customers owing the most first. Server Component: the
 * rows are in the HTML and ship no JavaScript; only the row click (ClickableRow)
 * and the pager are client islands. Clicking a row opens that customer's own
 * invoice page.
 */
export function CustomerRollupTable({
  rollup,
  page,
}: {
  rollup: Settled<{ items: ARInvoiceCustomerRollup[]; total: number }>
  page: number
}): React.JSX.Element {
  if (!rollup.ok) return <SectionError message={`Could not load AR invoices: ${rollup.error}`} />

  const { items, total } = rollup.data

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h.label}
                  className={`px-3 py-2 ${h.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                  No invoices.
                </td>
              </tr>
            ) : (
              items.map((g) => (
                <ClickableRow
                  key={g.customerId}
                  href={`/accounting/ar-invoices/customer/${g.customerId}`}
                  className="bg-gray-50 font-medium hover:bg-gray-100"
                >
                  <td className="px-3 py-2" colSpan={2}>
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                      {/* prefetch off: 50 rows x 2 links would each fire a
                          prefetch request on every visit; a click is the only
                          way into one customer. */}
                      <Link
                        href={`/accounting/ar-invoices/customer/${g.customerId}`}
                        prefetch={false}
                        className="truncate hover:underline"
                      >
                        {g.customerName}
                      </Link>
                      <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-normal text-gray-600">
                        {g.invoiceCount} invoice{g.invoiceCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs" colSpan={3}>
                    {g.overdueCount > 0 && (
                      <span className="font-medium text-red-600">{g.overdueCount} overdue</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtMoney(g.total)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(g.paid)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(g.outstanding)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/accounting/reports?tab=customer-statement&customerId=${g.customerId}`}
                      prefetch={false}
                      className="text-xs font-medium text-purple-700 hover:underline"
                    >
                      Statement
                    </Link>
                  </td>
                </ClickableRow>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > 0 && <UrlPagination info={fixedPages(page, PER_PAGE, total)} noun="customer" />}
    </div>
  )
}
