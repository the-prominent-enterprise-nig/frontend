import type { ApiResponse } from '@/src/libs/api/client'
import { drErrorMessage } from '../../../../inventory/delivery-receipts/_lib/dr-errors'

/** The memo's guard keys in English; DR keys (a unit gone, a short balance)
 * fall through to the DR's own messages. */
const IDM_ERROR_MESSAGES: Record<string, string> = {
  debit_memo_not_draft:
    'Only a draft memo can be changed — this one has already posted or been voided.',
  debit_memo_needs_two_lines: 'A memo needs at least one debit line and one credit line.',
  debit_memo_zero_amount: 'The memo has no amount yet.',
  debit_memo_not_balanced: 'Total debit and total credit must be equal before the memo can post.',
  debit_memo_already_void: 'This memo is already void.',
  delivery_receipt_not_approved:
    'Its delivery receipt is no longer approved, so this memo cannot post.',
  line_needs_debit_or_credit: 'Each line takes a debit or a credit, not both.',
  account_not_found: 'One of the accounts no longer exists.',
  insufficient_stock:
    'Not enough stock is left at the issuing branch for one of the items. Nothing was posted.',
}

export function idmFailure<T>(result: ApiResponse<unknown>, fallback: string): ApiResponse<T> {
  const raw = (typeof result.message === 'string' && result.message) || result.error || ''
  const key = raw.trim()
  const message = IDM_ERROR_MESSAGES[key] ?? drErrorMessage(key, fallback)
  return { success: false, error: fallback, message }
}
