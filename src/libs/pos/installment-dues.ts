import type { InstallmentScheduleLineWithInvoice } from '@/src/schema/pos'

/** A plan's dues all hang off ONE ARInvoice — the receivable for the whole
 * sale, opened at down payment + total payable (see transactions.service.ts's
 * `contractAmount`). So the invoice's own dueDate/totalAmount/amountPaid/
 * status describe the CONTRACT, not any one month: read a due off them and
 * every month shows the same date, the same plan-wide balance, and the same
 * badge. Per-due state lives on the line itself (amount/dueDate/paidAmount/
 * settledAt), advanced by ARInvoicesService's oldest-due-first allocation.
 *
 * These helpers are the one place that distinction is encoded. Anything
 * rendering a single due — the collections list, Customer 360's Upcoming
 * Payables and plan modal — goes through them rather than reaching into
 * `line.arInvoice`, which is what let the same bug ship twice.
 *
 * Decimal columns arrive as JSON strings even though the types say number,
 * hence the Number() at every boundary. */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** What this month still owes. */
export function dueOutstanding(line: InstallmentScheduleLineWithInvoice): number {
  return Math.max(Math.round((Number(line.amount) - Number(line.paidAmount)) * 100) / 100, 0)
}

/** What has been collected against this month. Excludes the down payment,
 * which settles no due (its ARPayment carries a null installmentScheduleLineId)
 * and is reported on its own alongside the schedule. */
export function duePaid(line: InstallmentScheduleLineWithInvoice): number {
  return Number(line.paidAmount)
}

/** Per-due equivalent of the invoice status badge, in the same vocabulary
 * DUE_STATUS_LABELS speaks. A voided/never-posted contract still reports at
 * contract level — no due of it is collectable either way. */
export function dueStatus(line: InstallmentScheduleLineWithInvoice): string {
  if (['DRAFT', 'CANCELLED'].includes(line.arInvoice.status)) return line.arInvoice.status
  if (line.settledAt) return 'PAID'
  if (Number(line.paidAmount) > 0) return 'PARTIAL'
  return line.dueDate.slice(0, 10) < todayIso() ? 'OVERDUE' : 'SENT'
}

/** Still collectable: the contract is posted and not voided, and this due
 * hasn't been settled. */
export function isDueOpen(line: InstallmentScheduleLineWithInvoice): boolean {
  return !line.settledAt && !['DRAFT', 'CANCELLED'].includes(line.arInvoice.status)
}

/** Collections against the dues of one plan — again, down payment excluded,
 * so this nets against `totalPayable` (the figure the dues actually bill)
 * rather than the invoice's down-payment-inclusive contract amount. */
export function sumDuesPaid(lines: InstallmentScheduleLineWithInvoice[]): number {
  return Math.round(lines.reduce((sum, line) => sum + Number(line.paidAmount), 0) * 100) / 100
}

/** ARInvoice.status is the underlying AR lifecycle state — "SENT" means
 * "posted, awaiting payment", not that a notification went out. Relabeled to
 * the Paid/Due/Overdue language a customer-facing schedule actually needs. */
export const DUE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Due',
  PARTIAL: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
}
