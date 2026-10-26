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
  'Received in',
  'Description',
  'Gross',
  'Subsidy',
  'Subsidy Account',
  'Withholding Tax',
  'Withholding Tax Account',
  'Net Amount',
]

// Net Amount = Gross − Subsidy − Withholding Tax on every example row, so a
// file started from the template passes the Net check as it stands. Delete
// these before uploading — a customer name that matches nobody is created.
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
    'UnionBank - Iloilo',
    'TONIK SETTLEMENT',
    '25200.00',
    '1500.00',
    '4-01-095',
    '150.00',
    '',
    '23550.00',
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
    'UnionBank - Iloilo',
    'SALMON SETTLEMENT',
    '10000.00',
    '0.00',
    '',
    '0.00',
    '',
    '10000.00',
  ],
]

export function downloadReceiptImportTemplate(): void {
  downloadCsv('receipts-bulk-upload-template.csv', RECEIPT_IMPORT_HEADERS, EXAMPLE_ROWS)
}
