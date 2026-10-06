// GCash and Billers are their own Payment Method buttons but tender through
// the 'qr' method; its one option list is split into the three groups by name.
// Shared by the sale's Cash payment mode and the delivery fee's Paid with.
export const GCASH_OPTION_NAMES = ['GCash Send Money', 'Soundpay']
export const BILLER_OPTION_NAMES = ['Ecpay', 'Palawan Pay']

export type QrOptionGroup = 'gcash' | 'billers' | 'qr'

/** Which of the three QR buttons an option belongs to, by its name. */
export function qrOptionGroup(optionName: string): QrOptionGroup {
  if (GCASH_OPTION_NAMES.includes(optionName)) return 'gcash'
  if (BILLER_OPTION_NAMES.includes(optionName)) return 'billers'
  return 'qr'
}
