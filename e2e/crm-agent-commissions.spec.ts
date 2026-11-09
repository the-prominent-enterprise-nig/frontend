import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 78 — the Sales Agents row opens the agent's own page: their
// invoices with their commission, and Edit and Remove in the header
// (inline edit, in-app confirm, unsaved-changes guard). Replaces the
// Scenario-01 "View commissions" dialog this file used to cover.
//
// Self-contained: creates its own agent through the API, so it never depends
// on what the roster holds, and removes it at the end (Remove is the last
// test; afterAll sweeps it if a run died earlier). The invoice rows
// themselves need a POS sale credited to the agent, which a spec can't make
// cheaply — the data side is proven in backend/src/crm/agent/agent.service.spec.ts.

const NAME = `E2E S78 Agent ${Date.now()}`
let agentId = ''

async function openList(page: Page) {
  await gotoReady(page, '/crm/agents')
  await expect(page.getByRole('heading', { name: 'Sales Agents' })).toBeVisible()
}

async function searchForAgent(page: Page, name: string) {
  const row = page.locator('tbody tr', { hasText: name })
  // The search box can be wiped by hydration on a cold compile — re-type until
  // the row shows.
  await expect(async () => {
    await page.getByPlaceholder('Search agents...').fill(name)
    await expect(row).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 20_000 })
  return row
}

test.describe.configure({ mode: 'serial' })

