/**
 * Mixed payment — one sale tendered with several methods (part cash, part
 * GCash, part card, ...). The first payment row is still the one Item Payment
 * Mode describes; every row added with "Add another payment method" carries
 * its own method and details (its `tender`), the same Paid with choices the
 * delivery fee takes.
 */

import type { PaymentMethodConfig, PosCardTxnMode, PosPaymentMethod } from '@/src/schema/pos'
import {
  DELIVERY_FEE_TENDER_LABELS,
  DELIVERY_FEE_TENDER_METHOD,
  DELIVERY_FEE_TENDERS,
  type DeliveryFeeTender,
} from './delivery'

export interface PaymentRow {
  method: PosPaymentMethod
  amount: number
  referenceNumber: string
  // populated for custom / configured methods
  configId?: string
  refFieldLabel?: string
  refRequired?: boolean
  refRegex?: string
  // Scenario 37 — bank for bank_transfer, gateway for qr. Card's terminal
  // choice comes from the transaction-scoped cardTerminalOptionId state
  // instead (set via Item Payment Mode), not stored per-row.
  paymentMethodOptionId?: string
  /** Set only on a row added with "Add another payment method". Such a row
   * owns its details below; the first row has none and follows Item Payment
   * Mode's transaction-scoped state. */
  tender?: DeliveryFeeTender
  /** The chosen bank / gateway / acquirer's name, for the receipt. */
  optionName?: string
  /** Check only. */
  checkNumber?: string
  /** Bank Transfer only. */
  bankVerified?: boolean
  /** Card only. */
  cardTxnMode?: PosCardTxnMode
  /** Card installment only. */
  cardTerm?: number
}

/** The order a new row picks its tender in. */
const NEXT_TENDER_PREFERENCE: readonly DeliveryFeeTender[] = [
  'cash_on_hand',
  'card',
  'gcash',
  'bank_transfer',
  'qr',
  'billers',
  'check',
]

/** The tenders a row can be paid with — those whose API method the branch has
 * switched on. */
export function availableTenders(enabledMethods: PosPaymentMethod[]): DeliveryFeeTender[] {
  return DELIVERY_FEE_TENDERS.filter((t) => enabledMethods.includes(DELIVERY_FEE_TENDER_METHOD[t]))
}

/** The tender a new row opens on: the first enabled one no payment uses yet. */
export function nextTender(
  available: DeliveryFeeTender[],
  used: DeliveryFeeTender[]
): DeliveryFeeTender {
  return (
    NEXT_TENDER_PREFERENCE.find((t) => !used.includes(t) && available.includes(t)) ??
    available[0] ??
    'cash_on_hand'
  )
}

/** A row's fields for a tender — its API method, the method's own reference
 * rules, and its details reset (a new tender starts over). */
export function rowForTender(
  tender: DeliveryFeeTender,
  configuredMethods: PaymentMethodConfig[],
  amount = 0,
  referenceNumber = ''
): PaymentRow {
  const method = DELIVERY_FEE_TENDER_METHOD[tender]
  const cfg = configuredMethods.find((m) => m.key === method)
  return {
    method,
    amount,
    referenceNumber,
    configId: cfg?.id,
    refFieldLabel: cfg?.referenceFieldLabel ?? undefined,
    refRequired: cfg?.referenceIsRequired,
    refRegex: cfg?.referenceFieldRegex ?? undefined,
    // A check is cash with the "Check" option, as it is on the sale.
    paymentMethodOptionId:
      tender === 'check'
        ? cfg?.options.find((o) => o.isEnabled && o.name === 'Check')?.id
        : undefined,
    tender,
    optionName: undefined,
    checkNumber: '',
    bankVerified: false,
    cardTxnMode: 'straight',
    cardTerm: undefined,
  }
}

export function tenderLabel(tender: DeliveryFeeTender, optionName?: string): string {
  const base = DELIVERY_FEE_TENDER_LABELS[tender]
  return optionName ? `${base} — ${optionName}` : base
}

/** Only Cash on Hand can hand change back: a check, card, transfer or QR is
 * for the amount it was written/charged/sent for. */
export function canGiveChange(row: PaymentRow, firstRowIsCheck: boolean): boolean {
  if (row.method !== 'cash') return false
  return row.tender ? row.tender !== 'check' : !firstRowIsCheck
}

