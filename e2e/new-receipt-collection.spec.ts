import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Docket NIG #90 — the simplified New Receipt form for a Collection.
//
// What the money does once saved (Monthly instalment takes it off ONE aging
// account, Customer deposit records a deposit, a Chart of Accounts pick posts
// straight to that account) is proved against the real database in the
// backend's test/acknowledgement-receipts-credit-entry.e2e-spec.ts. These
// check the screen: the fields, their order, what is gone, and what each
// payer can choose. Nothing here saves a receipt, so the suite leaves nothing
// behind (a receipt cannot be deleted through the API).

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

/** Opens New Receipt and switches it to Collection. Received in starts on
 * Cash on Hand once the bank list has loaded, which is the sign the form is
 * ready to be filled. */
async function openCollection(page: Page) {
  await gotoReady(page, '/pos/collections/acknowledgement/new')
  // The click can land before hydration, so each try is short and repeated.
  await expect(async () => {
    await page.locator('form input').first().click({ timeout: 3_000 })
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: 'Collection' })
      .first()
      .click({ timeout: 3_000 })
    await expect(page.getByRole('heading', { name: 'New Collection Receipt' })).toBeVisible({
      timeout: 2_000,
    })
  }).toPass({ timeout: 30_000 })
  await expect(page.getByLabel('Received in', { exact: true })).toHaveValue('Cash on Hand', {
    timeout: 20_000,
  })
}

const REMOVED = [
  'Cleared',
  'Clear Date',
  'Received in account',
  'Subsidy',
  'Withholding Tax',
  'Sales Invoice No.',
  'Net amount',
]

test('a Collection shows only the asked-for fields, in the asked-for order', async ({ page }) => {
  await openCollection(page)
  const text = await page.locator('form').innerText()
  const order = [
    'Receipt Type',
    'Branch',
    'Date',
    'Reference',
    'Payer name',
    'Description',
    'Received in',
    'Credit entry',
    'Amount',
  ]
  const at = order.map((label) => text.indexOf(label))
  expect(at.every((i, n) => i >= 0 && (n === 0 || i > at[n - 1]))).toBe(true)
  for (const gone of REMOVED) expect(text).not.toContain(gone)
  await expect(page.getByRole('button', { name: 'Save receipt' })).toBeVisible()
})

test('an Acknowledgement receipt keeps the full form', async ({ page }) => {
  await gotoReady(page, '/pos/collections/acknowledgement/new')
  const form = page.locator('form')
  for (const kept of REMOVED) await expect(form).toContainText(kept)
})

test('saving with required fields blank shows an error under each and saves nothing', async ({
  page,
}) => {
  await openCollection(page)
  await page.getByRole('button', { name: 'Save receipt' }).click()
  for (const message of [
    'Branch is required.',
    'Reference is required.',
    'Payer name is required.',
    'Credit entry is required.',
    'Amount is required.',
  ]) {
    await expect(page.getByText(message)).toBeVisible()
  }
  await expect(page).toHaveURL(/acknowledgement\/new/)
})

test('only a customer can credit Monthly instalment or Customer deposit', async ({ page }) => {
  await openCollection(page)
  await page.getByLabel('Credit entry', { exact: true }).click()
  const options = page.getByTestId('searchable-select-option')
  await expect(options.first()).toHaveText('Monthly instalment (MI)')
  await expect(options.nth(1)).toHaveText('Customer deposit')
  await page.locator('h1').click()

  await page.getByRole('radio', { name: 'Non-customer' }).click()
  await page.getByLabel('Credit entry', { exact: true }).click()
  await expect(options.first()).not.toHaveText('Monthly instalment (MI)')
  await expect(
    page.getByTestId('searchable-select-option').filter({ hasText: /^Customer deposit$/ })
  ).toHaveCount(0)
})

test('Aging account appears only for Monthly instalment, and says when the customer has none', async ({
  page,
}) => {
  const name = `E2E Collection Receipt ${Date.now()}`
  const res = await page.request.post('/api/crm/customers', {
    data: { name, customerType: 'individual', phone: '09170007788' },
  })
  createdCustomerId = (await res.json()).id

  await openCollection(page)
  await expect(page.getByLabel('Aging account', { exact: true })).toHaveCount(0)

  await page.getByText('Search customer…').first().click()
  await page.keyboard.type(name)
  await page.getByTestId('search-combobox-option').filter({ hasText: name }).first().click()

  await page.getByLabel('Credit entry', { exact: true }).click()
  await page
    .getByTestId('searchable-select-option')
    .filter({ hasText: /^Customer deposit$/ })
    .click()
  await expect(page.getByLabel('Aging account', { exact: true })).toHaveCount(0)

  await page.getByLabel('Credit entry', { exact: true }).click()
  await page
    .getByTestId('searchable-select-option')
    .filter({ hasText: 'Monthly instalment (MI)' })
    .click()
  const aging = page.getByLabel('Aging account', { exact: true })
  await expect(aging).toBeVisible()
  await expect(aging).toHaveAttribute('placeholder', 'No open aging accounts for this customer')
})
