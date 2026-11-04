import { test, expect, type Page, type Route } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 83 Part 3 (CL-07) — "Advance payments should show the amount due as
// a negative amount." The backend now returns a negative Due for money paid
// ahead (backend e2e: scenario-83-part-3-advance-negative); this pins that the
// two ledger screens show it as one — "-₱620.00", in red in the Due column —
// rather than hiding or flipping the sign.
//
// Read-only: a real ledger response is fetched and only its last row (and,
// for the plan ledger, its Tot. Amt. Due) is turned into a ₱620 advance before
// the page sees it. Nothing is written.

const ADVANCE = -620
const SHOWN = '-₱620.00'

type LedgerBody = { rows: { due: number }[]; account?: { totalDue: unknown } }

/** The ledger as the API sent it — bare, or inside a { data } envelope. */
function ledgerOf(body: unknown): LedgerBody | null {
  const b = body as { rows?: unknown; data?: { rows?: unknown } }
  if (Array.isArray(b?.rows)) return b as LedgerBody
  if (Array.isArray(b?.data?.rows)) return b.data as LedgerBody
  return null
}

async function endOnAdvance(page: Page, url: RegExp) {
  await page.route(url, async (route: Route) => {
    const response = await route.fetch()
    const body = await response.json()
    const ledger = ledgerOf(body)
    if (ledger && ledger.rows.length > 0) {
      ledger.rows[ledger.rows.length - 1].due = ADVANCE
      if (ledger.account) ledger.account.totalDue = ADVANCE
    }
    await route.fulfill({ response, json: body })
  })
}

// The ledger's own table (a page can carry others, e.g. the items bought).
const dueCellOfLastRow = (page: Page) =>
  page
    .locator('table', { has: page.getByRole('columnheader', { name: 'Outstanding' }) })
    .locator('tbody tr')
    .last()
    .locator('td')
    .nth(6)

test.describe('Scenario 83 Part 3 — an advance shows as a negative Due', () => {
  let accountId: string
  let customerId: string

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/crm/installment-accounts?limit=20&status=active')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // The list flattens the schedule away; only a POS plan carries the item
    // names off its sale.
    const rows: { id: string; customerId: string; itemNames?: string[] }[] = Array.isArray(body)
      ? body
      : (body.data ?? [])
    const plan = rows.find((r) => (r.itemNames ?? []).length > 0)
    test.skip(!plan, 'No active POS installment plan on this database')
    accountId = plan!.id
    customerId = plan!.customerId
  })

  test('S83-FE-3.1: the plan ledger shows the advance in Tot. Amt. Due and, in red, on its last row', async ({
    page,
  }) => {
    await endOnAdvance(page, /\/api\/crm\/installment-accounts\/[^/]+\/ledger(\?|$)/)
    await gotoReady(page, `/crm/customers/${customerId}/installments/${accountId}`)

    const figure = page.getByText('Tot. Amt. Due', { exact: true }).locator('..')
    await expect(figure).toContainText(SHOWN, { timeout: 15_000 })

    const due = dueCellOfLastRow(page)
    await expect(due).toHaveText(SHOWN)
    await expect(due).toHaveClass(/text-red-600/)
  })

  test('S83-FE-3.2: View ledger (the customer ledger narrowed to the plan) shows it in Tot. Amt. Due and, in red, on its last row', async ({
    page,
  }) => {
    // Narrowed to one plan, the customer ledger renders that plan's own ledger
    // (InstallmentLedgerBody, off the plan ledger endpoint).
    await endOnAdvance(page, /\/api\/crm\/installment-accounts\/[^/]+\/ledger(\?|$)/)
    await gotoReady(page, `/crm/customers/${customerId}/ledger?transactionId=acct:${accountId}`)

    const figure = page.getByText('Tot. Amt. Due', { exact: true }).locator('..')
    await expect(figure).toContainText(SHOWN, { timeout: 15_000 })
    const due = dueCellOfLastRow(page)
    await expect(due).toHaveText(SHOWN)
    await expect(due).toHaveClass(/text-red-600/)
  })
})
