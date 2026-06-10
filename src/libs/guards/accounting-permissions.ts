export const ACCOUNTING_PERMISSIONS = {
  ACCOUNT_READ: 'accounting:account:read',
  ACCOUNT_CREATE: 'accounting:account:create',
  ACCOUNT_UPDATE: 'accounting:account:update',
  ACCOUNT_DELETE: 'accounting:account:delete',

  GENERAL_LEDGER_READ: 'accounting:generalLedger:read',
  GENERAL_LEDGER_CREATE: 'accounting:generalLedger:create',
  GENERAL_LEDGER_UPDATE: 'accounting:generalLedger:update',
  GENERAL_LEDGER_DELETE: 'accounting:generalLedger:delete',

  JOURNAL_ENTRY_READ: 'accounting:journalEntry:read',
  JOURNAL_ENTRY_CREATE: 'accounting:journalEntry:create',
  JOURNAL_ENTRY_UPDATE: 'accounting:journalEntry:update',
  JOURNAL_ENTRY_DELETE: 'accounting:journalEntry:delete',
  JOURNAL_ENTRY_POST: 'accounting:journalEntry:post',

  TRANSACTION_READ: 'accounting:transaction:read',
  TRANSACTION_CREATE: 'accounting:transaction:create',
  TRANSACTION_UPDATE: 'accounting:transaction:update',
  TRANSACTION_DELETE: 'accounting:transaction:delete',

  CURRENCY_READ: 'accounting:currency:read',
  CURRENCY_CREATE: 'accounting:currency:create',
  CURRENCY_UPDATE: 'accounting:currency:update',
  CURRENCY_DELETE: 'accounting:currency:delete',

  DISBURSEMENT_READ: 'accounting:disbursement:read',
  DISBURSEMENT_CREATE: 'accounting:disbursement:create',
  DISBURSEMENT_UPDATE: 'accounting:disbursement:update',
  DISBURSEMENT_DELETE: 'accounting:disbursement:delete',

  LIQUIDATION_READ: 'accounting:liquidation:read',
  LIQUIDATION_CREATE: 'accounting:liquidation:create',
  LIQUIDATION_UPDATE: 'accounting:liquidation:update',
  LIQUIDATION_DELETE: 'accounting:liquidation:delete',

  EXPENSE_READ: 'accounting:expense:read',
  EXPENSE_CREATE: 'accounting:expense:create',
  EXPENSE_UPDATE: 'accounting:expense:update',
  EXPENSE_DELETE: 'accounting:expense:delete',

  PAYMENT_READ: 'accounting:payment:read',
  PAYMENT_CREATE: 'accounting:payment:create',
  PAYMENT_UPDATE: 'accounting:payment:update',
  PAYMENT_DELETE: 'accounting:payment:delete',

  VENDOR_READ: 'accounting:vendor:read',
  VENDOR_CREATE: 'accounting:vendor:create',
  VENDOR_UPDATE: 'accounting:vendor:update',
  VENDOR_DELETE: 'accounting:vendor:delete',

  SUPPLIER_READ: 'accounting:supplier:read',
  SUPPLIER_CREATE: 'accounting:supplier:create',
  SUPPLIER_UPDATE: 'accounting:supplier:update',
  SUPPLIER_DELETE: 'accounting:supplier:delete',

  CUSTOMER_READ: 'accounting:customer:read',
  CUSTOMER_CREATE: 'accounting:customer:create',
  CUSTOMER_UPDATE: 'accounting:customer:update',
  CUSTOMER_DELETE: 'accounting:customer:delete',

  TAX_READ: 'accounting:tax:read',
  TAX_CREATE: 'accounting:tax:create',
  TAX_UPDATE: 'accounting:tax:update',
  TAX_DELETE: 'accounting:tax:delete',

  BIR_EXPORT_READ: 'accounting:bir_export:read',
  BIR_EXPORT_GENERATE: 'accounting:bir_export:generate',

  FINANCIAL_REPORT_READ: 'accounting:financial_report:read',

  WILDCARD: 'accounting:*',
} as const

