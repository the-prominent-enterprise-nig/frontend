/**
 * Collections — a collection taken with several methods (part cash, part
 * GCash, part card). Each payment picks its own method with the same buttons
 * POS checkout uses; the CR number is the collection's one, asked once.
 */

import type { PaymentMethod } from '@/src/libs/data/AccountingV2Data'
import {
  DELIVERY_FEE_TENDERS,
  TENDERS_WITH_OPTIONS,
  type DeliveryFeeTender,
} from '../../checkout/_utils/delivery'
import { qrOptionGroup } from '../../checkout/_utils/qr-option-groups'

export type CollectionsPaymentOption = {
  /** Select value — the PosPaymentMethodConfig id, or 'CHECK'. */
  id: string
  label: string
  method: PaymentMethod
  configId?: string
  /** Named sub-choices (which bank/gateway) — empty when the method has none. */
  options: { id: string; name: string }[]
}

// The method buttons are POS checkout's own seven (Cash on Hand … Debit/Credit
// Card, same labels, same order), so a collection is picked the way a sale's
// payment is. Each one resolves to the same payment method the old dropdown
// sent; GCash and Billers are QR with their own part of its option list.
export const COLLECTIONS_TILE_METHOD: Record<DeliveryFeeTender, PaymentMethod> = {
  cash_on_hand: 'CASH',
  check: 'CHECK',
  bank_transfer: 'BANK_TRANSFER',
  gcash: 'QR',
  billers: 'QR',
  qr: 'QR',
  card: 'CARD',
}

export const TILE_OPTION_LABEL: Partial<Record<DeliveryFeeTender, string>> = {
  bank_transfer: 'Bank',
  gcash: 'Gateway',
  billers: 'Biller',
  qr: 'Gateway',
  card: 'Card Acquirer',
}

/** The bank / gateway / biller / acquirer choices a button offers. */
export function tileOptions(
  tile: DeliveryFeeTender,
  option: CollectionsPaymentOption | undefined
): { id: string; name: string }[] {
  if (!option || !TENDERS_WITH_OPTIONS.includes(tile)) return []
  return option.method === 'QR'
    ? option.options.filter((o) => qrOptionGroup(o.name) === tile)
    : option.options
}

/** Only the buttons this branch can actually take: Check is always there, the
 * rest follow the branch's enabled methods, and GCash / Billers need at least
 * one option of their own to be worth showing. */
export function availableTiles(paymentMethods: CollectionsPaymentOption[]): DeliveryFeeTender[] {
  return DELIVERY_FEE_TENDERS.filter((tile) => {
    const option = paymentMethods.find((m) => m.method === COLLECTIONS_TILE_METHOD[tile])
    if (!option) return false
    if (option.method !== 'QR') return true
    // A QR method with no named choices at all still takes plain QR.
    if (tile === 'qr' && option.options.length === 0) return true
    return tileOptions(tile, option).length > 0
  })
}

/** One payment of the collection, as typed. */
export interface CollectionPaymentRow {
  /** Stable React key — rows come and go. */
  key: string
  tile: DeliveryFeeTender | ''
  optionId: string
  /** The bank's own transaction reference — a Bank Transfer payment only. */
  bankReferenceNumber: string
  amount: string
}

let rowCounter = 0
export function newCollectionPaymentRow(
  tile: DeliveryFeeTender | '' = '',
  amount = ''
): CollectionPaymentRow {
  rowCounter += 1
  return { key: `payment-${rowCounter}`, tile, optionId: '', bankReferenceNumber: '', amount }
}

/** A row read against this branch's methods: the button it really is on (a
 * choice no longer on offer falls back to Cash), what that sends, and the
 * bank / gateway choice if it is still one of its options. */
export function resolveCollectionPayment(
  row: CollectionPaymentRow,
  tiles: DeliveryFeeTender[],
  paymentMethods: CollectionsPaymentOption[]
) {
  const tile: DeliveryFeeTender =
    tiles.find((t) => t === row.tile) ??
    (tiles.includes('cash_on_hand') ? 'cash_on_hand' : tiles[0])
  const option = paymentMethods.find((m) => m.method === COLLECTIONS_TILE_METHOD[tile])
  const options = tileOptions(tile, option)
  // A choice left over from a button (or branch) no longer selected is not sent.
  const optionId = options.some((o) => o.id === row.optionId) ? row.optionId : undefined
  return {
    tile,
    option,
    method: option?.method ?? 'CASH',
    options,
    optionId,
    amount: Number(row.amount) || 0,
  }
}

export type CollectionIssueField = 'amount' | 'bankReference' | 'option' | 'cr'

export interface CollectionIssue {
  /** Zero-based payment, or null for the collection as a whole. */
  row: number | null
  field: CollectionIssueField
  message: string
}

/**
 * What the collection is still missing — empty when it can be submitted.
 * Collect payment is never switched off for these: pressing it lists them.
 */
export function collectionIssues(args: {
  rows: {
    amount: number
    method: PaymentMethod
    bankReferenceNumber: string
    /** The bank / gateway / biller / acquirer this payment has to name — only
     * when its method offers any; null when there is nothing to choose. */
    option?: { label: string; chosen: boolean } | null
  }[]
  cr: string
}): CollectionIssue[] {
  const { rows, cr } = args
  const several = rows.length > 1
  const issues: CollectionIssue[] = []
  rows.forEach((r, i) => {
    const who = several ? `Payment ${i + 1} — ` : ''
    if (!(r.amount > 0)) {
      issues.push({
        row: i,
        field: 'amount',
        message: several ? `${who}amount received` : 'Amount received',
      })
    }
    // Which bank / gateway / acquirer the money went through is part of the
    // record, so a method that offers a choice needs one.
    if (r.option && !r.option.chosen) {
      const label = r.option.label.charAt(0).toUpperCase() + r.option.label.slice(1).toLowerCase()
      issues.push({
        row: i,
        field: 'option',
        message: several ? `${who}${label.toLowerCase()}` : label,
      })
    }
    if (r.method === 'BANK_TRANSFER' && !r.bankReferenceNumber.trim()) {
      issues.push({ row: i, field: 'bankReference', message: `${who}Bank reference number` })
    }
  })
  if (!cr.trim()) issues.push({ row: null, field: 'cr', message: 'CR number' })
  return issues
}
