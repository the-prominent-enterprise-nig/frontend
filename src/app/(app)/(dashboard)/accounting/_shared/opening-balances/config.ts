import type {
  ApOpeningRowData,
  CashAdvanceOpeningRowData,
  OpeningKind,
  OpeningRowData,
} from '@/src/schema/accounting/opening-balances'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'

export type OpeningColumn = {
  header: string
  /** CSS grid track for this column. */
  track: string
  align?: 'right'
  render: (data: OpeningRowData) => string
}

const dash = (v: string | null | undefined) => (v ? v : '—')
const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : fmtMoney(n))

const apColumns: OpeningColumn[] = [
  {
    header: 'Supplier',
    track: 'minmax(0,2fr)',
    render: (d) => {
      const r = d as ApOpeningRowData
      return r.supplierName ? `${r.supplierCode} — ${r.supplierName}` : dash(r.supplierCode)
    },
  },
  {
    header: 'Invoice No.',
    track: 'minmax(0,1.2fr)',
    render: (d) => dash((d as ApOpeningRowData).invoiceNo),
  },
  {
    header: 'Invoice date',
    track: 'minmax(0,1fr)',
    render: (d) => dash((d as ApOpeningRowData).invoiceDate),
  },
  {
    header: 'Due date',
    track: 'minmax(0,1fr)',
    render: (d) => dash((d as ApOpeningRowData).dueDate),
  },
  {
    header: 'Total',
    track: 'minmax(0,1fr)',
    align: 'right',
    render: (d) => money((d as ApOpeningRowData).total),
  },
  {
    header: 'Withholding',
    track: 'minmax(0,1fr)',
    align: 'right',
    render: (d) => money((d as ApOpeningRowData).withholding),
  },
  {
    header: 'Paid',
    track: 'minmax(0,1fr)',
    align: 'right',
    render: (d) => money((d as ApOpeningRowData).paid),
  },
  {
    header: 'Outstanding',
    track: 'minmax(0,1fr)',
    align: 'right',
    render: (d) => money((d as ApOpeningRowData).outstanding),
  },
]

const caColumns: OpeningColumn[] = [
  {
    header: 'Recipient',
    track: 'minmax(0,2fr)',
    render: (d) => dash((d as CashAdvanceOpeningRowData).recipient),
  },
  {
    header: 'Employee code',
    track: 'minmax(0,1fr)',
    render: (d) => dash((d as CashAdvanceOpeningRowData).employeeCode),
  },
  {
    header: 'Date',
    track: 'minmax(0,1fr)',
    render: (d) => dash((d as CashAdvanceOpeningRowData).date),
  },
  {
    header: 'Voucher / Ref',
    track: 'minmax(0,1.2fr)',
    render: (d) => dash((d as CashAdvanceOpeningRowData).voucherNo),
  },
  {
    header: 'Branch',
    track: 'minmax(0,1fr)',
    render: (d) => dash((d as CashAdvanceOpeningRowData).branchName),
  },
  {
    header: 'Particulars',
    track: 'minmax(0,1.6fr)',
    render: (d) => dash((d as CashAdvanceOpeningRowData).particulars),
  },
  {
    header: 'Amount',
    track: 'minmax(0,1fr)',
    align: 'right',
    render: (d) => money((d as CashAdvanceOpeningRowData).amount),
  },
]

export type OpeningConfig = {
  title: string
  intro: string
  amountLabel: string
  unit: { one: string; many: string }
  backHref: string
  backLabel: string
  doneHref: string
  doneLabel: string
  templateFile: string
  templateHeaders: string[]
  columns: OpeningColumn[]
}

export const OPENING_CONFIG: Record<OpeningKind, OpeningConfig> = {
  'ap-bills': {
    title: 'Load AP beginning balances',
    intro:
      'Load the supplier invoices that were still unpaid (or part-paid) at your cut-off date. Each one becomes a bill with its own journal entry — Debit the account chosen below, Credit Accounts Payable — for what is still owed. Every row is checked first and nothing is saved until you confirm; the load is all rows or none.',
    amountLabel: 'Outstanding',
    unit: { one: 'bill', many: 'bills' },
    backHref: '/accounting/ap-bills',
    backLabel: 'Back to AP Invoices',
    doneHref: '/accounting/ap-bills',
    doneLabel: 'View AP invoices',
    templateFile: 'ap-beginning-balances-template.csv',
    templateHeaders: [
      'Supplier Code',
      'Supplier Name',
      'Supplier Invoice No.',
      'Invoice Date',
      'Due Date',
      'Description',
      'Subtotal (excl. VAT)',
      'Input VAT',
      'Total Amount',
      'Withholding Tax',
      'Amount Paid',
      'Outstanding Balance',
      'Notes',
    ],
    columns: apColumns,
  },
  'cash-advances': {
    title: 'Load cash advance balances',
    intro:
      'Load the cash advances that were still unliquidated at your cut-off date — one row per advance, for the amount still open. Each one is recorded against its recipient, so it shows in Special Accounts and can be liquidated from there. Its journal entry is Debit Advances to Employees, Credit the account chosen below; no cash moves. Every row is checked first and nothing is saved until you confirm.',
    amountLabel: 'Advances',
    unit: { one: 'advance', many: 'advances' },
    backHref: '/accounting/special-accounts',
    backLabel: 'Back to Special Accounts',
    doneHref: '/accounting/special-accounts',
    doneLabel: 'View Special Accounts',
    templateFile: 'cash-advance-balances-template.csv',
    templateHeaders: [
      'Date',
      'Voucher / Reference No.',
      'Employee Code',
      'Recipient Name',
      'Branch',
      'Particulars',
      'Amount',
      'Notes',
    ],
    columns: caColumns,
  },
}
