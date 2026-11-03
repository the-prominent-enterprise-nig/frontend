/** The AR Aging upload — what the backend's /accounting/opening-balances/ar-aging
 * endpoints return. */

export type AgingRowStatus = 'ok' | 'warning' | 'error' | 'skipped'
export type AgingRowAction = 'create' | 'update' | 'skip'

export interface AgingPreviewRow {
  /** The spreadsheet row the message points at. */
  rowNumber: number
  status: AgingRowStatus
  action: AgingRowAction
  messages: string[]
  data: {
    siNo: string
    customerName: string
    branchCode: string | null
    category: string | null
    term: number | null
    monthlyInstallment: number | null
    balance: number | null
  }
}

export interface AgingUnmatched {
  value: string
  count: number
}

export interface AgingPreview {
  summary: {
    /** Sale rows read — title and subtotal rows are not counted. */
    read: number
    ignored: number
    create: number
    update: number
    skipped: number
    errors: number
    warnings: number
  }
  totals: { accounts: number; outstanding: number }
  matching: {
    customersMatched: number
    customersNew: number
    branchUnmatched: AgingUnmatched[]
    collectorUnmatched: AgingUnmatched[]
    branchUnmatchedRows: number
    collectorUnmatchedRows: number
  }
  blockingErrors: boolean
  /** Rows with an error, a skip or a warning — capped, errors first. */
  rows: AgingPreviewRow[]
  flaggedTotal: number
  /** The first rows that will load, to eyeball the column mapping. */
  sample: AgingPreviewRow[]
}

export interface AgingLoadStatus {
  jobId: string
  state: 'running' | 'done' | 'failed'
  total: number
  processed: number
  created: number
  updated: number
  customersCreated: number
  skipped: number
  outstanding: number
  startedAt: string
  finishedAt?: string
  error?: string
}

/** The sheet's 60 columns, in order — what the template download prints. The
 * loader reads by position, so these must not be reordered. */
export const AGING_TEMPLATE_HEADERS: string[] = [
  'CAT',
  'Year/Month',
  'Collector',
  'Area',
  'Coll_Code_IAS',
  'Coll_Code',
  'Coll_Code_collector',
  'Operation',
  'Area Supervisor',
  'br',
  'SI No.',
  'SI Date',
  'Customer Name',
  'Address',
  'UNIT',
  'Type',
  'Term',
  'MI',
  'FMI Date',
  'DP',
  'DP Bal',
  'PNV',
  'OB',
  'NYD',
  'totdue',
  'UNCOLL',
  'MI DUE',
  'BILLING',
  'pnlty',
  'penp',
  'current',
  'day30',
  'day60',
  'day90',
  'NO ARS',
  'MOS RUN',
  "TOTAL PAY'T",
  'TOTAL PRICE',
  'Tot Price %',
  'LCP',
  'LCP %',
  'MI PAY',
  'TNA',
  'TNAC',
  'item',
  'status',
  'NOT MVG',
  'Last OR Date',
  'Last ORlastnum',
  'Last ORAmt',
  'OVER 30',
  'Serial Number',
  'Rebate',
  'Agent',
  'Co Maker',
  'Months Run',
  '',
  'Acct Classification Official',
  'Acct Class Arrears',
  'Acct Class Not Moving',
]