test.describe('CRM Sales Agents — the agent page (Scenario 78)', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/crm/agents', {
      data: { name: NAME, commissionRate: 0.05, branchId: null },
    })
    expect(res.ok()).toBeTruthy()
    agentId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    if (agentId) await request.delete(`/api/crm/agents/${agentId}`).catch(() => {})
  })

  test('the list has no row actions — clicking a row opens the agent page', async ({ page }) => {
    await openList(page)
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0)
    await expect(page.getByTitle('View commissions')).toHaveCount(0)

    const row = await searchForAgent(page, NAME)
    // Any cell, not just the name.
    await row.locator('td').nth(4).click()
    await expect(page).toHaveURL(new RegExp(`/crm/agents/${agentId}$`))

    await expect(page.getByRole('heading', { name: NAME })).toBeVisible()
    await expect(page.getByText('All branches · 5.00% rate · Active')).toBeVisible()
    for (const tile of ['Invoices', 'Commission']) {
      await expect(page.getByText(tile, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('SMI Released')).toHaveCount(0)
    await expect(page.getByText('No invoices sold yet.')).toBeVisible()
  })

  test('Edit is inline: Cancel discards, Save keeps the rate when it was left alone', async ({
    page,
  }) => {
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Agent' })).toBeVisible()
    // The invoices stay on the page under the form.
    await expect(page.getByText('No invoices sold yet.')).toBeVisible()

    const phone = page.locator('form').getByRole('textbox').nth(1)
    await phone.fill('09170000078')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('09170000078')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.locator('form').getByRole('textbox').nth(1).fill('09170000078')
    // Rate untouched: the API sends it as a Decimal string and the update DTO is
    // @IsNumber() — this Save is what would 400 if the form passed it back as-is.
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Agent updated')).toBeVisible()
    await expect(page.getByText('09170000078')).toBeVisible()
    await expect(page.getByText('All branches · 5.00% rate · Active')).toBeVisible()
  })

  test('leaving with unsaved edits asks first; an unchanged form just leaves', async ({ page }) => {
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    const name = page.locator('form').getByRole('textbox').first()
    await name.fill(`${NAME} X`)

    await page.getByRole('link', { name: 'Back to sales agents' }).click()
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(new RegExp(`/crm/agents/${agentId}$`))
    await expect(name).toHaveValue(`${NAME} X`)

    // Changed back to the saved value — nothing to lose, so no question.
    await name.fill(NAME)
    await page.getByRole('link', { name: 'Back to sales agents' }).click()
    await expect(page).toHaveURL(/\/crm\/agents$/)
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toHaveCount(0)

    // And Discard and leave really leaves, without saving.
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.locator('form').getByRole('textbox').first().fill(`${NAME} Y`)
    await page.getByRole('link', { name: 'Back to sales agents' }).click()
    await page.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(page).toHaveURL(/\/crm\/agents$/)
    await searchForAgent(page, NAME)
    await expect(page.locator('tbody tr', { hasText: `${NAME} Y` })).toHaveCount(0)
  })

  // The page's Date is the day the commission (or, failing that, the SMI) was
  // released — not the day of the sale — and a From/To range filters on it.
  // Rows need a credited POS sale, which a spec can't make cheaply, so the
  // invoices response is stubbed; the sale dates are deliberately far from the
  // release dates so a column still showing the sale date would fail.
  test('Date is the released date, and a date range filters on it', async ({ page }) => {
    const release = (n: string, date: string, amount: number, isDraft = false) => ({
      expenseId: `exp-${n}`,
      voucherNumber: `V-${n}`,
      date,
      amount,
      isDraft,
    })
    const sale = (n: string, over: Record<string, unknown>) => ({
      id: `sale-${n}`,
      date: '2026-09-01T02:00:00.000Z',
      salesInvoiceNumber: `SI-${n}`,
      transactionNumber: `POS-${n}`,
      agentId,
      agentName: NAME,
      customerName: `Customer ${n}`,
      type: 'cash',
      subtotal: 1000,
      totalAmount: 1000,
      commission: null,
      released: null,
      smi: null,
      smiReleased: null,
      ...over,
    })
    const invoices = [
      // Commission out Nov 5 — the sale itself was Sep 1.
      sale('A', {
        commission: 500,
        released: release('A', '2026-11-05T00:00:00.000Z', 500),
      }),
      sale('B', {
        commission: 300,
        released: release('B', '2026-11-08T00:00:00.000Z', 300),
      }),
      // Nothing released.
      sale('C', {}),
      // Only the SMI is out — its date stands in.
      sale('D', {
        smi: 100,
        smiReleased: release('D', '2026-11-07T00:00:00.000Z', 100),
      }),
      // A draft isn't paid yet: no amount, no date.
      sale('E', { released: release('E', '2026-11-09T00:00:00.000Z', 0, true) }),
    ]
    await page.route('**/crm/agents/*/invoices', (route) => route.fulfill({ json: invoices }))

    await gotoReady(page, `/crm/agents/${agentId}`)
    const rows = page.locator('tbody tr')
    await expect(page.getByRole('columnheader', { name: 'Released Date' })).toBeVisible()
    await expect(rows).toHaveCount(5)

    // Newest release first, the unreleased and the draft after, with a dash.
    const order = async () => (await rows.locator('td:nth-child(2)').allInnerTexts()).join(',')
    await expect(rows.nth(0)).toContainText('Nov 8, 2026')
    await expect.poll(order).toBe('SI-B,SI-D,SI-A,SI-C,SI-E')
    await expect(rows.nth(1).locator('td').first()).toHaveText('Nov 7, 2026')
    await expect(rows.nth(2).locator('td').first()).toHaveText('Nov 5, 2026')
    await expect(rows.nth(3).locator('td').first()).toHaveText('-')
    await expect(rows.nth(4).locator('td').first()).toHaveText('-')
    await expect(page.getByText('Sep 1, 2026')).toHaveCount(0)
    await expect(page.getByText('Clear')).toHaveCount(0)

    // From – To are inclusive and cut the tiles down with the list.
    const tile = (label: string) =>
      page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::p')
    await expect(tile('Invoices')).toHaveText('5')
    await expect(tile('Commission')).toHaveText('₱800.00')
    await expect(tile('SMI')).toHaveText('₱100.00')

    await page.getByLabel('Released from').fill('2026-11-07')
    await page.getByLabel('Released to').fill('2026-11-08')
    await expect.poll(order).toBe('SI-B,SI-D')
    await expect(tile('Invoices')).toHaveText('2')
    await expect(tile('Commission')).toHaveText('₱300.00')
    await expect(tile('SMI')).toHaveText('₱100.00')

    // One side alone is a bound too.
    await page.getByLabel('Released from').fill('')
    await page.getByLabel('Released to').fill('2026-11-05')
    await expect.poll(order).toBe('SI-A')

    await page.getByLabel('Released from').fill('2026-12-01')
    await page.getByLabel('Released to').fill('')
    await expect(page.getByText('Nothing was released in this date range.')).toBeVisible()
    await expect(tile('Invoices')).toHaveText('0')

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByLabel('Released from')).toHaveValue('')
    await expect(page.getByLabel('Released to')).toHaveValue('')
    await expect(rows).toHaveCount(5)
  })

  test('the list pages 20 at a time', async ({ page }) => {
    await openList(page)
    const footer = page.getByText(/^Showing \d+–\d+ of \d+ agents?$/)
    await expect(footer).toBeVisible({ timeout: 15_000 })
    const total = Number((await footer.innerText()).match(/of (\d+)/)![1])
    await expect(page.locator('tbody tr')).toHaveCount(Math.min(total, 20))
    const next = page.getByRole('button', { name: 'Next', exact: true })
    if (total <= 20) {
      await expect(next).toBeDisabled()
      return
    }
    await next.click()
    await expect(footer).toHaveText(
      new RegExp(`^Showing 21–${Math.min(total, 40)} of ${total} agents$`)
    )
    // A search goes back to page 1.
    await page.getByPlaceholder('Search agents...').fill(NAME)
    await expect(footer).toHaveText('Showing 1–1 of 1 agent')
  })

  test('Remove asks in-app, then returns to the list without the agent', async ({ page }) => {
    await gotoReady(page, `/crm/agents/${agentId}`)
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByRole('heading', { name: 'Remove agent' })).toBeVisible()
    await expect(page.getByText('Their past invoices and commissions are kept.')).toBeVisible()
    await page.getByRole('button', { name: 'Remove', exact: true }).last().click()
    await expect(page).toHaveURL(/\/crm\/agents$/)
    await page.getByPlaceholder('Search agents...').fill(NAME)
    await expect(page.getByText('No sales agents yet')).toBeVisible({ timeout: 10_000 })
    agentId = ''
  })
})
