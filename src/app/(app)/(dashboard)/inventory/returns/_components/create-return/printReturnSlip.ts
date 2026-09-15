import type { CustomerReturnResult } from '../../_actions/create-customer-return'
import {
  DISPOSITION_META,
  REASON_LABELS,
  type CustomerReturnFormValues,
} from '@/src/schema/inventory/returns'
import { fmtPeso } from './returnTokens'

export type SlipContext = {
  customerName?: string
  branchName?: string
  values: CustomerReturnFormValues
  result: CustomerReturnResult
}

/** Anything typed by a clerk reaches this through innerHTML, so it is escaped
 *  on the way in rather than trusted because it came from our own form. */
function esc(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}

/**
 * The customer's copy, in its own window.
 *
 * A separate window rather than window.print() on the screen behind it: the
 * dashboard chrome is outside this route's control, so printing in place would
 * hand the customer a sidebar. Follows libs/print/printInventoryDocument.ts,
 * which solved the same problem for goods receipts.
 *
 * Built from what was submitted plus what came back, not from a re-fetch —
 * the customer is standing at the counter, and a slip that waits on a round
 * trip is a slip that sometimes never prints.
 */
export function printReturnSlip({ customerName, branchName, values, result }: SlipContext): void {
  const win = window.open('', '_blank', 'width=760,height=800')
  if (!win) return

  const rows = values.lines
    .map((line) => {
      const reason = line.reasonCode ? REASON_LABELS[line.reasonCode] : ''
      const outcome = line.disposition ? DISPOSITION_META[line.disposition].label : ''
      return `<tr>
        <td>${esc(line.itemName ?? line.itemSku ?? '')}${
          line.serialNumber ? `<div class="sub">${esc(line.serialNumber)}</div>` : ''
        }</td>
        <td class="num">${esc(line.quantity)}</td>
        <td>${esc(reason)}${
          line.faultNote ? `<div class="sub">${esc(line.faultNote)}</div>` : ''
        }</td>
        <td>${esc(outcome)}</td>
        <td class="num">${esc(fmtPeso(line.unitPrice * line.quantity))}</td>
      </tr>`
    })
    .join('')

  win.document.write(`<!DOCTYPE html><html><head><title>${esc(
    result.receivingReportNumber
  )}</title><style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 12px; }
    .label { color: #888; font-size: 11px; text-transform: uppercase; margin: 0; }
    .sub { color: #777; font-size: 11px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 6px 8px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; }
    td { padding: 6px 8px; border-top: 1px solid #eee; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .sign { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; font-size: 12px; }
    .rule { border-top: 1px solid #999; padding-top: 5px; color: #666; }
    .footer { margin-top: 28px; font-size: 11px; color: #999; }
    @media print { body { padding: 0; } button { display: none; } }
  </style></head><body>
    <p class="label">Goods received from customer</p>
    <h1>${esc(result.receivingReportNumber)}</h1>
    <p style="font-size:12px;color:#666">Return ${esc(
      result.returnNumber
    )} · ${new Date().toLocaleString('en-PH')}</p>

    <h2>Details</h2>
    <div class="meta">
      <div><p class="label">Customer</p><p>${esc(customerName ?? 'Walk-in')}</p></div>
      <div><p class="label">Branch</p><p>${esc(branchName ?? '')}</p></div>
      <div><p class="label">Against invoice</p><p>${esc(values.salesInvoiceNumber ?? '—')}</p></div>
      <div><p class="label">Credit memo</p><p>${esc(result.creditMemoNumber ?? '—')}</p></div>
    </div>

    <h2>What came back</h2>
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th>Reason</th><th>Outcome</th><th class="num">Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${values.notes ? `<p class="footer">${esc(values.notes)}</p>` : ''}

    <div class="sign">
      <div class="rule">Received by</div>
      <div class="rule">Customer</div>
    </div>

    <button onclick="window.print()" style="margin:24px 0;padding:6px 16px;background:#5b21b6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button>
  </body></html>`)
  win.document.close()
}
