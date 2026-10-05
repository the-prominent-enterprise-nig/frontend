/**
 * Scenario 66 — a sale marked for delivery: who receives it, where, and the
 * delivery fee. The fee is collected at the counter on its own collection
 * receipt and is never part of the sale — not in the Total, the tender, the
 * change or the loyalty points (docs/scenario-66-pos-delivery-fee-plan.md).
 *
 * These rules mirror the backend's prepareDeliveryFields (rules R1–R6), so
 * the cashier hears about a problem at Confirm rather than from the server.
 */

import type { PaymentMethodConfig, PosCardTxnMode } from '@/src/schema/pos'

/** The API's tenders for a delivery fee — the same four a down payment takes. */
export type DeliveryFeeMethod = 'cash' | 'card' | 'bank_transfer' | 'qr'

/**
 * Paid with — the same five choices as the sale's Cash payment mode (PR #201
 * review), each with the same details: a check number for Check, the bank
 * (and "verified at register") for Bank Transfer, the gateway for QR, and the
 * card acquirer with Straight / Installment for a card.
 */
export const DELIVERY_FEE_TENDERS = [
  'cash_on_hand',
  'check',
  'bank_transfer',
  'qr',
  'card',
] as const
export type DeliveryFeeTender = (typeof DELIVERY_FEE_TENDERS)[number]

export const DELIVERY_FEE_TENDER_LABELS: Record<DeliveryFeeTender, string> = {
  cash_on_hand: 'Cash on Hand',
  check: 'Check',
  bank_transfer: 'Bank Transfer',
  qr: 'QR',
  card: 'Debit/Credit Card',
}

/** A check is cash with a check number, as it is on the sale. */
export const DELIVERY_FEE_TENDER_METHOD: Record<DeliveryFeeTender, DeliveryFeeMethod> = {
  cash_on_hand: 'cash',
  check: 'cash',
  bank_transfer: 'bank_transfer',
  qr: 'qr',
  card: 'card',
}

/** The tenders whose bank / gateway / card acquirer is picked from a list. */
export const TENDERS_WITH_OPTIONS: readonly DeliveryFeeTender[] = ['bank_transfer', 'qr', 'card']

/** The card-installment terms checkout offers on the sale. */
export const CARD_INSTALLMENT_TERMS = [3, 6, 9, 12, 18, 24] as const

/** Column widths on PosTransaction (and the CR booklet number's). */
export const DELIVER_TO_MAX = 255
export const DELIVERY_ADDRESS_MAX = 1000
export const DELIVERY_FEE_CR_MAX = 100
export const DELIVERY_FEE_CHECK_NUMBER_MAX = 50

export interface DeliveryState {
  enabled: boolean
  deliverTo: string
  /** Once the cashier types in Deliver to, a customer change no longer overwrites it. */
  deliverToEdited: boolean
  /** 'customer' follows the selected customer's own address; 'picked' is
   * what the cashier chose in the address picker instead. */
  addressSource: 'customer' | 'picked'
  pickedAddress: string
  pickedBarangayCode: string
  /** The cashier pressed Save on the picked address: the picker closes into
   * a card, and Confirm accepts it. Any further pick clears it. */
  addressSaved: boolean
  /** What the picker opens with when it isn't the customer's own address —
   * the saved pick, frozen at "Change address". Kept apart from
   * pickedAddress because the picker re-hydrates whenever its initial
   * values change, so it can't be fed the address it is reporting. */
  pickerSeed: CustomerAddress | null
  /** The address picker reads its initial values once, so it is re-mounted
   * (this bumped) only when it should start over — never just because the
   * cashier picked something in it. */
  pickerKey: number
  /** As typed. Empty means free delivery. */
  fee: string
  tender: DeliveryFeeTender
  feeCr: string
  /** Check only. */
  checkNumber: string
  /** The bank, gateway or card acquirer — cleared whenever the tender changes. */
  optionId: string | undefined
  /** Bank Transfer only. */
  bankVerified: boolean
  /** Card only. */
  cardTxnMode: PosCardTxnMode
  /** Card installment only. */
  cardTerm: number | undefined
}

