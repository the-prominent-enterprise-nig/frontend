'use client'

import { MONO, fmtPeso } from './returnTokens'
import type { CustomerReturnResult } from '../../_actions/create-customer-return'
import type { ReturnSettlement } from './returnTotals'

type Props = {
  result: CustomerReturnResult
  settlement: ReturnSettlement
  branchName?: string
  onPrint: () => void
  onClose: () => void
}

/**
 * What happened, stated once and not taken away.
 *
 * A toast was wrong for this. The RR number is what the clerk writes on the
 * customer's copy before they can leave, and a message that dismisses itself
 * after four seconds is a number they have to go and look up again. It also
 * gives the credit-memo outcome somewhere permanent to live: a return against
 * a settled invoice posts correctly and credits nothing, and that is worth
 * saying in full rather than colouring a toast amber.
 */
export default function PostedDialog({ result, settlement, branchName, onPrint, onClose }: Props) {
  // A null memo is only worth flagging where one was actually expected. A cash
  // return credits nothing by design and needs no explaining.
  const creditMissed = !!result.arInvoiceId && !result.creditMemoId

  const money =
    settlement.net < 0
      ? `${fmtPeso(-settlement.net)} is collectible from the customer.`
      : settlement.net > 0
        ? `${fmtPeso(settlement.net)} goes back to the customer.`
        : 'Nothing is refunded.'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-posted-title"
      className="fixed inset-0 z-80 flex items-center justify-center bg-[rgba(23,23,28,.45)] p-[22px]"
    >
      <div className="flex w-full max-w-[500px] flex-col gap-[15px] rounded-[14px] border border-[#dcefe5] bg-[#f4fbf7] p-[22px]">
        <div className="flex flex-col gap-[5px]">
          <span id="return-posted-title" className="text-[17px] font-semibold text-[#0b6644]">
            Return posted
          </span>
          <span className="text-[12.5px] leading-[1.55] text-[#3d3d4a]">
            {settlement.units} {settlement.units === 1 ? 'unit' : 'units'} received
            {branchName ? ` at ${branchName}` : ''}. {money}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-[10px] border border-[#dcefe5] bg-white px-3.5 py-3">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11.5px] text-[#5b5b6b]">Write this on their copy</span>
            <span className={`${MONO} text-[15px] font-semibold text-[#17171c]`}>
              {result.receivingReportNumber}
            </span>
          </span>
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11.5px] text-[#5b5b6b]">Return</span>
            <span className={`${MONO} text-[11.5px] text-[#3d3d4a]`}>{result.returnNumber}</span>
          </span>
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11.5px] text-[#5b5b6b]">Credit memo</span>
            <span className={`${MONO} text-[11.5px] text-[#3d3d4a]`}>
              {result.creditMemoNumber ?? '—'}
            </span>
          </span>
        </div>

        {creditMissed && (
          <p className="rounded-[10px] border border-[#f5e2c6] bg-[#fffdf8] px-3.5 py-3 text-[11.5px] leading-[1.5] text-[#8a4b06]">
            The goods are in and the stock has moved, but no credit memo was raised.{' '}
            {result.accountingNote ??
              'Raise one against the invoice from the return’s detail panel.'}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-[9px]">
          <button
            type="button"
            onClick={onPrint}
            className="cursor-pointer rounded-lg border border-[#b6e0cd] bg-white px-[15px] py-2.5 text-[13px] font-medium text-[#0b6644] hover:bg-[#f4fbf7]"
          >
            Print slip
          </button>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="cursor-pointer rounded-lg bg-[#0f7b52] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0b6644]"
          >
            Back to returns
          </button>
        </div>
      </div>
    </div>
  )
}
