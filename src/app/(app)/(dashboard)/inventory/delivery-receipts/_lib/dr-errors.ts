import type { ApiResponse } from '@/src/libs/api/client'

/**
 * The backend's Delivery Receipt guards throw snake_case keys; this says them
 * in English. Unmapped keys fall through as-is (same contract as
 * uds-errors.ts), so a new guard is ugly rather than silent.
 */
const DR_ERROR_MESSAGES: Record<string, string> = {
  delivery_receipt_not_draft: 'Only a draft can be changed — this DR has already been submitted.',
  warehouse_not_found: 'You can only issue stock from your own branch.',
  department_not_found: 'That department no longer exists.',
  customer_not_found: 'That customer no longer exists.',
  supplier_not_found: 'That supplier no longer exists.',
  item_not_found: 'One of the items no longer exists.',
  item_not_issuable: 'Service items and bundles cannot go out on a Delivery Receipt.',
  serial_required: 'Pick the serial number for every serialized unit.',
  serial_not_applicable: 'Only serialized items take a serial number.',
  serial_not_available:
    'One of the serials is no longer on the shelf at this warehouse — it may have been sold or moved.',
  duplicate_serial: 'The same serial is on this DR twice.',
  reason_required: 'Say why this stock is leaving.',
  lines_required: 'Add at least one item.',
  department_required: 'Pick the department that will use it.',
  occasion_required: 'Pick the raffle occasion.',
  customer_required: 'Pick the customer from CRM.',
  supplier_required: 'Pick the supplier.',
  delivery_receipt_not_pending:
    'This DR is no longer waiting for approval — someone already decided it.',
  purpose_not_available_yet:
    'This purpose can be saved as a draft but not submitted yet — its approval step is still being built.',
}

export function drErrorMessage(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback
  const key = raw.trim()
  if (key.startsWith('serial_on_open_delivery_receipt:')) {
    return `One of the serials is already on ${key.split(':')[1]}, which is waiting for approval.`
  }
  return DR_ERROR_MESSAGES[key] ?? raw
}

/** Normalises a failed API call into the action's own failure shape. */
export function drFailure<T>(result: ApiResponse<unknown>, fallback: string): ApiResponse<T> {
  const raw = typeof result.message === 'string' && result.message ? result.message : result.error
  return { success: false, error: fallback, message: drErrorMessage(raw, fallback) }
}
