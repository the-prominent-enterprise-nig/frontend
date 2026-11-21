import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Docket NIG #91 — a customer's deposit applied to an aging account.
//
// What the money does — a request reserves the deposit, an approval posts
// Dr Customer Deposits / Cr Accounts Receivable and lowers the account, a
// rejection or cancel gives it back, a Cashier cannot apply — is proved
// against the real database in the backend's
// test/customer-deposit-applications.e2e-spec.ts. These check the screens a
// reader meets: the Approvals & Reviews tab and page, and the Deposits card on
// a profile with no deposit. Nothing here saves a deposit or a request, so the
// suite leaves nothing behind (a receipt cannot be deleted through the API).

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

test('Approvals & Reviews has a Deposit Applications tab with a tab per status', async ({
  page,
}) => {
  await gotoReady(page, '/pos/deposit-applications')
  await expect(page.getByRole('heading', { name: 'Deposit Applications' })).toBeVisible({
    timeout: 30_000,
  })
  // The hub's own strip lists it, and it is the page the strip is on.
  await expect(page.getByRole('link', { name: 'Deposit Applications' })).toBeVisible()
  for (const status of ['Pending', 'Applied', 'Rejected', 'Cancelled']) {
    await expect(page.getByRole('radio', { name: status })).toBeVisible()
  }
  // Pending is where it opens.
  await expect(page.getByRole('radio', { name: 'Pending' })).toBeChecked()
})

test('a profile with no deposit says so, offers no Apply deposit and shows no Deposit chip', async ({
  page,
}) => {
  // No "Deposit" in the name: the chip check below reads the header's text.
  const name = `E2E Profile Card ${Date.now()}`
  const res = await page.request.post('/api/crm/customers', {
    data: { name, customerType: 'individual', phone: '09170007799' },
  })
  createdCustomerId = (await res.json()).id

  await gotoReady(page, `/crm/customers/${createdCustomerId}`)
  const card = page.getByTestId('deposits-card')
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(card).toContainText('No deposits for this customer.')
  await expect(card.getByTestId('deposit-unapplied')).toContainText('0.00')
  await expect(card.getByRole('button', { name: 'Apply deposit' })).toHaveCount(0)
  await expect(card.getByTestId('deposit-view-only')).toHaveCount(0)
  await expect(
    page.locator('header').filter({ hasText: 'Customer ID' }).getByText('Deposit')
  ).toHaveCount(0)
  // No loaded account, so no net-due summary either.
  await expect(page.getByTestId('aging-deposit-summary')).toHaveCount(0)
})
