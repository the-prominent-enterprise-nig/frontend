import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canNavigateAny, type SessionUser } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import {
  BOOKS_HUB,
  CASH_BANKING_HUB,
  EXPENSES_HUB,
  PAYABLES_HUB,
  RECEIVABLES_HUB,
  type Hub,
} from './_shared/hubs'
import AccountingDashboard from './_components/AccountingDashboard'

// The Accounting dashboard is the company's financial picture (P&L, balance
// sheet, aging, budgets), on accounting:financial_report:read. A role without
// it (the Access Levels clerks) lands on its first Accounting page instead of
// a dashboard whose every figure the server refuses; one with it loads only
// the widgets its permissions reach.

/** Sidebar order (SideBar.tsx), Accounting's own permissions only. */
const HUBS: Hub[] = [BOOKS_HUB, RECEIVABLES_HUB, PAYABLES_HUB, EXPENSES_HUB]
const ITEMS: { href: string; permissions: string[] }[] = [
  ...HUBS.map((hub) => ({
    href: hub.entryHref,
    permissions: hub.tabs.flatMap((tab) => tab.permissions),
  })),
  { href: '/accounting/credit-memos', permissions: [ACCOUNTING_PERMISSIONS.CREDIT_MEMOS_READ] },
  {
    href: '/accounting/debit-memos',
    permissions: [
      ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_READ,
      ACCOUNTING_PERMISSIONS.SUPPLIER_DEBIT_MEMOS_READ,
      ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_READ,
    ],
  },
  {
    href: CASH_BANKING_HUB.entryHref,
    permissions: CASH_BANKING_HUB.tabs.flatMap((tab) => tab.permissions),
  },
]

function firstAccountingPage(session: SessionUser): string {
  const item = ITEMS.find((i) =>
    canNavigateAny(
      session,
      i.permissions.filter((p) => p.startsWith('accounting:'))
    )
  )
  return item?.href ?? '/403'
}

export default async function AccountingPage(): Promise<React.JSX.Element> {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)) {
    redirect(firstAccountingPage(session))
  }
  return (
    <AccountingDashboard
      access={{
        reports: true,
        arInvoices: can(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ),
        apBills: can(session, ACCOUNTING_PERMISSIONS.AP_BILLS_READ),
        bankAccounts: can(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ),
        fixedAssets: can(session, ACCOUNTING_PERMISSIONS.FIXED_ASSET_READ),
        fiscalPeriods: can(session, ACCOUNTING_PERMISSIONS.FISCAL_READ),
        budgets: can(session, ACCOUNTING_PERMISSIONS.BUDGET_READ),
      }}
    />
  )
}
