/**
 * Scenario 66 — a sale marked for delivery: who receives it, where, and the
 * delivery fee. The fee is collected at the counter on its own collection
 * receipt and is never part of the sale — not in the Total, the tender, the
 * change or the loyalty points (docs/scenario-66-pos-delivery-fee-plan.md).
 *
 * These rules mirror the backend's prepareDeliveryFields (rules R1–R6), so
 * the cashier hears about a problem at Confirm rather than from the server.
 */

/** The tenders a delivery fee can be paid with — the same four a down payment takes. */
export const DELIVERY_FEE_METHODS = ['cash', 'card', 'bank_transfer', 'qr'] as const
export type DeliveryFeeMethod = (typeof DELIVERY_FEE_METHODS)[number]

export const DELIVERY_FEE_METHOD_LABELS: Record<DeliveryFeeMethod, string> = {
  cash: 'Cash',
  card: 'Credit/Debit Card',
  bank_transfer: 'Bank Transfer',
  qr: 'QR',
}

/** Column widths on PosTransaction (and the CR booklet number's). */
export const DELIVER_TO_MAX = 255
export const DELIVERY_ADDRESS_MAX = 1000
export const DELIVERY_FEE_CR_MAX = 100

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
  /** The address picker reads its initial values once, so it is re-mounted
   * (this bumped) only when it should start over — never just because the
   * cashier picked something in it. */
  pickerKey: number
  /** As typed. Empty means free delivery. */
  fee: string
  method: DeliveryFeeMethod
  feeCr: string
}

export const EMPTY_DELIVERY: DeliveryState = {
  enabled: false,
  deliverTo: '',
  deliverToEdited: false,
  addressSource: 'customer',
  pickedAddress: '',
  pickedBarangayCode: '',
  pickerKey: 0,
  fee: '',
  method: 'cash',
  feeCr: '',
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
} {
  if (!state.enabled) return {}
  const { address, barangayCode } = resolveDeliveryAddress(state, customerAddress)
  const fee = parseDeliveryFee(state.fee) ?? 0
  return {
    deliverTo: state.deliverTo.trim(),
    deliveryAddress: address,
    deliveryBarangayCode: barangayCode ?? undefined,
    deliveryFee: fee,
    ...(fee > 0
      ? { deliveryFeeMethod: state.method, deliveryFeeReferenceNumber: state.feeCr.trim() }
      : {}),
  }
}
