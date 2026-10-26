const OPENING_ERROR_MESSAGES: Record<string, string> = {
  file_required: 'Choose a CSV file first.',
  invalid_csv_format: 'This file could not be read as a CSV. Save it as CSV and try again.',
  csv_has_no_rows: 'This file has a header row but no data rows.',
  import_has_errors:
    'Some rows still have errors. Fix the file and upload it again — nothing was saved.',
  as_of_date_required: 'Enter the cut-off date the balances are as of.',
  as_of_date_in_future: 'The cut-off date cannot be in the future.',
  offset_account_not_found: 'The account to post against was not found. Pick another one.',
}

/**
 * The backend raises short snake_case codes for expected failure states — this
 * maps the ones the opening-balance imports can produce into a sentence before
 * it reaches a toast. Codes can carry a detail after a colon. Messages the
 * backend already writes as full sentences pass through unchanged.
 */
export function humanizeOpeningImportError(message?: string): string | undefined {
  if (!message) return message
  if (OPENING_ERROR_MESSAGES[message]) return OPENING_ERROR_MESSAGES[message]
  const [code, ...rest] = message.split(': ')
  const detail = rest.join(': ')
  if (code === 'csv_headers_not_recognized') {
    return `The column headers weren't recognized (${detail}). Use the template's headers.`
  }
  if (code === 'too_many_rows') return `This file has too many rows — ${detail}.`
  if (code === 'row_failed') {
    return `A row could not be saved${detail ? ` — ${detail}` : ''}. Nothing was imported.`
  }
  if (code === 'as_of_date_period_closed') {
    return `The cut-off date falls in a closed period${detail ? ` — ${detail}` : ''}. Pick a date in an open period.`
  }
  if (code === 'offset_account_not_equity') return `${detail}. Pick an equity account.`
  if (code === 'offset_account_not_found')
    return detail || OPENING_ERROR_MESSAGES.offset_account_not_found
  if (code === 'as_of_date_required') return OPENING_ERROR_MESSAGES.as_of_date_required
  return message
}
