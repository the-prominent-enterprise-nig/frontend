'use client'

import { MONO } from '../../../../inventory/purchase-orders/_components/procurementTokens'
import { PANEL } from '../../../../inventory/purchase-orders/_components/receive-po/receiveTokens'
import type { ManualRrTotals } from './manualRrCosting'

const fmtPeso = (n: number) => n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })

/**
 * Mirrors receive-po/ReceiptTotalsPanel.tsx's exact layout and row order
 * (stock value → VAT → invoice total → less withholding → payable), per
 * developer feedback that Manual RR should carry the same "Receipt totals"
 * view. Differs only in the notes: here VAT and withholding are both
 * per-line (taxCode / withholdingClass), not one document-wide rate, so the
 * captions describe the rule rather than a single percentage.
 */
export function ManualRrTotalsPanel({
  totals,
  lines,
  units,
}: {
  totals: ManualRrTotals
  lines: number
  units: number
}) {
  const rows = [
    {
      key: 'stock',
      label: 'Stock value',
      note: 'goods received, net of VAT',
      value: fmtPeso(totals.net),
    },
    {
      key: 'vat',
      label: 'Input VAT',
      note: totals.vat > 0 ? '12% on VAT-coded lines' : 'no line is VAT-coded',
      value: totals.vat > 0 ? fmtPeso(totals.vat) : '—',
    },
    {
      key: 'invoice',
      label: 'Invoice total',
      note: 'stock value plus input VAT',
      value: fmtPeso(totals.gross),
      rule: true,
      strong: true,
    },
    {
      key: 'wht',
      label: 'Less withholding tax',
      note:
        totals.withheld > 0
          ? '1% goods · 2% services · BIR 2307'
          : 'no line is classed for withholding',
      value: totals.withheld > 0 ? `−${fmtPeso(totals.withheld)}` : '—',
      minus: true,
    },
    {
      key: 'net',
      label: 'Payable to source',
      note: '',
      value: fmtPeso(totals.payable),
      rule: true,
      pay: true,
    },
  ]

  return (
    <div className={`${PANEL} flex h-full flex-col overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-3">
        <span className="text-[13.5px] font-semibold">Receipt totals</span>
        <span className="text-[11.5px] text-[#8b8b9b]">
          {units > 0
            ? `Computed from ${units} units on ${lines} ${lines === 1 ? 'line' : 'lines'}`
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
