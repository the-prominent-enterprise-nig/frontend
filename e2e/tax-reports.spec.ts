/**
 * Scenario 69 Parts H and I — the Tax Reports screen.
 *
 * VAT Summary, Output VAT Detail, Input VAT Detail, EWT Payable, Creditable
 * WHT and the GL Reconciliation, and the Part I Tax Code Exception Report:
 * seven tabs over one period and one set of filters, each exporting to Excel.
 *
 * Read-only: it asserts how the screen is built and how it behaves (the tabs,
 * the period, the filters, the export), not which sales a database holds, so it
 * runs against any data. What the reports SAY about real documents is exercised
 * against the API by backend/test/scenario-69-tax-reports.e2e-spec.ts and
 * scenario-69-tax-controls.e2e-spec.ts, and end to end in a real browser by the
 * Part H and Part I walkthroughs. The Exceptions tab and the month-end checklist
 * are driven with the report's answer supplied by the test, so what they show is
 * known and nothing is written to the database. The one thing the rest leaves
 * behind is the audit row every real Excel export writes.
 *
 * Needs the Part H and Part I migrations applied to the DB the stack runs against.
 */
import { test, expect, type Download, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { clickStable, gotoReady } from './utils'
import { manilaToday, presetPeriod } from '../src/libs/tax/tax-reports'
import type { ExceptionRow, ExceptionsReport } from '../src/libs/data/TaxReportsData'

const TABS: [string, string, string][] = [
  ['vat-summary', 'VAT Summary', 'vat-summary-table'],
  ['output-vat', 'Output VAT Detail', 'output-vat-table'],
  ['input-vat', 'Input VAT Detail', 'input-vat-table'],
  ['ewt-schedule', 'EWT Payable', 'ewt-table'],
  ['cwt-schedule', 'Creditable WHT', 'cwt-table'],
  ['reconciliation', 'GL Reconciliation', 'recon-table'],
  ['exceptions', 'Exceptions', 'exceptions-table'],
]

test.describe('Tax Reports', () => {
  test('opens on the VAT Summary for this month and offers every report as a tab', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/tax-reports')
    await expect(page.getByRole('heading', { name: 'Tax Reports' })).toBeVisible()

    for (const [, label] of TABS) {
      await expect(page.getByRole('tab', { name: label })).toBeVisible()
    }
    await expect(page.getByRole('tab', { name: 'VAT Summary' })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    // This month, in Manila days.
    const { startDate, endDate } = presetPeriod('this-month')
    await expect(page.getByLabel('Period', { exact: true })).toHaveValue('this-month')
    await expect(page.getByLabel('From', { exact: true })).toHaveValue(startDate)
    await expect(page.getByLabel('To', { exact: true })).toHaveValue(endDate)

    await expect(page.getByTestId('vat-summary-table')).toBeVisible()
    await expect(page.getByTestId('stat-output-vat')).toBeVisible()
    await expect(page.getByTestId('stat-input-vat')).toBeVisible()
    await expect(page.getByTestId('stat-net-vat')).toBeVisible()
  })

  test('each tab is its own screen and keeps the period', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports')
    await expect(page.getByTestId('vat-summary-table')).toBeVisible()

    // Picked before React has attached its handler, the choice is put back by
    // hydration: choose again until the dates actually move.
    const { startDate, endDate } = presetPeriod('last-month')
    await expect(async () => {
      await page.getByLabel('Period', { exact: true }).selectOption('last-month')
      await expect(page.getByLabel('From', { exact: true })).toHaveValue(startDate, {
        timeout: 1_000,
      })
    }).toPass({ timeout: 10_000 })

    for (const [key, label, table] of TABS.slice(1)) {
      await page.getByRole('tab', { name: label }).click()
      await expect(page).toHaveURL(new RegExp(`report=${key}`))
      await expect(page.getByTestId(table)).toBeVisible()
      // the period was chosen once and every report reads it
      await expect(page.getByLabel('From', { exact: true })).toHaveValue(startDate)
      await expect(page.getByLabel('To', { exact: true })).toHaveValue(endDate)
    }
  })

  test('the EWT and Creditable WHT screens each carry a summary above the entries', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/tax-reports?report=ewt-schedule')
    await expect(page.getByTestId('ewt-summary-table')).toBeVisible()
    await expect(page.getByTestId('ewt-table')).toBeVisible()
    await expect(page.getByTestId('stat-withheld')).toBeVisible()
    await expect(page.getByTestId('stat-remitted')).toBeVisible()

    await clickStable(
      page.getByRole('tab', { name: 'Creditable WHT' }),
      page.getByTestId('cwt-summary-table')
    )
    await expect(page.getByTestId('cwt-table')).toBeVisible()
    await expect(page.getByTestId('stat-cwt-pending')).toBeVisible()
  })

  test('the GL Reconciliation lists every tax account and what to look at', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports?report=reconciliation')
    await expect(page.getByTestId('recon-table')).toBeVisible()
    for (const key of [
      'OUTPUT_VAT',
      'INPUT_VAT',
      'VAT_PAYABLE',
      'WHT_PAYABLE',
      'WHT_PAYABLE_RENT',
      'WHT_PAYABLE_PROFESSIONAL',
      'WHT_RECEIVABLE',
    ]) {
      await expect(page.getByTestId(`recon-${key}`)).toBeVisible()
    }
    await expect(page.getByTestId('recon-checks')).toBeVisible()
    await expect(page.getByTestId('check-creditMemosAgainstVatableInvoices')).toContainText(
      'Credit memos on VATable invoices'
    )
  })

  test('a deep link opens its tab', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports?report=input-vat')
    await expect(page.getByRole('tab', { name: 'Input VAT Detail' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByTestId('input-vat-table')).toBeVisible()
    // an unknown report falls back to the summary rather than a blank page
    await gotoReady(page, '/accounting/tax-reports?report=nonsense')
    await expect(page.getByRole('tab', { name: 'VAT Summary' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  test('a period that runs backwards asks for another and stops the export', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports')
    await expect(page.getByTestId('vat-summary-table')).toBeVisible()

    const today = manilaToday()
    // From later than To: not a period.
    await expect(async () => {
      await page.getByLabel('From', { exact: true }).fill(today)
      await page.getByLabel('To', { exact: true }).fill(`${today.slice(0, 8)}01`)
      await expect(page.getByText(/start date must be on or before the end date/i)).toBeVisible({
        timeout: 2_000,
      })
    }).toPass({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /export to excel/i })).toBeDisabled()
    await expect(page.getByTestId('vat-summary-table')).toHaveCount(0)
    // choosing a preset again brings the report back
    await page.getByLabel('Period', { exact: true }).selectOption('this-month')
    await expect(page.getByTestId('vat-summary-table')).toBeVisible()
  })

  test('the filters that mean something to a report appear only on it', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports')
    await expect(page.getByTestId('vat-summary-table')).toBeVisible()
    // the summary and the reconciliation are cut by period, branch and code, not by text
    await expect(page.getByLabel('Search', { exact: true })).toHaveCount(0)

    await clickStable(
      page.getByRole('tab', { name: 'Output VAT Detail' }),
      page.getByLabel('Search', { exact: true })
    )
    await expect(page.getByLabel('Tax code', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'Input VAT Detail' }).click()
    await expect(page.getByLabel('Project or asset', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'EWT Payable' }).click()
    await expect(page.getByLabel('ATC', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'Creditable WHT' }).click()
    await expect(page.getByLabel('Certificate', { exact: true })).toBeVisible()
    await expect(page.getByLabel('ATC', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Tax code', { exact: true })).toHaveCount(0)
  })

  test('a search that matches nothing says so', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports?report=output-vat')
    await expect(page.getByTestId('output-vat-table')).toBeVisible()
    // Hydration can wipe the box after its value has been checked, so retry on
    // the outcome, not on the value: type again until the report answers.
    await expect(async () => {
      await page.getByLabel('Search', { exact: true }).fill('zz-nothing-has-this-number-zz')
      await expect(page.getByText('No sales or invoices in this period.')).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 20_000 })
    await expect(page.getByTestId('output-row')).toHaveCount(0)
  })

  test('a narrowed EWT report leaves the remitted figure out and says why', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports?report=ewt-schedule')
    await expect(page.getByTestId('ewt-table')).toBeVisible()
    // The whole report sets the period's remittances against its withholding.
    await expect(page.getByTestId('stat-remitted')).toContainText('₱')
    // A remittance pays all the withholding accounts together, so a part of the
    // report (one search) cannot be set against it. Retry on the outcome: the
    // box can be wiped by hydration after its value has been checked.
    await expect(async () => {
      await page.getByLabel('Search', { exact: true }).fill('zz-nothing-has-this-number-zz')
      await expect(page.getByTestId('stat-remitted')).toContainText(/clear the filters/i, {
        timeout: 3_000,
      })
    }).toPass({ timeout: 20_000 })
    await expect(page.getByTestId('stat-remitted')).not.toContainText('₱')
    await expect(page.getByTestId('stat-outstanding')).not.toContainText('₱')
  })

  test('the Excel export downloads a workbook', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports?report=output-vat')
    await expect(page.getByTestId('output-vat-table')).toBeVisible()
    const button = page.getByRole('button', { name: /export to excel/i })
    await expect(button).toBeEnabled()

    // A click before React has attached its handler downloads nothing: click again.
    let download!: Download
    await expect(async () => {
      ;[download] = await Promise.all([
        page.waitForEvent('download', { timeout: 4_000 }),
        button.click(),
      ])
    }).toPass({ timeout: 20_000 })
    expect(download.suggestedFilename()).toMatch(/output-vat.*\.xlsx$/i)
    const path = await download.path()
    // an .xlsx is a zip
    expect(readFileSync(path).subarray(0, 2).toString()).toBe('PK')
  })

  test('the sidebar has Tax Reports and Tax Closing beside Reports', async ({ page }) => {
    await gotoReady(page, '/accounting/tax-reports')
    const nav = page.getByRole('complementary')
    await expect(nav.getByRole('link', { name: 'Tax Reports' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Tax Closing' })).toBeVisible()
  })
})

// ── Part I: the Tax Code Exception Report and the month-end checklist ──────────
//
// The report's answer is supplied by the test (page.route), cut the way the API
// cuts it, so what the screen shows is known without a database to hold it.

const exceptionRow = (over: Partial<ExceptionRow>): ExceptionRow => ({
  kind: 'OVERRIDE',
  module: 'AP_BILL',
  documentType: 'AP bill',
  documentId: 'bill-1',
  documentNo: 'E2E-BILL-1',
  party: 'E2E Supplier',
  date: '2026-10-05',
  branchId: null,
  branchName: 'Unassigned',
  userId: 'user-ana',
  userName: 'Ana Accountant',
  field: null,
  line: null,
  defaultCode: null,
  chosenCode: null,
  reason: null,
  at: null,
  approvedByName: null,
  detail: '',
  amount: 1000,
  ...over,
})

const EXCEPTIONS: ExceptionRow[] = [
  exceptionRow({
    documentId: 'bill-1',
    documentNo: 'E2E-BILL-1',
    field: 'INPUT_VAT_CODE',
    line: 1,
    defaultCode: 'VAT-IN-12',
    chosenCode: 'VAT-IN-CAPEX',
    reason: 'Delivery van, capitalised',
    at: '2026-10-05T01:00:00.000Z',
    detail: 'Input VAT code on line 1: VAT-IN-12 → VAT-IN-CAPEX',
    amount: 56000,
  }),
  exceptionRow({
    module: 'POS',
    documentType: 'POS sale',
    documentId: 'sale-1',
    documentNo: 'POS-E2E-1',
    party: 'Walk-in',
    date: '2026-10-06',
    branchId: 'branch-1',
    branchName: 'E2E Branch',
    userId: 'user-cora',
    userName: 'Cora Cashier',
    field: 'OUTPUT_VAT_CODE',
    defaultCode: 'VAT-OUT-12',
    chosenCode: 'VAT-OUT-EXEMPT',
    reason: 'Senior citizen',
    at: '2026-10-06T02:00:00.000Z',
    approvedByName: 'Manny Manager',
    detail: 'Output VAT class: VAT-OUT-12 → VAT-OUT-EXEMPT',
    amount: 1000,
  }),
  exceptionRow({
    kind: 'NO_VAT_CLASS',
    module: 'AR_INVOICE',
    documentType: 'AR invoice',
    documentId: 'inv-1',
    documentNo: 'INV-E2E-1',
    party: 'E2E Customer',
    date: '2026-10-07',
    userId: null,
    userName: null,
    detail: 'Posted without a VAT class',
    amount: 2000,
  }),
  exceptionRow({
    kind: 'NO_WITHHOLDING_CODE',
    documentId: 'bill-2',
    documentNo: 'E2E-BILL-2',
    date: '2026-10-08',
    detail: 'Withheld 500.00 with no withholding code',
    amount: 10000,
  }),
]

const CODE_WITHOUT_ATC = {
  code: 'EWT-E2E-9',
  name: 'E2E professional fees',
  taxType: 'EWT_PAYABLE',
  uses: 3,
  withheld: 1500,
}

/** The report the API would answer for a query, over `rows`, cut as the query says. */
function answerExceptions(
  url: URL,
  rows: ExceptionRow[],
  codes: (typeof CODE_WITHOUT_ATC)[]
): ExceptionsReport {
  const q = url.searchParams
  const needle = (q.get('search') ?? '').toLowerCase()
  const shown = rows
    .filter((r) => !q.get('kind') || r.kind === q.get('kind'))
    .filter((r) => !q.get('module') || r.module === q.get('module'))
    .filter((r) => !q.get('userId') || r.userId === q.get('userId'))
    .filter(
      (r) =>
        !needle ||
        [r.documentNo, r.party, r.userName, r.reason, r.detail].some((v) =>
          (v ?? '').toLowerCase().includes(needle)
        )
    )
  const users = new Map<string, { userId: string | null; userName: string; count: number }>()
  for (const r of shown) {
    const cur = users.get(r.userId ?? '') ?? {
      userId: r.userId,
      userName: r.userName ?? 'Not recorded',
      count: 0,
    }
    cur.count += 1
    users.set(r.userId ?? '', cur)
  }
  return {
    meta: {
      startDate: q.get('startDate') ?? '',
      endDate: q.get('endDate') ?? '',
      branchId: null,
      branchName: null,
      branchLocked: false,
      generatedAt: new Date().toISOString(),
      rowCount: shown.length,
    },
    summary: {
      byKind: (['OVERRIDE', 'NO_VAT_CLASS', 'NO_INPUT_CODE', 'NO_WITHHOLDING_CODE'] as const).map(
        (kind) => ({ kind, count: shown.filter((r) => r.kind === kind).length })
      ),
      byModule: (['POS', 'AR_INVOICE', 'AP_BILL', 'EXPENSE'] as const).map((module) => ({
        module,
        count: shown.filter((r) => r.module === module).length,
      })),
      byUser: [...users.values()].sort(
        (a, b) => b.count - a.count || a.userName.localeCompare(b.userName)
      ),
    },
    rows: shown,
    codesWithoutAtc: codes,
    totals: { rows: shown.length, documents: new Set(shown.map((r) => r.documentId)).size },
  }
}

/** Answers the report from `rows` instead of the database; returns the queries it was asked. */
async function mockExceptions(
  page: Page,
  rows: ExceptionRow[] = EXCEPTIONS,
  codes: (typeof CODE_WITHOUT_ATC)[] = [CODE_WITHOUT_ATC]
): Promise<URL[]> {
  const asked: URL[] = []
  await page.route(/\/api\/reports\/tax\/exceptions(\?|$)/, (route) => {
    const url = new URL(route.request().url())
    asked.push(url)
    return route.fulfill({ json: answerExceptions(url, rows, codes) })
  })
  return asked
}

const lastOf = (urls: URL[]): URL => urls[urls.length - 1]

test.describe('Tax Code Exceptions', () => {
  test('is a tab of its own, cut by module and exception, but not by tax code', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/tax-reports?report=exceptions')
    await expect(page.getByRole('tab', { name: 'Exceptions' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByTestId('exceptions-table')).toBeVisible()
    for (const id of ['stat-exceptions', 'stat-changed', 'stat-missing', 'stat-no-atc']) {
      await expect(page.getByTestId(id)).toBeVisible()
    }
    await expect(page.getByLabel('Search', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Tax code', { exact: true })).toHaveCount(0)

    // the four places a tax code is chosen, and the four things that can be found
    const moduleSelect = page.getByLabel('Module', { exact: true })
    await expect(moduleSelect.locator('option')).toHaveText([
      'All modules',
      'POS sale',
      'AR invoice',
      'AP bill',
      'Expense',
    ])
    await expect(page.getByLabel('Exception', { exact: true }).locator('option')).toHaveText([
      'All exceptions',
      'Tax code changed',
      'No VAT class',
      'No input VAT code',
      'No withholding code',
    ])

    // the filters belong to this report and go when it does
    await clickStable(
      page.getByRole('tab', { name: 'Output VAT Detail' }),
      page.getByTestId('output-vat-table')
    )
    await expect(page.getByLabel('Module', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Exception', { exact: true })).toHaveCount(0)
  })

  test('lists what was changed, why and by whom, and what is missing', async ({ page }) => {
    await mockExceptions(page)
    await gotoReady(page, '/accounting/tax-reports?report=exceptions')
    const rows = page.getByTestId('exception-row')
    await expect(rows).toHaveCount(4)

    await expect(page.getByTestId('stat-exceptions')).toContainText('4')
    await expect(page.getByTestId('stat-exceptions')).toContainText('Exceptions in the period')
    await expect(page.getByTestId('stat-changed')).toContainText('2')
    await expect(page.getByTestId('stat-missing')).toContainText('2')
    await expect(page.getByTestId('stat-no-atc')).toContainText('1')

    // a change: what the code was, what it became, why, who, and when
    const van = rows.filter({ hasText: 'E2E-BILL-1' })
    await expect(van).toContainText('Tax code changed')
    await expect(van).toContainText('Input VAT code')
    await expect(van).toContainText('line 1')
    await expect(van).toContainText('VAT-IN-12')
    await expect(van).toContainText('VAT-IN-CAPEX')
    await expect(van).toContainText('Delivery van, capitalised')
    await expect(van).toContainText('Ana Accountant')
    await expect(van).toContainText(/Oct 5, 2026/)
    await expect(van.getByRole('link', { name: 'E2E-BILL-1' })).toHaveAttribute(
      'href',
      '/accounting/ap-bills/bill-1'
    )

    // a register sale has no page of its own: it is found in the transactions list
    const sale = rows.filter({ hasText: 'POS-E2E-1' })
    await expect(sale).toContainText('Output VAT class')
    await expect(sale).toContainText('approved by Manny Manager')
    await expect(sale).toContainText('E2E Branch')
    await expect(sale.getByRole('link', { name: 'POS-E2E-1' })).toHaveAttribute(
      'href',
      '/pos/transactions?search=POS-E2E-1'
    )

    // a missing code: what is missing, on which document, and no reason to read
    const invoice = rows.filter({ hasText: 'INV-E2E-1' })
    await expect(invoice).toContainText('No VAT class')
    await expect(invoice).toContainText('Posted without a VAT class')
    await expect(invoice.getByRole('link', { name: 'INV-E2E-1' })).toHaveAttribute(
      'href',
      '/accounting/ar-invoices/inv-1'
    )
    await expect(rows.filter({ hasText: 'E2E-BILL-2' })).toContainText('No withholding code')

    // the withholding codes the accountant has still to give an ATC to
    await expect(page.getByTestId('exceptions-atc-note')).toContainText(
      '1 withholding tax code has no ATC yet'
    )
    await expect(page.getByTestId('exceptions-atc-codes')).toContainText('EWT-E2E-9')
    await expect(page.getByTestId('exceptions-atc-codes')).toContainText('3 documents')
  })

  test('a count in the summary cuts the report by it, and the same click lifts the cut', async ({
    page,
  }) => {
    const asked = await mockExceptions(page)
    await gotoReady(page, '/accounting/tax-reports?report=exceptions')
    const rows = page.getByTestId('exception-row')
    await expect(rows).toHaveCount(4)

    // by module: the summary only exists once the report has loaded, so the page
    // is hydrated and one click is enough
    const byModule = page.getByTestId('exceptions-by-module')
    await byModule.getByRole('button', { name: /AP bill/ }).click()
    await expect(rows).toHaveCount(2)
    expect(lastOf(asked).searchParams.get('module')).toBe('AP_BILL')
    await expect(page.getByLabel('Module', { exact: true })).toHaveValue('AP_BILL')
    // the counts are those of the rows shown, and say so
    await expect(page.getByTestId('stat-exceptions')).toContainText(
      'Exceptions matching the filters'
    )
    await expect(page.getByTestId('stat-changed')).toContainText('1')
    await expect(page.getByTestId('stat-missing')).toContainText('1')

    await byModule.getByRole('button', { name: /AP bill/ }).click()
    await expect(rows).toHaveCount(4)
    expect(lastOf(asked).searchParams.has('module')).toBe(false)
    await expect(page.getByLabel('Module', { exact: true })).toHaveValue('')
    await expect(page.getByTestId('stat-exceptions')).toContainText('Exceptions in the period')

    // by exception
    await page
      .getByTestId('exceptions-by-kind')
      .getByRole('button', { name: /No VAT class/ })
      .click()
    await expect(rows).toHaveCount(1)
    expect(lastOf(asked).searchParams.get('kind')).toBe('NO_VAT_CLASS')
    await expect(page.getByLabel('Exception', { exact: true })).toHaveValue('NO_VAT_CLASS')
    await page.getByLabel('Exception', { exact: true }).selectOption('')
    await expect(rows).toHaveCount(4)

    // by user: whoever made the changes; a missing code has nobody to name
    const byUser = page.getByTestId('exceptions-by-user')
    await expect(byUser).toContainText('Not recorded')
    await expect(byUser.getByRole('button', { name: /Not recorded/ })).toHaveCount(0)
    await byUser.getByRole('button', { name: /Ana Accountant/ }).click()
    await expect(rows).toHaveCount(2)
    expect(lastOf(asked).searchParams.get('userId')).toBe('user-ana')
    await expect(page.getByTestId('exceptions-user-filter')).toContainText(
      'Showing Ana Accountant only.'
    )
    await page.getByRole('button', { name: 'Show everyone' }).click()
    await expect(rows).toHaveCount(4)
    expect(lastOf(asked).searchParams.has('userId')).toBe(false)
    await expect(page.getByTestId('exceptions-user-filter')).toHaveCount(0)
  })

  test('a search narrows the report to what matches', async ({ page }) => {
    const asked = await mockExceptions(page)
    await gotoReady(page, '/accounting/tax-reports?report=exceptions')
    const rows = page.getByTestId('exception-row')
    await expect(rows).toHaveCount(4)
    // the box can be wiped by hydration after its value has been checked: retry on the outcome
    await expect(async () => {
      await page.getByLabel('Search', { exact: true }).fill('senior')
      await expect(rows).toHaveCount(1, { timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    expect(lastOf(asked).searchParams.get('search')).toBe('senior')
    await expect(rows).toContainText('POS-E2E-1')
    await expect(page.getByTestId('stat-exceptions')).toContainText(
      'Exceptions matching the filters'
    )
  })

  test('with nothing to review it says so, and has no codes to chase', async ({ page }) => {
    await mockExceptions(page, [], [])
    await gotoReady(page, '/accounting/tax-reports?report=exceptions')
    await expect(
      page.getByText('No exceptions in this period: every code is where it should be.')
    ).toBeVisible()
    await expect(page.getByTestId('exception-row')).toHaveCount(0)
    await expect(page.getByTestId('stat-exceptions')).toContainText('0')
    await expect(page.getByTestId('exceptions-summary')).toHaveCount(0)
    await expect(page.getByTestId('exceptions-atc-note')).toHaveCount(0)
  })

  test('the Excel export asks for the same cut of the report as the screen', async ({ page }) => {
    const exported: URL[] = []
    await page.route(/\/api\/reports\/tax\/exceptions\/export/, (route) => {
      exported.push(new URL(route.request().url()))
      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': 'attachment; filename="tax-code-exceptions-e2e.xlsx"',
        },
        body: Buffer.from('PK'),
      })
    })
    await mockExceptions(page)
    await gotoReady(page, '/accounting/tax-reports?report=exceptions')
    const rows = page.getByTestId('exception-row')
    await expect(rows).toHaveCount(4)
    await page
      .getByTestId('exceptions-by-module')
      .getByRole('button', { name: /AP bill/ })
      .click()
    await expect(rows).toHaveCount(2)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export to excel/i }).click(),
    ])
    expect(download.suggestedFilename()).toBe('tax-code-exceptions-e2e.xlsx')
    expect(exported).toHaveLength(1)
    expect(exported[0].pathname).toBe('/api/reports/tax/exceptions/export')
    expect(exported[0].searchParams.get('module')).toBe('AP_BILL')
    expect(exported[0].searchParams.get('startDate')).toBeTruthy()
    expect(exported[0].searchParams.get('endDate')).toBeTruthy()
  })

  test('a link that names its days opens the report on exactly those', async ({ page }) => {
    await mockExceptions(page)
    await gotoReady(page, '/accounting/tax-reports?report=exceptions&from=2025-01-01&to=2025-01-31')
    await expect(page.getByTestId('exceptions-table')).toBeVisible()
    await expect(page.getByLabel('Period', { exact: true })).toHaveValue('custom')
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2025-01-01')
    await expect(page.getByLabel('To', { exact: true })).toHaveValue('2025-01-31')
  })
})

test.describe('Month-end checklist — tax code exceptions', () => {
  const PAST = {
    id: 'fp-e2e-past',
    name: 'E2E Closed Period',
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2025-01-31T00:00:00.000Z',
    isLocked: false,
    status: 'OPEN',
  }
  // a period still running: the books only hold what has happened, so it is read up to today
  const RUNNING = {
    id: 'fp-e2e-running',
    name: 'E2E Running Period',
    startDate: '2020-01-01T00:00:00.000Z',
    endDate: '2099-12-31T00:00:00.000Z',
    isLocked: false,
    status: 'OPEN',
  }

  async function openChecklist(page: Page, periodName: string): Promise<void> {
    await page.route(/\/api\/fiscal-periods(\?.*)?$/, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: [PAST, RUNNING] })
        : route.continue()
    )
    await page.route(/\/api\/fiscal-periods\/[^/]+\/checklist$/, (route) =>
      route.fulfill({ json: { checklist: {}, completed: 0, total: 7, complete: false } })
    )
    await gotoReady(page, '/accounting/fiscal-periods')
    await page
      .getByRole('row', { name: new RegExp(periodName) })
      .getByTitle('Close checklist')
      .click()
    await expect(page.getByText('Close Checklist')).toBeVisible()
  }

  test('asks for the review, says how many exceptions there are, and links to them', async ({
    page,
  }) => {
    const asked = await mockExceptions(page)
    await openChecklist(page, 'E2E Closed Period')

    // the review is a tick someone gives; the count says what is behind it
    await expect(page.getByLabel('Tax code exceptions reviewed')).not.toBeChecked()
    await expect(page.getByTestId('checklist-tax-exceptions-count')).toContainText(
      '4 to review: 2 changed from a default, 2 missing a code.'
    )
    expect(
      asked.some(
        (u) =>
          u.searchParams.get('startDate') === '2025-01-01' &&
          u.searchParams.get('endDate') === '2025-01-31'
      )
    ).toBe(true)

    // the link opens the report on the period's own days
    const open = page.getByTestId('checklist-tax-exceptions').getByRole('link', {
      name: 'Open the report',
    })
    await expect(open).toHaveAttribute(
      'href',
      '/accounting/tax-reports?report=exceptions&from=2025-01-01&to=2025-01-31'
    )
    await open.click()
    await expect(page).toHaveURL(/report=exceptions&from=2025-01-01&to=2025-01-31/)
    await expect(page.getByRole('tab', { name: 'Exceptions' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2025-01-01')
    await expect(page.getByLabel('To', { exact: true })).toHaveValue('2025-01-31')
    await expect(page.getByTestId('exception-row')).toHaveCount(4)
  })

  test('a period that is still running is read up to today', async ({ page }) => {
    const asked = await mockExceptions(page, [])
    await openChecklist(page, 'E2E Running Period')
    const today = manilaToday()

    await expect(page.getByTestId('checklist-tax-exceptions-count')).toContainText(
      'No exceptions in this period.'
    )
    await expect(
      page.getByTestId('checklist-tax-exceptions').getByRole('link', { name: 'Open the report' })
    ).toHaveAttribute(
      'href',
      `/accounting/tax-reports?report=exceptions&from=2020-01-01&to=${today}`
    )
    expect(
      asked.some(
        (u) =>
          u.searchParams.get('startDate') === '2020-01-01' &&
          u.searchParams.get('endDate') === today
      )
    ).toBe(true)
  })
})
