/**
 * A recorded expense can be edited.
 *
 * Until now only a draft had an Edit; a recorded one could only be voided and
 * typed in again. Now Edit is offered on a recorded expense too: Save writes
 * the change straight through (no Save draft / Record — there is nothing left
 * to record), the server reverses the journal entry and posts a new one when
 * the change reaches the books, and the user lands back on the expense's page.
 *
 * Self-cleaning: every expense it records is voided afterwards. A voided
 * expense stays as a VOID row with its reversed entry, like every other spec
 * that records one.
 *
 * The backend e2e (expense-edit-recorded.e2e-spec.ts) covers the ledger rules
 * (what reposts, what doesn't, cleared payments, locks); this covers the screens.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { fillStable, gotoReady, openCustomSelect } from './utils'

const recordedIds: string[] = []

test.afterEach(async ({ request }) => {
  for (const id of recordedIds.splice(0)) {
    await request.post(`/api/expenses/${id}/void`).catch(() => {})
  }
})

async function pickCustom(page: Page, combo: Locator, option: string | RegExp): Promise<void> {
  await expect(async () => {
    await openCustomSelect(combo)
    await page.getByRole('option', { name: option }).first().click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

async function pickAccount(page: Page, name: string): Promise<void> {
  await expect(async () => {
    const account = page.locator('[aria-label="Account"]').first()
    await account.click()
    await account.fill(name)
    await page.locator('div.fixed button', { hasText: name }).first().click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

const payeeType = (page: Page) =>
  page.getByRole('combobox', { name: /^(— Select —|Customer|Supplier|Employee|Other)$/ }).first()

async function pickPaidFromAndDivision(page: Page): Promise<void> {
  await expect(async () => {
    await page.locator('[aria-label="Select source of fund"]').click()
    await page.locator('body > div.fixed button').nth(1).click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
  await expect(async () => {
    await page.locator('[aria-label="Division"]').first().click()
    await page.locator('body > div.fixed button').nth(1).click({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

/** Types in a ₱11,200 rent expense through the form and presses Record. */
async function recordRentThroughTheForm(
  page: Page
): Promise<{ id: string; journalEntryId: string }> {
  await gotoReady(page, '/accounting/expenses/new')
  await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible({ timeout: 15_000 })
  await pickCustom(page, payeeType(page), 'Supplier')
  await pickAccount(page, 'Rent Expense')
  await fillStable(page.locator('input[aria-label="Amount"]').first(), '11200')
  await fillStable(page.locator('input[aria-label="Description"]'), `E2E-EDIT-REC-${Date.now()}`)
  await pickPaidFromAndDivision(page)

  const [created] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/expenses') && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Record', exact: true }).click(),
  ])
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  recordedIds.push(id)
  await page.waitForResponse(
    (r) => r.url().endsWith(`/api/expenses/${id}/record`) && r.request().method() === 'POST'
  )

  const read = await page.request.get(`/api/expenses/${id}`)
  const body = await read.json()
  expect(body.status).toBe('RECORDED')
  return { id, journalEntryId: body.journalEntryId }
}

test.describe('Expenses — editing a recorded expense', () => {
  test('Edit is offered on a recorded expense, and saving a new amount re-posts its journal entry', async ({
    page,
  }) => {
    const { id, journalEntryId } = await recordRentThroughTheForm(page)

    // The detail page offers Edit beside Void.
    await gotoReady(page, `/accounting/expenses/${id}`)
    await page.getByRole('button', { name: 'More actions' }).first().click()
    await expect(page.getByRole('button', { name: /^Void/ })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Edit', exact: true }).click()

    // The form is the same one, but there is nothing left to record.
    await expect(page).toHaveURL(new RegExp(`/accounting/expenses/${id}/edit$`), {
      timeout: 15_000,
    })
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('This expense is already recorded.')).toBeVisible()
    await expect(page.getByTestId('expense-save-changes')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Record', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0)
    // Nothing is frozen on an ordinary expense.
    await expect(page.getByTestId('expense-edit-lock')).toHaveCount(0)

    await fillStable(page.locator('input[aria-label="Amount"]').first(), '22400')
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/expenses/${id}`) && r.request().method() === 'PATCH'
      ),
      page.getByTestId('expense-save-changes').click(),
    ])
    expect(saved.status()).toBe(200)

    // Back on the expense's own page, showing the new figure.
    await expect(page).toHaveURL(new RegExp(`/accounting/expenses/${id}$`), { timeout: 15_000 })
    await expect(page.getByText('₱22,400.00').first()).toBeVisible({ timeout: 15_000 })

    const after = await (await page.request.get(`/api/expenses/${id}`)).json()
    expect(after.status).toBe('RECORDED')
    expect(after.totalAmount).toBe(22400)
    // The entry that stands is a new one; the old one was reversed.
    expect(after.journalEntryId).not.toBe(journalEntryId)
  })

  test('a note can be changed without touching the books', async ({ page }) => {
    const { id, journalEntryId } = await recordRentThroughTheForm(page)

    await gotoReady(page, `/accounting/expenses/${id}/edit`)
    await expect(page.getByTestId('expense-save-changes')).toBeVisible({ timeout: 15_000 })
    await fillStable(
      page.locator('textarea[aria-label="Notes"], textarea').first(),
      'Paid out of petty cash'
    )
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/expenses/${id}`) && r.request().method() === 'PATCH'
      ),
      page.getByTestId('expense-save-changes').click(),
    ])
    expect(saved.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`/accounting/expenses/${id}$`), { timeout: 15_000 })

    const after = await (await page.request.get(`/api/expenses/${id}`)).json()
    expect(after.journalEntryId).toBe(journalEntryId)
  })

  test('an expense whose amounts are frozen says so before anything is typed', async ({ page }) => {
    const { id } = await recordRentThroughTheForm(page)
    const reason = 'Its payee, accounts and amounts are locked — void it and enter a new one.'
    // The lock itself comes from the server (covered by the backend e2e); this
    // is the screen's side of it, so the reason is injected into the read.
    await page.route(`**/api/expenses/${id}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const res = await route.fetch()
      const body = await res.json()
      await route.fulfill({ response: res, json: { ...body, editLock: reason } })
    })

    await gotoReady(page, `/accounting/expenses/${id}/edit`)
    await expect(page.getByTestId('expense-edit-lock')).toContainText(reason, { timeout: 15_000 })
  })

  test('a voided expense cannot be edited', async ({ page, request }) => {
    const { id } = await recordRentThroughTheForm(page)
    const voided = await request.post(`/api/expenses/${id}/void`)
    expect(voided.ok()).toBeTruthy()

    await gotoReady(page, `/accounting/expenses/${id}/edit`)
    await expect(page.getByText('A voided expense cannot be edited.')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId('expense-save-changes')).toHaveCount(0)
  })
})
