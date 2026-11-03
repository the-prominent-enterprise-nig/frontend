const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  file_required: 'Choose a CSV file first.',
  invalid_csv_format: 'This file could not be read as a CSV. Save it as CSV and try again.',
  csv_has_no_rows: 'This file has a header row but no data rows.',
  import_has_errors: 'Some rows still have errors. Fix them and try again — nothing was saved.',
}

/**
 * The backend raises short snake_case codes for expected failure states (the
 * convention used across this codebase) — this maps the ones the receipts
 * import can produce into a sentence before it reaches a toast. Codes can
 * carry a detail after a colon ("row_failed: Row 4 — …"). Messages the
 * backend already writes as full sentences pass through unchanged.
 */
export function humanizeAcknowledgementImportError(message?: string): string | undefined {
  if (!message) return message
  if (IMPORT_ERROR_MESSAGES[message]) return IMPORT_ERROR_MESSAGES[message]
  const [code, ...rest] = message.split(': ')
  const detail = rest.join(': ')
  if (IMPORT_ERROR_MESSAGES[code]) return IMPORT_ERROR_MESSAGES[code]
  if (code === 'csv_headers_not_recognized') {
    return `The column headers weren't recognized (${detail}). Use the template's headers.`
  }
  if (code === 'too_many_rows') return `This file has too many rows — ${detail}.`
  if (code === 'row_failed') {
    return `A row could not be saved${detail ? ` — ${detail}` : ''}. Nothing was imported.`
  }
  return message
}
