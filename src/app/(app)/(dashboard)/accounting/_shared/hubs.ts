import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { canAny, type SessionUser } from '@/src/libs/guards/permission'

/**
 * Accounting's sidebar hubs — several screens that were separate sidebar items
 * but one workflow (Scenario 62's consolidation, applied to Accounting).
 *
 * The tabs are the existing routes, not a new page that embeds them. Every
 * detail and form route under them (`bank-reconciliation/[id]`,
 * `ap-bills/new`, …) and every link, redirect and source-document link that
 * already points at them keeps working; each list page just renders the tab
 * strip above itself. Same visible-tabs-only rule as the Inventory hubs.
 *
 * Each hub's `entryHref` is a route with no page of its own — it only
 * redirects to the first tab the caller can open (see hub-entry.ts).
 */
export type HubTab = {
  id: string
  label: string
  href: string
  /**
   * Holding any one of these shows the tab. Empty means no permission is
   * required — only Special Accounts, whose page and sidebar item were never
   * gated; left as it was rather than tightened here.
   */
  permissions: string[]
}

export type Hub = {
  entryHref: string
  tabs: ReadonlyArray<HubTab>
}

export type HubTabId =
  | 'journal-entries'
  | 'general-ledger'
  | 'chart-of-accounts'
  | 'account-mapping'
  | 'ar-invoices'
  | 'customers'
  | 'expenses'
  | 'recurring-expenses'
  | 'special-accounts'
  | 'employee-cash-loans'
  | 'drivers'
  | 'vehicles'
  | 'bank-accounts'
  | 'undeposited-funds'
  | 'inter-account-transfer'
  | 'bank-reconciliation'
  | 'ap-invoices'
  | 'ap-payments'
  | 'receiving-reports'
  | 'suppliers'

export const BOOKS_HUB: Hub = {
  entryHref: '/accounting/books',
  tabs: [
    {
      id: 'journal-entries',
      label: 'Journal Entries',
      href: '/accounting/journal-entries',
      permissions: [ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_READ],
    },
    {
      // The page and the API gate on generalLedger:read; the sidebar used to
      // check financial_report:read, which could show a link that 403'd.
      id: 'general-ledger',
      label: 'General Ledger',
      href: '/accounting/general-ledger',
      permissions: [ACCOUNTING_PERMISSIONS.GENERAL_LEDGER_READ],
    },
    {
      id: 'chart-of-accounts',
      label: 'Chart of Accounts',
      href: '/accounting/chart-of-accounts',
      permissions: [ACCOUNTING_PERMISSIONS.ACCOUNT_READ],
    },
    {
      id: 'account-mapping',
      label: 'Account Mapping',
      href: '/accounting/account-mapping',
      permissions: [ACCOUNTING_PERMISSIONS.ACCOUNT_READ, POS_PERMISSIONS.CONFIG_READ],
    },
  ],
}

export const RECEIVABLES_HUB: Hub = {
  entryHref: '/accounting/receivables',
  tabs: [
    {
      id: 'ar-invoices',
      label: 'AR Invoices',
      href: '/accounting/ar-invoices',
      permissions: [ACCOUNTING_PERMISSIONS.AR_INVOICES_READ],
    },
    {
      id: 'customers',
      label: 'Customers',
      href: '/accounting/customers',
      permissions: [ACCOUNTING_PERMISSIONS.CUSTOMER_READ],
    },
  ],
}