export const EMPTY_DELIVERY: DeliveryState = {
  enabled: false,
  deliverTo: '',
  deliverToEdited: false,
  addressSource: 'customer',
  pickedAddress: '',
  pickedBarangayCode: '',
  addressSaved: false,
  pickerSeed: null,
  pickerKey: 0,
  fee: '',
  tender: 'cash_on_hand',
  feeCr: '',
  checkNumber: '',
  optionId: undefined,
  bankVerified: false,
  cardTxnMode: 'straight',
  cardTerm: undefined,
}

/** The enabled bank / gateway / acquirer choices for a tender, from the
 * branch's configured payment methods — the same list the sale offers. */
export function deliveryFeeOptions(
  tender: DeliveryFeeTender,
  configuredMethods: PaymentMethodConfig[]
): { id: string; name: string }[] {
  if (!TENDERS_WITH_OPTIONS.includes(tender)) return []
  const config = configuredMethods.find((m) => m.key === tender)
  return config?.options.filter((o) => o.isEnabled) ?? []
}

/** The fee's receipt as the transaction detail reads it back. */
export interface DeliveryFeeReceiptTender {
  method: 'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' | 'QR' | null
  checkNumber?: string | null
  bankTransferVerifiedAtRegister?: boolean
  cardTxnMode?: PosCardTxnMode | null
  cardInstallmentTerm?: number | null
  paymentMethodOption?: { name: string } | null
}

const RECEIPT_METHOD_TENDER: Record<
  NonNullable<DeliveryFeeReceiptTender['method']>,
  DeliveryFeeTender
> = {
  CASH: 'cash_on_hand',
  CHECK: 'check',
  BANK_TRANSFER: 'bank_transfer',
  QR: 'qr',
  CARD: 'card',
}

/** The same label as the success screen's, from the saved receipt. */
export function deliveryFeeReceiptTenderLabel(receipt: DeliveryFeeReceiptTender): string | null {
  if (!receipt.method) return null
  return deliveryFeeTenderLabel(
    {
      ...EMPTY_DELIVERY,
      tender: RECEIPT_METHOD_TENDER[receipt.method],
      checkNumber: receipt.checkNumber ?? '',
      bankVerified: !!receipt.bankTransferVerifiedAtRegister,
      cardTxnMode: receipt.cardTxnMode ?? 'straight',
      cardTerm: receipt.cardInstallmentTerm ?? undefined,
    },
    receipt.paymentMethodOption?.name
  )
}

/** How the fee was paid, for the success screen: "Check #0012",
 * "Bank Transfer — BDO (verified at register)", "Debit/Credit Card — BPI ·
 * Installment, 6 months". */
export function deliveryFeeTenderLabel(state: DeliveryState, optionName?: string | null): string {
  const parts = [DELIVERY_FEE_TENDER_LABELS[state.tender]]
  if (state.tender === 'check' && state.checkNumber.trim()) {
    parts[0] += ` #${state.checkNumber.trim()}`
  }
  if (optionName) parts[0] += ` — ${optionName}`
  if (state.tender === 'bank_transfer' && state.bankVerified) {
    parts[0] += ' (verified at register)'
  }
  if (state.tender === 'card') {
    parts.push(
      state.cardTxnMode === 'installment' && state.cardTerm
        ? `Installment, ${state.cardTerm} months`
        : 'Straight'
    )
  }
  return parts.join(' · ')
}

/** The selected customer's current address, as CRM stores it. */
export interface CustomerAddress {
  address: string
  barangayCode: string | null
}

/** The address the sale will carry, wherever it came from. */
export function resolveDeliveryAddress(
  state: DeliveryState,
  customerAddress: CustomerAddress | null
): { address: string; barangayCode: string | null } {
  if (state.addressSource === 'picked') {
    return {
      address: state.pickedAddress.trim(),
      barangayCode: state.pickedBarangayCode.trim() || null,
    }
  }
  return {
    address: customerAddress?.address.trim() ?? '',
    barangayCode: customerAddress?.barangayCode?.trim() || null,
  }
}

