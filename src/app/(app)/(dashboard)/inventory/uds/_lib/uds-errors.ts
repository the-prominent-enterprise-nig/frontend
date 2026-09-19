/**
 * The backend throws snake_case keys as its BadRequestException messages, and
 * the UDS actions pass them through verbatim — so a clerk who trips a guard
 * reads `repair_provider_required_for_repairable_assessment` in a toast.
 *
 * Mapped here rather than changed at the source: those strings are the API's
 * stable error contract, matched on by callers and tests, and the place that
 * knows how to say them in English is the one rendering them to a person.
 * Anything unmapped falls back to the original, so a new guard degrades to an
 * ugly message rather than a silent one.
 */
const UDS_ERROR_MESSAGES: Record<string, string> = {
  repair_provider_required_for_repairable_assessment:
    'Choose who will repair the unit before marking it repairable.',
  estimated_cost_required_for_repairable_assessment:
    'A repairable unit needs an estimated repair cost.',
  assessment_only_valid_for_repair_uds: 'Only a repair UDS can be assessed.',
  uds_must_be_received_before_assessment: 'Receive the unit at main before assessing it.',
  uds_already_assessed: 'This unit has already been assessed.',
  uds_already_closed: 'This UDS is already closed.',
  uds_not_ready_to_return_to_the_customer:
    'The unit has not been dealt with yet — assess it, or bring it back from the service centre first.',
  a_unit_released_without_an_assessment_needs_a_reason_in_the_notes:
    'Say in the notes why the unit is going back without an assessment.',
  use_release_to_customer_to_close_a_customer_owned_uds:
    'This unit belongs to the customer — close it with Release to Customer, which issues the DR they sign for.',
  use_dispatch_to_provider_or_receive_from_provider_for_this_status:
    'Use Send to Service Centre or Receive Back for this step.',
  uds_is_with_a_repair_provider_receive_it_back_first:
    'The service centre still has this unit — receive it back first.',
  uds_is_still_with_a_repair_provider_receive_it_back_first:
    'The service centre still has this unit — receive it back first.',
  repair_provider_not_found: 'That repair provider no longer exists.',
  serial_number_not_found: 'That serial number no longer exists.',
  uds_not_found: 'That UDS no longer exists.',
}

export function udsErrorMessage(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback
  return UDS_ERROR_MESSAGES[raw.trim()] ?? raw
}
