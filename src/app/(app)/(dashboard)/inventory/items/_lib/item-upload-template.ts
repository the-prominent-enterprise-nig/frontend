import { downloadCsv } from '@/src/libs/format/csv-export'

/** Item Master's bulk upload sheet. One row = one item line: BRAND…SUBGROUP
 * define the item, PRICE USE…CM price it on that price use's list, and
 * SERIAL + BRANCH record one unit on hand there (DATE IN / RR / COST
 * optional — blank date = upload day, blank RR = one generated per branch). */
export const ITEM_UPLOAD_TEMPLATE_HEADERS = [
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
  'SERIAL',
  'BRANCH',
  'DATE IN',
  'RR',
  'COST',
]

export function downloadItemUploadTemplate(): void {
  downloadCsv('item-upload-template.csv', ITEM_UPLOAD_TEMPLATE_HEADERS, [])
}
