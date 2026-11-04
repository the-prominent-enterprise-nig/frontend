import { downloadCsv } from '@/src/libs/format/csv-export'

/** The upload template's columns, in order — the backend reads the file by
 * these same names, so they have to stay exactly as written. */
export const RECEIPT_IMPORT_HEADERS = [
  'Receipt Type',
  'Branch',
  'Date',
  'Reference',
  'Cleared',
  'Clear Date',
  'Customer Name',
  'Sales Invoice No.',
  'Paid by',
  'Received in',
  'Received in Account',
  'Description',
  'Gross',
  'Subsidy',
  'Subsidy Account',
  'Withholding Tax',
  'Withholding Tax Account',
  'Net Amount',
]

// Net Amount = Gross − Subsidy + Withholding Tax on every example row, so a
// file started from the template passes the Net check as it stands. Paid by is
// optional: a partner's name or Customer for that row, blank to take the
// page's "Who paid these receipts?" choice. Delete these before uploading — a
// customer name that matches nobody is created.
const EXAMPLE_ROWS: (string | number)[][] = [
  [
    'Acknowledgement',
    'Ajuy',
    '2026-10-21',
    '',
    'Same date',
    '',
    'Juan Dela Cruz',
    'SI-10482',
    'Tonik',
    'UnionBank - Iloilo',
    '',
    'TONIK SETTLEMENT',
    '25200.00',
    '1500.00',
    '4-01-095',
    '150.00',
    '2-01-243',
    '23850.00',
  ],
  [
    'Acknowledgement',
    'Ajuy',
    '2026-10-18',
    '',
    'Past date',
    '2026-10-20',
    'Maria Santos',
    'SI-10497',
    '',
    'UnionBank - Iloilo',
    '',
    'SALMON SETTLEMENT',
    '10000.00',
    '0.00',
    '',
    '0.00',
    '',
    '10000.00',
  ],
  [
    'Acknowledgement',
    'Ajuy',
    '2026-10-21',
    '',
    'Same date',
    '',
    'Pedro Reyes',
    'SI-10511',
    'Customer',
    '',
    '',
    'Payment at the branch',
    '5000.00',
    '0.00',
    '',
    '0.00',
    '',
    '5000.00',
  ],
]

export function downloadReceiptImportTemplate(): void {
  downloadCsv('receipts-bulk-upload-template.csv', RECEIPT_IMPORT_HEADERS, EXAMPLE_ROWS)
}
