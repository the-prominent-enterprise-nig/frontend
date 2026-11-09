'use client'

import { useState } from 'react'
import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import {
  getCustomerReturns,
  type CustomerReturnRecord,
  type ReturnDisposition,
} from '../../_actions/get-customer-returns'
import { MONO } from '../../../purchase-orders/_components/procurementTokens'
import { PANEL } from './rrTokens'

/** What the POS return did with each unit, in the counter's own words. */
const DISPOSITION_LABEL: Record<ReturnDisposition, string> = {
  restock: 'Back on the shelf',
  quarantine: 'On hold (not sellable)',
  scrap: 'Written off',
  repair: 'Sent for repair',
  exchange: 'Exchanged',
}

const CAPTION = `${MONO} mb-1 block text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`

/**
 * Ticket #27 — the Return reason on Create RR. A customer return is received
 * at the POS (the cashier's return moves the stock and credits the customer)
 * and already carries its receiving report # (RRC-…). This panel finds that
 * report — by the RRC #, the Sales Invoice No., the customer, an item or a
 * serial — and shows it; nothing here posts stock, so a returned unit is
 * never counted twice.
 */
export function CustomerReturnLookupPanel(): React.JSX.Element {
  const [pickedId, setPickedId] = useState('')
  const [picked, setPicked] = useState<CustomerReturnRecord | null>(null)

  return (
    <div className={PANEL}>
      <div className="flex flex-col gap-0.5 border-b border-[#eeeef1] px-4.5 py-3.5">
        <span className="text-[13.5px] font-semibold">Returned units</span>
        <span className="text-[11.5px] text-ink-muted">
          Returns are received at the POS — the cashier&rsquo;s return puts the unit back and
          credits the customer, and issues its receiving report. Find it here by the invoice #, the
          customer&rsquo;s name, the unit or the RRC #.
        </span>
      </div>

      <div className="px-4.5 py-4">
        <label className={CAPTION}>Find the return</label>
        <SearchCombobox
          value={pickedId}
          onChange={setPickedId}
          onSelect={(option: SearchComboboxOption) =>
            setPicked(option.meta as CustomerReturnRecord)
          }
          queryKey="customer-returns-lookup"
          placeholder="Invoice #, customer, serial or RRC #…"
          typeToSearchMessage="No customer returns yet"
          emptyMessage="No customer return matches that"
          search={async (query) => {
            const res = await getCustomerReturns({ search: query || undefined })
            return (res.data ?? []).map((r) => ({
              id: r.id,
              primary: r.siNumber
                ? `${r.siNumber} · ${r.receivingReportNumber}`
                : r.receivingReportNumber,
              secondary:
                [r.customer?.name, r.soldAtBranch && `Sold at ${r.soldAtBranch.name}`]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              meta: r,
            }))
          }}
        />
      </div>

      {picked && <ReturnDetail record={picked} />}
    </div>
  )
}

function ReturnDetail({ record }: { record: CustomerReturnRecord }): React.JSX.Element {
  const facts: [string, string][] = [
    ['Receiving report #', record.receivingReportNumber],
    ['Return #', record.returnNumber],
    ['Invoice #', record.siNumber ?? '—'],
    ['Sold at', record.soldAtBranch?.name ?? '—'],
    [
      'Returned at',
      `${record.returnedAtBranch.name} · ${new Date(record.returnedAt).toLocaleDateString('en-PH', {
        dateStyle: 'medium',
      })}`,
    ],
    [
      'Customer',
      record.customer
        ? `${record.customer.name} (${record.customer.customerCode})`
        : 'Walk-in customer',
    ],
  ]
  return (
    <div className="border-t border-[#eeeef1] px-4.5 py-4">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className={CAPTION}>{label}</dt>
            <dd className="text-[13px] text-[#17171c]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[#e4e4e9]">
        <table className="w-full text-[12.5px]">
          <thead className="bg-[#fbfbfc] text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2">Serial #</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">What happened</th>
            </tr>
          </thead>
          <tbody>
            {record.units.map((u) => (
              <tr key={u.id} className="border-t border-[#eeeef1]">
                <td className={`${MONO} px-3 py-2`}>{u.serialNumber ?? '—'}</td>
                <td className="px-3 py-2">{u.modelNumber ?? '—'}</td>
                <td className="px-3 py-2">{u.brand ?? '—'}</td>
                <td className="px-3 py-2">
                  {u.itemName}
                  {u.quantity !== 1 && ` × ${u.quantity}`}
                </td>
                <td className="px-3 py-2">{DISPOSITION_LABEL[u.disposition]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
