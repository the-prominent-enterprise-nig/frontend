/** Helpers for turning a row's raw CSV text into what the edit panel's inputs
 * need — and back. The server parses the text itself, so these only have to
 * agree with it on spelling, never decide validity. */

export const RECEIPT_TYPE_LABELS = ['Acknowledgement', 'Collection']
export const CLEARED_LABELS = ['Same date', 'Later date', 'Past date']

/** The option label a cell's text names, ignoring case and surrounding
 * spaces — or '' when it names none. */
export function matchLabel(value: string | undefined, labels: string[]): string {
  const v = (value ?? '').trim().toLowerCase()
  return labels.find((l) => l.toLowerCase() === v) ?? ''
}

/** Cleared: a blank cell means Same date; anything unrecognised is returned
 * as '' so no segment shows as picked (the server will flag it). */
export function clearedLabel(value: string | undefined): string {
  if (!(value ?? '').trim()) return 'Same date'
  return matchLabel(value, CLEARED_LABELS)
}

/** A cell date as the YYYY-MM-DD a date input takes. The server also reads
 * MM/DD/YYYY, so that is converted; anything else is '' (the input shows
 * empty, and the row's own message says what is wrong with the text). */
export function dateToInput(value: string | undefined): string {
  const v = (value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return ''
}
