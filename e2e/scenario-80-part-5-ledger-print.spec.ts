import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 80 Part 5 — Oct 29 UAT printed customer ledger:
//   - CL-01 the single-plan (paper form) printout carries the customer's phone
//   - CL-03 the multi-plan printout carries Total Amount Due
// Uses customers already on the database: one with a single in-house plan
// and one with several purchases. Annotated, not failed, when there is none.

type LedgerTotals = { outstanding: number; totalDue?: number }
type Ledger = { transactions: { id: string; kind: string }[]; totals: LedgerTotals }

async function ledgerOf(request: APIRequestContext, customerId: string): Promise<Ledger> {
  const res = await request.get(`/api/crm/customers/${customerId}/ledger`)
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

async function findCustomer(
  request: APIRequestContext,
  wanted: (l: Ledger) => boolean
): Promise<string | null> {
  const res = await request.get('/api/crm/installment-accounts', { params: { limit: '50' } })
  const body = await res.json()
  const ids = [
    ...new Set(((body.data ?? body) as { customerId: string }[]).map((a) => a.customerId)),
  ]
  for (const id of ids) {
    if (wanted(await ledgerOf(request, id))) return id
  }
  return null
}

async function printedHtml(page: Page, customerId: string): Promise<string> {
  await gotoReady(page, `/crm/customers/${customerId}/ledger`)
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print' }).click()
  const popup = await popupPromise
  await expect(popup.locator('.letterhead')).toBeVisible({ timeout: 20_000 })
  return popup.content()
}

test.describe('Scenario 80 Part 5 — printed customer ledger', () => {
  test('CL-03: the ledger totals carry Total Amount Due, and the multi-plan print shows it', async ({
    page,
  }, testInfo) => {
    const id = await findCustomer(page.request, (l) => l.transactions.length > 1)
    if (!id) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'No customer with more than one purchase on this DB.',
      })
      return
    }
    const ledger = await ledgerOf(page.request, id)
    expect(typeof ledger.totals.totalDue).toBe('number')
    expect(ledger.totals.totalDue!).toBeLessThanOrEqual(ledger.totals.outstanding + 0.005)

    const html = await printedHtml(page, id)
    expect(html).toContain('Total Amount Due')
  })

  test('CL-01: the single-plan print shows the customer’s phone', async ({ page }, testInfo) => {
    const id = await findCustomer(
      page.request,
      (l) => l.transactions.length === 1 && l.transactions[0].kind === 'inhouse'
    )
    if (!id) {
      testInfo.annotations.push({
        type: 'skipped-assertion',
        description: 'No customer with exactly one in-house plan on this DB.',
      })
      return
    }
    const html = await printedHtml(page, id)
    expect(html).toContain('<p class="cell-label">Phone</p>')
  })
})
