import { downloadCsv } from '@/src/libs/format/csv-export'
import type { PriceListImportRow } from '@/src/schema/inventory/price-lists/import'

/** The upload template's columns, in order. The backend hands skipped rows
 * back keyed by these same names, so a downloaded "skipped rows" file can be
 * fixed and uploaded again as is. */
export const UPLOAD_TEMPLATE_HEADERS = [
  'BRAND',
  'MODEL',
  'TYPE',
  'GROUP',
  'SUBGROUP',
  'PRICE USE',
  'PRICE',
  'DOWN PAYMENT',
  '3mos MI',
  '3mos PPD',
  '6mos MI',
  '6mos PPD',
  '9mos MI',
  '9mos PPD',
  '12mos MI',
  '12mos PPD',
  'CREDIT',
  'CM',
]

export function downloadUploadTemplate(): void {
  downloadCsv('price-list-upload-template.csv', UPLOAD_TEMPLATE_HEADERS, [])
}

export function downloadSkippedRows(rows: PriceListImportRow[]): void {
  downloadCsv(
    `price-list-skipped-rows-${Date.now()}.csv`,
    [...UPLOAD_TEMPLATE_HEADERS, 'ISSUE'],
    rows.map((r) => [
      ...UPLOAD_TEMPLATE_HEADERS.map((h) => r.record?.[h] ?? ''),
      `Row ${r.row}: ${r.message ?? ''}`,
    ])
  )
}

export const SKIPPED_STATUS_LABELS: Record<string, string> = {
  other_price_use: 'Different price use',
  no_list: 'No list for price use',
  not_in_catalog: 'Not in catalog',
  ambiguous: 'Ambiguous model',
  duplicate: 'Duplicate in file',
  error: 'Invalid row',
}
