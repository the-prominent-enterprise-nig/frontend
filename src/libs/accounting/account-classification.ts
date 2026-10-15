/**
 * How the Chart of Accounts form's classification fields fit together — a copy
 * of backend src/accounting/accounts/account-classification.ts (the server
 * validates the same rules, so a drift shows up as a refused save rather than
 * bad data). Keep the two in step.
 *
 *   Account Type             -> the client's eight (AccountClass)
 *   Group / Category         -> a group (Current Asset …) over the category
 *   Cash Flow Classification -> OPERATING / INVESTING / FINANCING
 */

export type AccountClass =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COST_OF_SALES'
  | 'OPERATING_EXPENSES'
  | 'OTHER_OPERATING_INCOME'
  | 'NON_OPERATING_EXPENSES'

export const ACCOUNT_CLASSES: { value: AccountClass; label: string }[] = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'COST_OF_SALES', label: 'Cost of Sales' },
  { value: 'OPERATING_EXPENSES', label: 'Operating Expenses' },
  { value: 'OTHER_OPERATING_INCOME', label: 'Other Operating Income' },
  { value: 'NON_OPERATING_EXPENSES', label: 'Non-Operating Expenses' },
]

export const accountClassLabel = (c: string | null | undefined): string =>
  ACCOUNT_CLASSES.find((a) => a.value === c)?.label ?? '—'

export type AccountGroup =
  | 'CURRENT_ASSET'
  | 'NON_CURRENT_ASSET'
  | 'CURRENT_LIABILITY'
  | 'NON_CURRENT_LIABILITY'

/** Only assets and liabilities are grouped; the other types have no groups. */
export const GROUPS_BY_CLASS: Partial<
  Record<AccountClass, { value: AccountGroup; label: string }[]>
> = {
  ASSET: [
    { value: 'CURRENT_ASSET', label: 'Current Asset' },
    { value: 'NON_CURRENT_ASSET', label: 'Non-current Asset' },
  ],
  LIABILITY: [
    { value: 'CURRENT_LIABILITY', label: 'Current Liability' },
    { value: 'NON_CURRENT_LIABILITY', label: 'Non-Current Liability' },
  ],
}

export const CATEGORIES_BY_GROUP: Record<AccountGroup, string[]> = {
  CURRENT_ASSET: [
    'CASH',
    'ACCOUNTS_RECEIVABLE',
    'INVENTORY',
    'PREPAID_EXPENSES',
    'OTHER_CURRENT_ASSETS',
  ],
  NON_CURRENT_ASSET: [
    'PROPERTY_PLANT_EQUIPMENT',
    'ACCUMULATED_DEPRECIATION',
    'INTANGIBLE_ASSETS',
    'INVESTMENTS',
    'OTHER_NON_CURRENT_ASSETS',
  ],
  CURRENT_LIABILITY: [
    'ACCOUNTS_PAYABLE',
    'SHORT_TERM_DEBT',
    'ACCRUED_EXPENSES',
    'CURRENT_PORTION_LT_DEBT',
    'OTHER_CURRENT_LIABILITIES',
  ],
  NON_CURRENT_LIABILITY: [
    'LONG_TERM_DEBT',
    'DEFERRED_TAX_LIABILITY',
    'OTHER_NON_CURRENT_LIABILITIES',
  ],
}

/** The category an asset or liability gets from its group alone — the form asks
 * only for the group, as the client's mockup does. Each is the group's own
 * "other" category, so groupOfCategory() reads the group straight back, and the
 * Non-current Asset one is a capital-purchase account (CAPEX_ACCOUNT_CATEGORIES
 * in libs/tax/input-vat.ts). An existing account keeps the finer category it
 * already has while its group is unchanged. */
export const DEFAULT_CATEGORY_OF_GROUP: Record<AccountGroup, string> = {
  CURRENT_ASSET: 'OTHER_CURRENT_ASSETS',
  NON_CURRENT_ASSET: 'OTHER_NON_CURRENT_ASSETS',
  CURRENT_LIABILITY: 'OTHER_CURRENT_LIABILITIES',
  NON_CURRENT_LIABILITY: 'OTHER_NON_CURRENT_LIABILITIES',
}

/** The category a type with no groups gets when the form does not ask — the
 * client's Group / Category field only has the four balance-sheet groups, so an
 * equity, income or expense account is not asked for one. Each is the type's
 * ordinary category (Operating Expense for both expense types, which the Cash
 * Flow report reads as operating), and an existing account keeps its own. */
