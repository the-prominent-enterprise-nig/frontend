import { downloadCsv } from '@/src/libs/format/csv-export'

/** Item Master's bulk upload sheet. One row = one item line: BRAND…SUBGROUP
 * define the item (CATEGORY / SUBGROUP, the form's words — GROUP is still
 * read from older sheets), PRICE USE…CM price it on that price use's list, and
 * SERIAL + BRANCH record one unit on hand there (DATE IN / RR / COST /
 * ORIGIN / CLASSIFICATION optional — blank date = upload day, blank RR = one
 * generated per branch, blank ORIGIN / WHSE / the branch's own code = no
 * supplier, blank CLASSIFICATION = Brand New). Same rules as Add units. */
export const ITEM_UPLOAD_TEMPLATE_HEADERS = [
  'BRAND',
  'MODEL',
  'TYPE',
  'CATEGORY',
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
  'ORIGIN',
  'CLASSIFICATION',
]

export function downloadItemUploadTemplate(): void {
  downloadCsv('item-upload-template.csv', ITEM_UPLOAD_TEMPLATE_HEADERS, [])
}