/** The fee in pesos — 0 for blank (free delivery), null when it isn't a valid amount. */
export function parseDeliveryFee(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  return Math.round(Number(trimmed) * 100) / 100
}

/** Rule R6 — trimmed, case-insensitive; a blank never matches. */
export function sameCrNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a?.trim().toLowerCase() ?? ''
  const right = b?.trim().toLowerCase() ?? ''
  return left !== '' && left === right
}

/**
 * What's wrong with the delivery as entered, for Confirm to show — or null.
 * `paymentCrs` are the CR numbers on the sale's own payment rows (which the
 * down payment shares): the fee's CR must be none of them.
 */
export function deliveryProblem(
  state: DeliveryState,
  customerAddress: CustomerAddress | null,
  paymentCrs: string[]
): string | null {
  if (!state.enabled) return null
  if (!state.deliverTo.trim()) return 'Enter who receives the delivery (Deliver to).'
  if (!resolveDeliveryAddress(state, customerAddress).address) {
    return 'Enter the delivery address.'
  }
  if (state.addressSource === 'picked' && !state.addressSaved) {
    return 'Save the delivery address first.'
  }
  const fee = parseDeliveryFee(state.fee)
  if (fee === null) {
    return 'The delivery fee must be zero or more, in pesos and centavos (at most 2 decimals).'
  }
  if (fee > 0) {
    if (!state.feeCr.trim()) {
      return 'Enter the collection receipt (CR) number for the delivery fee.'
    }
    if (paymentCrs.some((cr) => sameCrNumber(cr, state.feeCr))) {
      return "The delivery fee needs its own CR number — it can't be the same as the payment's."
    }
    if (state.tender === 'check' && !state.checkNumber.trim()) {
      return 'Enter the check number for the delivery fee.'
    }
    if (state.tender === 'card' && state.cardTxnMode === 'installment' && !state.cardTerm) {
      return "Select a term for the delivery fee's card installment."
    }
  }
  return null
}

/** The delivery fields createTransaction sends — nothing at all when delivery is off. */
export function deliveryPayload(
  state: DeliveryState,
  customerAddress: CustomerAddress | null
): {
  deliverTo?: string
  deliveryAddress?: string
  deliveryBarangayCode?: string
  deliveryFee?: number
  deliveryFeeMethod?: DeliveryFeeMethod
  deliveryFeeReferenceNumber?: string
  deliveryFeeCheckNumber?: string
  deliveryFeePaymentMethodOptionId?: string
  deliveryFeeBankTransferVerifiedAtRegister?: boolean
  deliveryFeeCardTxnMode?: PosCardTxnMode
  deliveryFeeCardInstallmentTerm?: number
} {
  if (!state.enabled) return {}
  const { address, barangayCode } = resolveDeliveryAddress(state, customerAddress)
  const fee = parseDeliveryFee(state.fee) ?? 0
  const base = {
    deliverTo: state.deliverTo.trim(),
    deliveryAddress: address,
    deliveryBarangayCode: barangayCode ?? undefined,
    deliveryFee: fee,
  }
  if (fee <= 0) return base
  const { tender } = state
  const isInstallment = tender === 'card' && state.cardTxnMode === 'installment'
  // Each detail goes only with its own tender — the server rejects strays.
  return {
    ...base,
    deliveryFeeMethod: DELIVERY_FEE_TENDER_METHOD[tender],
    deliveryFeeReferenceNumber: state.feeCr.trim(),
    ...(tender === 'check' ? { deliveryFeeCheckNumber: state.checkNumber.trim() } : {}),
    ...(TENDERS_WITH_OPTIONS.includes(tender) && state.optionId
      ? { deliveryFeePaymentMethodOptionId: state.optionId }
      : {}),
    ...(tender === 'bank_transfer' && state.bankVerified
      ? { deliveryFeeBankTransferVerifiedAtRegister: true }
      : {}),
    ...(tender === 'card' ? { deliveryFeeCardTxnMode: state.cardTxnMode } : {}),
    ...(isInstallment && state.cardTerm ? { deliveryFeeCardInstallmentTerm: state.cardTerm } : {}),
  }
}
