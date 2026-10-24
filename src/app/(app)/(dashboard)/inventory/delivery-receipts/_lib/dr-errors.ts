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
    'One of the serials is no longer available here — it may have been sold, moved or sent out.',
  duplicate_serial: 'The same serial is on this DR twice.',
  reason_required: 'Say why this stock is leaving.',
  lines_required: 'Add at least one item.',
  department_required: 'Pick the department that will use it.',
  occasion_required: 'Pick the raffle occasion.',
  customer_required: 'Pick the customer from CRM.',
  supplier_required: 'Pick the supplier.',
  delivery_receipt_not_pending:
    'This DR is no longer waiting for approval — someone already decided it.',
  delivery_receipt_cannot_void:
    'Only an approved or posted DR can be voided — delete a draft, or reject a pending one.',
  insufficient_stock: 'Not enough stock is left at the issuing branch for one of the items.',
  purpose_not_available_yet:
    'This purpose can be saved as a draft but not submitted yet — its approval step is still being built.',
  uds_required: 'Pick the repair ticket (UDS) this DR moves.',
  uds_not_found: 'That repair ticket is not at your branch, or no longer exists.',
  uds_has_no_warehouse: 'That repair ticket has no warehouse on file.',
  uds_is_not_a_customer_unit: "That repair ticket is for our own unit, not a customer's.",
  uds_not_repaired_yet: 'That unit has not come back repaired yet.',
  uds_not_assessed_unrepairable: 'That unit was not assessed as unrepairable.',
  only_a_repairable_uds_can_be_dispatched_to_a_provider:
    'Only a unit assessed as repairable can go to the service center.',
  uds_already_dispatched: 'That unit is already with the service center.',
  uds_must_be_received_before_dispatch:
    'That repair ticket is not at a step where the unit can be sent out.',
  uds_is_still_with_a_repair_provider_receive_it_back_first:
    'The unit is still with the service center — receive it back first.',
  uds_already_closed: 'That repair ticket is already closed.',
  uds_not_ready_to_return_to_the_customer: 'That unit is not ready to go back to the customer.',
  uds_is_not_a_repair_ticket: 'That ticket is not a repair ticket.',
  repair_lines_need_serials:
    'Every unit going to the service center needs its serial — the repair ticket tracks units by serial.',
  repair_delivery_receipt_cannot_void:
    'A repair DR cannot be voided — its repair ticket has already moved.',
}

export function drErrorMessage(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback
  const key = raw.trim()
  if (key.startsWith('uds_already_on_delivery_receipt:')) {
    return `That repair ticket is already on ${key.split(':')[1]}.`
  }
  if (key.startsWith('uds_unit_is_on_transfer:')) {
    return `That unit is already on its way to main on ${key.split(':')[1]}.`
  }
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