export const EXPENSES_HUB: Hub = {
  entryHref: '/accounting/expenses-hub',
  tabs: [
    {
      id: 'expenses',
      label: 'Expenses',
      href: '/accounting/expenses',
      permissions: [ACCOUNTING_PERMISSIONS.EXPENSE_READ],
    },
    {
      // The client's list of recurring expenses. Sits under /accounting/expenses —
      // the strip lights the most specific tab, so Expenses does not stay lit.
      id: 'recurring-expenses',
      label: 'Recurring',
      href: '/accounting/expenses/recurring',
      permissions: [ACCOUNTING_PERMISSIONS.EXPENSE_READ],
    },
    {
      id: 'special-accounts',
      label: 'Special Accounts',
      href: '/accounting/special-accounts',
      permissions: [],
    },
    {
      // Scenario 52 — issues against the same Employee Cash Loan Special
      // Account ledger the tab beside it lists.
      id: 'employee-cash-loans',
      label: 'Employee Cash Loans',
      href: '/accounting/employee-cash-loans',
      permissions: [ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_READ],
    },
    {
      // The people on the fleet roster — name, contact number, branch. Not tied
      // to a vehicle. Moved over from Inventory's Master Data; the permissions
      // did not move with it — the API still gates drivers on inventory:*, and
      // the list reads on inventory:transfers:read.
      id: 'drivers',
      label: 'Drivers',
      href: '/accounting/drivers',
      permissions: [INVENTORY_PERMISSIONS.TRANSFERS_READ],
    },
    {
      // The roster by plate, and each vehicle's recorded Fuel / Repair expenses
      // (read-only). Either permission shows it: an accountant reads vehicles
      // here through expense:read without holding transfers:read.
      id: 'vehicles',
      label: 'Vehicles',
      href: '/accounting/vehicles',
      permissions: [INVENTORY_PERMISSIONS.TRANSFERS_READ, ACCOUNTING_PERMISSIONS.EXPENSE_READ],
    },
  ],
}

export const CASH_BANKING_HUB: Hub = {
  entryHref: '/accounting/cash-banking',
  tabs: [
    {
      id: 'bank-accounts',
      label: 'Bank and Cash Accounts',
      href: '/accounting/bank-accounts',
      permissions: [ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ],
    },
    {
      // Route and permissions keep the old cash-in-transit name (Scenario 61).
      id: 'undeposited-funds',
      label: 'Collected Funds History',
      href: '/accounting/cash-in-transit',
      permissions: [ACCOUNTING_PERMISSIONS.CASH_IN_TRANSIT_READ],
    },
    {
      id: 'inter-account-transfer',
      label: 'Inter-Account Transfer',
      href: '/accounting/fund-transfers',
      permissions: [
        ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ,
        ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_TRANSFER,
      ],
    },
    {
      id: 'bank-reconciliation',
      label: 'Bank Reconciliation',
      href: '/accounting/bank-reconciliation',
      permissions: [ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ],
    },
  ],
}

export const PAYABLES_HUB: Hub = {
  entryHref: '/accounting/payables',
  tabs: [
    {
      id: 'ap-invoices',
      label: 'AP Invoices',
      href: '/accounting/ap-bills',
      permissions: [ACCOUNTING_PERMISSIONS.AP_BILLS_READ],
    },
    {
      // Sits under /accounting/ap-bills — the tab strip lights the most
      // specific tab, so AP Invoices does not stay lit on this one.
      id: 'ap-payments',
      label: 'Payments',
      href: '/accounting/ap-bills/payments',
      permissions: [ACCOUNTING_PERMISSIONS.AP_BILLS_READ],
    },
    {
      id: 'receiving-reports',
      label: 'Receiving Reports',
      href: '/accounting/receiving-reports',
      permissions: [ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ],
    },
    {
      // Moved over from Inventory's Master Data, the way Customers sits beside
      // AR Invoices. Supplier permissions stayed inventory:suppliers:*.
      id: 'suppliers',
      label: 'Suppliers',
      href: '/accounting/suppliers',
      permissions: [PROCUREMENT_PERMISSIONS.SUPPLIERS_READ],
    },
  ],
}

export const HUBS = {
  books: BOOKS_HUB,
  receivables: RECEIVABLES_HUB,
  payables: PAYABLES_HUB,
  expenses: EXPENSES_HUB,
  'cash-banking': CASH_BANKING_HUB,
} as const

export type HubKey = keyof typeof HUBS

export function visibleHubTabs(hub: Hub, session: SessionUser) {
  return hub.tabs.filter((tab) => tab.permissions.length === 0 || canAny(session, tab.permissions))
}
