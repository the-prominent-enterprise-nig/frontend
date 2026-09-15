'use client'

import { LABEL, MONO, fmtPeso } from './returnTokens'
import type { ReturnSettlement } from './returnTotals'

type Props = {
  settlement: ReturnSettlement
  notes: string
  onNotes: (value: string) => void
}

type Cell = { key: string; label: string; value: string; note: string; strong?: boolean }

/**
 * The money, read across like a receipt.
 *
 * Four cells rather than one total, because "what the customer gets back" is
 * the sum of three facts that behave differently, and a clerk challenged on
 * the figure has to be able to point at which one. The repair column exists
 * purely so nobody reads the refund as the value of everything handed over —
 * a unit going to service is worth money and refunds none of it.
 */
function cells(s: ReturnSettlement): Cell[] {
  return [
    {
      key: 'refundable',
      label: 'Refundable',
      value: fmtPeso(s.refundable),
      note: s.refundable ? 'restock, quarantine, scrap' : 'nothing yet',
    },
    {
      key: 'exchange',
      label: 'Exchange difference',
      value: !s.swaps ? '—' : s.swapsPriced < s.swaps ? 'pending' : 'even',
      note: !s.swaps
        ? 'no swaps'
        : s.swapsPriced < s.swaps
          ? 'replacement not picked'
          : `${s.swaps} ${s.swaps === 1 ? 'unit' : 'units'} swapped`,
    },
    {
      key: 'repair',
      label: 'Not refunded',
      value: s.notRefunded ? fmtPeso(s.notRefunded) : '—',
      note: s.notRefunded ? 'repairs — unit goes back' : 'no repairs',
    },
    {
      key: 'net',
      label: s.net < 0 ? 'Customer pays' : 'Customer gets back',
      value: fmtPeso(Math.abs(s.net)),
      note: `${s.units} ${s.units === 1 ? 'unit' : 'units'} coming back`,
      strong: true,
    },
  ]
}

export default function SettlementLedger({ settlement, notes, onNotes }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
      <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1.15fr]">
        {cells(settlement).map((cell, i) => (
          <div
            key={cell.key}
            className={`flex min-w-0 flex-col gap-[3px] px-[17px] py-3.5 ${
              cell.strong ? 'bg-[#fbfbfc]' : 'bg-white'
            } ${i % 2 === 1 ? 'border-l border-[#eeeef1]' : ''} ${
              i > 1 ? 'border-t border-[#eeeef1]' : ''
            } md:border-t-0 ${i > 0 ? 'md:border-l md:border-[#eeeef1]' : 'md:border-l-0'}`}
          >
            <span className={cell.strong ? `${LABEL} text-[#3f1490]` : LABEL}>{cell.label}</span>
            <span
              className={`${MONO} font-semibold tracking-[-.02em] ${
                cell.strong ? 'text-[20px] text-[#17171c]' : 'text-[15px]'
              } ${
                !cell.strong && (cell.value === '—' || cell.value === 'pending')
                  ? 'text-[#a3a3b2]'
                  : cell.strong
                    ? ''
                    : 'text-[#3d3d4a]'
              }`}
            >
              {cell.value}
            </span>
            <span
              className={`text-[10.5px] leading-[1.35] ${
                cell.strong ? 'text-[#3d3d4a]' : 'text-[#5b5b6b]'
              }`}
            >
              {cell.note}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[#e4e4e9] bg-[#fbfbfc] px-[17px] py-[11px] md:flex-nowrap">
        <label htmlFor="return-notes" className={LABEL}>
          Notes
        </label>
        <input
          id="return-notes"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Anything worth recording about this return (optional)…"
          maxLength={1000}
          className="h-[34px] min-w-0 flex-1 rounded-lg border border-[#d3d3db] bg-white px-[11px] text-[12.5px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
        />
      </div>
    </div>
  )
}