/**
 * The amounts to record when the customer handed over more than the sale
 * needs: the change comes off the cash rows (the last one first), so a GCash,
 * card or transfer row is always recorded for what really went through it.
 */
export function withChangeTakenFromCash<T extends PaymentRow>(
  rows: T[],
  change: number,
  firstRowIsCheck: boolean
): T[] {
  let toTake = Math.round(change * 100) / 100
  const out = rows.map((r) => ({ ...r }))
  for (let i = out.length - 1; i >= 0 && toTake > 0.009; i--) {
    if (!canGiveChange(out[i], firstRowIsCheck)) continue
    const take = Math.min(out[i].amount, toTake)
    out[i].amount = Math.round((out[i].amount - take) * 100) / 100
    toTake = Math.round((toTake - take) * 100) / 100
  }
  return out.filter((r) => r.amount > 0.009)
}

export type PaymentIssueField = 'amount' | 'reference' | 'check' | 'term'

export interface PaymentIssue {
  /** Zero-based payment row, or null for the sale as a whole. */
  row: number | null
  field: PaymentIssueField | 'balance'
  message: string
}

/**
 * What a mixed payment is still missing — empty when it can be confirmed.
 * Mirrors what handleConfirm refuses, so Confirm can list every gap at once
 * instead of the first one it meets.
 */
export function mixedPaymentIssues(args: {
  payments: PaymentRow[]
  tenderTarget: number
  balance: number
  /** A down payment: ONE CR Number for the whole transaction (held on the
   * first row), asked once. Without one there is no CR at all. */
  transactionCr: boolean
  /** Whether a row asks for its own reference number, whether it must be
   * filled, and what it is called — only used when there is no transaction CR. */
  reference: (p: PaymentRow, i: number) => { shown: boolean; required: boolean; label: string }
  /** The first row is Item Payment Mode's Check. */
  firstRowIsCheck: boolean
  firstRowCheckNumber: string
  /** The first row is a Card on Installment with no Term picked yet. */
  firstRowMissingTerm: boolean
  fmt: (n: number) => string
}): PaymentIssue[] {
  const { payments, tenderTarget, balance, transactionCr, reference, firstRowIsCheck, fmt } = args
  const issues: PaymentIssue[] = []

  payments.forEach((p, i) => {
    const n = i + 1
    if (!(p.amount > 0)) {
      issues.push({ row: i, field: 'amount', message: `Payment ${n} — amount received` })
    }
    const ref = reference(p, i)
    if (!transactionCr && ref.shown && ref.required && !p.referenceNumber.trim()) {
      issues.push({ row: i, field: 'reference', message: `Payment ${n} — ${ref.label}` })
    }
    if (p.tender) {
      if (p.tender === 'check' && !(p.checkNumber ?? '').trim()) {
        issues.push({ row: i, field: 'check', message: `Payment ${n} — Check Number` })
      }
      if (p.method === 'card' && p.cardTxnMode === 'installment' && !p.cardTerm) {
        issues.push({ row: i, field: 'term', message: `Payment ${n} — card Term` })
      }
    } else {
      if (firstRowIsCheck && !args.firstRowCheckNumber.trim()) {
        issues.push({ row: i, field: 'check', message: `Payment ${n} — Check Number` })
      }
      if (args.firstRowMissingTerm) {
        issues.push({ row: i, field: 'term', message: `Payment ${n} — card Term` })
      }
    }
  })

  // Overpaying is only possible through cash: whatever isn't cash on hand has
  // to fit inside the sale by itself.
  const cannotOverpay = payments.filter((p) => !canGiveChange(p, firstRowIsCheck))
  const cannotOverpayTotal = cannotOverpay.reduce((s, p) => s + (p.amount || 0), 0)
  if (cannotOverpayTotal > tenderTarget + 0.009) {
    payments.forEach((p, i) => {
      if (canGiveChange(p, firstRowIsCheck) || !(p.amount > 0)) return
      issues.push({
        row: i,
        field: 'amount',
        message: `Payment ${i + 1} — more than the ${fmt(tenderTarget)} due (only cash gives change)`,
      })
    })
  }

  // The one CR of a down-payment sale lives on the first row and is asked once.
  if (transactionCr && !(payments[0]?.referenceNumber ?? '').trim()) {
    issues.push({ row: null, field: 'reference', message: 'CR Number' })
  }

  if (balance > 0.009) {
    issues.push({ row: null, field: 'balance', message: `${fmt(balance)} still unpaid` })
  }
  return issues
}