export const DEFAULT_CATEGORY_OF_CLASS: Partial<Record<AccountClass, string>> = {
  EQUITY: 'OTHER_EQUITY',
  REVENUE: 'REVENUE',
  COST_OF_SALES: 'COGS',
  OPERATING_EXPENSES: 'OPERATING_EXPENSE',
  OTHER_OPERATING_INCOME: 'REVENUE',
  NON_OPERATING_EXPENSES: 'OPERATING_EXPENSE',
}

export const CATEGORY_LABELS: Record<string, string> = {
  CASH: 'Cash',
  ACCOUNTS_RECEIVABLE: 'Accounts Receivable',
  INVENTORY: 'Inventory',
  PREPAID_EXPENSES: 'Prepaid Expenses',
  OTHER_CURRENT_ASSETS: 'Other Current Assets',
  PROPERTY_PLANT_EQUIPMENT: 'Property, Plant & Equipment',
  ACCUMULATED_DEPRECIATION: 'Accumulated Depreciation',
  INTANGIBLE_ASSETS: 'Intangible Assets',
  INVESTMENTS: 'Investments',
  OTHER_NON_CURRENT_ASSETS: 'Other Non-current Assets',
  ACCOUNTS_PAYABLE: 'Accounts Payable',
  SHORT_TERM_DEBT: 'Short-term Debt',
  ACCRUED_EXPENSES: 'Accrued Expenses',
  CURRENT_PORTION_LT_DEBT: 'Current Portion of Long-term Debt',
  OTHER_CURRENT_LIABILITIES: 'Other Current Liabilities',
  LONG_TERM_DEBT: 'Long-term Debt',
  DEFERRED_TAX_LIABILITY: 'Deferred Tax Liability',
  OTHER_NON_CURRENT_LIABILITIES: 'Other Non-current Liabilities',
  SHARE_CAPITAL: 'Share Capital',
  RETAINED_EARNINGS: 'Retained Earnings',
  OTHER_EQUITY: 'Other Equity',
  REVENUE: 'Revenue',
  COGS: 'Cost of Goods Sold',
  OPERATING_EXPENSE: 'Operating Expense',
  ADMINISTRATIVE_EXPENSE: 'Administrative Expense',
  FINANCIAL_EXPENSE: 'Financial Expense',
  // The general categories of the chart's header rows (1-00-000 "ASSETS" …).
  ASSET: 'General (header)',
  LIABILITY: 'General (header)',
  EQUITY: 'General (header)',
}

export const categoryLabel = (c: string | null | undefined): string =>
  (c && CATEGORY_LABELS[c]) || '—'

export function groupOfCategory(category: string | null | undefined): AccountGroup | null {
  for (const [group, categories] of Object.entries(CATEGORIES_BY_GROUP)) {
    if (category && categories.includes(category)) return group as AccountGroup
  }
  return null
}

export type CashFlowClass = 'OPERATING' | 'INVESTING' | 'FINANCING'

export const CASH_FLOW_CLASSES: { value: CashFlowClass; label: string }[] = [
  { value: 'OPERATING', label: 'Operating Activities' },
  { value: 'INVESTING', label: 'Investing Activities' },
  { value: 'FINANCING', label: 'Financing Activities' },
]

export const cashFlowClassLabel = (c: string | null | undefined): string =>
  CASH_FLOW_CLASSES.find((a) => a.value === c)?.label ?? '—'

const OPERATING = [
  'REVENUE',
  'COGS',
  'OPERATING_EXPENSE',
  'ADMINISTRATIVE_EXPENSE',
  'ACCOUNTS_RECEIVABLE',
  'ACCOUNTS_PAYABLE',
  'INVENTORY',
]
const INVESTING = ['PROPERTY_PLANT_EQUIPMENT', 'INTANGIBLE_ASSETS', 'INVESTMENTS']
const FINANCING = [
  'SHORT_TERM_DEBT',
  'CURRENT_PORTION_LT_DEBT',
  'LONG_TERM_DEBT',
  'SHARE_CAPITAL',
  'RETAINED_EARNINGS',
]

/** The section an account with no Cash Flow Classification of its own reports
 * under — what the Cash Flow report falls back to. */
export function cashFlowClassOfCategory(category: string | null | undefined): CashFlowClass | null {
  if (!category) return null
  if (OPERATING.includes(category)) return 'OPERATING'
  if (INVESTING.includes(category)) return 'INVESTING'
  if (FINANCING.includes(category)) return 'FINANCING'
  return null
}