export const FINANCIAL_REPORT_READ = 'accounting:financial_report:read'

export const ACCOUNTING_PERMISSION_DESCRIPTIONS: Record<
  (typeof ACCOUNTING_PERMISSIONS)[keyof typeof ACCOUNTING_PERMISSIONS],
  string
> = {
  'accounting:account:read': 'View chart of accounts',
  'accounting:account:create': 'Create accounts',
  'accounting:account:update': 'Edit accounts',
  'accounting:account:delete': 'Delete accounts',
  'accounting:generalLedger:read': 'View general ledgers',
  'accounting:generalLedger:create': 'Create general ledgers',
  'accounting:generalLedger:update': 'Edit general ledgers',
  'accounting:generalLedger:delete': 'Delete general ledgers',
  'accounting:journalEntry:read': 'View journal entries',
  'accounting:journalEntry:create': 'Create journal entries',
  'accounting:journalEntry:update': 'Edit journal entries',
  'accounting:journalEntry:delete': 'Delete journal entries',
  'accounting:journalEntry:post': 'Post journal entries to the ledger',
  'accounting:transaction:read': 'View transactions',
  'accounting:transaction:create': 'Create transactions',
  'accounting:transaction:update': 'Edit transactions',
  'accounting:transaction:delete': 'Delete transactions',
  'accounting:currency:read': 'View currencies',
  'accounting:currency:create': 'Create currencies',
  'accounting:currency:update': 'Edit currencies',
  'accounting:currency:delete': 'Delete currencies',
  'accounting:disbursement:read': 'View disbursements',
  'accounting:disbursement:create': 'Create disbursements',
  'accounting:disbursement:update': 'Edit disbursements and change status',
  'accounting:disbursement:delete': 'Delete disbursements',
  'accounting:liquidation:read': 'View liquidations',
  'accounting:liquidation:create': 'Create liquidations',
  'accounting:liquidation:update': 'Edit liquidations and change status',
  'accounting:liquidation:delete': 'Delete liquidations',
  'accounting:expense:read': 'View expenses',
  'accounting:expense:create': 'Create expenses',
  'accounting:expense:update': 'Edit expenses',
  'accounting:expense:delete': 'Delete expenses',
  'accounting:payment:read': 'View payments',
  'accounting:payment:create': 'Create payments',
  'accounting:payment:update': 'Edit payments',
  'accounting:payment:delete': 'Delete payments',
  'accounting:vendor:read': 'View vendors',
  'accounting:vendor:create': 'Create vendors',
  'accounting:vendor:update': 'Edit vendors',
  'accounting:vendor:delete': 'Delete vendors',
  'accounting:supplier:read': 'View suppliers',
  'accounting:supplier:create': 'Create suppliers',
  'accounting:supplier:update': 'Edit suppliers',
  'accounting:supplier:delete': 'Delete suppliers',
  'accounting:customer:read': 'View customers',
  'accounting:customer:create': 'Create customers',
  'accounting:customer:update': 'Edit customers',
  'accounting:customer:delete': 'Delete customers',
  'accounting:tax:read': 'View tax configurations and records',
  'accounting:tax:create': 'Create tax configurations and records',
  'accounting:tax:update': 'Update tax configurations and records',
  'accounting:tax:delete': 'Delete tax configurations',
  'accounting:bir_export:read': 'View BIR forms and alphalist',
  'accounting:bir_export:generate': 'Generate BIR forms',
  'accounting:financial_report:read':
    'View financial reports (Balance Sheet, Income Statement, Trial Balance, Cash Flow)',
  'accounting:*': 'Wildcard full accounting access',
}

export type AccountingPermission =
  (typeof ACCOUNTING_PERMISSIONS)[keyof typeof ACCOUNTING_PERMISSIONS]
