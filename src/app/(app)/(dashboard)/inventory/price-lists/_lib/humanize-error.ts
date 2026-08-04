const PRICE_LIST_ERROR_MESSAGES: Record<string, string> = {
  price_list_not_found: 'This price list could not be found.',
  price_list_not_editable:
    'This price list can no longer be edited — only pending or rejected lists can be changed. Create a new version instead.',
  price_list_not_pending_approval: 'This price list is not awaiting approval.',
  price_list_not_rejected: 'This price list has not been rejected.',
  price_list_item_not_found: 'That item is not in this price list.',
  invalid_supersedes_id: "The price list you're replacing could not be found.",
  invalid_price_use_type_id: 'Select a valid price use type.',
  price_use_type_not_found: 'This price use type could not be found.',
  price_use_type_name_already_exists: 'A price use type with that name already exists.',
  price_use_type_in_use:
    'This price use type is still used by one or more price lists — reassign or remove those first.',
}

/**
 * The backend raises short snake_case codes for expected failure states
 * (matching this codebase's existing convention elsewhere) — this maps the
 * ones this feature can produce into a sentence before it ever reaches a
 * toast. Messages the backend already writes as full sentences (floor price
 * and date-overlap violations) pass through unchanged.
 */
export function humanizePriceListError(message?: string): string | undefined {
  if (!message) return message
  if (PRICE_LIST_ERROR_MESSAGES[message]) return PRICE_LIST_ERROR_MESSAGES[message]
  if (message.startsWith('invalid_branch_ids')) return 'One or more selected branches are invalid.'
  return message
}
