'use client'

import { MONO } from '../procurementTokens'
import { PANEL } from './receiveTokens'
import { fmtPeso, type ReceiptTotals } from './receiveTotals'

/**
 * What this delivery is worth, in the order the figures actually derive:
 * goods value, the VAT carved out of it, what the supplier bills, what the
 * BIR takes back, and what is left to remit.
 *
 * Only ever rendered for roles holding `inventory:receive:cost-view` — the
 * caller gates it, the server is the real guard.
 */
export function ReceiptTotalsPanel({ totals }: { totals: ReceiptTotals }) {
  const rows = [
    {
      key: 'stock',
      label: 'Stock value',
      note: 'goods received, net of VAT',
      value: fmtPeso(totals.stock),
    },
    {
      key: 'vat',
      label: 'Input VAT',
      note: totals.chargesInputVat ? '12% of the invoice' : 'supplier is not VAT-registered',
      value: totals.chargesInputVat ? fmtPeso(totals.vat) : '—',
    },
    {
      key: 'invoice',
      label: 'Invoice total',
      note: 'stock value plus input VAT',
      value: fmtPeso(totals.invoice),
      rule: true,
      strong: true,
    },
    {
      key: 'wht',
      label: 'Less withholding tax',
      note: totals.withholdsTax ? '1% of stock value · BIR 2307' : 'none for this supplier',
      value: totals.withholdsTax ? `−${fmtPeso(totals.withheld)}` : '—',
      minus: true,
    },
    {
      key: 'net',
      label: 'Payable to supplier',
      note: '',
      value: fmtPeso(totals.net),
      rule: true,
      pay: true,
    },
  ]

  return (
    <div className={`${PANEL} flex h-full flex-col overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-3">
        <span className="text-[13.5px] font-semibold">Receipt totals</span>
        <span className="text-[11.5px] text-[#8b8b9b]">
          {totals.units > 0
            ? `Computed from ${totals.units} units on ${totals.lines} ${
                totals.lines === 1 ? 'line' : 'lines'
              }`
            : 'No quantities entered yet'}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center px-4.5 pb-3.5 pt-1.5">
        {rows.map((row) => (
          <div
            key={row.key}
            className={`flex items-baseline gap-2.5 ${row.pay ? 'pb-0.5 pt-2.5' : 'py-[7px]'} ${
              row.rule ? 'mt-[5px] border-t border-[#e4e4e9]' : ''
            }`}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
              <span
                className={
                  row.pay
                    ? 'text-[13.5px] font-semibold text-[#3f1490]'
                    : `text-[12.5px] text-[#3d3d4a] ${row.strong ? 'font-semibold' : ''}`
                }
              >
                {row.label}
              </span>
              {row.note && <span className="text-[11px] text-[#a3a3b2]">{row.note}</span>}
            </div>
            <span
              className={`${MONO} shrink-0 text-right tracking-[-.02em] ${
                row.pay
                  ? 'text-[21px] font-semibold text-[#3f1490]'
                  : row.strong
                    ? 'text-[16px] font-semibold text-[#17171c]'
                    : `text-[13.5px] font-medium ${row.minus ? 'text-[#b42318]' : 'text-[#17171c]'}`
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
